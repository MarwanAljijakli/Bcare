import { CheckCircle2 } from 'lucide-react';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import type { AppLocale } from '@/i18n/routing';
import { LegalPage } from '@/components/marketing/legal-page';
import { pageMetadata } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: AppLocale }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'marketing.accessibility' });
  return pageMetadata({ locale, path: 'accessibility', title: t('title') });
}

const TESTED_KEYS = [0, 1, 2, 3, 4] as const;

export default async function AccessibilityPage({
  params,
}: {
  params: Promise<{ locale: AppLocale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'marketing.accessibility' });

  const conformanceBody = (
    <div>
      <p>{t('conformance.summary')}</p>
      <ul className="mt-5 space-y-2">
        {TESTED_KEYS.map((i) => (
          <li key={i} className="flex items-start gap-2">
            <CheckCircle2 aria-hidden="true" className="text-success mt-0.5 h-4 w-4 shrink-0" />
            <span>{t(`conformance.tested.${i}`)}</span>
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <LegalPage
      title={t('title')}
      lastUpdated={t('lastUpdated')}
      intro={t('intro')}
      sections={[
        { id: 'conformance', title: t('conformance.title'), body: conformanceBody },
        { id: 'knownIssues', title: t('knownIssues.title'), body: t('knownIssues.body') },
        { id: 'feedback', title: t('feedback.title'), body: t('feedback.body') },
      ]}
    />
  );
}
