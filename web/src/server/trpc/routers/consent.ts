import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { protectedMutationProcedure, protectedProcedure, router } from '../trpc';

/**
 * Consent router — list + revoke.
 *
 * Revocations write a NEW row with granted=false and metadata.action='revoke'
 * pointing at the original grant id. We never UPDATE or DELETE consent rows
 * — the historical timeline is the audit trail.
 */

const SCOPES = [
  'data_processing',
  'ai_personalization',
  'voice_recording',
  'webcam_processing',
  'analytics_dashboard',
] as const;

export const consentRouter = router({
  /** List the current user's consent rows in chronological order. */
  list: protectedProcedure.query(async ({ ctx }) => {
    const res = await (
      ctx.supabase.from('consent_records') as never as {
        select: (cols: string) => {
          eq: (
            col: string,
            v: string,
          ) => {
            order: (
              col: string,
              opts: { ascending: boolean },
            ) => Promise<{
              data: ConsentRow[] | null;
              error: { message: string } | null;
            }>;
          };
        };
      }
    )
      .select('id, scope, granted, policy_version, metadata, created_at, subject_child_id')
      .eq('granted_by_id', ctx.session.userId)
      .order('created_at', { ascending: false });
    if (res.error) {
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: res.error.message });
    }
    return res.data ?? [];
  }),

  /** Revoke a specific scope (writes a NEW row, never mutates). */
  revoke: protectedMutationProcedure
    .input(
      z.object({
        scope: z.enum(SCOPES),
        subjectChildId: z.string().uuid().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const row: ConsentInsertRow = {
        granted_by_id: ctx.session.userId,
        subject_child_id: input.subjectChildId ?? null,
        scope: input.scope,
        granted: false,
        policy_version: '2026-05-09.1',
        metadata: { action: 'revoke', source: 'settings/privacy' },
      };
      const res = await (
        ctx.supabase.from('consent_records') as never as {
          insert: (row: ConsentInsertRow) => Promise<{ error: { message: string } | null }>;
        }
      ).insert(row);
      if (res.error) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: res.error.message });
      }

      // Mirror to the audit log via the admin client (RLS denies regular
      // inserts to audit_log).
      await (
        ctx.supabaseAdmin.from('audit_log') as never as {
          insert: (row: {
            actor_id: string;
            action: string;
            target_type: string;
            target_id: string;
            metadata: { scope: string };
          }) => Promise<unknown>;
        }
      ).insert({
        actor_id: ctx.session.userId,
        action: 'consent_revoke',
        target_type: 'consent_records',
        target_id: input.subjectChildId ?? 'self',
        metadata: { scope: input.scope },
      });

      return { ok: true };
    }),
});

interface ConsentRow {
  id: string;
  scope: string;
  granted: boolean;
  policy_version: string;
  metadata: Record<string, unknown>;
  created_at: string;
  subject_child_id: string | null;
}

interface ConsentInsertRow {
  granted_by_id: string;
  subject_child_id: string | null;
  scope: string;
  granted: boolean;
  policy_version: string;
  metadata: Record<string, unknown>;
}
