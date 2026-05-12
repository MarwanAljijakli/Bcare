/**
 * OpenAI tts-1-hd — Quality Fix Phase 8.B fallback provider.
 *
 * Parallel to elevenlabs.ts; runs the same external contract
 * (synthesize → MP3 buffer + units + cost) but talks to OpenAI's
 * /v1/audio/speech endpoint instead of ElevenLabs.
 *
 * Provider routing (see ./index.ts):
 *   • PRIMARY: ElevenLabs Multilingual v2.
 *   • FALLBACK: this module (OpenAI tts-1-hd).
 *   • Triggers for fallback: 401 (quota) | 402 (billing) | 429 (rate)
 *     | 5xx | network timeout > 5s on ElevenLabs.
 *
 * Cost: tts-1-hd is $30 / 1M characters ($0.00003 per char). The
 * cache key in cache.ts now includes the provider, so once an
 * ElevenLabs miss falls through to OpenAI, the OpenAI bytes get
 * cached under their own hash and the next call for the same text
 * hits the cache regardless of which provider generated it.
 *
 * Voices for child-AAC:
 *   • nova — warm female (default in this module)
 *   • shimmer — soft female (alternative)
 *
 * Server-only — `OPENAI_API_KEY` MUST never reach the browser.
 */
import 'server-only';
import './http-agent';

const OPENAI_API = 'https://api.openai.com/v1';
/**
 * Phase 10.A — switch from tts-1-hd to tts-1. Studio-quality HD nuance
 * doesn't help speech intelligibility on the AAC board and tts-1 is
 * ~2× faster + ~2× cheaper. We use HD only for the /voice-test admin
 * page when an operator wants to A/B the timbre.
 */
const MODEL_ID = 'tts-1';

/** Known voices. Both work for EN + AR (model handles both). */
export const OPENAI_TTS_VOICES = {
  nova: 'nova',
  shimmer: 'shimmer',
} as const;
export type OpenAiTtsVoiceKey = keyof typeof OPENAI_TTS_VOICES;
export const OPENAI_TTS_DEFAULT_VOICE: OpenAiTtsVoiceKey = 'nova';

/** Cost per character (USD). $30 / 1M = $0.00003. */
export const OPENAI_TTS_COST_PER_CHAR_USD = 0.00003;

export interface OpenAiTtsInput {
  text: string;
  /** Internal key (`nova` | `shimmer`) — the function maps to OpenAI's literal name. */
  voice_key: OpenAiTtsVoiceKey;
  /** Hint for telemetry only. OpenAI's tts-1-hd auto-detects. */
  language: 'en' | 'ar';
  /** 0.25..4.0 — OpenAI's `speed` knob. Defaults to 1.0. */
  speed?: number;
}

export interface OpenAiTtsResult {
  mp3: Buffer;
  units: number;
  cost_usd: number;
}

export function isOpenAiTtsAvailable(): boolean {
  return !!process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.length > 0;
}

export function estimateOpenAiTtsCostUsd(charCount: number): number {
  const c = Math.max(0, charCount) * OPENAI_TTS_COST_PER_CHAR_USD;
  return Math.round(c * 1_000_000) / 1_000_000;
}

/**
 * Map internal voice keys to OpenAI's literal voice names. ElevenLabs's
 * Charlotte → OpenAI's nova (both warm female). ElevenLabs's Sarah →
 * OpenAI's shimmer (both soft female). When the orchestrator falls back
 * provider-to-provider, the closest tonal match is used so the
 * acoustic profile stays consistent for the child.
 */
export function mapElevenLabsKeyToOpenAi(key: 'charlotte' | 'sarah'): OpenAiTtsVoiceKey {
  return key === 'sarah' ? 'shimmer' : 'nova';
}

export async function openaiTtsSynthesize(input: OpenAiTtsInput): Promise<OpenAiTtsResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured');
  const text = input.text.trim();
  if (text.length === 0) throw new Error('synthesize: empty text');
  if (text.length > 4096) {
    // OpenAI's hard limit on /v1/audio/speech is 4096 characters per
    // request. The board never produces sentences this long; the cap
    // is defense-in-depth.
    throw new Error(`synthesize: text too long (${text.length} chars > 4096)`);
  }
  const speed = Math.max(0.25, Math.min(4.0, input.speed ?? 1.0));
  const voice = OPENAI_TTS_VOICES[input.voice_key];

  const res = await fetch(`${OPENAI_API}/audio/speech`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
    },
    body: JSON.stringify({
      model: MODEL_ID,
      input: text,
      voice,
      response_format: 'mp3',
      speed,
    }),
  });
  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`OpenAI TTS ${res.status}: ${errBody.slice(0, 240)}`);
  }
  const mp3 = Buffer.from(await res.arrayBuffer());
  return {
    mp3,
    units: text.length,
    cost_usd: estimateOpenAiTtsCostUsd(text.length),
  };
}
