import { redirect } from 'next/navigation';
import type { AppLocale } from '@/i18n/routing';

/**
 * /[locale]/dashboard/sessions — index redirect to /dashboard.
 *
 * There is no sessions index list (the dashboard already shows the
 * Recent Sessions table). A user landing on /dashboard/sessions —
 * either by typing it into the URL or by following a stale link —
 * should bounce back to the dashboard rather than seeing a 404.
 */
export default async function SessionsIndexPage({
  params,
}: {
  params: Promise<{ locale: AppLocale }>;
}) {
  const { locale } = await params;
  redirect(`/${locale}/dashboard`);
}
