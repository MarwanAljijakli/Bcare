import { setRequestLocale } from 'next-intl/server';
import { TherapistCaseloadClient } from './caseload-client';
import type { AppLocale } from '@/i18n/routing';
import { pageMetadata } from '@/lib/seo';

/**
 * /therapist — Module 6.1 item 2 (therapist surface).
 *
 * Therapist caseload index: one tile per child the caller has an active
 * `therapist_grants` row for. Each tile links to the read-mostly
 * dashboard view for that child (the caregiver dashboard already
 * supports the ?child= query param via RLS; migration 0010 lets the
 * therapist read the child's progress + sessions data).
 *
 * Auth gate: parent (app)/layout.tsx already redirects unauthenticated
 * visitors. We don't gate by "role=therapist" — a caregiver who happens
 * to also be a therapist for another family lands here too and sees
 * their caseload (which may be empty if they haven't accepted any
 * invites). Empty state copy is friendly.
 */
export async function generateMetadata({ params }: { params: Promise<{ locale: AppLocale }> }) {
  const { locale } = await params;
  return pageMetadata({
    locale,
    path: 'therapist',
    title: locale === 'ar' ? 'لوحة المعالج' : 'Therapist dashboard',
    description:
      locale === 'ar'
        ? 'قائمة الأطفال الذين منحك أولياء أمورهم حق الوصول إلى لوحاتهم.'
        : 'Children whose caregivers have granted you access to their board.',
    robots: { index: false, follow: false },
  });
}

export default async function TherapistPage({
  params,
}: {
  params: Promise<{ locale: AppLocale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <TherapistCaseloadClient locale={locale} />;
}
