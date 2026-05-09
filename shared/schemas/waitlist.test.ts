import { describe, it, expect } from 'vitest';
import { waitlistSignupInputSchema } from './waitlist';

describe('waitlistSignupInputSchema', () => {
  it('accepts a valid family signup', () => {
    const result = waitlistSignupInputSchema.safeParse({
      email: 'parent@example.com',
      role: 'family',
      locale: 'en',
    });
    expect(result.success).toBe(true);
  });

  it('lowercases and trims emails', () => {
    const result = waitlistSignupInputSchema.parse({
      email: '  PARENT@EXAMPLE.com  ',
    });
    expect(result.email).toBe('parent@example.com');
  });

  it('rejects malformed emails', () => {
    expect(waitlistSignupInputSchema.safeParse({ email: 'not-an-email' }).success).toBe(false);
    expect(waitlistSignupInputSchema.safeParse({ email: 'a@b' }).success).toBe(false);
    expect(waitlistSignupInputSchema.safeParse({ email: 'a..b@example.com' }).success).toBe(false);
  });

  it('rejects when honeypot is filled (bot heuristic)', () => {
    const result = waitlistSignupInputSchema.safeParse({
      email: 'parent@example.com',
      honeypot: 'i-am-a-bot',
    });
    expect(result.success).toBe(false);
  });

  it('defaults role to family and locale to en', () => {
    const result = waitlistSignupInputSchema.parse({ email: 'parent@example.com' });
    expect(result.role).toBe('family');
    expect(result.locale).toBe('en');
  });

  it('caps email length at 254 chars (RFC 5321)', () => {
    const tooLong = 'a'.repeat(250) + '@e.co';
    expect(waitlistSignupInputSchema.safeParse({ email: tooLong }).success).toBe(false);
  });
});
