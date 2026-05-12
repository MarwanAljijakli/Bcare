/**
 * /api/health/voice — Quality Fix Phase 6 monitoring probe.
 *
 * Returns:
 *   200 {
 *     ok: true,
 *     elevenLabsConfigured, whisperConfigured, claudeReachable,
 *     ttsCalls30d, ttsCacheHits30d, ttsCacheHitRate30d,
 *     sttCalls30d, claudeCalls30d, totalCostUsd30d,
 *     timestamp
 *   }
 *   503 on internal error.
 *
 * Used by:
 *   • Vercel uptime monitoring — flags when the cache hit rate dips
 *     below 60% (the Quality Fix target) so we can investigate before
 *     ElevenLabs costs balloon.
 *   • The ops dashboard — surfaces "is voice configured / reachable
 *     right now."
 */
import { NextResponse } from 'next/server';
import { isClaudeAvailable, claudeDirect } from '@/lib/ai/anthropic';
import {
  cacheStats30d,
  fallbackProvider,
  isElevenLabsAvailable,
  isOpenAiTtsAvailable,
  isWhisperAvailable,
  primaryProvider,
} from '@/lib/voice';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface UsageRow {
  service: string;
  cost_usd: number;
  units: number;
  created_at: string;
}

export async function GET() {
  try {
    const { createSupabaseAdminClient } = await import('@/lib/supabase/server');
    const supabaseAdmin = createSupabaseAdminClient();

    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const usageRes = await (
      supabaseAdmin.from('ai_usage_ledger') as never as {
        select: (cols: string) => {
          gte: (col: string, v: string) => Promise<{ data: UsageRow[] | null }>;
        };
      }
    )
      .select('service, cost_usd, units, created_at')
      .gte('created_at', since);
    const usage = usageRes.data ?? [];
    const ttsCalls = usage.filter((u) => u.service === 'elevenlabs_tts').length;
    const sttCalls = usage.filter((u) => u.service === 'whisper_stt').length;
    const claudeCalls = usage.filter((u) => u.service.startsWith('claude_')).length;
    const totalCost = usage.reduce((sum, u) => sum + Number(u.cost_usd ?? 0), 0);

    // Phase 8.B fallback telemetry. Fallback triggers are recorded as
    // azure_tts rows with units=0 + cost=0 (see voice/index.ts:
    // recordFallbackTrigger). Module 9 enum cleanup will split this
    // into a dedicated service value; for now this works without a
    // migration.
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const todayIso = today.toISOString();
    const fallbackRows = usage.filter(
      (u) =>
        u.service === 'azure_tts' && Number(u.units ?? 0) === 0 && Number(u.cost_usd ?? 0) === 0,
    );
    const fallbackCountToday = fallbackRows.filter((u) => u.created_at >= todayIso).length;
    const lastFallbackAt = fallbackRows.length
      ? fallbackRows.reduce((max, u) => (u.created_at > max ? u.created_at : max), '')
      : null;

    const cacheStats = await cacheStats30d(supabaseAdmin as never);

    let claudeReachable = false;
    let claudeLatencyMs: number | null = null;
    if (isClaudeAvailable()) {
      const startedAt = Date.now();
      try {
        await claudeDirect({
          system: 'Reply with exactly "ok".',
          user: 'health',
          max_tokens: 4,
          temperature: 0,
        });
        claudeReachable = true;
        claudeLatencyMs = Date.now() - startedAt;
      } catch {
        claudeReachable = false;
      }
    }

    return NextResponse.json({
      ok: true,
      elevenLabsConfigured: isElevenLabsAvailable(),
      openAiTtsConfigured: isOpenAiTtsAvailable(),
      whisperConfigured: isWhisperAvailable(),
      claudeConfigured: isClaudeAvailable(),
      claudeReachable,
      claudeLatencyMs,
      // Phase 8.B — which provider is primary right now (per VOICE_PROVIDER_PRIMARY env)?
      primaryProvider: primaryProvider(),
      fallbackProvider: fallbackProvider(),
      // Phase 9.A — per-locale primary (EN=openai, AR=elevenlabs after the
      // 2026-05-12 native-speaker acceptance test).
      primaryProviderEn: primaryProvider('en'),
      primaryProviderAr: primaryProvider('ar'),
      lastFallbackAt,
      fallbackCountToday,
      ttsCalls30d: ttsCalls,
      ttsCacheHits30d: cacheStats.ttsCacheHits,
      ttsCacheHitRate30d: cacheStats.ttsCacheHitRate,
      sttCalls30d: sttCalls,
      claudeCalls30d: claudeCalls,
      totalCostUsd30d: Math.round(totalCost * 1_000_000) / 1_000_000,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error: e instanceof Error ? e.message : 'unknown_error',
      },
      { status: 503 },
    );
  }
}
