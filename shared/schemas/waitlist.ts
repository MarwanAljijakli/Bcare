import { z } from 'zod';
import { localeSchema } from './common';

export const waitlistRoleSchema = z.enum(['family', 'therapist', 'school', 'other']);
export type WaitlistRole = z.infer<typeof waitlistRoleSchema>;

/**
 * Waitlist form input. Mirrors `db/schema/waitlist_signups`. Strict-but-friendly
 * email validation: zod's email() plus a length cap, no consecutive dots.
 */
export const waitlistSignupInputSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(5)
    .max(254) // RFC 5321
    .email()
    .refine((v) => !v.includes('..'), 'Invalid email'),
  role: waitlistRoleSchema.default('family'),
  locale: localeSchema.default('en'),
  source: z.string().trim().max(120).optional(),
  // Honeypot: a hidden field bots tend to fill. We accept the request only
  // when this is empty. Server-side; never echoed.
  honeypot: z.string().max(0).optional(),
});

export type WaitlistSignupInput = z.infer<typeof waitlistSignupInputSchema>;
