/**
 * Phase 12 — one-time backfill endpoint.
 *
 * The Phase 12 audit found that the personalization cron had been
 * bailing on a config_drift false positive for 3 consecutive nights.
 * Result: `progress_metrics.day` last refreshed 2026-05-10, the
 * `mastery_per_child_symbol` materialized view never refreshed since
 * creation (pg_class.reltuples = -1), and dashboard aggregates were
 * frozen for every child. Patch 2 (A.1) fixes the cron going forward,
 * but the existing data drift needs a manual nudge so caregivers see
 * fresh numbers without waiting for the next 03:00 UTC run.
 *
 * What this handler does:
 *   1. `rpc('refresh_mastery_view')` — refreshes the materialized view.
 *   2. For every non-deleted children row, calls `recomputeChild()`
 *      from the personalization module. Upserts today's
 *      progress_metrics, reorders vocabulary_sets, generates frequency
 *      suggestions, and advances vocabulary_level if mastery ≥ 80%.
 *   3. Returns a summary { mastery_refresh: ok, children: [...], errors: [...] }.
 *
 * Auth: same shape as /api/cron/personalization — Bearer token must
 * match `CRON_SECRET`. (Reusing the existing secret avoids adding a
 * new env var for a one-shot endpoint; if you want to revoke access
 * later, rotate CRON_SECRET.)
 *
 * Method: POST (the body is empty; POST is used so the route can't be
 * accidentally triggered by a browser preview/prefetch).
 *
 * Idempotent: safe to re-run. `refresh_mastery_view` rebuilds the
 * view; `recomputeChild` is the same idempotent function the nightly
 * cron uses.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { recomputeChild } from '@/server/personalization';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

interface ChildRow {
  id: string;
}

interface ChildResult {
  childId: string;
  ok: boolean;
  vocabUpdated?: number;
  suggestionsCreated?: number;
  metricsUpserted?: boolean;
  levelAdvanced?: unknown;
  error?: string;
}

export async function POST(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (expected) {
    const provided = req.headers.get('authorization');
    if (provided !== `Bearer ${expected}`) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
  }

  const supabaseAdmin = createSupabaseAdminClient();
  const startedAt = Date.now();

  // 1. Refresh the materialized view.
  let masteryRefreshOk = false;
  let masteryRefreshError: string | null = null;
  try {
    const rpc = await (
      supabaseAdmin as unknown as {
        rpc: (fn: string) => Promise<{ error: { message: string } | null }>;
      }
    ).rpc('refresh_mastery_view');
    if (rpc.error) {
      masteryRefreshError = rpc.error.message;
    } else {
      masteryRefreshOk = true;
    }
  } catch (e) {
    masteryRefreshError = e instanceof Error ? e.message : String(e);
  }

  // 2. List every non-deleted child.
  const childrenRes = await (
    supabaseAdmin.from('children') as never as {
      select: (cols: string) => {
        is: (col: string, v: null) => Promise<{ data: ChildRow[] | null; error: unknown }>;
      };
    }
  )
    .select('id')
    .is('deleted_at', null);
  const children = childrenRes.data ?? [];

  // 3. Recompute each one.
  const results: ChildResult[] = [];
  for (const c of children) {
    try {
      const r = await recomputeChild(supabaseAdmin as never, c.id);
      results.push({
        childId: c.id,
        ok: true,
        vocabUpdated: r.vocabUpdated,
        suggestionsCreated: r.suggestionsCreated,
        metricsUpserted: r.metricsUpserted,
        levelAdvanced: r.levelAdvanced,
      });
    } catch (e) {
      results.push({
        childId: c.id,
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  const durationMs = Date.now() - startedAt;
  const okCount = results.filter((r) => r.ok).length;

  // Audit-log the backfill so the operator can see when it ran.
  try {
    await (
      supabaseAdmin.from('audit_log') as never as {
        insert: (row: Record<string, unknown>) => Promise<unknown>;
      }
    ).insert({
      actor_id: null,
      action: 'admin_action',
      target_type: 'backfill',
      target_id: null,
      metadata: {
        kind: 'phase12_backfill',
        masteryRefreshOk,
        masteryRefreshError,
        childrenTotal: children.length,
        childrenOk: okCount,
        durationMs,
      },
    });
  } catch {
    /* audit-log is best-effort */
  }

  return NextResponse.json({
    ok: true,
    masteryRefreshOk,
    masteryRefreshError,
    children: children.length,
    childrenOk: okCount,
    childrenFailed: children.length - okCount,
    durationMs,
    results,
  });
}
