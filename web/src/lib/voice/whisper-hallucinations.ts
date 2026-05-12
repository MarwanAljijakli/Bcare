/**
 * Whisper hallucination filter — Quality Fix Phase 9.B.
 *
 * whisper-1 on short clips (<2s) or near-silent clips biases toward
 * the most-common phrases in its training corpus, which is dominated
 * by YouTube auto-subtitle text. The result: a child says nothing or
 * mumbles, and Whisper confidently returns "اشتركوا في القناة"
 * ("Subscribe to the channel") or "Thank you for watching".
 *
 * This module owns the whitelist of known bad patterns + a fuzzy
 * matcher (Levenshtein distance < 3 against any canonical entry, after
 * Arabic diacritic stripping and punctuation normalization). Callers
 * route every Whisper transcript through `detectHallucination()` and
 * surface a typed `{ hallucination_detected: true, reason }` response
 * instead of returning the bogus text to the UI.
 *
 * Tested against the 6 patterns documented in the Phase 9 directive
 * (whisper-hallucinations.test.ts). When this filter still misses,
 * Phase 9.C STT-provider swap is the escalation path.
 */

/** The canonical hallucination patterns. Order doesn't matter; we
 *  match against every entry. Keep this list lower-cased + diacritic-
 *  free so the normalizer can compare apples-to-apples. */
export const KNOWN_HALLUCINATION_PATTERNS: readonly string[] = [
  // Arabic — YouTube subtitle bias.
  'اشتركوا في القناة',
  'اشترك في القناة',
  'شكرا لكم على المشاهدة',
  'شكرا لكم',
  'ترجمة الفيلم',
  'ترجمة',
  'نراكم في الفيديو القادم',
  // English — the same YouTube bias in the other language.
  'thank you for watching',
  'thanks for watching',
  'subscribe',
  'like and subscribe',
  'please subscribe',
  "don't forget to subscribe",
] as const;

/** Normalize Arabic + English text for fuzzy comparison:
 *   • lowercase (English)
 *   • strip Arabic diacritics (tashkeel: ً ٌ ٍ َ ُ ِ ّ ْ ٰ)
 *   • strip Arabic tatweel (ـ)
 *   • collapse alif variants (أ إ آ → ا)
 *   • collapse ya/alif-maksura (ى → ي)
 *   • collapse ta-marbuta (ة → ه) — common transcription variance
 *   • strip punctuation + collapse whitespace
 */
export function normalizeForMatch(input: string): string {
  return input
    .toLowerCase()
    .replace(/[ً-ْٰـ]/g, '') // diacritics + tatweel
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[.,!?؟،;:"'`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Classic Levenshtein distance. Iterative two-row DP — O(m*n) time,
 *  O(min(m,n)) space. Cap defensively at 240 chars (whisper transcripts
 *  longer than that are too long to be hallucination clones anyway). */
export function levenshtein(a: string, b: string): number {
  const s1 = a.length <= 240 ? a : a.slice(0, 240);
  const s2 = b.length <= 240 ? b : b.slice(0, 240);
  if (s1 === s2) return 0;
  if (s1.length === 0) return s2.length;
  if (s2.length === 0) return s1.length;

  let prev: number[] = new Array<number>(s2.length + 1).fill(0);
  let curr: number[] = new Array<number>(s2.length + 1).fill(0);
  for (let j = 0; j <= s2.length; j++) prev[j] = j;
  for (let i = 1; i <= s1.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= s2.length; j++) {
      const cost = s1.charCodeAt(i - 1) === s2.charCodeAt(j - 1) ? 0 : 1;
      const del = (prev[j] ?? 0) + 1;
      const ins = (curr[j - 1] ?? 0) + 1;
      const sub = (prev[j - 1] ?? 0) + cost;
      curr[j] = Math.min(del, ins, sub);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[s2.length] ?? 0;
}

export interface HallucinationDecision {
  hallucination: boolean;
  reason: 'matched_known_pattern' | 'near_substring' | 'none';
  /** The canonical pattern that triggered the match (for telemetry). */
  matched_pattern?: string;
}

/**
 * Decide whether a transcript is a known Whisper hallucination.
 *
 * Heuristic:
 *   1. Exact match (after normalization) → matched_known_pattern.
 *   2. The transcript contains a normalized pattern AS A SUBSTRING
 *      → near_substring.
 *   3. The transcript's Levenshtein distance to any pattern is < 3
 *      AND the transcript is short (≤ pattern.length + 6) → near_substring.
 *   4. Otherwise: not a hallucination.
 *
 * The "short transcript" guard prevents false positives on long
 * legitimate sentences that happen to contain a hallucination phrase
 * as a substring (e.g. a child reading aloud from a video).
 */
export function detectHallucination(transcript: string): HallucinationDecision {
  const text = normalizeForMatch(transcript);
  if (text.length === 0) {
    return { hallucination: false, reason: 'none' };
  }
  for (const pattern of KNOWN_HALLUCINATION_PATTERNS) {
    const p = normalizeForMatch(pattern);
    if (p.length === 0) continue;
    if (text === p) {
      return { hallucination: true, reason: 'matched_known_pattern', matched_pattern: pattern };
    }
    if (text.includes(p) && text.length <= p.length + 6) {
      return { hallucination: true, reason: 'near_substring', matched_pattern: pattern };
    }
    if (text.length <= p.length + 6) {
      const d = levenshtein(text, p);
      if (d < 3) {
        return { hallucination: true, reason: 'near_substring', matched_pattern: pattern };
      }
    }
  }
  return { hallucination: false, reason: 'none' };
}
