import { setRequestLocale } from 'next-intl/server';
import { AdminAuditClient } from './audit-client';
import type { AppLocale } from '@/i18n/routing';
import { pageMetadata } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: AppLocale }> }) {
  const { locale } = await params;
  return pageMetadata({
    locale,
    path: 'admin/audit',
    title: locale === 'ar' ? 'سجل التدقيق' : 'Audit log',
    description:
      locale === 'ar' ? 'عرض قابل للتصفية لسجل التدقيق.' : 'Filterable audit log viewer.',
    robots: { index: false, follow: false },
  });
}

export default async function AdminAuditPage({
  params,
}: {
  params: Promise<{ locale: AppLocale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <AdminAuditClient locale={locale} />;
}
