/**
 * Domain types shared across web and db. Database row types live in @bluecare/db
 * and are imported via the @bluecare/db package, not duplicated here.
 */

export type Locale = 'en' | 'ar';

export type Direction = 'ltr' | 'rtl';

export const localeDirection: Record<Locale, Direction> = {
  en: 'ltr',
  ar: 'rtl',
} as const;

/** Application roles. Mirrored in Supabase RLS policies. */
export type Role = 'child' | 'caregiver' | 'therapist' | 'admin';

/** Sensory profile — drives UI defaults (motion, audio, contrast, touch sensitivity). */
export interface SensoryProfile {
  motion: 'full' | 'reduced' | 'off';
  audio: 'full' | 'soft' | 'off';
  contrast: 'standard' | 'high';
  touch: 'standard' | 'large' | 'extra-large';
  fontScale: 1 | 1.25 | 1.5;
}

export const defaultSensoryProfile: SensoryProfile = {
  motion: 'full',
  audio: 'full',
  contrast: 'standard',
  touch: 'standard',
  fontScale: 1,
};

/** Vocabulary level (drives starting symbol set + difficulty progression). */
export type VocabularyLevel = 'starter' | 'expanding' | 'conversational' | 'advanced';

/** Input modalities. Telemetry rolls up by these. */
export type InputModality = 'symbol' | 'speech' | 'gesture' | 'keyboard';

/** Output modalities. */
export type OutputModality = 'tts' | 'sentence-strip' | 'visual-confirmation';

/** Theme name. Mirrors @bluecare/shared/tokens.semantic keys. */
export type Theme = 'light' | 'dark' | 'hc';

/** Discriminated result type for service functions. Avoids try/catch in call sites. */
export type Result<T, E = Error> = { ok: true; value: T } | { ok: false; error: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });
