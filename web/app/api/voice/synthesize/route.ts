/**
 * /api/voice/synthesize — Quality Fix Phase 2.
 *
 * POST { text, voice_key?, language, child_id, speed? } →
 *   200 { url, cached, durationMs, cost_usd, voice, provider }
 *   429 { error: 'cap_reached', remainingUsd, monthlyCapUsd }
 *   400 { error: 'invalid_input', detail }
 *   503 { error: 'voice_unavailable', detail }
 *
 * Server-side ElevenLabs Multilingual v2 synthesis with mandatory
 * Supabase Storage caching. Browser SpeechSynthesis is GONE — when the
 * key is missing OR the cap is reached, the caller surfaces a friendly
 * disabled state. NEVER falls back to browser voices.
 *
 * Auth: takes the cookie-bound supabase session + verifies the
 * caregiver owns `child_id` (RLS check via `is_caregiver_of`). The
 * service-role admin client handles ai_usage_ledger writes since RLS
 * blocks normal inserts.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { speakPinned, speakWithFallback, type VoiceProvider } from '@/lib/voice';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RequestBody {
  text?: string;
  language?: string;
  child_id?: string;
  voice_key?: string;
  speed?: number;
  /** Optional — when set to 'elevenlabs' | 'openai', pins to that
   *  provider with no fallback. Used by the /voice-test A/B UI to
   *  compare providers head-to-head. When omitted, the normal
   *  primary→fallback chain fires. */
  provider?: string;
}

function badRequest(detail: string) {
  return NextResponse.json({ error: 'invalid_input', detail }, { status: 400 });
}

export async function POST(req: NextRequest) {
  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return badRequest('body must be JSON');
  }
  const text = (body.text ?? '').toString().trim();
  const language = body.language;
  const childId = body.child_id;
  const voiceKey = body.voice_key as 'charlotte' | 'sarah' | undefined;
  const speed = typeof body.speed === 'number' ? body.speed : 1.0;
  const pinned: VoiceProvider | undefined =
    body.provider === 'elevenlabs' || body.provider === 'openai'
      ? (body.provider as VoiceProvider)
      : undefined;
  if (body.provider !== undefined && pinned === undefined) {
    return badRequest('provider must be elevenlabs|openai');
  }
  if (!text) return badRequest('text required');
  if (text.length > 5000) return badRequest('text too long');
  if (language !== 'en' && language !== 'ar') return badRequest('language must be en|ar');
  if (typeof childId !== 'string' || childId.length === 0) return badRequest('child_id required');
  if (voiceKey && voiceKey !== 'charlotte' && voiceKey !== 'sarah')
    return badRequest('voice_key invalid');

  const startedAt = Date.now();
  try {
    const { createSupabaseServerClient, createSupabaseAdminClient } =
      await import('@/lib/supabase/server');
    const supabase = await createSupabaseServerClient();
    const supabaseAdmin = createSupabaseAdminClient();

    // Verify the caller owns the child. RLS on `children` enforces this
    // for the cookie-bound client; selecting it as the calling user
    // returns a row only when they're the caregiver (or have a valid
    // therapist_grant in a future module).
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
    if (!childRow) {
      return NextResponse.json({ error: 'not_authorized' }, { status: 403 });
    }

    const result = pinned
      ? await speakPinned({
          text,
          locale: language,
          voice: voiceKey,
          speed,
          childId,
          supabaseAdmin: supabaseAdmin as never,
          provider: pinned,
        })
      : await speakWithFallback({
          text,
          locale: language,
          voice: voiceKey,
          speed,
          childId,
          supabaseAdmin: supabaseAdmin as never,
        });
    if (!result.ok) {
      // cap_reached
      return NextResponse.json(
        {
          error: result.reason,
          remainingUsd: result.remainingUsd,
          monthlyCapUsd: result.monthlyCapUsd,
        },
        { status: 429 },
      );
    }

    const durationMs = Date.now() - startedAt;
    return NextResponse.json({
      url: result.result.audioUrl,
      cached: result.result.cacheHit,
      durationMs,
      cost_usd: result.result.cost_usd,
      voice: result.result.voice,
      provider: result.result.provider,
      fallback_trigger: result.result.fallback_trigger ?? null,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'unknown_error';
    if (message === 'voice_unavailable') {
      return NextResponse.json(
        {
          error: 'voice_unavailable',
          detail:
            'Voice service is not configured for this deployment. Admin needs to set ELEVENLABS_API_KEY.',
        },
        { status: 503 },
      );
    }
    return NextResponse.json(
      { error: 'synthesize_failed', detail: message.slice(0, 240) },
      { status: 502 },
    );
  }
}
