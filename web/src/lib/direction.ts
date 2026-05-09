import type { AppLocale } from '@/i18n/routing';

export type Direction = 'ltr' | 'rtl';

/** Maps a locale code to the document writing direction. */
export function directionForLocale(locale: AppLocale): Direction {
  return locale === 'ar' ? 'rtl' : 'ltr';
}

/**
 * Convenience for direction-aware Framer Motion x-axis offsets. In RTL the
 * "forward" visual direction is negative-x, so we flip the sign.
 */
export function dirX(distance: number, direction: Direction): number {
  return direction === 'rtl' ? -distance : distance;
}
