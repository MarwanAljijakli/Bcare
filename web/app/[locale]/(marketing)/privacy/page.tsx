import { setRequestLocale, getTranslations } from 'next-intl/server';
import type { AppLocale } from '@/i18n/routing';
import { LegalPage } from '@/components/marketing/legal-page';
import { pageMetadata } from '@/lib/seo';

const SECTION_KEYS = [
  'whoWeAre',
  'whatWeCollect',
  'whyWeCollect',
  'lawfulBasis',
  'thirdParties',
  'retention',
  'yourRights',
  'children',
  'changes',
] as const;

export async function generateMetadata({ params }: { params: Promise<{ locale: AppLocale }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'marketing.privacy' });
  return pageMetadata({ locale, path: 'privacy', title: t('title') });
}

export default async function PrivacyPage({ params }: { params: Promise<{ locale: AppLocale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'marketing.privacy' });

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
