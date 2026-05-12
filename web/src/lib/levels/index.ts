/**
 * Child vocabulary levels (Phase 10.D).
 *
 * Maps symbol categories → tier, and tier → friendly metadata. Used by
 * the personalization cron for auto-promotion, by the board for the
 * "X/N mastered" badge, and by `/settings/level` for caregiver
 * override + tier descriptions.
 *
 * The `vocabulary_level` enum in `db/schema/enums.ts` has 4 tiers
 * (`starter | expanding | conversational | advanced`). The user-facing
 * specification framed them as 3 (`starter | intermediate | advanced`);
 * we keep the 4-tier DB shape and surface the labels in i18n so a
 * future rename is a copy change, not a destructive migration.
 *
 * Category source: `db/seed/reseed-targets.json` — the canonical 199
 * symbol set defines 13 categories. Every category belongs to exactly
 * one tier. Higher tiers INCLUDE lower-tier categories — i.e., an
 * "advanced" child sees `starter ∪ expanding ∪ conversational ∪ advanced`
 * categories, not just the four `advanced` categories. This matches
 * the spec's "unlocks all 159".
 */

export type VocabLevel = 'starter' | 'expanding' | 'conversational' | 'advanced';

export const VOCAB_LEVELS: VocabLevel[] = ['starter', 'expanding', 'conversational', 'advanced'];

/** Maps each tier to the categories first unlocked at that tier. */
export const LEVEL_CATEGORIES: Record<VocabLevel, readonly string[]> = {
  starter: ['core_needs', 'feelings', 'people'],
  expanding: ['food_drink', 'body', 'actions'],
  conversational: ['places', 'time', 'clothing', 'toys_play', 'social'],
  advanced: ['school', 'weather'],
};

/**
 * All categories visible at a given level — inclusive of lower tiers.
 * Used by both the board (to filter vocabulary_sets) and the
 * personalization cron (to compute mastery against the active set).
 */
export function categoriesForLevel(level: VocabLevel): string[] {
  const result: string[] = [];
  for (const tier of VOCAB_LEVELS) {
    result.push(...LEVEL_CATEGORIES[tier]);
    if (tier === level) break;
  }
  return result;
}

/** The next level in progression. `advanced` is terminal. */
export const LEVEL_PROGRESSION: Record<VocabLevel, VocabLevel> = {
  starter: 'expanding',
  expanding: 'conversational',
  conversational: 'advanced',
  advanced: 'advanced',
};

/** The previous level. `starter` is the floor. */
export const LEVEL_REGRESSION: Record<VocabLevel, VocabLevel> = {
  starter: 'starter',
  expanding: 'starter',
  conversational: 'expanding',
  advanced: 'conversational',
};

/** Approximate symbol counts per tier (used for the "X/N mastered" copy). */
export const LEVEL_TARGET_COUNTS: Record<VocabLevel, number> = {
  starter: 55,
  expanding: 125,
  conversational: 175,
  advanced: 199,
};

/** Mastery thresholds — a symbol is "mastered" at these usage levels. */
export const MASTERY_USES_THRESHOLD = 10;
export const MASTERY_SESSIONS_THRESHOLD = 3;

/** When ≥80% of active-tier symbols are mastered, auto-promote. */
export const AUTO_PROMOTION_PCT = 0.8;

/**
 * The position of a level in the progression (0-indexed). Used by the
 * level badge to render "Level 1 / 4".
 */
export function levelOrdinal(level: VocabLevel): number {
  return VOCAB_LEVELS.indexOf(level) + 1;
}

export const LEVEL_COUNT = VOCAB_LEVELS.length;
