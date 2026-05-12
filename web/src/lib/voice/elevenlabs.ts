/**
 * ElevenLabs Multilingual v2 TTS — Quality Fix Phase 2.
 *
 * Server-side wrapper around POST /v1/text-to-speech/{voice_id}.
 * Returns an MP3 buffer; the caller is responsible for caching to
 * Supabase Storage via cache.ts.
 *
 * Why ElevenLabs Multilingual v2 (per Quality Fix override):
 *   • Industry-leading Arabic naturalness, Saudi-dialect aware. The
 *     same voice handles both EN and AR — no provider switch by
 *     locale, no jarring tone change when a child mixes languages.
 *   • Browser SpeechSynthesis Arabic voices are robotic and were
 *     unintelligible to native-speaker testers. That path is
 *     DELETED forever per directive.
 *
 * Voice catalog (default voices in ElevenLabs shared library):
 *   • Charlotte (XB0fDUnXU5powFXDhCwa) — warm female, child-friendly.
 *     Default for new caregivers.
 *   • Sarah (EXAVITQu4vr4xnSDxMaL) — soft female, alternative.
 *
 * Cost: ~$0.18 / 1K characters on the Starter plan; cache hit rate
 * target ≥ 60% keeps the per-child line item small.
 *
 * Server-only — `ELEVENLABS_API_KEY` MUST never reach the browser.
 */
import 'server-only';
import './http-agent';

const ELEVENLABS_API = 'https://api.elevenlabs.io/v1';
const MODEL_ID = 'eleven_multilingual_v2';
/**
 * Phase 10.A — drop output bitrate from the default 128 kbps to
 * 32 kbps mp3 @ 22.05 kHz. Speech is fine at that quality (we tested
 * with native-Arabic-speaker acceptance), files are ~4× smaller, and
 * Supabase Storage's CDN delivers them noticeably faster on cellular.
 */
const OUTPUT_FORMAT = 'mp3_22050_32';

/** Known voice IDs. Both work for EN + AR via the multilingual model. */
export const VOICE_IDS = {
  charlotte: 'XB0fDUnXU5powFXDhCwa',
  sarah: 'EXAVITQu4vr4xnSDxMaL',
} as const;
export type VoiceKey = keyof typeof VOICE_IDS;
export const DEFAULT_VOICE: VoiceKey = 'charlotte';

/** Cost per character (USD). Conservative — favors over-charge so the
 *  cap can never be silently breached. */
export const COST_PER_CHAR_USD = 0.00018;

export interface SynthesizeInput {
  text: string;
  voice_id: string;
  language: 'en' | 'ar';
  /** 0.5 .. 2.0 — ElevenLabs accepts this via the speed control on
   *  newer models. Defaults to 1.0. */
  speed?: number;
}

export interface SynthesizeResult {
  mp3: Buffer;
  /** Number of characters billed (includes whitespace + punctuation). */
  units: number;
  cost_usd: number;
}

export function isElevenLabsAvailable(): boolean {
  return !!process.env.ELEVENLABS_API_KEY && process.env.ELEVENLABS_API_KEY.length > 0;
}

export function estimateSynthesisCostUsd(charCount: number): number {
  const c = Math.max(0, charCount) * COST_PER_CHAR_USD;
  return Math.round(c * 1_000_000) / 1_000_000;
}

/**
 * Direct ElevenLabs call. NO aiGuard wrapper, NO cache lookup — the
 * caller composes that. Throws on non-2xx responses (the route handler
 * catches + maps to a 502 with a friendly message).
 */
export async function elevenlabsSynthesize(input: SynthesizeInput): Promise<SynthesizeResult> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error('ELEVENLABS_API_KEY is not configured');

  const text = input.text.trim();
  if (text.length === 0) throw new Error('synthesize: empty text');
  if (text.length > 5000) {
    // Hard server-side cap. The board never produces sentences this long
    // (the strip caps at ~12 symbols × 20 chars). Anything bigger is
    // accidental or abusive.
    throw new Error(`synthesize: text too long (${text.length} chars > 5000)`);
  }

  const url = `${ELEVENLABS_API}/text-to-speech/${encodeURIComponent(input.voice_id)}?output_format=${OUTPUT_FORMAT}`;
  const speed = Math.max(0.5, Math.min(2.0, input.speed ?? 1.0));
  const body = JSON.stringify({
    text,
    model_id: MODEL_ID,
    voice_settings: {
      stability: 0.5,
      similarity_boost: 0.75,
      style: 0.3,
      use_speaker_boost: true,
      speed,
    },
  });

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
    },
    body,
  });
  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`ElevenLabs ${res.status}: ${errBody.slice(0, 240)}`);
  }
  const mp3 = Buffer.from(await res.arrayBuffer());
  return {
    mp3,
    units: text.length,
    cost_usd: estimateSynthesisCostUsd(text.length),
  };
}
