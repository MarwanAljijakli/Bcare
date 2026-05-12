/**
 * Vercel Cron — nightly voice cache pre-warm.
 *
 * Schedule: daily at 02:30 UTC (configured in vercel.json `crons`).
 *
 * For every active child (`deleted_at IS NULL`), runs both:
 *   • `prewarmChildVocabulary(childId)` — synthesizes-and-caches every
 *     symbol label on the child's board in their current voice.
 *   • `prewarmCommonPhrases(childId)` — synthesizes the 30 bilingual
 *     conversational phrases shared across every child.
 *
 * Idempotent: every target is HEAD-probed against the storage bucket
 * before the upstream call fires. Already-cached entries skip both the
 * synth call AND the aiGuard ledger write — re-running the cron mid-day
 * is free.
 *
 * Auth: Vercel Cron sends `Authorization: Bearer ${CRON_SECRET}`. When
 * the env var is missing, the route still runs (degraded posture for
 * dev) but production should always have it set.
 *
 * Cost ceiling: bounded by the per-child monthly cap in `aiGuard`. A
 * fully cold child takes ~189 calls (159 vocab × 2 langs + 30 common ×
 * 2 langs ≈ 378, but every entry is a HEAD-probe + skip after the
 * first warm run) which is well inside the $20/month cap.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { prewarmChildVocabulary, prewarmCommonPhrases } from '@/lib/voice/prewarm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // pre-warm can take 1-2 minutes per cold child

interface ChildRow {
  id: string;
  voice_id: string | null;
  voice_speed: number | string | null;
}

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

  const childRes = await (
    supabaseAdmin.from('children') as never as {
      select: (cols: string) => {
        is: (col: string, v: null) => Promise<{ data: ChildRow[] | null }>;
      };
    }
  )
    .select('id, voice_id, voice_speed')
    .is('deleted_at', null);
  const children = childRes.data ?? [];

  let totalAttempted = 0;
  let totalHits = 0;
  let totalSynthesized = 0;
  let totalFailed = 0;

  for (const c of children) {
    const voice = (c.voice_id === 'sarah' ? 'sarah' : 'charlotte') as 'charlotte' | 'sarah';
    const speed = c.voice_speed ? Number(c.voice_speed) : 1.0;

    try {
      const vocab = await prewarmChildVocabulary({
        supabaseAdmin: supabaseAdmin as never,
        childId: c.id,
        voice,
        speed: Number.isFinite(speed) ? speed : 1.0,
      });
      const common = await prewarmCommonPhrases({
        supabaseAdmin: supabaseAdmin as never,
        childId: c.id,
        voice,
        speed: Number.isFinite(speed) ? speed : 1.0,
      });
      totalAttempted += vocab.attempted + common.attempted;
      totalHits += vocab.cacheHits + common.cacheHits;
      totalSynthesized += vocab.synthesized + common.synthesized;
      totalFailed += vocab.failed + common.failed;
    } catch (e) {
      console.error('prewarm failed for', c.id, e instanceof Error ? e.message : String(e));
      totalFailed++;
    }
  }

  // Audit-log so we can monitor coverage rates over time.
  try {
    await (
      supabaseAdmin.from('audit_log') as never as {
        insert: (row: Record<string, unknown>) => Promise<unknown>;
      }
    ).insert({
      actor_id: null,
      action: 'admin_action',
      target_type: 'voice_prewarm',
      target_id: null,
      metadata: {
        kind: 'voice_prewarm_run',
        children: children.length,
        attempted: totalAttempted,
        cacheHits: totalHits,
        synthesized: totalSynthesized,
        failed: totalFailed,
        durationMs: Date.now() - startedAt,
      },
    });
  } catch {
    /* swallow — telemetry is best-effort */
  }

  return NextResponse.json({
    ok: true,
    children: children.length,
    attempted: totalAttempted,
    cacheHits: totalHits,
    synthesized: totalSynthesized,
    failed: totalFailed,
    durationMs: Date.now() - startedAt,
  });
}

export async function POST(req: NextRequest) {
  return GET(req);
}
