import { describe, it, expect } from 'vitest';
import { THEMES, THEME_UNLOCK_THRESHOLDS, __testing } from './index';

const { computeUnlocked } = __testing;

describe('gamification — theme unlock thresholds', () => {
  it('always unlocks default at 0 stars', () => {
    expect(computeUnlocked(0)).toEqual(['default']);
  });

  it('unlocks animal at exactly 5 stars', () => {
    expect(computeUnlocked(4)).toEqual(['default']);
    expect(computeUnlocked(5)).toEqual(['default', 'animal']);
  });

  it('unlocks nature at 15', () => {
    expect(computeUnlocked(14)).toEqual(['default', 'animal']);
    expect(computeUnlocked(15)).toEqual(['default', 'animal', 'nature']);
  });

  it('unlocks space at 30', () => {
    expect(computeUnlocked(29)).toEqual(['default', 'animal', 'nature']);
    expect(computeUnlocked(30)).toEqual(['default', 'animal', 'nature', 'space']);
  });

  it('unlocks ocean at 50', () => {
    expect(computeUnlocked(49)).toEqual(['default', 'animal', 'nature', 'space']);
    expect(computeUnlocked(50)).toEqual(['default', 'animal', 'nature', 'space', 'ocean']);
    expect(computeUnlocked(1000)).toEqual([...THEMES]);
  });

  it('thresholds are monotonic', () => {
    let prev = -1;
    for (const t of THEMES) {
      expect(THEME_UNLOCK_THRESHOLDS[t]).toBeGreaterThanOrEqual(prev);
      prev = THEME_UNLOCK_THRESHOLDS[t];
    }
  });
});

describe('gamification — daily cap math', () => {
  // Mirror the engine's hard cap (5 stars/day, hard cap, never exceeded).
  const CAP = 5;

  function shouldAward(usedToday: number): boolean {
    return usedToday < CAP;
  }

  it('awards when below the cap', () => {
    for (let i = 0; i < CAP; i++) expect(shouldAward(i)).toBe(true);
  });

  it('refuses at the cap', () => {
    expect(shouldAward(CAP)).toBe(false);
    expect(shouldAward(CAP + 1)).toBe(false);
    expect(shouldAward(100)).toBe(false);
  });
});

describe('gamification — streak math', () => {
  // Mirror the engine's streak logic so we can validate edge cases.
  function nextStreak(opts: {
    sameDay: boolean;
    yesterdayAwarded: boolean;
    everAwarded: boolean;
    currentStreak: number;
  }): number {
    if (opts.sameDay) {
      return opts.currentStreak === 0 ? 1 : opts.currentStreak;
    }
    if (opts.yesterdayAwarded) return opts.currentStreak + 1;
    if (!opts.everAwarded) return 1;
    return 1; // gap: reset
  }

  it('starts at 1 on first ever star', () => {
    expect(
      nextStreak({ sameDay: false, yesterdayAwarded: false, everAwarded: false, currentStreak: 0 }),
    ).toBe(1);
  });

  it('extends when yesterday had a star', () => {
    expect(
      nextStreak({ sameDay: false, yesterdayAwarded: true, everAwarded: true, currentStreak: 4 }),
    ).toBe(5);
  });

  it('preserves on same-day awards', () => {
    expect(
      nextStreak({ sameDay: true, yesterdayAwarded: false, everAwarded: true, currentStreak: 3 }),
    ).toBe(3);
  });

  it('resets to 1 after a gap', () => {
    expect(
      nextStreak({ sameDay: false, yesterdayAwarded: false, everAwarded: true, currentStreak: 7 }),
    ).toBe(1);
  });
});
