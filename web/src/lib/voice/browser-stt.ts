/**
 * Browser-native STT via the Web Speech API
 * (`SpeechRecognition` / `webkitSpeechRecognition`).
 *
 * Free-first design: works in Chrome, Edge, Safari (16.4+), and modern
 * Android WebView for both EN + AR using OS-level engines. Server-side
 * Whisper is the optional Module 9 upgrade behind a feature flag — never
 * the default.
 *
 * What this wrapper does:
 *   • Detects availability and returns a friendly `{ available: false,
 *     reason }` object so the board can show "STT not available in this
 *     browser" without crashing.
 *   • Records short hold-to-speak utterances (single-shot, not continuous).
 *   • Returns the best-matched transcript + confidence so the caller can
 *     map it to a symbol via fuzzy match. The transcript text is NEVER
 *     persisted — it's matched in-memory and discarded.
 *
 * Privacy posture: nothing in this module writes to the DB, to analytics,
 * or to logs. The transcript is consumed by the symbol-matcher and
 * dropped at the end of the function call.
 */

interface SpeechRecognitionResultLike {
  transcript: string;
  confidence: number;
  isFinal: boolean;
}

export interface SttResult {
  transcript: string;
  confidence: number;
}

export type SttAvailability =
  | { available: true }
  | { available: false; reason: 'no_browser_api' | 'permission_denied' | 'not_secure_context' };

/** Probe browser support without prompting for permission. */
export function getSttAvailability(): SttAvailability {
  if (typeof window === 'undefined') return { available: false, reason: 'no_browser_api' };
  // Web Speech API requires a secure context (https or localhost).
  if (!window.isSecureContext) {
    return { available: false, reason: 'not_secure_context' };
  }
  const Ctor =
    (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition ||
    (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition;
  if (!Ctor) return { available: false, reason: 'no_browser_api' };
  return { available: true };
}

/**
 * Single-shot recognition. Resolves with the best transcript or rejects
 * on permission-denied / network / language-not-supported. The caller
 * should debounce subsequent invocations on its own.
 */
export function recognizeOnce(opts: {
  lang: 'en' | 'ar';
  /** Max seconds to listen before forcing a stop. Default 6. */
  timeoutSec?: number;
}): Promise<SttResult> {
  const probe = getSttAvailability();
  if (!probe.available) {
    return Promise.reject(new SttError(probe.reason));
  }

  const Ctor =
    (window as unknown as { SpeechRecognition?: SpeechRecognitionConstructor }).SpeechRecognition ||
    (window as unknown as { webkitSpeechRecognition?: SpeechRecognitionConstructor })
      .webkitSpeechRecognition;
  if (!Ctor) return Promise.reject(new SttError('no_browser_api'));

  const recog = new Ctor();
  recog.lang = opts.lang === 'ar' ? 'ar-SA' : 'en-US';
  recog.interimResults = false;
  recog.maxAlternatives = 1;
  recog.continuous = false;

  return new Promise<SttResult>((resolve, reject) => {
    const timeout = window.setTimeout(
      () => {
        try {
          recog.stop();
        } catch {
          /* ignore */
        }
        reject(new SttError('timeout'));
      },
      (opts.timeoutSec ?? 6) * 1000,
    );

    recog.onresult = (event: SpeechRecognitionEventLike) => {
      window.clearTimeout(timeout);
      const last = event.results[event.results.length - 1];
      const best = last?.[0];
      if (!best) {
        reject(new SttError('no_match'));
        return;
      }
      resolve({ transcript: best.transcript.trim(), confidence: best.confidence });
    };

    recog.onerror = (event: { error?: string }) => {
      window.clearTimeout(timeout);
      const err = event.error ?? 'stt_failed';
      if (err === 'not-allowed' || err === 'service-not-allowed') {
        reject(new SttError('permission_denied'));
      } else if (err === 'no-speech') {
        reject(new SttError('no_match'));
      } else {
        reject(new SttError(err));
      }
    };

    recog.onend = () => {
      window.clearTimeout(timeout);
      // If no result event fired, treat as no_match.
      // (handled by onresult resolving first — this is just cleanup).
    };

    try {
      recog.start();
    } catch (e) {
      window.clearTimeout(timeout);
      reject(new SttError(e instanceof Error ? e.message : 'start_failed'));
    }
  });
}

/**
 * Fuzzy-match a transcript to one of the symbols. Returns the best symbol
 * id, or null if no symbol passes the similarity threshold. Pure function
 * — no I/O, no analytics.
 */
export function matchTranscriptToSymbol<
  S extends { id: string; label: string; phonetic?: string | null },
>(transcript: string, symbols: readonly S[]): { symbolId: string; score: number } | null {
  const norm = normalize(transcript);
  let best: { symbolId: string; score: number } | null = null;
  for (const s of symbols) {
    const labelN = normalize(s.label);
    const phonN = s.phonetic ? normalize(s.phonetic) : null;
    const labelScore = similarity(norm, labelN);
    const phonScore = phonN ? similarity(norm, phonN) : 0;
    const score = Math.max(labelScore, phonScore);
    if (!best || score > best.score) best = { symbolId: s.id, score };
  }
  // 0.6 threshold keeps obvious matches without making the board feel
  // "stuck" on near-misses; 0.5 was too noisy in the unit-test corpus.
  if (best && best.score >= 0.6) return best;
  return null;
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function similarity(a: string, b: string): number {
  if (a === b) return 1;
  if (!a || !b) return 0;
  // Cheap Sørensen-Dice on word bigrams. Adequate for short labels.
  const bigrams = (s: string) => {
    const out = new Set<string>();
    for (let i = 0; i < s.length - 1; i++) out.add(s.slice(i, i + 2));
    return out;
  };
  const A = bigrams(a);
  const B = bigrams(b);
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return (2 * inter) / (A.size + B.size || 1);
}

export class SttError extends Error {
  constructor(public code: string) {
    super(code);
    this.name = 'SttError';
  }
}

interface SpeechRecognitionConstructor {
  new (): {
    lang: string;
    interimResults: boolean;
    maxAlternatives: number;
    continuous: boolean;
    onresult: ((event: SpeechRecognitionEventLike) => void) | null;
    onerror: ((event: { error?: string }) => void) | null;
    onend: (() => void) | null;
    start: () => void;
    stop: () => void;
  };
}

interface SpeechRecognitionEventLike {
  results: ArrayLike<ArrayLike<SpeechRecognitionResultLike>>;
}
