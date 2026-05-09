import { describe, it, expect } from 'vitest';
import {
  bilingualTextSchema,
  inputModalitySchema,
  localeSchema,
  roleSchema,
  sensoryProfileSchema,
  themeSchema,
  vocabularyLevelSchema,
} from './common.js';

describe('common schemas', () => {
  it('localeSchema accepts en and ar only', () => {
    expect(localeSchema.safeParse('en').success).toBe(true);
    expect(localeSchema.safeParse('ar').success).toBe(true);
    expect(localeSchema.safeParse('fr').success).toBe(false);
  });

  it('roleSchema accepts the four roles', () => {
    for (const role of ['child', 'caregiver', 'therapist', 'admin']) {
      expect(roleSchema.safeParse(role).success).toBe(true);
    }
    expect(roleSchema.safeParse('owner').success).toBe(false);
  });

  it('themeSchema accepts the three themes', () => {
    for (const t of ['light', 'dark', 'hc']) {
      expect(themeSchema.safeParse(t).success).toBe(true);
    }
  });

  it('vocabularyLevelSchema accepts the four levels', () => {
    for (const v of ['starter', 'expanding', 'conversational', 'advanced']) {
      expect(vocabularyLevelSchema.safeParse(v).success).toBe(true);
    }
  });

  it('inputModalitySchema accepts the four modalities', () => {
    for (const m of ['symbol', 'speech', 'gesture', 'keyboard']) {
      expect(inputModalitySchema.safeParse(m).success).toBe(true);
    }
  });

  it('sensoryProfileSchema rejects out-of-range fontScale', () => {
    expect(
      sensoryProfileSchema.safeParse({
        motion: 'full',
        audio: 'full',
        contrast: 'standard',
        touch: 'standard',
        fontScale: 1,
      }).success,
    ).toBe(true);
    expect(
      sensoryProfileSchema.safeParse({
        motion: 'full',
        audio: 'full',
        contrast: 'standard',
        touch: 'standard',
        fontScale: 2,
      }).success,
    ).toBe(false);
  });

  it('bilingualTextSchema requires both en and ar non-empty', () => {
    expect(bilingualTextSchema.safeParse({ en: 'eat', ar: 'يأكل' }).success).toBe(true);
    expect(bilingualTextSchema.safeParse({ en: 'eat', ar: '' }).success).toBe(false);
    expect(bilingualTextSchema.safeParse({ en: '', ar: 'يأكل' }).success).toBe(false);
  });
});
