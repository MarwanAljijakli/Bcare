import { setRequestLocale } from 'next-intl/server';
import { TherapistsSettings } from './therapists-client';
import type { AppLocale } from '@/i18n/routing';

export default async function TherapistsSettingsPage({
  params,
}: {
  params: Promise<{ locale: AppLocale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <TherapistsSettings />;
}
