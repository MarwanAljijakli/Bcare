import { AR_ARTICLES } from './articles-ar';
import { EN_ARTICLES } from './articles-en';
import type { HelpArticle } from './types';

/**
 * Help-article registry — Module 8.
 *
 * Single import surface for the help index + article pages. The
 * parity assertion at module-load time guarantees every slug exists
 * in both locales, so a missing translation surfaces during dev
 * rather than at runtime when a user hits a 404.
 */

const enSlugs = new Set(EN_ARTICLES.map((a) => a.slug));
const arSlugs = new Set(AR_ARTICLES.map((a) => a.slug));

const missingInAr = [...enSlugs].filter((s) => !arSlugs.has(s));
const missingInEn = [...arSlugs].filter((s) => !enSlugs.has(s));

if (missingInAr.length > 0 || missingInEn.length > 0) {
  throw new Error(
    `Help article parity broken — EN-only: [${missingInAr.join(', ')}]; AR-only: [${missingInEn.join(', ')}]`,
  );
}

export type { HelpArticle, HelpSection } from './types';

/** Articles for a single locale, in author order. */
export function getArticles(locale: 'en' | 'ar'): HelpArticle[] {
  return locale === 'ar' ? AR_ARTICLES : EN_ARTICLES;
}

/** One article by slug, or null. */
export function getArticle(locale: 'en' | 'ar', slug: string): HelpArticle | null {
  return getArticles(locale).find((a) => a.slug === slug) ?? null;
}

/** All slugs (same in both locales by parity assertion). */
export function allHelpSlugs(): string[] {
  return EN_ARTICLES.map((a) => a.slug);
}
