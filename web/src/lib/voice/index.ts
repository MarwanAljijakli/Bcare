/**
 * Voice service abstraction. Module 2.B ships with a mock provider; real
 * ElevenLabs (EN voices) and Azure Neural TTS (AR voices) flip on when
 * the corresponding env vars land.
 *
 * The cost-guard wraps every TTS call so the per-child monthly budget is
 * respected without paywalling — when the cap is reached the provider
 * returns a `cap_reached` result and the caller surfaces a graceful
 * degradation path (cached response / no audio / encouragement to wait).
 */

import { mockSpeak } from './mock';
import type { SupabaseClient } from '@supabase/supabase-js';
import { aiGuard, type AiService, type GuardResult } from '@/lib/ai/guard';

export type VoiceLocale = 'en' | 'ar';

export interface SpeakInput {
  text: string;
  locale: VoiceLocale;
  /** ElevenLabs voice id for EN, Azure voice name for AR. */
  voiceId?: string;
  /** Owning child — required for cost-guard accounting. */
  childId: string;
  supabase: SupabaseClient<never>;
}

export interface SpeakResult {
  /** Public URL of the generated audio (cached in Supabase Storage). */
  audioUrl: string;
  /** Provider that produced this clip. */
  provider: 'mock' | 'elevenlabs' | 'azure';
  /** Cache hit means cost wasn't charged. */
  cacheHit: boolean;
}

/**
 * Provider selector:
 *   • mock provider when the corresponding API key is missing
 *   • elevenlabs for EN when ELEVENLABS_API_KEY is set
 *   • azure for AR when AZURE_TTS_KEY + AZURE_TTS_REGION are set
 *
 * The cost estimate is per-character based on each vendor's published
 * pricing; conservative rounding favors the project so we never undershoot
 * the per-child cap.
 */
function pickProvider(locale: VoiceLocale): {
  provider: 'mock' | 'elevenlabs' | 'azure';
  service: AiService;
} {
  if (locale === 'ar') {
    if (process.env.AZURE_TTS_KEY && process.env.AZURE_TTS_REGION) {
      return { provider: 'azure', service: 'azure_tts' };
    }
  } else {
    if (process.env.ELEVENLABS_API_KEY) {
      return { provider: 'elevenlabs', service: 'elevenlabs_tts' };
    }
  }
  return { provider: 'mock', service: locale === 'ar' ? 'azure_tts' : 'elevenlabs_tts' };
}

/** Estimated USD per character (conservative). */
const COST_PER_CHAR_USD = {
  elevenlabs: 0.000_18, // ~$0.18 / 1K chars on Creator plan
  azure: 0.000_016, // ~$16 / 1M chars on Standard
  mock: 0,
} as const;

export async function speak(input: SpeakInput): Promise<GuardResult<SpeakResult>> {
  const { provider, service } = pickProvider(input.locale);
  const cost = input.text.length * COST_PER_CHAR_USD[provider];

  return aiGuard(
    {
      childId: input.childId,
      service,
      estimatedCostUsd: cost,
      units: input.text.length,
      supabase: input.supabase,
    },
    async () => {
      if (provider === 'mock') return mockSpeak(input);
      // Real providers wired in Module 9 when keys land. The mock fallback
      // returns a deterministic placeholder so the UI flow keeps working.
      return mockSpeak(input);
    },
  );
}

export { mockSpeak } from './mock';
