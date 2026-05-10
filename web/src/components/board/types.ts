/**
 * Shared types for board components. Keeping the surface narrow so the
 * tRPC bootstrap output and the prop signatures stay in lockstep.
 */

export type CategoryKey =
  | 'core'
  | 'food'
  | 'feelings'
  | 'people'
  | 'actions'
  | 'places'
  | 'time'
  | 'all';

export interface BoardSymbol {
  id: string;
  label_en: string;
  label_ar: string;
  phonetic_en: string | null;
  phonetic_ar: string | null;
  image_path: string;
  categories: string[];
  tags: string[];
}

export interface BoardChild {
  id: string;
  full_name: string;
  preferred_name: string | null;
  preferred_locale: 'en' | 'ar';
  preferred_theme: 'light' | 'dark' | 'hc';
  vocabulary_level: 'starter' | 'expanding' | 'conversational' | 'advanced';
  voice_id: string | null;
  sensory_profile: {
    motion: 'full' | 'reduced' | 'off';
    audio: 'full' | 'soft' | 'off';
    contrast: 'standard' | 'high';
    touch: 'standard' | 'large' | 'extra-large';
    fontScale: 1 | 1.25 | 1.5;
  };
}

export interface BoardBootstrap {
  child: BoardChild;
  symbols: BoardSymbol[];
  favorites: string[];
  bucket: string;
}

/** Map UI locale to the right label for a symbol. */
export function symbolLabel(s: BoardSymbol, locale: 'en' | 'ar'): string {
  return locale === 'ar' ? s.label_ar : s.label_en;
}

export function symbolPhonetic(s: BoardSymbol, locale: 'en' | 'ar'): string | null {
  return locale === 'ar' ? s.phonetic_ar : s.phonetic_en;
}
