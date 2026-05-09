import { z } from 'zod';

/**
 * Auth request schemas. Shared between client (rhf zodResolver) and server
 * (route handler validation). The client validates for fast feedback; the
 * server validates again because client-side validation is advisory only.
 */

export const signupRoleSchema = z.enum(['family', 'therapist', 'school']);
export type SignupRole = z.infer<typeof signupRoleSchema>;

export const passwordPolicy = z
  .string()
  .min(12, { message: 'too-short' })
  .max(128)
  .refine((v) => /[a-zA-Z]/.test(v) && /[0-9]/.test(v), { message: 'too-weak' });

export const signupRequestSchema = z
  .object({
    method: z.enum(['magic-link', 'password']),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .min(5)
      .max(254)
      .email()
      .refine((v) => !v.includes('..'), { message: 'invalid-format' }),
    fullName: z.string().trim().min(2).max(80),
    role: signupRoleSchema,
    schoolName: z.string().trim().min(1).max(160).optional(),
    password: passwordPolicy.optional(),
    consent: z.object({
      granted: z.literal(true),
      version: z.string().min(1).max(64),
      textHash: z.string().regex(/^[0-9a-f]{64}$/),
    }),
    locale: z.enum(['en', 'ar']),
  })
  .superRefine((val, ctx) => {
    // School path: schoolName required.
    if (val.role === 'school' && !val.schoolName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['schoolName'],
        message: 'required',
      });
    }
    // Password method: password required.
    if (val.method === 'password' && !val.password) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['password'],
        message: 'required',
      });
    }
  });

export type SignupRequest = z.infer<typeof signupRequestSchema>;

export const loginRequestSchema = z
  .object({
    method: z.enum(['magic-link', 'password']),
    email: z.string().trim().toLowerCase().min(5).max(254).email(),
    password: z.string().min(1).max(128).optional(),
    locale: z.enum(['en', 'ar']),
  })
  .superRefine((val, ctx) => {
    if (val.method === 'password' && !val.password) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['password'],
        message: 'required',
      });
    }
  });

export type LoginRequest = z.infer<typeof loginRequestSchema>;
