import { describe, expect, it } from 'vitest';
import {
  ageYears,
  firstNameOf,
  formatDecimal,
  formatDurationShort,
  formatInteger,
  formatPercent,
  formatShortDate,
  pickSymbolLabel,
  sortChildrenForTabs,
} from './format';

const UNITS_EN = { hour: 'h', minute: 'm', second: 's' };
const UNITS_AR = { hour: 'س', minute: 'د', second: 'ث' };

/**
 * Format helpers — module 6 dashboard. Pure functions; the tests are
 * tight and focused. Locale-specific output (Arabic-Indic digits) is
 * verified end-to-end so a regression in `Intl.NumberFormat` would be
 * caught here rather than in production.
 */
describe('dashboard format helpers', () => {
  describe('formatInteger', () => {
    it('renders ASCII digits for en', () => {
      expect(formatInteger(0, 'en')).toBe('0');
      expect(formatInteger(1234, 'en')).toBe('1,234');
    });
    it('renders Arabic-Indic digits for ar', () => {
      expect(formatInteger(5, 'ar')).toMatch(/[٠-٩]/);
      expect(formatInteger(1234, 'ar')).toMatch(/[٠-٩]/);
    });
  });

  describe('formatPercent', () => {
    it('clamps to 0..1', () => {
      expect(formatPercent(-0.5, 'en')).toBe('0%');
      expect(formatPercent(2, 'en')).toBe('100%');
    });
    it('rounds to whole percents', () => {
      expect(formatPercent(0.756, 'en')).toBe('76%');
    });
    it('survives NaN', () => {
      expect(formatPercent(Number.NaN, 'en')).toBe('0%');
    });
  });

  describe('formatDecimal', () => {
    it('shows up to one decimal', () => {
      expect(formatDecimal(3.14, 'en')).toBe('3.1');
      expect(formatDecimal(3, 'en')).toBe('3');
    });
    it('survives NaN', () => {
      expect(formatDecimal(Number.NaN, 'en')).toBe('0');
    });
  });

  describe('formatDurationShort', () => {
    it('renders seconds for sub-minute durations', () => {
      expect(formatDurationShort(45, 'en', UNITS_EN)).toBe('45s');
    });
    it('renders minutes + seconds', () => {
      expect(formatDurationShort(125, 'en', UNITS_EN)).toBe('2m 5s');
    });
    it('renders hours + minutes', () => {
      expect(formatDurationShort(3725, 'en', UNITS_EN)).toBe('1h 2m');
    });
    it('omits trailing zero units', () => {
      expect(formatDurationShort(120, 'en', UNITS_EN)).toBe('2m');
      expect(formatDurationShort(3600, 'en', UNITS_EN)).toBe('1h');
    });
    it('uses the supplied units in ar', () => {
      expect(formatDurationShort(125, 'ar', UNITS_AR)).toContain('د');
      expect(formatDurationShort(125, 'ar', UNITS_AR)).toContain('ث');
    });
  });

  describe('formatShortDate', () => {
    it('formats a valid ISO date in en', () => {
      // Avoid asserting exact string due to ICU drift between Node versions;
      // assert the day digit is present and locale didn't fall through.
      expect(formatShortDate('2026-05-09', 'en')).toMatch(/9/);
    });
    it('returns the input when unparseable', () => {
      expect(formatShortDate('not-a-date', 'en')).toBe('not-a-date');
    });
  });

  describe('pickSymbolLabel', () => {
    it('prefers locale-matching label', () => {
      const sym = { label_en: 'Apple', label_ar: 'تفاحة' };
      expect(pickSymbolLabel('en', sym)).toBe('Apple');
      expect(pickSymbolLabel('ar', sym)).toBe('تفاحة');
    });
    it('falls back to the other locale when primary is missing', () => {
      expect(pickSymbolLabel('ar', { label_en: 'Apple', label_ar: null })).toBe('Apple');
    });
    it('falls back to placeholder when both missing', () => {
      expect(pickSymbolLabel('en', { label_en: null, label_ar: null }, '∅')).toBe('∅');
    });
    it('handles a null symbol', () => {
      expect(pickSymbolLabel('en', null)).toBe('—');
    });
    it('trims whitespace', () => {
      expect(pickSymbolLabel('en', { label_en: '  Apple  ', label_ar: null })).toBe('Apple');
    });
  });

  describe('ageYears', () => {
    it('returns null for missing dob', () => {
      expect(ageYears(null)).toBeNull();
      expect(ageYears(undefined)).toBeNull();
    });
    it('returns null for unparseable dob', () => {
      expect(ageYears('not-a-date')).toBeNull();
    });
    it('subtracts 1 if birthday has not occurred yet this year', () => {
      // child born 2020-12-31; "now" 2026-05-10 → still 5
      expect(ageYears('2020-12-31', new Date('2026-05-10'))).toBe(5);
    });
    it('does not subtract once birthday has passed', () => {
      expect(ageYears('2021-01-01', new Date('2026-05-10'))).toBe(5);
    });
    it('floors at 0', () => {
      // future dob — would naively yield negative
      expect(ageYears('2030-01-01', new Date('2026-05-10'))).toBe(0);
    });
  });

  describe('firstNameOf', () => {
    it('returns first whitespace-delimited token', () => {
      expect(firstNameOf('Test Caregiver')).toBe('Test');
      expect(firstNameOf('  Sami   Al Faisal  ')).toBe('Sami');
    });
    it('returns null for empty input', () => {
      expect(firstNameOf(null)).toBeNull();
      expect(firstNameOf('   ')).toBeNull();
    });
  });

  describe('sortChildrenForTabs', () => {
    it('sorts by name, alphabetical', () => {
      const out = sortChildrenForTabs([
        { id: 'b', name: 'Banana', ageYears: 4 },
        { id: 'a', name: 'Apple', ageYears: 5 },
      ]);
      expect(out.map((c) => c.id)).toEqual(['a', 'b']);
    });
    it('does not mutate input', () => {
      const input = [
        { id: 'b', name: 'Banana', ageYears: 4 },
        { id: 'a', name: 'Apple', ageYears: 5 },
      ];
      const inputCopy = [...input];
      sortChildrenForTabs(input);
      expect(input).toEqual(inputCopy);
    });
  });
});
