import { setRequestLocale } from 'next-intl/server';
import { AdminSymbolsClient } from './symbols-client';
import type { AppLocale } from '@/i18n/routing';
import { pageMetadata } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: AppLocale }> }) {
  const { locale } = await params;
  return pageMetadata({
    locale,
    path: 'admin/symbols',
    title: locale === 'ar' ? 'قائمة الرموز' : 'Symbol moderation',
    description:
      locale === 'ar'
        ? 'مراجعة الرموز المخصّصة في انتظار الموافقة.'
        : 'Review custom symbols pending approval.',
    robots: { index: false, follow: false },
  });
}

export default async function AdminSymbolsPage({
  params,
}: {
  params: Promise<{ locale: AppLocale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <AdminSymbolsClient locale={locale} />;
}
