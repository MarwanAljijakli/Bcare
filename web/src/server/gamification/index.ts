/**
 * Gamification — calm by design.
 *
 * Per the master prompt:
 *   • Streak counter (consecutive days the child used the board).
 *   • Max 5 stars per UTC day. Hard cap, NEVER exceeded.
 *   • Unlockable palette-safe tile themes: animal / nature / space / ocean,
 *     plus the always-available default.
 *   • Soft 200ms milestone celebration. Debounced. No leaderboards, no
 *     time pressure, no comparisons across children.
 *   • Every celebration respects prefers-reduced-motion AND the child's
 *     quiet-mode toggle (gated client-side; the server just bookkeeps).
 *
 * State is persisted in `public.gamification_state`, one row per child,
 * upserted via service-role from the board's tRPC `recordOutput` path.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

type SupabaseAny = SupabaseClient<never>;

export type ThemeKey = 'default' | 'animal' | 'nature' | 'space' | 'ocean';
export const THEMES: readonly ThemeKey[] = ['default', 'animal', 'nature', 'space', 'ocean'];

/** Star total at which each theme unlocks. Tuned to land roughly weekly. */
export const THEME_UNLOCK_THRESHOLDS: Record<ThemeKey, number> = {
  default: 0,
  animal: 5,
  nature: 15,
  space: 30,
  ocean: 50,
};

export const DAILY_STAR_CAP = 5;

export interface GamificationState {
  child_id: string;
  total_stars: number;
  current_streak_days: number;
  longest_streak_days: number;
  stars_awarded_today: number;
  stars_awarded_day: string | null;
  unlocked_themes: ThemeKey[];
  selected_theme: ThemeKey | null;
  last_celebration_at: string | null;
}

export interface AwardStarResult {
  awarded: boolean;
  reason: 'awarded' | 'daily_cap' | 'no_state';
  state: GamificationState;
  newlyUnlockedTheme: ThemeKey | null;
}

function utcDate(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

function computeUnlocked(totalStars: number): ThemeKey[] {
  const out: ThemeKey[] = [];
  for (const t of THEMES) {
    if (totalStars >= THEME_UNLOCK_THRESHOLDS[t]) out.push(t);
  }
  return out;
}

/** Fetch (or initialize) the gamification_state row for a child. */
export async function getState(supabase: SupabaseAny, childId: string): Promise<GamificationState> {
  const r = await supabase
    .from('gamification_state')
    .select(
      'child_id, total_stars, current_streak_days, longest_streak_days, stars_awarded_today, stars_awarded_day, unlocked_themes, selected_theme, last_celebration_at',
    )
    .eq('child_id', childId)
    .maybeSingle();
  if (r.data) return r.data as GamificationState;

  // Initialize. Caregiver flow ensures the children row exists first.
  const initial: GamificationState = {
    child_id: childId,
    total_stars: 0,
    current_streak_days: 0,
    longest_streak_days: 0,
    stars_awarded_today: 0,
    stars_awarded_day: null,
    unlocked_themes: ['default'],
    selected_theme: 'default',
    last_celebration_at: null,
  };
  await (
    supabase.from('gamification_state') as never as {
      insert: (row: GamificationState) => Promise<unknown>;
    }
  ).insert(initial);
  return initial;
}

/**
 * Award one star for a successful speak event. Server-side enforces the
 * daily cap and the streak. Returns whether a star was awarded + the
 * up-to-date state + any newly-unlocked theme to surface.
 *
 * Idempotency: caller (board) should debounce on the client (200ms is
 * sufficient — humans don't chain Speak presses faster than that). The
 * server doesn't dedupe; double-awarding within the same tick would
 * count twice up to the daily cap, which is the desired behaviour for
 * legitimate consecutive utterances.
 */
export async function awardStarOnSpeak(
  supabase: SupabaseAny,
  childId: string,
): Promise<AwardStarResult> {
  const today = utcDate();
  const before = await getState(supabase, childId);

  // Daily cap.
  const sameDay = before.stars_awarded_day === today;
  const usedToday = sameDay ? before.stars_awarded_today : 0;
  if (usedToday >= DAILY_STAR_CAP) {
    return { awarded: false, reason: 'daily_cap', state: before, newlyUnlockedTheme: null };
  }

  // Streak.
  let newStreak = before.current_streak_days;
  if (!sameDay) {
    const yesterday = utcDate(new Date(Date.now() - 86_400_000));
    if (before.stars_awarded_day === yesterday) {
      newStreak = before.current_streak_days + 1;
    } else if (!before.stars_awarded_day) {
      newStreak = 1;
    } else {
      // Gap in the streak — reset to 1.
      newStreak = 1;
    }
  } else if (before.current_streak_days === 0) {
    // First star ever → streak = 1.
    newStreak = 1;
  }
  const newLongest = Math.max(before.longest_streak_days, newStreak);

  const newTotal = before.total_stars + 1;
  const newUsedToday = sameDay ? before.stars_awarded_today + 1 : 1;
  const newUnlocked = computeUnlocked(newTotal);
  const beforeUnlockedSet = new Set(before.unlocked_themes);
  const newlyUnlockedTheme = newUnlocked.find((t) => !beforeUnlockedSet.has(t)) ?? null;

  const next: GamificationState = {
    ...before,
    total_stars: newTotal,
    current_streak_days: newStreak,
    longest_streak_days: newLongest,
    stars_awarded_today: newUsedToday,
    stars_awarded_day: today,
    unlocked_themes: newUnlocked,
    last_celebration_at: new Date().toISOString(),
  };

  await (
    supabase.from('gamification_state') as never as {
      update: (patch: Omit<GamificationState, 'child_id' | 'selected_theme'>) => {
        eq: (col: string, v: string) => Promise<unknown>;
      };
    }
  )
    .update({
      total_stars: next.total_stars,
      current_streak_days: next.current_streak_days,
      longest_streak_days: next.longest_streak_days,
      stars_awarded_today: next.stars_awarded_today,
      stars_awarded_day: next.stars_awarded_day,
      unlocked_themes: next.unlocked_themes,
      last_celebration_at: next.last_celebration_at,
    })
    .eq('child_id', childId);

  return { awarded: true, reason: 'awarded', state: next, newlyUnlockedTheme };
}

/**
 * Caregiver-only: select an unlocked theme. Locked themes are
 * silently ignored (no error, no surface — the caregiver UI hides them).
 */
export async function setSelectedTheme(
  supabase: SupabaseAny,
  childId: string,
  theme: ThemeKey,
): Promise<GamificationState> {
  const state = await getState(supabase, childId);
  if (!state.unlocked_themes.includes(theme)) {
    return state; // no-op
  }
  await (
    supabase.from('gamification_state') as never as {
      update: (patch: { selected_theme: ThemeKey }) => {
        eq: (col: string, v: string) => Promise<unknown>;
      };
    }
  )
    .update({ selected_theme: theme })
    .eq('child_id', childId);
  return { ...state, selected_theme: theme };
}

/**
 * Pure helper exposed for unit testing. Given a star total, return the
 * list of unlocked themes (default is always included).
 */
export const __testing = { computeUnlocked, utcDate };
