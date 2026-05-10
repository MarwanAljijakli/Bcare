/**
 * Lightweight liveness probe for the auth + Supabase data path.
 *
 * Why this exists: Module 2.A.1.fix taught us that a route handler can
 * still respond 200 to /api/health while production signup is broken
 * because of a trigger ordering bug or a project-ref drift. This
 * endpoint exercises the actual Supabase service-role path so a cheap
 * external probe can spot misroute or DB drift before users do.
 *
 * Behavior:
 *   • Calls supabase.auth.admin.listUsers({page:1, perPage:1}) — minimal
 *     read, no writes, no rate-limit risk. Returns {ok:true, supabaseProject}.
 *   • If the call fails OR the parsed project ref doesn't match the
 *     env-var URL, returns {ok:false, reason} with status 503.
 *
 * The Module 4 personalization cron also pings this endpoint and writes
 * an audit_log `config_drift_detected` row when it returns ok:false.
 */

import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function projectRefFromUrl(url: string | undefined): string | null {
  if (!url) return null;
  const m = url.match(/^https:\/\/([a-z0-9]+)\.supabase\.co\/?$/i);
  return m ? m[1]! : null;
}

export async function GET() {
  const expectedRef = projectRefFromUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
  if (!expectedRef) {
    return NextResponse.json({ ok: false, reason: 'no_supabase_url' }, { status: 503 });
  }

  try {
    const supabase = createSupabaseAdminClient();
    const res = await supabase.auth.admin.listUsers({ page: 1, perPage: 1 });
    if (res.error) {
      return NextResponse.json(
        {
          ok: false,
          reason: 'supabase_call_failed',
          message: res.error.message,
          supabaseProject: expectedRef,
        },
        { status: 503 },
      );
    }
    return NextResponse.json({
      ok: true,
      supabaseProject: expectedRef,
      // We deliberately do NOT report user counts — that's analytics on
      // child-impacting auth and is none of the probe's business.
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        reason: 'unexpected_error',
        message: e instanceof Error ? e.message : 'unknown',
        supabaseProject: expectedRef,
      },
      { status: 503 },
    );
  }
}
