/**
 * POST /api/account/export — GDPR/PDPL data-portability endpoint.
 *
 * Streams a JSON archive of every record we hold for the caller. Gated by:
 *   1. CSRF double-submit cookie (verifyCsrf).
 *   2. Recent re-auth (≤ 5 minutes since sign-in / token refresh).
 *
 * Audit-logs the export with action='data_export' so PDPL/GDPR DSAR
 * trails are intact even when the caller deletes their account afterwards.
 *
 * The same logic also lives in the tRPC `account.exportAll` procedure so
 * the dashboard can call it from a typed client. This REST wrapper exists
 * because regulators sometimes ask for an http-callable endpoint they
 * can hit from outside the app shell.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { verifyCsrf, CsrfError } from '@/lib/auth/csrf';
import { requireRecentAuth, SessionError } from '@/lib/auth/session';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TABLES = [
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

const CHILD_SCOPED = new Set([
  'sessions',
  'input_events',
  'output_events',
  'progress_metrics',
  'gamification_state',
  'custom_voices',
  'vocabulary_sets',
  'ai_usage_ledger',
]);

function ownerColumn(table: (typeof TABLES)[number]): string {
  if (table === 'profiles' || table === 'draft_onboarding') return 'user_id';
  if (table === 'children' || table === 'therapist_invites' || table === 'therapist_grants') {
    return 'caregiver_id';
  }
  if (table === 'consent_records') return 'granted_by_id';
  if (table === 'custom_voices') return 'recorded_by_id';
  return 'child_id';
}

export async function POST(req: NextRequest) {
  try {
    await verifyCsrf(req);
    const session = await requireRecentAuth();
    const supabase = await createSupabaseServerClient();
    const supabaseAdmin = createSupabaseAdminClient();
    const userId = session.userId;

    const archive: Record<string, unknown[]> = {};

    // First gather child IDs once.
    const childRes = await (
      supabase.from('children') as never as {
        select: (cols: string) => {
          eq: (col: string, v: string) => Promise<{ data: { id: string }[] | null }>;
        };
      }
    )
      .select('id')
      .eq('caregiver_id', userId);
    const childIds = (childRes.data ?? []).map((r) => r.id);

    for (const table of TABLES) {
      if (CHILD_SCOPED.has(table)) {
        if (childIds.length === 0) {
          archive[table] = [];
          continue;
        }
        const res = await (
          supabase.from(table) as never as {
            select: (cols: string) => {
              in: (col: string, vals: string[]) => Promise<{ data: unknown[] | null }>;
            };
          }
        )
          .select('*')
          .in('child_id', childIds);
        archive[table] = res.data ?? [];
      } else {
        const col = ownerColumn(table);
        const res = await (
          supabase.from(table) as never as {
            select: (cols: string) => {
              eq: (col: string, v: string) => Promise<{ data: unknown[] | null }>;
            };
          }
        )
          .select('*')
          .eq(col, userId);
        archive[table] = res.data ?? [];
      }
    }

    // Audit-log via service role so RLS doesn't block the insert.
    await (
      supabaseAdmin.from('audit_log') as never as {
        insert: (row: {
          actor_id: string;
          action: string;
          target_type: string;
          target_id: string;
          metadata: { table_count: number; via: string };
        }) => Promise<unknown>;
      }
    ).insert({
      actor_id: userId,
      action: 'data_export',
      target_type: 'account',
      target_id: userId,
      metadata: { table_count: TABLES.length, via: 'rest' },
    });

    const body = {
      manifest: {
        userId,
        email: session.email,
        exportedAt: new Date().toISOString(),
        version: '1.0',
        tables: TABLES,
      },
      archive,
    };

    return NextResponse.json(body, {
      headers: {
        'content-disposition': 'attachment; filename="bluecare-export.json"',
        'cache-control': 'private, no-store',
      },
    });
  } catch (e) {
    if (e instanceof CsrfError) {
      return NextResponse.json({ error: 'csrf_invalid' }, { status: 403 });
    }
    if (e instanceof SessionError) {
      const status = e.code === 'reauth_required' ? 401 : 401;
      return NextResponse.json({ error: e.code }, { status });
    }
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
