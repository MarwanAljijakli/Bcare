/**
 * Voice sample endpoint — onboarding voice-picker preview.
 *
 * Unlike `/api/voice-preview`, which talks to the real per-child
 * synthesize pipeline (cost-guarded, child_id required), this endpoint
 * exists ONLY to play a fixed 2-3 second sample so a caregiver can
 * compare voices BEFORE they've created a child profile. The audio is
 * deterministic per `(locale, voice)` pair, hard-coded sample text, and
 * cached in the same `tts-cache` Supabase Storage bucket as the rest of
 * the platform — so the second request for a given (locale, voice) is
 * a CDN-cached redirect with zero TTS spend.
 *
 * GET /api/voice-sample?locale=en|ar&voice=charlotte|sarah
 *   → 302 to the public MP3 URL
 *   → 400 on bad locale/voice
 *   → 503 if neither provider is configured
 *
 * Cache key uses the same hash scheme as `tryProvider` in
 * `web/src/lib/voice/index.ts` so a sample synthesized here is
 * indistinguishable from one synthesized by the real path — and a
 * future hit on the real path for the same exact phrase (unlikely
 * but possible) reuses the same cached MP3.
 *
 * No aiGuard / child_id / cost ledger row is written. The set of
 * sample bytes is tiny (2 locales × 2 voices = 4 cache entries, each
 * < 30 KB) and the cost is one-shot per deployment. Wrapping these
 * in the per-child cap would be incorrect (no child exists yet).
 *
 * Phase 11.B — Bug 2 hot-fix.
 */
import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { computeCacheKey, getCachedAudio, putCachedAudio } from '@/lib/voice/cache';
import {
  VOICE_IDS as ELEVENLABS_VOICE_IDS,
  elevenlabsSynthesize,
  isElevenLabsAvailable,
} from '@/lib/voice/elevenlabs';
import {
  OPENAI_TTS_VOICES,
  isOpenAiTtsAvailable,
  mapElevenLabsKeyToOpenAi,
  openaiTtsSynthesize,
} from '@/lib/voice/openai-tts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type SampleLocale = 'en' | 'ar';
type SampleVoice = 'charlotte' | 'sarah';

/**
 * Fixed sample phrases per locale. The same phrases the user spec'd in
 * the Phase 11.B brief. KEEP THESE STABLE — every change invalidates the
 * cache for every (locale, voice) pair.
 */
const SAMPLE_PHRASES: Record<SampleLocale, string> = {
  en: "Hi, I'm here to help.",
  ar: 'مرحبًا، أنا هنا للمساعدة.',
};

const SAMPLE_SPEED = 1.0;

/**
 * Choose a provider for a (locale, voice) pair. Mirror the per-locale
 * primary mapping in `web/src/lib/voice/index.ts`:
 *   - AR  → ElevenLabs Multilingual v2 (Charlotte / Sarah)
 *   - EN  → OpenAI tts-1 (Nova / Shimmer via the charlotte→nova map)
 *
 * If the locale's primary isn't configured (missing API key), fall back
 * to the other provider so we still produce audio. The cache hash
 * encodes the provider, so a fallback synthesis lives at a different
 * cache key than a primary synthesis — which is fine; they're different
 * recordings.
 */
function pickProvider(locale: SampleLocale): 'elevenlabs' | 'openai' | null {
  if (locale === 'ar') {
    if (isElevenLabsAvailable()) return 'elevenlabs';
    if (isOpenAiTtsAvailable()) return 'openai';
    return null;
  }
  if (isOpenAiTtsAvailable()) return 'openai';
  if (isElevenLabsAvailable()) return 'elevenlabs';
  return null;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const locale = url.searchParams.get('locale') as SampleLocale | null;
  const voice = url.searchParams.get('voice') as SampleVoice | null;

  if (locale !== 'en' && locale !== 'ar') {
    return NextResponse.json({ error: 'locale must be en|ar' }, { status: 400 });
  }
  if (voice !== 'charlotte' && voice !== 'sarah') {
    return NextResponse.json({ error: 'voice must be charlotte|sarah' }, { status: 400 });
  }

  const provider = pickProvider(locale);
  if (!provider) {
    return NextResponse.json(
      {
        error: 'voice_unavailable',
        detail: 'Neither ElevenLabs nor OpenAI TTS is configured for this environment.',
      },
      { status: 503 },
    );
  }

  const text = SAMPLE_PHRASES[locale];

  // Build the same cache hash the real synthesize path would build so a
  // sample synthesized here is byte-for-byte identical to one synthesized
  // by /api/voice/synthesize for the exact same text+voice+locale.
  const cacheKeyInput =
    provider === 'elevenlabs'
      ? {
          provider: 'elevenlabs' as const,
          language: locale,
          voice_id: ELEVENLABS_VOICE_IDS[voice],
          speed: SAMPLE_SPEED,
          text,
        }
      : {
          provider: 'openai' as const,
          language: locale,
          voice_id: OPENAI_TTS_VOICES[mapElevenLabsKeyToOpenAi(voice)],
          speed: SAMPLE_SPEED,
          text,
        };
  const hash = computeCacheKey(cacheKeyInput);

  try {
    const { createSupabaseAdminClient } = await import('@/lib/supabase/server');
    const admin = createSupabaseAdminClient();

    // Cache lookup first — the whole point of this endpoint is that the
    // SECOND click on a voice never hits a TTS API.
    const cached = await getCachedAudio(admin as never, hash);
    if (cached) {
      // Browsers follow the 302 transparently and play the MP3.
      return NextResponse.redirect(cached.url, { status: 302 });
    }

    // Cache miss — synthesize once, write to cache, redirect.
    let mp3: Buffer;
    if (provider === 'elevenlabs') {
      const res = await elevenlabsSynthesize({
        text,
        voice_id: ELEVENLABS_VOICE_IDS[voice],
        language: locale,
        speed: SAMPLE_SPEED,
      });
      mp3 = res.mp3;
    } else {
      const res = await openaiTtsSynthesize({
        text,
        voice_key: mapElevenLabsKeyToOpenAi(voice),
        language: locale,
        speed: SAMPLE_SPEED,
      });
      mp3 = res.mp3;
    }
    const uploaded = await putCachedAudio(admin as never, hash, mp3);
    return NextResponse.redirect(uploaded.url, { status: 302 });
  } catch (e) {
    const detail = e instanceof Error ? e.message.slice(0, 240) : 'unknown_error';
    return NextResponse.json({ error: 'sample_failed', detail }, { status: 502 });
  }
}
