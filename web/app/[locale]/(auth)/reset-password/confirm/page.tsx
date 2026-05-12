import { setRequestLocale } from 'next-intl/server';
import { ResetConfirmClient } from './confirm-client';
import type { AppLocale } from '@/i18n/routing';
import { pageMetadata } from '@/lib/seo';

/**
 * /[locale]/reset-password/confirm — landing for the Supabase
 * recovery email link.
 *
 * The recovery URL Supabase mails includes an `access_token` fragment
 * (#access_token=...) that the browser-side supabase client picks up
 * automatically when imported. We don't read it from query — it's a
 * URL fragment, which the server never sees. The client component
 * lets the user type a new password and calls
 * `supabase.auth.updateUser({ password })`.
 */
export async function generateMetadata({ params }: { params: Promise<{ locale: AppLocale }> }) {
  const { locale } = await params;
  return pageMetadata({
    locale,
    path: 'reset-password/confirm',
    title: locale === 'ar' ? 'تعيين كلمة مرور جديدة' : 'Set new password',
    description:
      locale === 'ar'
        ? 'أدخل كلمة المرور الجديدة لإكمال إعادة التعيين.'
        : 'Enter your new password to finish the reset.',
    robots: { index: false, follow: false },
  });
}

export default async function ResetConfirmPage({
  params,
}: {
  params: Promise<{ locale: AppLocale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ResetConfirmClient locale={locale} />;
}
