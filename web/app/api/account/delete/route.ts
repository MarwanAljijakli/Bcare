/**
 * POST /api/account/delete — GDPR/PDPL right-to-erasure endpoint.
 *
 * Tombstones the user immediately (sets `users.deleted_at`) and audit-logs
 * the request. A separate scheduled job (Module 9 hardening) performs the
 * cascade hard-delete after a 30-day grace window, including purge from
 * backups within their retention envelope.
 *
 * Gated by:
 *   1. CSRF double-submit cookie.
 *   2. Recent re-auth (≤ 5 minutes since sign-in / token refresh).
 *   3. Caller must hold the session being deleted (cannot delete another
 *      user — RLS UPDATE policy on `users` enforces caller_id == users.id).
 *
 * The endpoint also signs the caller out of their current session by
 * blanking the auth cookies — the next request will re-prompt for sign-in
 * but the account is already tombstoned.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { verifyCsrf, CsrfError } from '@/lib/auth/csrf';
import { requireRecentAuth, SessionError } from '@/lib/auth/session';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const GRACE_DAYS = 30;

export async function POST(req: NextRequest) {
  try {
    await verifyCsrf(req);
    const session = await requireRecentAuth();
    const supabase = await createSupabaseServerClient();
    const supabaseAdmin = createSupabaseAdminClient();
    const userId = session.userId;
    const tombstonedAt = new Date().toISOString();
    const hardDeleteEta = new Date(Date.now() + GRACE_DAYS * 24 * 60 * 60 * 1000).toISOString();

    // Audit FIRST — if anything else fails we still have a record.
    await (
      supabaseAdmin.from('audit_log') as never as {
        insert: (row: {
          actor_id: string;
          action: string;
          target_type: string;
          target_id: string;
          metadata: { reason: string; via: string; queued_at: string; eta: string };
        }) => Promise<unknown>;
      }
    ).insert({
      actor_id: userId,
      action: 'data_delete',
      target_type: 'account',
      target_id: userId,
      metadata: {
        reason: 'user_request',
        via: 'rest',
        queued_at: tombstonedAt,
        eta: hardDeleteEta,
      },
    });

    // Set the tombstone via the user's own (RLS-scoped) client. Module 9
    // promotes this to a hard-cascade delete at end of grace window.
    await (
      supabase.from('users') as never as {
        update: (patch: { deleted_at: string }) => {
          eq: (col: string, v: string) => Promise<{ error: { message: string } | null }>;
        };
      }
    )
      .update({ deleted_at: tombstonedAt })
      .eq('id', userId);

    // Sign the caller out so their cookie can't be used to "undelete" by
    // visiting other endpoints during the grace window.
    await supabase.auth.signOut();

    return NextResponse.json({
      ok: true,
      tombstonedAt,
      hardDeleteEta,
    });
  } catch (e) {
    if (e instanceof CsrfError) {
      return NextResponse.json({ error: 'csrf_invalid' }, { status: 403 });
    }
    if (e instanceof SessionError) {
      return NextResponse.json({ error: e.code }, { status: 401 });
    }
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
