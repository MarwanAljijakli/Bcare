import { z } from 'zod';

export const localeSchema = z.enum(['en', 'ar']);
export const directionSchema = z.enum(['ltr', 'rtl']);
export const roleSchema = z.enum(['child', 'caregiver', 'therapist', 'admin']);
export const themeSchema = z.enum(['light', 'dark', 'hc']);
export const vocabularyLevelSchema = z.enum(['starter', 'expanding', 'conversational', 'advanced']);
export const inputModalitySchema = z.enum(['symbol', 'speech', 'gesture', 'keyboard']);
export const outputModalitySchema = z.enum(['tts', 'sentence-strip', 'visual-confirmation']);

export const sensoryProfileSchema = z.object({
  motion: z.enum(['full', 'reduced', 'off']),
  audio: z.enum(['full', 'soft', 'off']),
  contrast: z.enum(['standard', 'high']),
  touch: z.enum(['standard', 'large', 'extra-large']),
  fontScale: z.union([z.literal(1), z.literal(1.25), z.literal(1.5)]),
});

/** A bilingual label. Both forms are required at the data layer; UI may show one. */
export const bilingualTextSchema = z.object({
  en: z.string().min(1).max(120),
  ar: z.string().min(1).max(120),
});

export type BilingualText = z.infer<typeof bilingualTextSchema>;

/** UUID v4 for any application-generated ID. */
export const idSchema = z.string().uuid();

/** ISO 8601 timestamp string at the API boundary. */
export const timestampSchema = z.string().datetime();
