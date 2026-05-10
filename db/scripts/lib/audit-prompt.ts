/**
 * Shared Claude vision audit prompt — used by BOTH:
 *   • db/scripts/reseed-symbols-from-arasaac.ts (audit-on-insert)
 *   • db/scripts/audit-symbols.ts (acceptance + ongoing monitoring)
 *
 * Centralizing here guarantees the verified-by-construction property
 * holds: a candidate that passes audit-on-insert MUST also pass the
 * acceptance audit, because they apply the same standard.
 *
 * Earlier prompt-drift between the two scripts caused the reseed to
 * accept "afternoon" → sunset-pictogram (Claude treats stylized
 * AAC depictions as matches when told to) but the looser audit prompt
 * to flag it as a mismatch. Sharing the prompt fixes that.
 */

export interface VisionFinding {
  matches: boolean;
  confidence: number;
  what_image_actually_shows: string;
  recommended_label_en: string;
  recommended_label_ar: string;
  /** True if the image shows the face of a specific identifiable real
   *  person. Generic illustrated people / cartoon characters do NOT count. */
  depicts_specific_person_face: boolean;
  /** True if the image has a full sentence baked in. Mild text labels
   *  (one or two words) do NOT count. */
  has_embedded_sentence_text: boolean;
  /** True if the AR label reads naturally for a child in Saudi Arabia. */
  ar_label_natural_for_saudi_child: boolean;
}

export const visionAuditPrompt = (label_en: string, label_ar: string): string =>
  `You are auditing pictograms for an AAC (augmentative + alternative communication) tool used by autistic children, with users in Saudi Arabia. The candidate symbol is labeled '${label_en}' in English${label_ar ? ` and '${label_ar}' in Arabic` : ' (NO Arabic label provided — fill in recommended_label_ar with a fluent natural Saudi-child Arabic equivalent)'}.

CRITICAL — AAC pictogram conventions: the AAC tradition uses STYLIZED depictions for many concepts. A stick figure with arms raised IS the canonical "stop" pictogram. Crossed forearms IS the canonical "finished/done" pictogram. A hand reaching out IS "give" or "want". Two stick figures hugging IS "love". A sun setting at the horizon IS "afternoon" / "evening". Treat these stylized depictions as MATCHES even when they look schematic — the visual convention is intentional and is what AAC users learn. Only mark matches=false when the image clearly shows a DIFFERENT concept (e.g. labeled 'apple', shows armchair) or is genuinely ambiguous between two distant concepts.

Look at the attached image. Reply with strict JSON only — no commentary, no fences, no preface. Schema:
{
  "matches": boolean,
  "confidence": number,
  "what_image_actually_shows": string,
  "recommended_label_en": string,
  "recommended_label_ar": string,
  "depicts_specific_person_face": boolean,
  "has_embedded_sentence_text": boolean,
  "ar_label_natural_for_saudi_child": boolean
}

Field guidance:
- matches: true iff the image is a reasonable AAC pictogram for the given EN concept (applying AAC-convention awareness above). Stylized action / time / abstract depictions ARE matches.
- confidence: 0..1 scalar. Lean toward 0.85+ for clear-cut object pictograms (apple, ball). Lean 0.70-0.85 for stylized action/feeling/time pictograms even when correct.
- recommended_label_ar: must always be a fluent natural Saudi-child Arabic word/phrase for the EN concept, regardless of whether an AR label was provided. Use simple modern standard or Khaleeji-friendly vocabulary that a 4-7 year old would understand.
- depicts_specific_person_face: true ONLY if the image shows the face of a specific identifiable real person. Generic illustrated people / cartoon characters do NOT count.
- has_embedded_sentence_text: true if the image has a FULL SENTENCE baked in. Mild text labels (one or two words) do NOT count.
- ar_label_natural_for_saudi_child: true if the AR label that was provided (or your recommended_label_ar if none was provided) reads naturally for a child in Saudi Arabia. False if the Arabic is literal/awkward translation, formal-only register, or wrong dialect.`;

/** Robust JSON extractor — handles bare object, fenced object, or commentary-prefixed object. */
export function parseVisionFinding(text: string): VisionFinding | null {
  const candidates: string[] = [text.trim()];
  const fence = text.match(/```(?:json)?\s*([\s\S]+?)```/i);
  if (fence?.[1]) candidates.push(fence[1].trim());
  const brace = text.match(/\{[\s\S]*\}/);
  if (brace) candidates.push(brace[0]);
  for (const c of candidates) {
    try {
      const p = JSON.parse(c) as Partial<VisionFinding>;
      if (
        typeof p.matches !== 'boolean' ||
        typeof p.confidence !== 'number' ||
        typeof p.what_image_actually_shows !== 'string' ||
        typeof p.recommended_label_en !== 'string' ||
        typeof p.recommended_label_ar !== 'string'
      )
        continue;
      return {
        matches: p.matches,
        confidence: Math.max(0, Math.min(1, p.confidence)),
        what_image_actually_shows: p.what_image_actually_shows,
        recommended_label_en: p.recommended_label_en,
        recommended_label_ar: p.recommended_label_ar,
        depicts_specific_person_face: p.depicts_specific_person_face ?? false,
        has_embedded_sentence_text: p.has_embedded_sentence_text ?? false,
        ar_label_natural_for_saudi_child: p.ar_label_natural_for_saudi_child ?? true,
      };
    } catch {
      /* try next */
    }
  }
  return null;
}
