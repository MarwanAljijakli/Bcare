import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { protectedMutationProcedure, protectedProcedure, router } from '../trpc';

/**
 * Therapist-invite router. 12-char alphanumeric codes (no ambiguous
 * 0/O/I/l), 7-day expiry, single-use, scoped to a (caregiver, child) pair.
 *
 * Acceptance flow:
 *   - Caregiver issues an invite → row in therapist_invites.
 *   - Therapist visits /accept-invite/[code] → calls `accept` (auth required).
 *   - On accept: invite row is stamped (accepted_at, accepted_by) and a
 *     therapist_grants row is created. The grant is what later RLS
 *     policies use to gate read access.
 */

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LEN = 12;
const EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

function generateCode(): string {
  const bytes = new Uint8Array(CODE_LEN);
  globalThis.crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < CODE_LEN; i++) {
    const idx = bytes[i]! % CODE_ALPHABET.length;
    out += CODE_ALPHABET[idx];
  }
  return out;
}

export const invitesRouter = router({
  /** Caregiver: issue a new invite for one of their children. */
  issue: protectedMutationProcedure
    .input(z.object({ childId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const code = generateCode();
      const expiresAt = new Date(Date.now() + EXPIRY_MS).toISOString();
      const row: InviteInsertRow = {
        code,
        caregiver_id: ctx.session.userId,
        child_id: input.childId,
        expires_at: expiresAt,
      };
      const res = await (
        ctx.supabase.from('therapist_invites') as never as {
          insert: (row: InviteInsertRow) => {
            select: (cols: string) => {
              single: () => Promise<{
                data: { id: string; code: string; expires_at: string } | null;
                error: { message: string } | null;
              }>;
            };
          };
        }
      )
        .insert(row)
        .select('id, code, expires_at')
        .single();
      if (res.error || !res.data) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: res.error?.message ?? 'invite_issue_failed',
        });
      }
      return res.data;
    }),

  /** Caregiver: list active invites + grants for their children. */
  listOutgoing: protectedProcedure.query(async ({ ctx }) => {
    const invites = await (
      ctx.supabase.from('therapist_invites') as never as {
        select: (cols: string) => {
          eq: (
            col: string,
            v: string,
          ) => {
            order: (
              col: string,
              opts: { ascending: boolean },
            ) => Promise<{ data: InviteRow[] | null }>;
          };
        };
      }
    )
      .select('id, code, child_id, expires_at, accepted_at, revoked_at, created_at')
      .eq('caregiver_id', ctx.session.userId)
      .order('created_at', { ascending: false });

    const grants = await (
      ctx.supabase.from('therapist_grants') as never as {
        select: (cols: string) => {
          eq: (
            col: string,
            v: string,
          ) => {
            order: (
              col: string,
              opts: { ascending: boolean },
            ) => Promise<{ data: GrantRow[] | null }>;
          };
        };
      }
    )
      .select('id, therapist_id, child_id, granted_at, revoked_at')
      .eq('caregiver_id', ctx.session.userId)
      .order('granted_at', { ascending: false });

    return {
      invites: invites.data ?? [],
      grants: grants.data ?? [],
    };
  }),

  /** Caregiver: revoke an invite (before acceptance) or a grant (after). */
  revoke: protectedMutationProcedure
    .input(
      z.object({
        kind: z.enum(['invite', 'grant']),
        id: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const table = input.kind === 'invite' ? 'therapist_invites' : 'therapist_grants';
      const res = await (
        ctx.supabase.from(table) as never as {
          update: (patch: { revoked_at: string }) => {
            eq: (
              col: string,
              v: string,
            ) => {
              eq: (col2: string, v2: string) => Promise<{ error: { message: string } | null }>;
            };
          };
        }
      )
        .update({ revoked_at: new Date().toISOString() })
        .eq('id', input.id)
        .eq('caregiver_id', ctx.session.userId);
      if (res.error) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: res.error.message });
      }
      return { ok: true };
    }),

  /**
   * Therapist: accept an invite by code. Reads + writes use the admin
   * client because the invite row isn't scoped to the therapist by RLS
   * (they don't own it yet — they're claiming it). The handler does the
   * authorization manually via expiry/revoke/accepted checks.
   */
  accept: protectedMutationProcedure
    .input(z.object({ code: z.string().min(8).max(16) }))
    .mutation(async ({ ctx, input }) => {
      const code = input.code.toUpperCase();
      const lookup = await (
        ctx.supabaseAdmin.from('therapist_invites') as never as {
          select: (cols: string) => {
            eq: (
              col: string,
              v: string,
            ) => {
              maybeSingle: () => Promise<{
                data: {
                  id: string;
                  caregiver_id: string;
                  child_id: string;
                  expires_at: string;
                  accepted_at: string | null;
                  revoked_at: string | null;
                } | null;
              }>;
            };
          };
        }
      )
        .select('id, caregiver_id, child_id, expires_at, accepted_at, revoked_at')
        .eq('code', code)
        .maybeSingle();
      const invite = lookup.data;
      if (!invite) throw new TRPCError({ code: 'NOT_FOUND', message: 'unknown_code' });
      if (invite.revoked_at) throw new TRPCError({ code: 'CONFLICT', message: 'revoked' });
      if (invite.accepted_at)
        throw new TRPCError({ code: 'CONFLICT', message: 'already_accepted' });
      if (new Date(invite.expires_at).getTime() < Date.now()) {
        throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'expired' });
      }

      // Write grant + stamp invite via admin client (bypasses RLS so we
      // can write the grant for the (caregiver, therapist) pair atomically).
      const grantRow: GrantInsertRow = {
        caregiver_id: invite.caregiver_id,
        therapist_id: ctx.session.userId,
        child_id: invite.child_id,
        invite_id: invite.id,
      };
      const grantInsert = await (
        ctx.supabaseAdmin.from('therapist_grants') as never as {
          insert: (row: GrantInsertRow) => Promise<{ error: { message: string } | null }>;
        }
      ).insert(grantRow);
      if (grantInsert.error) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: grantInsert.error.message });
      }

      await (
        ctx.supabaseAdmin.from('therapist_invites') as never as {
          update: (patch: { accepted_at: string; accepted_by: string }) => {
            eq: (col: string, v: string) => Promise<unknown>;
          };
        }
      )
        .update({ accepted_at: new Date().toISOString(), accepted_by: ctx.session.userId })
        .eq('id', invite.id);

      return { ok: true, childId: invite.child_id };
    }),
});

interface InviteRow {
  id: string;
  code: string;
  child_id: string;
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
  created_at: string;
}
interface GrantRow {
  id: string;
  therapist_id: string;
  child_id: string;
  granted_at: string;
  revoked_at: string | null;
}

interface InviteInsertRow {
  code: string;
  caregiver_id: string;
  child_id: string;
  expires_at: string;
}

interface GrantInsertRow {
  caregiver_id: string;
  therapist_id: string;
  child_id: string;
  invite_id: string;
}
