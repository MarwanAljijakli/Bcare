import { setRequestLocale } from 'next-intl/server';
import { HelpIndexClient } from './help-index-client';
import type { AppLocale } from '@/i18n/routing';
import { getArticles } from '@/content/help';
import { pageMetadata } from '@/lib/seo';

/**
 * /[locale]/help — Module 8 help index.
 *
 * Public surface (no auth gate). Client-side Fuse.js fuzzy search
 * across title + summary + tags + section headings. Card grid below
 * shows every article with title + summary + last-updated date.
 */
export async function generateMetadata({ params }: { params: Promise<{ locale: AppLocale }> }) {
  const { locale } = await params;
  return pageMetadata({
    locale,
    path: 'help',
    title: locale === 'ar' ? 'المساعدة' : 'Help center',
    description:
      locale === 'ar'
        ? 'مقالات مساعدة وأدلة استخدام BlueCare.'
        : 'How-to guides + reference articles for BlueCare.',
  });
}

export default async function HelpPage({ params }: { params: Promise<{ locale: AppLocale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const articles = getArticles(locale);
  return <HelpIndexClient locale={locale} articles={articles} />;
}
