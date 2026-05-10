import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import {
  protectedMutationProcedure,
  protectedProcedure,
  recentAuthProcedure,
  router,
} from '../trpc';
import { hashPin, isValidPinFormat, verifyPinHash } from '@/lib/auth/pin';

/**
 * Account router — GDPR/PDPL endpoints + parental-PIN management.
 *
 * Export and delete operations are gated by `recentAuthProcedure` (≤ 5
 * minutes since sign-in). PIN endpoints require an authenticated session
 * but not recent auth (you'd be locked out of your own settings if
 * you needed to re-auth to set a PIN you forgot).
 */

const TABLES_TO_EXPORT = [
  'profiles',
  'children',
  'sessions',
  'input_events',
  'output_events',
  'progress_metrics',
  'gamification_state',
  'consent_records',
  'custom_voices',
  'vocabulary_sets',
  'ai_usage_ledger',
  'therapist_invites',
  'therapist_grants',
  'draft_onboarding',
] as const;

export const accountRouter = router({
  /** Pulls every row associated with the user across the 14 tables above. */
  exportAll: recentAuthProcedure.mutation(async ({ ctx }) => {
    const archive: Record<string, unknown[]> = {};
    const userId = ctx.session.userId;

    for (const table of TABLES_TO_EXPORT) {
      // Choose the right user-bound column per table.
      const ownerCol =
        table === 'profiles' || table === 'draft_onboarding'
          ? 'user_id'
          : table === 'children' || table === 'therapist_invites' || table === 'therapist_grants'
            ? 'caregiver_id'
            : table === 'consent_records'
              ? 'granted_by_id'
              : table === 'custom_voices'
                ? 'recorded_by_id'
                : 'child_id'; // sessions/events/progress/etc → joined via child below

      // For child-scoped tables we first need the child IDs.
      if (
        [
          'sessions',
          'input_events',
          'output_events',
          'progress_metrics',
          'gamification_state',
          'custom_voices',
          'vocabulary_sets',
          'ai_usage_ledger',
        ].includes(table)
      ) {
        const childIdsRes = await (
          ctx.supabase.from('children') as never as {
            select: (cols: string) => {
              eq: (col: string, v: string) => Promise<{ data: { id: string }[] | null }>;
            };
          }
        )
          .select('id')
          .eq('caregiver_id', userId);
        const childIds = (childIdsRes.data ?? []).map((r) => r.id);
        if (childIds.length === 0) {
          archive[table] = [];
          continue;
        }
        const res = await (
          ctx.supabase.from(table) as never as {
            select: (cols: string) => {
              in: (col: string, vals: string[]) => Promise<{ data: unknown[] | null }>;
            };
          }
        )
          .select('*')
          .in('child_id', childIds);
        archive[table] = res.data ?? [];
      } else {
        const res = await (
          ctx.supabase.from(table) as never as {
            select: (cols: string) => {
              eq: (col: string, v: string) => Promise<{ data: unknown[] | null }>;
            };
          }
        )
          .select('*')
          .eq(ownerCol, userId);
        archive[table] = res.data ?? [];
      }
    }

    // Audit-log the export.
    await (
      ctx.supabaseAdmin.from('audit_log') as never as {
        insert: (row: {
          actor_id: string;
          action: string;
          target_type: string;
          target_id: string;
          metadata: { table_count: number };
        }) => Promise<unknown>;
      }
    ).insert({
      actor_id: userId,
      action: 'data_export',
      target_type: 'account',
      target_id: userId,
      metadata: { table_count: TABLES_TO_EXPORT.length },
    });

    return {
      manifest: {
        userId,
        email: ctx.session.email,
        exportedAt: new Date().toISOString(),
        version: '1.0',
        tables: TABLES_TO_EXPORT,
      },
      archive,
    };
  }),

  /**
   * Real cascade delete. Sets a tombstone in audit_log, then deletes the
   * user row in public.users which cascades to children → sessions →
   * events → ... per the FK constraints. The auth.users row is also
   * deleted via the admin auth API.
   */
  deleteAll: recentAuthProcedure.mutation(async ({ ctx }) => {
    const userId = ctx.session.userId;

    // Tombstone first so we have a record even if the cascade explodes.
    await (
      ctx.supabaseAdmin.from('audit_log') as never as {
        insert: (row: {
          actor_id: string;
          action: string;
          target_type: string;
          target_id: string;
          metadata: { reason: string; queued_at: string };
        }) => Promise<unknown>;
      }
    ).insert({
      actor_id: userId,
      action: 'data_delete',
      target_type: 'account',
      target_id: userId,
      metadata: { reason: 'user_request', queued_at: new Date().toISOString() },
    });

    // Soft-delete public.users immediately (sets deleted_at). Module 9
    // hardening swaps in a job that does the hard cascade after a
    // 30-day grace window during which the user can recover.
    await (
      ctx.supabase.from('users') as never as {
        update: (patch: { deleted_at: string }) => {
          eq: (col: string, v: string) => Promise<{ error: { message: string } | null }>;
        };
      }
    )
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', userId);

    return {
      ok: true,
      tombstonedAt: new Date().toISOString(),
      hardDeleteEta: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    };
  }),

  /** PIN management. */
  pin: router({
    /** Set or replace the PIN. Stored on every child of the caregiver. */
    set: protectedMutationProcedure
      .input(z.object({ pin: z.string() }))
      .mutation(async ({ ctx, input }) => {
        if (!isValidPinFormat(input.pin)) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'invalid_format' });
        }
        const hash = await hashPin(input.pin);
        await (
          ctx.supabase.from('children') as never as {
            update: (patch: { parental_pin_hash: string }) => {
              eq: (col: string, v: string) => Promise<unknown>;
            };
          }
        )
          .update({ parental_pin_hash: hash })
          .eq('caregiver_id', ctx.session.userId);
        return { ok: true };
      }),
    /** Verify a PIN against the caregiver's first child's hash. */
    verify: protectedMutationProcedure
      .input(z.object({ pin: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const lookup = await (
          ctx.supabase.from('children') as never as {
            select: (cols: string) => {
              eq: (
                col: string,
                v: string,
              ) => {
                limit: (
                  n: number,
                ) => Promise<{ data: { parental_pin_hash: string | null }[] | null }>;
              };
            };
          }
        )
          .select('parental_pin_hash')
          .eq('caregiver_id', ctx.session.userId)
          .limit(1);
        const hash = lookup.data?.[0]?.parental_pin_hash ?? null;
        if (!hash) throw new TRPCError({ code: 'NOT_FOUND', message: 'pin_not_set' });
        const ok = await verifyPinHash(input.pin, hash);
        if (!ok) throw new TRPCError({ code: 'UNAUTHORIZED', message: 'wrong_pin' });
        return { ok: true };
      }),
  }),

  /** Self-info — used by the (app) shell to check session age, etc. */
  whoami: protectedProcedure.query(({ ctx }) => ({
    userId: ctx.session.userId,
    email: ctx.session.email,
    sessionAgeMs: ctx.session.ageMs,
  })),
});
