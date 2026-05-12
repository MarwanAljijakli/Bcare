import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { ArticleClient } from './article-client';
import type { AppLocale } from '@/i18n/routing';
import { allHelpSlugs, getArticle } from '@/content/help';
import { routing } from '@/i18n/routing';
import { pageMetadata } from '@/lib/seo';

/**
 * /[locale]/help/[slug] — Module 8 article page.
 *
 * Statically generated for every (locale, slug) pair so each article
 * ships as cached HTML on the CDN. The client component handles the
 * TOC scroll behavior, the copy-link buttons, and the helpful 👍/👎
 * mutation.
 */
export async function generateStaticParams() {
  const out: { locale: AppLocale; slug: string }[] = [];
  for (const locale of routing.locales) {
    for (const slug of allHelpSlugs()) {
      out.push({ locale, slug });
    }
  }
  return out;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: AppLocale; slug: string }>;
}) {
  const { locale, slug } = await params;
  const article = getArticle(locale, slug);
  if (!article) {
    return pageMetadata({
      locale,
      path: `help/${slug}`,
      title: locale === 'ar' ? 'مقال غير موجود' : 'Article not found',
      description: '',
    });
  }
  return pageMetadata({
    locale,
    path: `help/${slug}`,
    title: article.title,
    description: article.summary,
  });
}

export default async function HelpArticlePage({
  params,
}: {
  params: Promise<{ locale: AppLocale; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const article = getArticle(locale, slug);
  if (!article) notFound();
  return <ArticleClient locale={locale} article={article} />;
}
