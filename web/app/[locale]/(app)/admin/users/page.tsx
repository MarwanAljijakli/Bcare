import { setRequestLocale } from 'next-intl/server';
import { AdminUsersClient } from './users-client';
import type { AppLocale } from '@/i18n/routing';
import { pageMetadata } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: AppLocale }> }) {
  const { locale } = await params;
  return pageMetadata({
    locale,
    path: 'admin/users',
    title: locale === 'ar' ? 'إدارة المستخدمين' : 'User administration',
    description:
      locale === 'ar' ? 'قائمة المستخدمين القابلة للبحث والتصفية.' : 'Searchable user list.',
    robots: { index: false, follow: false },
  });
}

export default async function AdminUsersPage({
  params,
}: {
  params: Promise<{ locale: AppLocale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <AdminUsersClient locale={locale} />;
}
