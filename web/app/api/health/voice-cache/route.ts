/**
 * /api/health/voice-cache — Phase 10.A cache hit-rate probe.
 *
 * Returns the rolling-24h cache hit rate for TTS so we can spot
 * regressions in pre-warm coverage. Backed by `ai_usage_ledger`: every
 * TTS call writes a row; cache hits are recorded with `cost_usd = 0`
 * (the synth call short-circuits before the upstream charge fires).
 *
 *   hit_rate = count(cost_usd = 0) / count(*)  over the last 24h
 *
 * Target: ≥ 95% after the pre-warm cron has run at least once.
 */

import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabaseAdmin = createSupabaseAdminClient();
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const res = await (
      supabaseAdmin.from('ai_usage_ledger') as never as {
        select: (cols: string) => {
          in: (
            col: string,
            v: string[],
          ) => {
            gte: (
              col: string,
              v: string,
            ) => Promise<{
              data: { service: string; cost_usd: number; units: number }[] | null;
            }>;
          };
        };
      }
    )
      .select('service, cost_usd, units')
      .in('service', ['elevenlabs_tts', 'gpt_personalization'])
      .gte('created_at', since);
    const rows = res.data ?? [];
    const total = rows.length;
    const hits = rows.filter((r) => Number(r.cost_usd ?? 0) === 0).length;
    const synthesized = total - hits;
    const hitRate = total > 0 ? hits / total : 0;
    return NextResponse.json({
      ok: true,
      windowHours: 24,
      ttsCalls: total,
      ttsCacheHits: hits,
      ttsSynthesized: synthesized,
      ttsCacheHitRate: hitRate,
      target: 0.95,
      meetsTarget: hitRate >= 0.95 || total < 10,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, reason: e instanceof Error ? e.message : 'unknown' },
      { status: 503 },
    );
  }
}
