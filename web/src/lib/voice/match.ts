/**
 * Transcript → symbol fuzzy matcher. Pure helper, no I/O.
 *
 * Used by the board after Whisper returns a transcript: we map the
 * heard utterance to one of the child's active symbols via Sørensen-
 * Dice similarity on lowercase + accent-stripped + word-bigram
 * representation. Adequate for short labels (1-3 words) where the
 * AAC vocabulary lives.
 *
 * Was originally co-located with the now-deleted browser-stt.ts; moved
 * here in Quality Fix Phase 2 so the deletion doesn't strand callers.
 */

export function matchTranscriptToSymbol<
  S extends { id: string; label: string; phonetic?: string | null },
>(
  transcript: string,
  symbols: readonly S[],
  threshold = 0.6,
): { symbolId: string; score: number } | null {
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
  if (best && best.score >= threshold) return best;
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
  // Sørensen-Dice on word bigrams. Cheap, adequate for short labels.
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
