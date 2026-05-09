import { setRequestLocale, getTranslations } from 'next-intl/server';
import type { AppLocale } from '@/i18n/routing';
import { LegalPage } from '@/components/marketing/legal-page';
import { pageMetadata } from '@/lib/seo';

const SECTION_KEYS = [
  'service',
  'accounts',
  'acceptableUse',
  'ip',
  'fees',
  'termination',
  'disclaimer',
  'law',
  'contact',
] as const;

export async function generateMetadata({ params }: { params: Promise<{ locale: AppLocale }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'marketing.terms' });
  return pageMetadata({ locale, path: 'terms', title: t('title') });
}

export default async function TermsPage({ params }: { params: Promise<{ locale: AppLocale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'marketing.terms' });

  return (
    <LegalPage
      title={t('title')}
      lastUpdated={t('lastUpdated')}
      intro={t('intro')}
      sections={SECTION_KEYS.map((id) => ({
        id,
        title: t(`sections.${id}.title`),
        body: t(`sections.${id}.body`),
      }))}
    />
  );
}
