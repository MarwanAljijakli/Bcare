/**
 * Voice preview endpoint — Quality Fix Phase 2.
 *
 * Sample-phrase TTS preview for the onboarding wizard's voice-selection
 * step + the per-child settings voice picker. Calls the real
 * /api/voice/synthesize pipeline so the preview the caregiver hears is
 * EXACTLY the same audio they'll hear on the board (cache-coupled).
 *
 * GET /api/voice-preview?voice=charlotte&locale=en&child_id=<uuid>
 *   → 302 to the public audio URL on success
 *   → 503 when ELEVENLABS_API_KEY is missing
 *   → 429 when the per-child monthly cap is reached
 *
 * The voice-test page hits this with hard-coded sample phrases (3 EN +
 * 3 AR per directive) so a native Arabic speaker can spot-check
 * intelligibility.
 *
 * No mock provider, no browser SpeechSynthesis fallback. Quality is the
 * product per the Quality Fix override.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { speakWithFallback } from '@/lib/voice';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SAMPLE_PHRASES = {
  en: 'Hello! I am happy to talk with you today.',
  ar: 'مرحبا! أنا سعيد بأن أتحدث معك اليوم.',
};

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const voice = (url.searchParams.get('voice') ?? 'charlotte') as 'charlotte' | 'sarah';
  const locale = (url.searchParams.get('locale') ?? 'en') as 'en' | 'ar';
  const text = url.searchParams.get('text') ?? SAMPLE_PHRASES[locale];
  const childId = url.searchParams.get('child_id');
  if (!childId) {
    return NextResponse.json({ error: 'child_id required' }, { status: 400 });
  }
  if (voice !== 'charlotte' && voice !== 'sarah') {
    return NextResponse.json({ error: 'voice must be charlotte|sarah' }, { status: 400 });
  }
  if (locale !== 'en' && locale !== 'ar') {
    return NextResponse.json({ error: 'locale must be en|ar' }, { status: 400 });
  }

  try {
    const { createSupabaseServerClient, createSupabaseAdminClient } =
      await import('@/lib/supabase/server');
    const supabase = await createSupabaseServerClient();
    const supabaseAdmin = createSupabaseAdminClient();

    // Verify the caller owns the child via RLS (same pattern as
    // /api/voice/synthesize).
    const { data: childRow } = await (
      supabase.from('children') as never as {
        select: (cols: string) => {
          eq: (
            col: string,
            v: string,
          ) => {
            maybeSingle: () => Promise<{ data: { id: string } | null }>;
          };
        };
      }
    )
      .select('id')
      .eq('id', childId)
      .maybeSingle();
    if (!childRow) return NextResponse.json({ error: 'not_authorized' }, { status: 403 });

    const result = await speakWithFallback({
      text,
      locale,
      voice,
      childId,
      supabaseAdmin: supabaseAdmin as never,
    });
    if (!result.ok) {
      return NextResponse.json(
        {
          error: result.reason,
          remainingUsd: result.remainingUsd,
          monthlyCapUsd: result.monthlyCapUsd,
        },
        { status: 429 },
      );
    }
    return NextResponse.redirect(result.result.audioUrl);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'unknown_error';
    if (message === 'voice_unavailable') {
      return NextResponse.json(
        {
          error: 'voice_unavailable',
          detail: 'Voice service is not configured. Admin needs to set ELEVENLABS_API_KEY.',
        },
        { status: 503 },
      );
    }
    return NextResponse.json(
      { error: 'preview_failed', detail: message.slice(0, 240) },
      { status: 502 },
    );
  }
}
