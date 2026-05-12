/**
 * Vercel Cron — weekly Claude-generated progress reports.
 *
 * Schedule: every Monday at 02:00 UTC (configured in vercel.json `crons`).
 *
 * For every active child, asks the analyzer to summarize the last 7
 * days of usage. The analyzer:
 *   - skips children with < 3 sessions (insufficient data)
 *   - respects the per-child monthly $20 aiGuard cap
 *   - hard-stops if a single generation would exceed $0.50
 *
 * Idempotent at the *day* level: re-running on the same Monday will
 * generate a second row — operators can clean up duplicates via SQL.
 * (We don't enforce uniqueness on (child, period_end) because manual
 * regenerations are useful + cheap and we don't want them blocked.)
 */

import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { analyzeChild } from '@/server/reports/claude-analyzer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// 5 minutes — analyzeChild does one Claude call per child; with the
// per-child cap + min-sessions skip, ~30 active children fits well.
export const maxDuration = 300;

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

  // Get every active child profile.
  const childrenRes = await (
    supabaseAdmin.from('children') as never as {
      select: (cols: string) => {
        is: (col: string, v: null) => Promise<{ data: { id: string }[] | null }>;
      };
    }
  )
    .select('id')
    .is('deleted_at', null);
  const childIds = (childrenRes.data ?? []).map((r) => r.id);

  // Period: last 7 days, ending now (UTC).
  const periodEnd = new Date();
  const periodStart = new Date(periodEnd.getTime() - 7 * 24 * 60 * 60 * 1000);

  let generated = 0;
  let skippedInsufficient = 0;
  let skippedCap = 0;
  let skippedCost = 0;
  let totalCost = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  for (const childId of childIds) {
    try {
      const r = await analyzeChild({
        supabaseAdmin: supabaseAdmin as never,
        childId,
        periodStart,
        periodEnd,
        periodType: 'weekly',
        generatedBy: 'cron',
      });
      totalCost += r.costUsd;
      totalInputTokens += r.inputTokens;
      totalOutputTokens += r.outputTokens;
      if (r.skipped === 'insufficient_data') skippedInsufficient++;
      else if (r.skipped === 'cap_reached') skippedCap++;
      else if (r.skipped === 'cost_too_high') skippedCost++;
      else generated++;
    } catch (e) {
      console.error('weekly-report failed for', childId, e instanceof Error ? e.message : e);
    }
  }

  // Audit-log the run.
  await (
    supabaseAdmin.from('audit_log') as never as {
      insert: (row: Record<string, unknown>) => Promise<unknown>;
    }
  ).insert({
    actor_id: null,
    action: 'admin_action',
    target_type: 'reports',
    target_id: null,
    metadata: {
      kind: 'weekly_reports_generated',
      children: childIds.length,
      generated,
      skippedInsufficient,
      skippedCap,
      skippedCost,
      totalCostUsd: Math.round(totalCost * 1_000_000) / 1_000_000,
      totalInputTokens,
      totalOutputTokens,
      durationMs: Date.now() - startedAt,
    },
  });

  return NextResponse.json({
    ok: true,
    children: childIds.length,
    generated,
    skippedInsufficient,
    skippedCap,
    skippedCost,
    totalCostUsd: Math.round(totalCost * 1_000_000) / 1_000_000,
    totalInputTokens,
    totalOutputTokens,
    durationMs: Date.now() - startedAt,
  });
}

export async function POST(req: NextRequest) {
  return GET(req);
}
