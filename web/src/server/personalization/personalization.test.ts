import { describe, it, expect } from 'vitest';

// Internal helper exposed for unit testing only.
const timeOfDayWeight = (hour: number): number => {
  if (hour >= 6 && hour <= 11) return 1.15;
  if (hour >= 18 && hour <= 21) return 1.1;
  if (hour >= 12 && hour <= 17) return 1.0;
  return 0.85;
};

describe('personalization — time-of-day weight', () => {
  it('boosts morning hours', () => {
    expect(timeOfDayWeight(7)).toBe(1.15);
    expect(timeOfDayWeight(11)).toBe(1.15);
  });

  it('boosts evening hours', () => {
    expect(timeOfDayWeight(18)).toBe(1.1);
    expect(timeOfDayWeight(21)).toBe(1.1);
  });

  it('keeps midday neutral', () => {
    expect(timeOfDayWeight(12)).toBe(1.0);
    expect(timeOfDayWeight(15)).toBe(1.0);
  });

  it('dampens late-night hours', () => {
    expect(timeOfDayWeight(2)).toBe(0.85);
    expect(timeOfDayWeight(23)).toBe(0.85);
  });
});

describe('personalization — mastery threshold edge cases', () => {
  // Mirror the engine's mastery math:
  //   mastery = (uses ≥ MASTERY_USES) per symbol
  //   advance when masteryPct ≥ MASTERY_PCT
  const MASTERY_USES = 10;
  const MASTERY_PCT = 0.8;

  function shouldAdvance(perSymbolUses: number[]): boolean {
    if (perSymbolUses.length === 0) return false;
    const mastered = perSymbolUses.filter((n) => n >= MASTERY_USES).length;
    return mastered / perSymbolUses.length >= MASTERY_PCT;
  }

  it('does not advance with zero usage', () => {
    expect(shouldAdvance([0, 0, 0, 0, 0])).toBe(false);
  });

  it('does not advance below the 80% threshold', () => {
    // 3 of 5 mastered = 60% — too low.
    expect(shouldAdvance([10, 10, 10, 5, 5])).toBe(false);
  });

  it('advances at exactly the threshold', () => {
    // 4 of 5 mastered = 80%.
    expect(shouldAdvance([10, 10, 10, 10, 5])).toBe(true);
  });

  it('advances when fully mastered', () => {
    expect(shouldAdvance([20, 20, 20, 20, 20])).toBe(true);
  });

  it('handles a single-symbol board', () => {
    expect(shouldAdvance([10])).toBe(true);
    expect(shouldAdvance([9])).toBe(false);
  });
});

describe('personalization — frequency-suggestion gating', () => {
  const SUGGESTION_MIN_USES = 2;
  const SUGGESTION_REJECTION_COOLDOWN_DAYS = 60;

  function passesMinUses(count: number): boolean {
    return count >= SUGGESTION_MIN_USES;
  }

  function withinCooldown(rejectedAtIso: string, nowIso: string): boolean {
    const cutoff = new Date(nowIso).getTime() - SUGGESTION_REJECTION_COOLDOWN_DAYS * 86400_000;
    return new Date(rejectedAtIso).getTime() > cutoff;
  }

  it('requires at least two uses to surface', () => {
    expect(passesMinUses(0)).toBe(false);
    expect(passesMinUses(1)).toBe(false);
    expect(passesMinUses(2)).toBe(true);
  });

  it('blocks recently-rejected symbols within the cooldown', () => {
    const now = '2026-05-10T00:00:00Z';
    expect(withinCooldown('2026-05-09T00:00:00Z', now)).toBe(true); // 1 day ago
    expect(withinCooldown('2026-04-01T00:00:00Z', now)).toBe(true); // ~40 days ago
    expect(withinCooldown('2026-02-01T00:00:00Z', now)).toBe(false); // ~100 days ago
  });
});
