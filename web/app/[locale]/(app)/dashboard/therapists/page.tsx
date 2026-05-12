import { setRequestLocale } from 'next-intl/server';
import { TherapistsDashboardClient } from './therapists-client';
import type { AppLocale } from '@/i18n/routing';
import { pageMetadata } from '@/lib/seo';

/**
 * /dashboard/therapists — Module 6.1 item 2 (caregiver surface).
 *
 * The caregiver issues 12-char invite codes, watches their status, and
 * revokes either an unused invite or an accepted grant. Mirrors what
 * lives at /settings/therapists today but adds the grants list and
 * the revoke-grant action that the master-plan deferral originally
 * promised here.
 */
export async function generateMetadata({ params }: { params: Promise<{ locale: AppLocale }> }) {
  const { locale } = await params;
  return pageMetadata({
    locale,
    path: 'dashboard/therapists',
    title: locale === 'ar' ? 'مشاركة مع المعالج' : 'Therapist sharing',
    description:
      locale === 'ar'
        ? 'إصدار الرموز وإدارة وصول المعالجين إلى لوحة طفلك.'
        : 'Issue invite codes and manage therapist access to your child’s board.',
    robots: { index: false, follow: false },
  });
}

export default async function TherapistsDashboardPage({
  params,
}: {
  params: Promise<{ locale: AppLocale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <TherapistsDashboardClient locale={locale} />;
}
