/**
 * Voice service abstraction — Quality Fix (replaces mock provider).
 *
 * What landed in the Quality Fix override:
 *   • TTS — ElevenLabs Multilingual v2 for both EN + AR (one voice
 *     handles both, no jarring tone change when a child code-switches).
 *   • STT — OpenAI Whisper (whisper-1).
 *   • Mandatory caching — every TTS call hashes (text + voice + speed +
 *     language) and probes the `tts-cache` Supabase Storage bucket
 *     before calling ElevenLabs. Hit returns the public URL with $0
 *     spend. Cache hit rate target ≥ 60% over 30 days.
 *   • The mock + browser-SpeechSynthesis paths are GONE. There is no
 *     fallback to robotic Arabic OS voices — quality is the product.
 *
 * Cap-reached behavior (per directive):
 *   • TTS over cap → return a `cap_reached` result. Caller surfaces a
 *     pre-recorded calm bilingual "Voice limit reached today, please
 *     try again tomorrow" message in the active language.
 *   • STT over cap → return a `cap_reached` result. Caller shows a
 *     friendly disabled state on the hold-to-speak button.
 *   • NEVER falls back to browser SpeechSynthesis.
 *
 * All callers go through `speak()` and `transcribe()`; both return
 * `GuardResult<T>` so the cap-reached branch is a typed first-class
 * citizen, not a stringly-typed error.
 */
import 'server-only';
import {
  computeCacheKey,
  getCachedAudio,
  putCachedAudio,
  type CacheKeyInput,
} from './cache';
import {
  DEFAULT_VOICE,
  VOICE_IDS,
  elevenlabsSynthesize,
  estimateSynthesisCostUsd,
  isElevenLabsAvailable,
  type SynthesizeInput,
  type VoiceKey,
} from './elevenlabs';
import { isWhisperAvailable, whisperTranscribe, type TranscribeInput } from './whisper';
import type { SupabaseClient } from '@supabase/supabase-js';
import { aiGuard, type GuardResult } from '@/lib/ai/guard';

export type VoiceLocale = 'en' | 'ar';

// =============================================================================
// TTS — speak()
// =============================================================================

export interface SpeakInput {
  text: string;
  locale: VoiceLocale;
  /** Caller-supplied voice key (`charlotte` or `sarah`). Defaults to
   *  `charlotte` when omitted. */
  voice?: VoiceKey;
  /** 0.5 .. 2.0 — defaults to 1.0. Maps to ElevenLabs's `speed` knob. */
  speed?: number;
  /** Owning child for cost-guard accounting. */
  childId: string;
  supabaseAdmin: SupabaseClient<never>;
}

export interface SpeakResult {
  audioUrl: string;
  cacheHit: boolean;
  /** Number of characters billed (0 on cache hit). */
  units: number;
  /** USD billed for this call (0 on cache hit). */
  cost_usd: number;
  /** Voice key the audio was (or would be) synthesized with. */
  voice: VoiceKey;
  /** Provider name for telemetry / health probes. */
  provider: 'elevenlabs';
}

/**
 * Synthesize speech, with mandatory cache lookup. Returns a public URL
 * the browser plays via HTMLAudioElement.
 *
 * Behavior:
 *   1. If ELEVENLABS_API_KEY is missing AND the cache misses → throws
 *      (route handler maps to 503 + friendly "voice unavailable" copy).
 *      A cache hit can still serve audio even when the key is gone —
 *      that's the right posture during a key rotation outage.
 *   2. Cache hit → return the URL with $0 ledger row (so the cache-hit
 *      rate metric works).
 *   3. Cache miss + key present → aiGuard wraps the ElevenLabs call. If
 *      guard blocks (cap reached), return `cap_reached`. Otherwise
 *      synthesize, upload, return URL.
 */
export async function speak(input: SpeakInput): Promise<GuardResult<SpeakResult>> {
  const voice = input.voice ?? DEFAULT_VOICE;
  const voice_id = VOICE_IDS[voice];
  const speed = input.speed ?? 1.0;
  const cacheKeyInput: CacheKeyInput = {
    language: input.locale,
    voice_id,
    speed,
    text: input.text,
  };
  const hash = computeCacheKey(cacheKeyInput);

  // 1. Cache lookup first — even when the API key is missing.
  const cached = await getCachedAudio(input.supabaseAdmin, hash);
  if (cached) {
    // Record a $0 ledger row so the 30d cache-hit-rate metric works.
    await aiGuard(
      {
        supabase: input.supabaseAdmin,
        childId: input.childId,
        service: 'elevenlabs_tts',
        estimatedCostUsd: 0,
        units: 0,
      },
      async () => undefined,
    );
    return {
      ok: true,
      result: {
        audioUrl: cached.url,
        cacheHit: true,
        units: 0,
        cost_usd: 0,
        voice,
        provider: 'elevenlabs',
      },
    };
  }

  // 2. Miss. Need the key for synthesis.
  if (!isElevenLabsAvailable()) {
    throw new Error('voice_unavailable');
  }

  // 3. Wrap synthesis through aiGuard.
  const estimated = estimateSynthesisCostUsd(input.text.trim().length);
  const guard = await aiGuard<SpeakResult>(
    {
      supabase: input.supabaseAdmin,
      childId: input.childId,
      service: 'elevenlabs_tts',
      estimatedCostUsd: estimated,
      units: input.text.trim().length,
    },
    async () => {
      const synthInput: SynthesizeInput = {
        text: input.text,
        voice_id,
        language: input.locale,
        speed,
      };
      const res = await elevenlabsSynthesize(synthInput);
      const cached = await putCachedAudio(input.supabaseAdmin, hash, res.mp3);
      return {
        audioUrl: cached.url,
        cacheHit: false,
        units: res.units,
        cost_usd: res.cost_usd,
        voice,
        provider: 'elevenlabs' as const,
      };
    },
  );
  return guard;
}

// =============================================================================
// STT — transcribe()
// =============================================================================

export interface TranscribeArgs {
  audio: Buffer;
  audioMime: string;
  language: VoiceLocale;
  childId: string;
  supabaseAdmin: SupabaseClient<never>;
  /** Conservative pre-charge estimate. Defaults to 0.005 USD (~0.83
   *  minutes at $0.006/min). */
  estimatedCostUsd?: number;
}

export interface TranscribeResultExternal {
  transcript: string;
  language_detected: string;
  duration_seconds: number;
  cost_usd: number;
  provider: 'whisper';
}

export async function transcribe(
  args: TranscribeArgs,
): Promise<GuardResult<TranscribeResultExternal>> {
  if (!isWhisperAvailable()) throw new Error('voice_unavailable');

  return aiGuard<TranscribeResultExternal>(
    {
      supabase: args.supabaseAdmin,
      childId: args.childId,
      service: 'whisper_stt',
      estimatedCostUsd: args.estimatedCostUsd ?? 0.005,
      units: args.audio.length,
    },
    async () => {
      const res = await whisperTranscribe({
        audio: args.audio,
        audioMime: args.audioMime,
        language: args.language,
      });
      return {
        transcript: res.transcript,
        language_detected: res.language_detected,
        duration_seconds: res.duration_seconds,
        cost_usd: res.cost_usd,
        provider: 'whisper' as const,
      };
    },
  );
}

// =============================================================================
// Re-exports for convenience.
// =============================================================================

export { VOICE_IDS, DEFAULT_VOICE, isElevenLabsAvailable } from './elevenlabs';
export { isWhisperAvailable } from './whisper';
export { computeCacheKey, cacheStats30d } from './cache';
export type { VoiceKey, TranscribeInput };
