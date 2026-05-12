/**
 * Shared Claude vision audit prompt — used by BOTH:
 *   • db/scripts/reseed-symbols-from-arasaac.ts (audit-on-insert)
 *   • db/scripts/audit-symbols.ts (acceptance + ongoing monitoring)
 *
 * Centralizing here guarantees the verified-by-construction property
 * holds: a candidate that passes audit-on-insert MUST also pass the
 * acceptance audit, because they apply the same standard.
 *
 * Module 9.1 refinement (2026-05-12): the previous prompt produced
 * 33 false-positive mismatches against the 159 production symbols
 * (pointing-finger flagged for "you", up/down arrows flagged for
 * "grow", house-with-smoke flagged for "house"). These are all
 * standard AAC iconography that the prompt was judging too literally.
 * The refinement adds 8 concrete few-shot exemplars + an explicit
 * "apply AAC convention reasoning BEFORE literal pattern-match"
 * instruction at the top. Acceptance target: ≤ 5 mismatches.
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

═══════════════════════════════════════════════════════════════════════
REASONING ORDER (do not skip this):
═══════════════════════════════════════════════════════════════════════

Before deciding matches=true/false, walk through these three steps in order:

STEP 1. Look at the image and describe what is visually present (the literal pixels — a pointing finger, an arrow, a stick figure with arms up, a house with a chimney, etc).

STEP 2. Ask yourself: "In commercial AAC products (Proloquo2Go, TouchChat, CoughDrop, PECS, ARASAAC, Boardmaker), what concept does this kind of pictogram conventionally represent?" This is NOT the same as the literal pixels — AAC pictograms are intentionally abstract.

STEP 3. Compare the conventional AAC meaning from step 2 to the given English label '${label_en}'. ONLY then set matches=true/false.

If you only do step 1 + step 3, you will produce false-positive mismatches because AAC pictograms ARE deliberately abstract. The whole point of step 2 is to bridge the gap.

═══════════════════════════════════════════════════════════════════════
AAC ICONOGRAPHY CONVENTIONS — eight examples to anchor your reasoning:
═══════════════════════════════════════════════════════════════════════

EXAMPLE A.  A pointing finger (index finger extended toward the viewer) labeled "you"
            → matches=true. Pointing IS the universal AAC symbol for second-person
            reference. Every commercial AAC product uses this exact glyph. Do NOT
            mark mismatch because "the image is just a finger, not a person".

EXAMPLE B.  Up/down arrows or a small plant growing taller labeled "grow"
            → matches=true. Directional arrows are the standard AAC abstraction for
            change-of-state verbs (grow, increase, rise, get bigger). Even when the
            image is JUST arrows, this is the AAC convention.

EXAMPLE C.  A stylized house with a smoking chimney labeled "house" or "home"
            → matches=true. The smoking-chimney house is the canonical home glyph
            across ARASAAC, Boardmaker, and Microsoft's pictogram set. The smoke
            is decorative; the concept is "dwelling".

EXAMPLE D.  A stick figure with arms raised labeled "stop"
            → matches=true. This IS the universal "stop" pictogram. Do NOT mark
            mismatch on grounds of "the figure is too abstract to be a person".

EXAMPLE E.  A sun setting over a horizon line labeled "afternoon" or "evening"
            → matches=true. AAC tradition depicts times of day with sun position:
            sun overhead = noon, sun setting = afternoon/evening, moon = night.

EXAMPLE F.  A hand reaching outward labeled "give" or "want"
            → matches=true. A single open hand reaching toward the viewer is the
            AAC convention for transactional verbs (give, want, need, please).

EXAMPLE G.  A stylized boy/girl figure (generic cartoon child, not a specific
            person) labeled "child" or "boy" or "girl"
            → matches=true. Generic cartoon children are the standard AAC glyph
            for child-related concepts. depicts_specific_person_face=false here.

EXAMPLE H.  A thumbs-up labeled "good" or "yes" or "OK"
            → matches=true. The thumbs-up is the AAC convention for affirmation
            even when the EN label is more abstract than "thumbs up". Similarly,
            thumbs-down = "bad" / "no" / "stop that".

═══════════════════════════════════════════════════════════════════════
WHEN TO MARK matches=false:
═══════════════════════════════════════════════════════════════════════

Only mark matches=false when the image CLEARLY shows a concept distant from the
label AND no AAC convention bridges them. Examples of legitimate mismatch:

  • Image of an armchair, label says "apple".
  • Image of a car, label says "sandwich".
  • Image of a dog, label says "school".
  • Image of meaningless geometric shapes with no AAC convention, label says
    "happy" (no thumbs-up, no smiley face, no AAC bridge — genuinely ambiguous).

If you are unsure whether an AAC convention bridges the gap, prefer
matches=true with a confidence around 0.70-0.85. False-negative cost (admin
manually re-reviews a real match) is much smaller than false-positive cost
(family sees an alarming "this symbol is wrong" report when actually it is
the correct standard AAC glyph).

═══════════════════════════════════════════════════════════════════════
OUTPUT FORMAT:
═══════════════════════════════════════════════════════════════════════

Reply with strict JSON only — no commentary, no fences, no preface. Schema:
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
- what_image_actually_shows: describe the LITERAL pixels (step 1 above), not the conventional meaning. Example: "a pointing finger extending toward the viewer" — NOT "the AAC symbol for you".
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
