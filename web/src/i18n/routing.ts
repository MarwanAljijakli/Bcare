import { createNavigation } from 'next-intl/navigation';
import { defineRouting } from 'next-intl/routing';

/**
 * Single source of truth for the supported locales and the default. Both
 * marketing and product surfaces honor the locale segment; switching languages
 * keeps the pathname and replaces the prefix.
 */
export const routing = defineRouting({
  locales: ['en', 'ar'],
  defaultLocale: 'en',
  // Always show the locale prefix — clearer than auto-detection, and matches
  // the public marketing structure /en /ar.
  localePrefix: 'always',
});

export type AppLocale = (typeof routing.locales)[number];

export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
