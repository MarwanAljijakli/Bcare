import { describe, it, expect } from 'vitest';
import { directionForLocale, dirX } from './direction';

describe('directionForLocale', () => {
  it('maps en → ltr', () => {
    expect(directionForLocale('en')).toBe('ltr');
  });
  it('maps ar → rtl', () => {
    expect(directionForLocale('ar')).toBe('rtl');
  });
});

describe('dirX', () => {
  it('keeps the sign in LTR', () => {
    expect(dirX(8, 'ltr')).toBe(8);
    expect(dirX(-8, 'ltr')).toBe(-8);
  });
  it('flips the sign in RTL', () => {
    expect(dirX(8, 'rtl')).toBe(-8);
    expect(dirX(-8, 'rtl')).toBe(8);
  });
});
