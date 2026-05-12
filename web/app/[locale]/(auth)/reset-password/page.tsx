import { setRequestLocale } from 'next-intl/server';
import { ResetRequestClient } from './reset-request-client';
import type { AppLocale } from '@/i18n/routing';
import { AuthShell } from '@/components/auth/auth-shell';
import { pageMetadata } from '@/lib/seo';

/**
 * /[locale]/reset-password — Module 9.9 real reset flow.
 *
 * The previous stub nudged users to use the magic-link flow instead.
 * The real flow now: user submits their email, /api/auth/reset-password
 * triggers Supabase's `resetPasswordForEmail()` which mails a recovery
 * link, and the link lands on /[locale]/reset-password/confirm where
 * the user enters a new password.
 *
 * Anti-enumeration: always shows the same "if an account exists"
 * confirmation regardless of whether the email is registered.
 */

export async function generateMetadata({ params }: { params: Promise<{ locale: AppLocale }> }) {
  const { locale } = await params;
  return pageMetadata({
    locale,
    path: 'reset-password',
    title: locale === 'ar' ? 'إعادة تعيين كلمة المرور' : 'Reset password',
    description:
      locale === 'ar'
        ? 'سنرسل لك رابط إعادة تعيين بالبريد الإلكتروني.'
        : 'We will email you a reset link.',
    robots: { index: false, follow: true },
  });
}

export default async function ResetPasswordPage({
  params,
}: {
  params: Promise<{ locale: AppLocale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <AuthShell>
      <ResetRequestClient locale={locale} />
    </AuthShell>
  );
}
