import { setRequestLocale } from 'next-intl/server';
import { AccountSettings } from './account-client';
import type { AppLocale } from '@/i18n/routing';

export default async function SettingsAccountPage({
  params,
}: {
  params: Promise<{ locale: AppLocale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <AccountSettings />;
}
