import type { AppLocale } from '@/i18n/routing';
import type { Metadata } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://bluecare.app';

const SITE_NAME = {
  en: 'BlueCare',
  ar: 'بلوكير',
} as const;

const DEFAULT_DESCRIPTION = {
  en: 'Smart, personalized communication for children with autism. Symbols, voice, and gestures, in Arabic and English.',
  ar: 'تواصل ذكي وشخصي للأطفال ذوي اضطراب طيف التوحد. رموز وصوت وإيماءات، بالعربية والإنجليزية.',
} as const;

export interface PageSeoInput {
  locale: AppLocale;
  /** Path under the locale segment (no leading slash). e.g. 'about', 'how-it-works'. */
  path?: string;
  /** Localized page title. The site name is appended automatically by the layout's title.template. */
  title?: string;
  /** Localized 1-2-sentence description. Falls back to the site default. */
  description?: string;
  /** Optional override for the OG image URL. Defaults to /api/og?locale=…&title=… */
  ogImage?: string;
  /** robots directive override. Default index, follow. */
  robots?: { index?: boolean; follow?: boolean };
}

/**
 * Build a Next.js Metadata object for a marketing page. Centralizing this
 * here keeps every page's <head> consistent and makes a sitewide change
 * (e.g., bumping OG image dimensions) a one-file edit.
 */
export function pageMetadata({
  locale,
  path = '',
  title,
  description,
  ogImage,
  robots,
}: PageSeoInput): Metadata {
  const trimmedPath = path.replace(/^\//, '');
  const localePath = trimmedPath ? `/${locale}/${trimmedPath}` : `/${locale}`;
  const canonical = new URL(localePath, BASE_URL).toString();
  const otherLocale: AppLocale = locale === 'en' ? 'ar' : 'en';
  const otherPath = trimmedPath ? `/${otherLocale}/${trimmedPath}` : `/${otherLocale}`;

  const desc = description ?? DEFAULT_DESCRIPTION[locale];
  const finalOgImage =
    ogImage ?? `/api/og?locale=${locale}&title=${encodeURIComponent(title ?? SITE_NAME[locale])}`;

  return {
    title: title,
    description: desc,
    alternates: {
      canonical,
      languages: {
        en: `/en${trimmedPath ? `/${trimmedPath}` : ''}`,
        ar: `/ar${trimmedPath ? `/${trimmedPath}` : ''}`,
        'x-default': `/en${trimmedPath ? `/${trimmedPath}` : ''}`,
      },
    },
    openGraph: {
      type: 'website',
      url: canonical,
      siteName: SITE_NAME[locale],
      title: title ?? SITE_NAME[locale],
      description: desc,
      locale: locale === 'ar' ? 'ar_SA' : 'en_US',
      alternateLocale: locale === 'ar' ? 'en_US' : 'ar_SA',
      images: [
        {
          url: finalOgImage,
          width: 1200,
          height: 630,
          alt: title ?? SITE_NAME[locale],
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: title ?? SITE_NAME[locale],
      description: desc,
      images: [finalOgImage],
    },
    robots: {
      index: robots?.index ?? true,
      follow: robots?.follow ?? true,
    },
    other: { 'og:locale:other': otherPath },
  };
}

export const SITE = { name: SITE_NAME, defaultDescription: DEFAULT_DESCRIPTION, baseUrl: BASE_URL };
