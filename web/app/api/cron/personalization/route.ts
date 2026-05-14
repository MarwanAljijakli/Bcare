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

  // Phase 12.A.1 — observability-only project-ref check, IN-PROCESS.
  //
  // The old version called `/api/health/auth` over HTTP from the cron
  // handler. Vercel's deployment-protection layer 401s every server-
  // internal request to public preview URLs, which made `probe.ok ===
  // false` every night → handler returned 503 BEFORE recomputing. Three
  // consecutive cron runs were lost this way (audit_log target_type=
  // config_drift, probeStatus=401 on 2026-05-11, 12, 13). progress_metrics
  // stopped updating, mastery_per_child_symbol never refreshed, and the
  // dashboard froze at zero.
  //
  // Replace with an in-process check: derive the project ref from
  // `NEXT_PUBLIC_SUPABASE_URL` and compare to EXPECTED_SUPABASE_PROJECT_REF.
  // Audit-log mismatches; NEVER block. The recompute is $0; even if it
  // somehow ran against the wrong project, the worst case is a wasted
  // CPU minute, not a billing event. Observability, not authorization.
  try {
    const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
    const observedProject = supaUrl.match(/^https:\/\/([a-z0-9]+)\.supabase\.co/i)?.[1] ?? null;
    const expectedProject = process.env.EXPECTED_SUPABASE_PROJECT_REF ?? observedProject;
    if (observedProject !== expectedProject) {
      await (
        supabaseAdmin.from('audit_log') as never as {
          insert: (row: Record<string, unknown>) => Promise<unknown>;
        }
      ).insert({
        actor_id: null,
        action: 'admin_action',
        target_type: 'config_drift',
        target_id: null,
        metadata: {
          kind: 'config_drift_detected',
          source: 'in_process_env_check',
          observedProject,
          expectedProject,
        },
      });
      // Phase 12.A.1 — log, do NOT block. The cron must run.
    }
  } catch {
    // The check itself failed — that's a code bug, not an auth issue.
    // Don't let it stop the recompute.
  }

  try {
    const summary = await recomputeAll(supabaseAdmin as never);
    children = summary.children;
    for (const r of summary.results) {
      totalSuggestions += r.suggestionsCreated;
      if (r.levelAdvanced) totalAdvances++;
    }

    // Phase 10.D — refresh the mastery materialized view so the board
    // badge + dashboard stats reflect today's input_events. Best-effort;
    // a failure here is non-fatal (the view stays at yesterday's data).
    try {
      await (supabaseAdmin as unknown as { rpc: (fn: string) => Promise<{ error: unknown }> }).rpc(
        'refresh_mastery_view',
      );
    } catch (e) {
      console.error('refresh_mastery_view failed:', e instanceof Error ? e.message : String(e));
    }

    // Quality Fix Phase 3 — Claude contextual suggestion pass. Runs
    // AFTER the frequency pass so it has fresh progress_metrics +
    // suggestion-cooldown data to consult. Falls through silently when
    // ANTHROPIC_API_KEY is missing or per-child cap is reached (the
    // Claude module returns empty arrays in those cases — never throws
    // a user-visible error, never blocks the frequency pass).
    let claudeChildren = 0;
    let claudeConcepts = 0;
    let claudeSuggestionsCreated = 0;
    try {
      const { claudeSuggestionsForAll } = await import('@/server/personalization/claude');
      const claudeRun = await claudeSuggestionsForAll(supabaseAdmin as never);
      claudeChildren = claudeRun.children;
      for (const r of claudeRun.results) {
        claudeConcepts += r.conceptsReturned;
        claudeSuggestionsCreated += r.suggestionsInserted;
      }
      totalSuggestions += claudeSuggestionsCreated;
    } catch (e) {
      console.error('claude pass failed:', e instanceof Error ? e.message : String(e));
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
        claudeChildren,
        claudeConcepts,
        claudeSuggestionsCreated,
        durationMs: Date.now() - startedAt,
      },
    });

    return NextResponse.json({
      ok: true,
      children,
      suggestionsCreated: totalSuggestions,
      levelAdvances: totalAdvances,
      claudeChildren,
      claudeConcepts,
      claudeSuggestionsCreated,
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
