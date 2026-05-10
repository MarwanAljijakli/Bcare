import { setRequestLocale } from 'next-intl/server';
import { PrivacySettings } from './privacy-client';
import type { AppLocale } from '@/i18n/routing';

export default async function PrivacySettingsPage({
  params,
}: {
  params: Promise<{ locale: AppLocale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <PrivacySettings />;
}
