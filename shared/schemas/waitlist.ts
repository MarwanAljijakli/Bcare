import { z } from 'zod';
import { localeSchema } from './common';

export const waitlistRoleSchema = z.enum(['family', 'therapist', 'school', 'other']);
export type WaitlistRole = z.infer<typeof waitlistRoleSchema>;

/**
 * @deprecated Retained only so the legacy /api/waitlist route handler keeps
 * compiling for any in-flight inbound traffic. BlueCare is free + open as of
 * Module 1.5 — no UI references this schema anymore. Slated for removal in
 * Module 9 hardening (see docs/backlog.md).
 *
 * Legacy contract below — strict-but-friendly email validation, length cap,
 * no consecutive dots, honeypot field.
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
