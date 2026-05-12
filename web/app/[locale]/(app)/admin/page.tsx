import { setRequestLocale } from 'next-intl/server';
import { AdminOverviewClient } from './overview-client';
import type { AppLocale } from '@/i18n/routing';
import { pageMetadata } from '@/lib/seo';

/**
 * /[locale]/admin — Module 7 landing.
 *
 * 2x2 system health grid. Cards auto-refresh every 30s via SWR-style
 * useQuery refetchInterval. Data sources:
 *   • API health: /api/health
 *   • Auth health: /api/health/auth
 *   • Voice health: /api/health/voice
 *   • Database: project ref + symbols count via the admin client
 */
export async function generateMetadata({ params }: { params: Promise<{ locale: AppLocale }> }) {
  const { locale } = await params;
  return pageMetadata({
    locale,
    path: 'admin',
    title: locale === 'ar' ? 'لوحة المسؤول' : 'Admin overview',
    description:
      locale === 'ar'
        ? 'لوحة صحّة النظام: المصادقة، الصوت، قاعدة البيانات، النشر.'
        : 'System health dashboard: auth, voice, database, deploy.',
    robots: { index: false, follow: false },
  });
}

export default async function AdminOverviewPage({
  params,
}: {
  params: Promise<{ locale: AppLocale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <AdminOverviewClient locale={locale} />;
}
