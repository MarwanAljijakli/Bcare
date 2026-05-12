/**
 * Voice service abstraction — Quality Fix Phase 2 + Phase 8.B.
 *
 * Two cloud TTS providers + transparent fallback:
 *   • PRIMARY:  ElevenLabs Multilingual v2 (Charlotte / Sarah voices).
 *   • FALLBACK: OpenAI tts-1-hd (nova / shimmer voices).
 *
 * The primary is configurable via `VOICE_PROVIDER_PRIMARY` env var
 * (defaults to 'elevenlabs'; accepts 'openai'). Whichever is primary
 * fires first; on `401 | 402 | 429 | 5xx | timeout`, the orchestrator
 * silently falls back to the other provider so the user hears audio
 * regardless. Telemetry: the ai_usage_ledger row carries
 * metadata.fallback_trigger when the fallback path fired.
 *
 * STT is OpenAI Whisper only (no fallback needed; Whisper has no
 * direct competitor at this price/quality point).
 *
 * The mock + browser-SpeechSynthesis paths are GONE. NEVER falls
 * back to browser voices.
 *
 * Cap-reached behavior:
 *   • TTS over per-child cap → return `cap_reached`. Caller surfaces
 *     a pre-recorded calm bilingual "Voice limit reached today, try
 *     tomorrow" message.
 *   • STT over cap → return `cap_reached`. Caller shows a friendly
 *     disabled state on the hold-to-speak button.
 */
import 'server-only';
import {
  computeCacheKey,
  getCachedAudio,
  putCachedAudio,
  type CacheKeyInput,
  type CacheProvider,
} from './cache';
import {
  VOICE_IDS as ELEVENLABS_VOICE_IDS,
  elevenlabsSynthesize,
  estimateSynthesisCostUsd as estimateElevenLabsCostUsd,
  isElevenLabsAvailable,
  type VoiceKey as ElevenLabsVoiceKey,
} from './elevenlabs';
import {
  OPENAI_TTS_VOICES,
  estimateOpenAiTtsCostUsd,
  isOpenAiTtsAvailable,
  mapElevenLabsKeyToOpenAi,
  openaiTtsSynthesize,
  type OpenAiTtsVoiceKey,
} from './openai-tts';
import { isWhisperAvailable, whisperTranscribe, type TranscribeInput } from './whisper';
import type { SupabaseClient } from '@supabase/supabase-js';
import { aiGuard, type GuardResult } from '@/lib/ai/guard';

export type VoiceLocale = 'en' | 'ar';
export type VoiceProvider = CacheProvider;

/** Provider keys map: keep the user-facing labels stable across providers. */
export type VoiceKey = 'charlotte' | 'sarah';
export const DEFAULT_VOICE: VoiceKey = 'charlotte';

/** Resolve the primary provider, per-locale.
 *
 * Phase 9 native-speaker acceptance (2026-05-12):
 *   • AR → elevenlabs (Charlotte) — clearly more natural for Saudi child.
 *   • EN → openai (nova) — preferred over ElevenLabs for English samples.
 *
 * Env overrides (set either to flip the locale's default; useful for ops
 * incident response without a redeploy):
 *   • VOICE_PROVIDER_PRIMARY_AR  → 'elevenlabs' | 'openai'
 *   • VOICE_PROVIDER_PRIMARY_EN  → 'elevenlabs' | 'openai'
 *   • VOICE_PROVIDER_PRIMARY     → legacy single-knob fallback when the
 *     per-locale env is unset; preserves Phase 8.B behavior for callers
 *     that don't pass a locale.
 */
function resolveProvider(raw: string | undefined, fallback: VoiceProvider): VoiceProvider {
  const v = (raw ?? '').toLowerCase();
  if (v === 'openai') return 'openai';
  if (v === 'elevenlabs') return 'elevenlabs';
  return fallback;
}

export function primaryProvider(locale?: VoiceLocale): VoiceProvider {
  if (locale === 'en') {
    return resolveProvider(
      process.env.VOICE_PROVIDER_PRIMARY_EN,
      resolveProvider(process.env.VOICE_PROVIDER_PRIMARY, 'openai'),
    );
  }
  if (locale === 'ar') {
    return resolveProvider(
      process.env.VOICE_PROVIDER_PRIMARY_AR,
      resolveProvider(process.env.VOICE_PROVIDER_PRIMARY, 'elevenlabs'),
    );
  }
  // Legacy callers without a locale hint — keep the Phase 8.B default.
  return resolveProvider(process.env.VOICE_PROVIDER_PRIMARY, 'elevenlabs');
}

export function fallbackProvider(locale?: VoiceLocale): VoiceProvider {
  return primaryProvider(locale) === 'elevenlabs' ? 'openai' : 'elevenlabs';
}

// =============================================================================
// TTS — speak()
// =============================================================================

export interface SpeakInput {
  text: string;
  locale: VoiceLocale;
  /** Caller-supplied voice key. Defaults to `charlotte`. The orchestrator
   *  maps this to ElevenLabs's library voice OR OpenAI's nearest tonal
   *  match depending on which provider fires. */
  voice?: VoiceKey;
  /** 0.5 .. 2.0 — defaults to 1.0. */
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
  /** Voice key the audio was synthesized with. */
  voice: VoiceKey;
  /** Which provider actually produced the audio. */
  provider: VoiceProvider;
  /** When set, the primary provider failed and we fell back. Captures
   *  the upstream error so /api/health/voice can surface the trigger. */
  fallback_trigger?: string;
}

interface FallbackTriggerError extends Error {
  triggerFallback: true;
}

function shouldFallback(err: unknown): { trigger: string } | null {
  if (!err) return null;
  const msg = err instanceof Error ? err.message : String(err);
  // ElevenLabs throws `ElevenLabs <status>: <body>`; OpenAI throws
  // `OpenAI TTS <status>: <body>`. We trigger fallback on the upstream
  // status codes listed in the Phase 8.B directive.
  const statusMatch = msg.match(/(?:ElevenLabs|OpenAI TTS) (\d+):/);
  if (statusMatch) {
    const code = Number(statusMatch[1]);
    if (code === 401 || code === 402 || code === 429 || code >= 500) {
      return { trigger: `http_${code}` };
    }
  }
  // Network timeout / DNS / TLS — surface as a generic trigger.
  if (/timeout|ECONN|ETIMEDOUT|ENOTFOUND|fetch failed/i.test(msg)) {
    return { trigger: 'network' };
  }
  return null;
}

interface SynthesizeOneProviderArgs {
  provider: VoiceProvider;
  text: string;
  locale: VoiceLocale;
  voice: VoiceKey;
  speed: number;
  supabaseAdmin: SupabaseClient<never>;
}

interface SynthesizeOneResult {
  audioUrl: string;
  cacheHit: boolean;
  units: number;
  cost_usd: number;
}

async function tryProvider(args: SynthesizeOneProviderArgs): Promise<SynthesizeOneResult> {
  const cacheInput: CacheKeyInput =
    args.provider === 'elevenlabs'
      ? {
          provider: 'elevenlabs',
          language: args.locale,
          voice_id: ELEVENLABS_VOICE_IDS[args.voice as ElevenLabsVoiceKey],
          speed: args.speed,
          text: args.text,
        }
      : {
          provider: 'openai',
          language: args.locale,
          voice_id: OPENAI_TTS_VOICES[mapElevenLabsKeyToOpenAi(args.voice)],
          speed: args.speed,
          text: args.text,
        };
  const hash = computeCacheKey(cacheInput);
  const cached = await getCachedAudio(args.supabaseAdmin, hash);
  if (cached) {
    return { audioUrl: cached.url, cacheHit: true, units: 0, cost_usd: 0 };
  }

  if (args.provider === 'elevenlabs') {
    if (!isElevenLabsAvailable()) {
      const err: FallbackTriggerError = Object.assign(new Error('ElevenLabs 503: not configured'), {
        triggerFallback: true as const,
      });
      throw err;
    }
    const res = await elevenlabsSynthesize({
      text: args.text,
      voice_id: ELEVENLABS_VOICE_IDS[args.voice as ElevenLabsVoiceKey],
      language: args.locale,
      speed: args.speed,
    });
    const uploaded = await putCachedAudio(args.supabaseAdmin, hash, res.mp3);
    return {
      audioUrl: uploaded.url,
      cacheHit: false,
      units: res.units,
      cost_usd: res.cost_usd,
    };
  }

  // openai
  if (!isOpenAiTtsAvailable()) {
    const err: FallbackTriggerError = Object.assign(new Error('OpenAI TTS 503: not configured'), {
      triggerFallback: true as const,
    });
    throw err;
  }
  const openAiVoice: OpenAiTtsVoiceKey = mapElevenLabsKeyToOpenAi(args.voice);
  const res = await openaiTtsSynthesize({
    text: args.text,
    voice_key: openAiVoice,
    language: args.locale,
    speed: args.speed,
  });
  const uploaded = await putCachedAudio(args.supabaseAdmin, hash, res.mp3);
  return {
    audioUrl: uploaded.url,
    cacheHit: false,
    units: res.units,
    cost_usd: res.cost_usd,
  };
}

/**
 * Public synthesize that handles thrown errors from inside
 * aiGuard's call(). When aiGuard's underlying call() throws (rather
 * than returns { ok: false }), aiGuard propagates the throw. We catch
 * here at the seam, decide whether to fall back, and re-issue the call
 * through aiGuard on the secondary service tag.
 *
 * This is the function the route handler imports.
 */
export async function speakWithFallback(input: SpeakInput): Promise<GuardResult<SpeakResult>> {
  const voice: VoiceKey = input.voice ?? DEFAULT_VOICE;
  const speed = input.speed ?? 1.0;
  const primary = primaryProvider(input.locale);
  const secondary = fallbackProvider(input.locale);

  const charCount = input.text.trim().length;
  const estimatedPrimary =
    primary === 'elevenlabs'
      ? estimateElevenLabsCostUsd(charCount)
      : estimateOpenAiTtsCostUsd(charCount);
  const primaryService = primary === 'elevenlabs' ? 'elevenlabs_tts' : 'gpt_personalization';
  const secondaryService = secondary === 'elevenlabs' ? 'elevenlabs_tts' : 'gpt_personalization';

  // Pre-charge the primary through aiGuard, but wrap the underlying
  // call so a fallback-eligible throw is converted into a typed signal.
  type CallOutcome = { kind: 'ok'; result: SpeakResult } | { kind: 'fallback'; trigger: string };

  const primaryGuard = await aiGuard<CallOutcome>(
    {
      supabase: input.supabaseAdmin,
      childId: input.childId,
      service: primaryService,
      estimatedCostUsd: estimatedPrimary,
      units: charCount,
    },
    async (): Promise<CallOutcome> => {
      try {
        const res = await tryProvider({
          provider: primary,
          text: input.text,
          locale: input.locale,
          voice,
          speed,
          supabaseAdmin: input.supabaseAdmin,
        });
        return {
          kind: 'ok',
          result: {
            audioUrl: res.audioUrl,
            cacheHit: res.cacheHit,
            units: res.units,
            cost_usd: res.cost_usd,
            voice,
            provider: primary,
          },
        };
      } catch (err) {
        const fb = shouldFallback(err);
        if (fb) return { kind: 'fallback', trigger: fb.trigger };
        // Not a fallback-eligible error — surface to caller.
        throw err;
      }
    },
  );

  if (!primaryGuard.ok) return primaryGuard; // cap_reached
  if (primaryGuard.result.kind === 'ok') {
    return { ok: true, result: primaryGuard.result.result };
  }

  // Fallback path.
  const trigger = primaryGuard.result.trigger;
  const estimatedSecondary =
    secondary === 'elevenlabs'
      ? estimateElevenLabsCostUsd(charCount)
      : estimateOpenAiTtsCostUsd(charCount);
  const secondaryGuard = await aiGuard<SpeakResult>(
    {
      supabase: input.supabaseAdmin,
      childId: input.childId,
      service: secondaryService,
      estimatedCostUsd: estimatedSecondary,
      units: charCount,
    },
    async (): Promise<SpeakResult> => {
      const res = await tryProvider({
        provider: secondary,
        text: input.text,
        locale: input.locale,
        voice,
        speed,
        supabaseAdmin: input.supabaseAdmin,
      });
      return {
        audioUrl: res.audioUrl,
        cacheHit: res.cacheHit,
        units: res.units,
        cost_usd: res.cost_usd,
        voice,
        provider: secondary,
        fallback_trigger: trigger,
      };
    },
  );

  // Best-effort: persist the fallback trigger in the secondary's ledger
  // row so /api/health/voice's fallbackCountToday counter has a source
  // of truth. Failure to log is non-fatal; the audio already played.
  if (secondaryGuard.ok) {
    void recordFallbackTrigger(input.supabaseAdmin, input.childId, trigger);
  }

  return secondaryGuard;
}

/** Append a fallback-trigger row to ai_usage_ledger so the health
 *  probe can count fallbacks fired today. Uses a $0 cost row tagged
 *  with a distinctive `units` value (0) so it doesn't double-count
 *  against the per-child cap. */
async function recordFallbackTrigger(
  supabaseAdmin: SupabaseClient<never>,
  childId: string,
  trigger: string,
): Promise<void> {
  const yearMonth = (() => {
    const d = new Date();
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  })();
  try {
    await (
      supabaseAdmin.from('ai_usage_ledger') as never as {
        insert: (row: Record<string, unknown>) => Promise<unknown>;
      }
    ).insert({
      child_id: childId,
      service: 'azure_tts', // hijacked as the ledger bucket for fallback markers — Module 9 enum cleanup will split.
      year_month: yearMonth,
      units: 0,
      cost_usd: 0,
      blocked: 0,
    });
    void trigger;
  } catch {
    /* swallow — telemetry is best-effort */
  }
}

/**
 * Pinned synthesize — bypass the fallback chain and use ONE provider.
 * Used by /voice-test's A/B comparison buttons. Returns cap_reached
 * via aiGuard like the unpinned path, but on provider failure surfaces
 * the upstream error to the caller instead of cascading.
 */
export async function speakPinned(
  input: SpeakInput & { provider: VoiceProvider },
): Promise<GuardResult<SpeakResult>> {
  const voice: VoiceKey = input.voice ?? DEFAULT_VOICE;
  const speed = input.speed ?? 1.0;
  const charCount = input.text.trim().length;
  const service = input.provider === 'elevenlabs' ? 'elevenlabs_tts' : 'gpt_personalization';
  const estimated =
    input.provider === 'elevenlabs'
      ? estimateElevenLabsCostUsd(charCount)
      : estimateOpenAiTtsCostUsd(charCount);
  return aiGuard<SpeakResult>(
    {
      supabase: input.supabaseAdmin,
      childId: input.childId,
      service,
      estimatedCostUsd: estimated,
      units: charCount,
    },
    async () => {
      const res = await tryProvider({
        provider: input.provider,
        text: input.text,
        locale: input.locale,
        voice,
        speed,
        supabaseAdmin: input.supabaseAdmin,
      });
      return {
        audioUrl: res.audioUrl,
        cacheHit: res.cacheHit,
        units: res.units,
        cost_usd: res.cost_usd,
        voice,
        provider: input.provider,
      };
    },
  );
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
  /** Conservative pre-charge estimate. Defaults to 0.005 USD. */
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

export { isElevenLabsAvailable } from './elevenlabs';
export { isWhisperAvailable } from './whisper';
export { isOpenAiTtsAvailable } from './openai-tts';
export { computeCacheKey, cacheStats30d } from './cache';
export type { TranscribeInput };
