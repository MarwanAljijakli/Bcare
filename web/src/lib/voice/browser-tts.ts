/**
 * Browser-native TTS via the Web Speech API (`window.speechSynthesis`).
 *
 * Free-first design: every modern browser ships SpeechSynthesis with at
 * least one EN voice and (on macOS / iOS / modern Windows) at least one
 * AR voice from the OS. ElevenLabs / Azure Neural TTS land in Module 9
 * as opt-in quality upgrades — never as hard dependencies.
 *
 * What this wrapper does:
 *   • Picks the best available voice for the requested language tag,
 *     falling back to the first matching `lang` prefix, then to default.
 *   • Reads `prefers-reduced-motion` to skip the 200ms ramp-in on the
 *     sentence strip animation hook (consumed by the board UI separately).
 *   • Returns a Promise that resolves on `onend` or rejects on `onerror`
 *     so the UI can drive a "speaking" state cleanly.
 *
 * The browser API needs a user gesture before audio plays — so the board
 * only invokes `speak()` from the Speak button click handler, not from
 * effect-driven autoplay.
 */

export interface SpeakOptions {
  text: string;
  lang: 'en' | 'ar';
  rate?: number;
  pitch?: number;
  volume?: number;
}

export interface VoiceMatch {
  name: string;
  lang: string;
  isLocal: boolean;
}

const LANG_BCP47: Record<'en' | 'ar', string[]> = {
  en: ['en-US', 'en-GB', 'en'],
  ar: ['ar-SA', 'ar-EG', 'ar-MA', 'ar'],
};

/** True if the browser exposes SpeechSynthesis at all. */
export function isTtsAvailable(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

/**
 * Speak the given text. Resolves on `onend`, rejects on `onerror`. No-op
 * (resolves immediately) if SpeechSynthesis isn't available — the caller
 * should still surface the visual confirmation.
 */
export function speak(opts: SpeakOptions): Promise<void> {
  if (!isTtsAvailable()) return Promise.resolve();
  const synth = window.speechSynthesis;

  // Cancel any in-flight utterance so consecutive Speak presses don't queue.
  synth.cancel();

  const utter = new SpeechSynthesisUtterance(opts.text);
  utter.rate = clamp(opts.rate ?? 0.95, 0.5, 1.5);
  utter.pitch = clamp(opts.pitch ?? 1.0, 0.5, 1.5);
  utter.volume = clamp(opts.volume ?? 1.0, 0, 1);

  const voice = pickVoice(opts.lang);
  if (voice) {
    utter.voice = voice;
    utter.lang = voice.lang;
  } else {
    utter.lang = LANG_BCP47[opts.lang][0]!;
  }

  return new Promise<void>((resolve, reject) => {
    utter.onend = () => resolve();
    utter.onerror = (e) => {
      // Some browsers fire `interrupted` when a new utterance preempts —
      // treat that as a non-error.
      if (e.error === 'interrupted' || e.error === 'canceled') {
        resolve();
      } else {
        reject(new TtsError(e.error ?? 'tts_failed'));
      }
    };
    synth.speak(utter);
  });
}

/** Cancel any in-flight TTS. Safe to call when nothing is playing. */
export function cancel(): void {
  if (!isTtsAvailable()) return;
  window.speechSynthesis.cancel();
}

/**
 * List the currently-installed voices for a given language tag. Useful
 * for the Module 6 voice-selection UI; not consumed during the board flow.
 */
export function listVoices(lang: 'en' | 'ar'): VoiceMatch[] {
  if (!isTtsAvailable()) return [];
  return window.speechSynthesis
    .getVoices()
    .filter((v) =>
      LANG_BCP47[lang].some((tag) => v.lang.toLowerCase().startsWith(tag.toLowerCase())),
    )
    .map((v) => ({ name: v.name, lang: v.lang, isLocal: v.localService }));
}

function pickVoice(lang: 'en' | 'ar'): SpeechSynthesisVoice | null {
  const all = window.speechSynthesis.getVoices();
  if (all.length === 0) return null;
  for (const tag of LANG_BCP47[lang]) {
    const exact = all.find((v) => v.lang === tag);
    if (exact) return exact;
  }
  for (const tag of LANG_BCP47[lang]) {
    const loose = all.find((v) =>
      v.lang.toLowerCase().startsWith(tag.toLowerCase().split('-')[0]!),
    );
    if (loose) return loose;
  }
  return null;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export class TtsError extends Error {
  constructor(public code: string) {
    super(code);
    this.name = 'TtsError';
  }
}
