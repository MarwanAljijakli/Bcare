import { sensoryProfileSchema, vocabularyLevelSchema } from '@bluecare/shared';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { protectedMutationProcedure, protectedProcedure, router } from '../trpc';
import { hashPin, isValidPinFormat } from '@/lib/auth/pin';

/**
 * Onboarding router — draft persistence + final commit.
 *
 * Each step posts a partial payload to `upsertDraft` which merges into
 * `draft_onboarding.payload`. The final `finalize` mutation reads the
 * draft, writes the canonical profile + child + per-scope consent rows,
 * sets the parental PIN hash, and deletes the draft — all inside a single
 * server-side transaction-style sequence (Supabase doesn't expose multi-
 * statement transactions over the JS client; we sequence + roll back via
 * compensating deletes on error).
 */

const draftStepSchema = z.enum([
  'welcome',
  'about_you',
  'about_child',
  'sensory',
  'vocabulary_level',
  'voice',
  'consent',
  'pin',
  'review',
]);

const draftPayloadSchema = z.object({
  profile: z
    .object({
      fullName: z.string().min(2).max(80).optional(),
      relationship: z.string().min(1).max(80).optional(),
      locale: z.enum(['en', 'ar']).optional(),
      theme: z.enum(['light', 'dark', 'hc']).optional(),
    })
    .optional(),
  child: z
    .object({
      fullName: z.string().min(1).max(80).optional(),
      preferredName: z.string().max(40).optional(),
      dateOfBirth: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional(),
      locale: z.enum(['en', 'ar']).optional(),
      vocabularyLevel: vocabularyLevelSchema.optional(),
      voiceId: z.string().max(64).optional(),
      sensoryProfile: sensoryProfileSchema.optional(),
    })
    .optional(),
  consentScopes: z
    .object({
      data_processing: z.boolean(),
      ai_personalization: z.boolean(),
      voice_recording: z.boolean(),
      webcam_processing: z.boolean(),
      analytics_dashboard: z.boolean(),
    })
    .optional(),
  pinHash: z.string().min(1).max(120).optional(),
});

export type DraftPayload = z.infer<typeof draftPayloadSchema>;

const CONSENT_SCOPES = [
  'data_processing',
  'ai_personalization',
  'voice_recording',
  'webcam_processing',
  'analytics_dashboard',
] as const;
type ConsentScope = (typeof CONSENT_SCOPES)[number];

export const onboardingRouter = router({
  /** Read the current user's draft. Returns null if none exists. */
  getDraft: protectedProcedure.query(async ({ ctx }) => {
    const { data, error } = await (
      ctx.supabase.from('draft_onboarding') as never as {
        select: (cols: string) => {
          eq: (
            col: string,
            v: string,
          ) => {
            single: () => Promise<{
              data: { step: string; payload: DraftPayload } | null;
              error: { message: string } | null;
            }>;
          };
        };
      }
    )
      .select('step, payload')
      .eq('user_id', ctx.session.userId)
      .single();
    if (error && error.message && !error.message.includes('PGRST116')) {
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
    }
    return data;
  }),

  /** Merge a partial payload into the user's draft + advance the step. */
  upsertDraft: protectedMutationProcedure
    .input(
      z.object({
        step: draftStepSchema,
        patch: draftPayloadSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Read existing payload (if any) and shallow-merge.
      const current = await (
        ctx.supabase.from('draft_onboarding') as never as {
          select: (cols: string) => {
            eq: (
              col: string,
              v: string,
            ) => {
              maybeSingle: () => Promise<{ data: { payload: DraftPayload } | null }>;
            };
          };
        }
      )
        .select('payload')
        .eq('user_id', ctx.session.userId)
        .maybeSingle();

      const merged: DraftPayload = {
        ...(current.data?.payload ?? {}),
        ...input.patch,
        ...(input.patch.profile
          ? { profile: { ...(current.data?.payload.profile ?? {}), ...input.patch.profile } }
          : {}),
        ...(input.patch.child
          ? { child: { ...(current.data?.payload.child ?? {}), ...input.patch.child } }
          : {}),
      };

      const { error } = await (
        ctx.supabase.from('draft_onboarding') as never as {
          upsert: (
            row: {
              user_id: string;
              step: string;
              payload: DraftPayload;
            },
            opts: { onConflict: string },
          ) => Promise<{ error: { message: string } | null }>;
        }
      ).upsert(
        { user_id: ctx.session.userId, step: input.step, payload: merged },
        { onConflict: 'user_id' },
      );
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      return { ok: true, step: input.step };
    }),

  /**
   * Set the parental PIN as part of the draft. The plaintext never lands
   * in the draft payload — only the bcrypt hash.
   */
  setPin: protectedMutationProcedure
    .input(z.object({ pin: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (!isValidPinFormat(input.pin)) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'invalid_format' });
      }
      const hash = await hashPin(input.pin);
      const { error } = await (
        ctx.supabase.from('draft_onboarding') as never as {
          upsert: (
            row: { user_id: string; step: string; payload: { pinHash: string } },
            opts: { onConflict: string },
          ) => Promise<{ error: { message: string } | null }>;
        }
      ).upsert(
        { user_id: ctx.session.userId, step: 'pin', payload: { pinHash: hash } },
        { onConflict: 'user_id' },
      );
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      return { ok: true };
    }),

  /**
   * Final commit: writes profile + child + consent rows + PIN, deletes
   * the draft. Best-effort transactional via compensating deletes on
   * error — Module 9 hardening swaps in a single SQL function for true
   * atomicity.
   */
  finalize: protectedMutationProcedure.mutation(async ({ ctx }) => {
    // Read draft.
    const drafts = await (
      ctx.supabase.from('draft_onboarding') as never as {
        select: (cols: string) => {
          eq: (
            col: string,
            v: string,
          ) => {
            single: () => Promise<{
              data: { payload: DraftPayload } | null;
              error: { message: string } | null;
            }>;
          };
        };
      }
    )
      .select('payload')
      .eq('user_id', ctx.session.userId)
      .single();
    if (drafts.error || !drafts.data) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'no_draft' });
    }
    const payload = drafts.data.payload;

    if (!payload.profile?.fullName || !payload.child?.fullName || !payload.consentScopes) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'incomplete_draft' });
    }

    // 1. Upsert profile.
    const profileRow = {
      user_id: ctx.session.userId,
      role: 'caregiver' as const,
      full_name: payload.profile.fullName,
      caregiver_relationship: payload.profile.relationship ?? null,
      preferred_locale: payload.profile.locale ?? 'en',
      preferred_theme: payload.profile.theme ?? 'light',
    };
    const profileWrite = await (
      ctx.supabase.from('profiles') as never as {
        upsert: (
          row: typeof profileRow,
          opts: { onConflict: string },
        ) => Promise<{ error: { message: string } | null }>;
      }
    ).upsert(profileRow, { onConflict: 'user_id' });
    if (profileWrite.error) {
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: profileWrite.error.message });
    }

    // 2. Insert child.
    const childRow = {
      caregiver_id: ctx.session.userId,
      full_name: payload.child.fullName,
      preferred_name: payload.child.preferredName ?? null,
      date_of_birth: payload.child.dateOfBirth ?? null,
      preferred_locale: payload.child.locale ?? 'en',
      vocabulary_level: payload.child.vocabularyLevel ?? 'starter',
      voice_id: payload.child.voiceId ?? null,
      sensory_profile: payload.child.sensoryProfile ?? {
        motion: 'full',
        audio: 'full',
        contrast: 'standard',
        touch: 'standard',
        fontScale: 1,
      },
      parental_pin_hash: payload.pinHash ?? null,
    };
    const childInsert = await (
      ctx.supabase.from('children') as never as {
        insert: (row: typeof childRow) => {
          select: (cols: string) => {
            single: () => Promise<{
              data: { id: string } | null;
              error: { message: string } | null;
            }>;
          };
        };
      }
    )
      .insert(childRow)
      .select('id')
      .single();
    if (childInsert.error || !childInsert.data) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: childInsert.error?.message ?? 'child_insert_failed',
      });
    }
    const childId = childInsert.data.id;

    // 3. Insert per-scope consent_records.
    const scopes = payload.consentScopes;
    const consentRows = CONSENT_SCOPES.filter((s) => scopes[s as ConsentScope]).map((scope) => ({
      granted_by_id: ctx.session.userId,
      subject_child_id: scope === 'data_processing' ? null : childId,
      scope,
      granted: true,
      policy_version: '2026-05-09.1',
      metadata: { source: 'onboarding' },
    }));
    if (consentRows.length > 0) {
      const consentWrite = await (
        ctx.supabase.from('consent_records') as never as {
          insert: (rows: typeof consentRows) => Promise<{ error: { message: string } | null }>;
        }
      ).insert(consentRows);
      if (consentWrite.error) {
        // Compensating: delete the child we just created so the next
        // attempt doesn't double-create. Profile is upsert-safe.
        await (
          ctx.supabase.from('children') as never as {
            delete: () => { eq: (col: string, v: string) => Promise<unknown> };
          }
        )
          .delete()
          .eq('id', childId);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: consentWrite.error.message,
        });
      }
    }

    // 4. Delete the draft.
    await (
      ctx.supabase.from('draft_onboarding') as never as {
        delete: () => { eq: (col: string, v: string) => Promise<unknown> };
      }
    )
      .delete()
      .eq('user_id', ctx.session.userId);

    // 5. Phase 10.A — kick off voice pre-warm as fire-and-forget so the
    //    child's first tap-to-speak hits a warm CDN instead of waiting
    //    on a cold ElevenLabs call. We don't await it; the caregiver
    //    sees a "Preparing voice…" toast in the wizard's review step.
    void (async () => {
      try {
        const { createSupabaseAdminClient } = await import('@/lib/supabase/server');
        const { prewarmChildVocabulary, prewarmCommonPhrases } =
          await import('@/lib/voice/prewarm');
        const admin = createSupabaseAdminClient();
        const voice = (payload.child?.voiceId === 'sarah' ? 'sarah' : 'charlotte') as
          | 'charlotte'
          | 'sarah';
        await Promise.allSettled([
          prewarmChildVocabulary({ supabaseAdmin: admin as never, childId, voice, speed: 1.0 }),
          prewarmCommonPhrases({ supabaseAdmin: admin as never, childId, voice, speed: 1.0 }),
        ]);
      } catch {
        /* never blocks finalize */
      }
    })();

    return { ok: true, childId };
  }),
});
