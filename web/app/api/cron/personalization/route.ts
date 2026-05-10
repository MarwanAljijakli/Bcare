/**
 * Vercel Cron — nightly personalization recompute.
 *
 * Schedule: daily at 03:00 UTC (configured in vercel.json `crons`).
 *
 * What it does (no LLM, no upstream API, $0 cost):
 *   1. For every child with deleted_at IS NULL, runs recomputeChild()
 *      from web/src/server/personalization/.
 *   2. Audit-logs a single `personalization_recomputed` row with
 *      aggregate counters in metadata.
 *
 * Auth: Vercel Cron sends a Bearer token in `Authorization` matching
 * `process.env.CRON_SECRET`. If the secret isn't set, the route still
 * runs (degraded posture for dev) but in production the absence of
 * `CRON_SECRET` would mean any caller can trigger expensive
 * recomputes. Our recompute is $0, so even without auth the only
 * downside is wasted CPU — but we still gate it.
 *
 * Idempotent: running twice in the same day produces the same end state.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { recomputeAll } from '@/server/personalization';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Allow cron handlers to run for up to 60s — recompute takes <2s/child
// today; this gives headroom to ~30 children before we need to shard.
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (expected) {
    const provided = req.headers.get('authorization');
    if (provided !== `Bearer ${expected}`) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
  }

  const supabaseAdmin = createSupabaseAdminClient();
  const startedAt = Date.now();
  let children = 0;
  let totalSuggestions = 0;
  let totalAdvances = 0;
  try {
    const summary = await recomputeAll(supabaseAdmin as never);
    children = summary.children;
    for (const r of summary.results) {
      totalSuggestions += r.suggestionsCreated;
      if (r.levelAdvanced) totalAdvances++;
    }

    // Audit-log the run. actor_id null = system action.
    await (
      supabaseAdmin.from('audit_log') as never as {
        insert: (row: {
          actor_id: null;
          action: string;
          target_type: string;
          target_id: null;
          metadata: Record<string, unknown>;
        }) => Promise<unknown>;
      }
    ).insert({
      actor_id: null,
      action: 'admin_action',
      target_type: 'personalization',
      target_id: null,
      metadata: {
        kind: 'personalization_recomputed',
        children,
        suggestionsCreated: totalSuggestions,
        levelAdvances: totalAdvances,
        durationMs: Date.now() - startedAt,
      },
    });

    return NextResponse.json({
      ok: true,
      children,
      suggestionsCreated: totalSuggestions,
      levelAdvances: totalAdvances,
      durationMs: Date.now() - startedAt,
    });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error: e instanceof Error ? e.message : 'internal_error',
        durationMs: Date.now() - startedAt,
      },
      { status: 500 },
    );
  }
}

/**
 * POST mirror — useful for manual triggering from a server-only context
 * (admin tools, CI) without depending on the cron schedule.
 */
export async function POST(req: NextRequest) {
  return GET(req);
}
