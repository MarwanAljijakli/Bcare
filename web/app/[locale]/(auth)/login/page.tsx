import { redirect } from 'next/navigation';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import type { AppLocale } from '@/i18n/routing';
import { AuthShell } from '@/components/auth/auth-shell';
import { LoginForm } from '@/components/auth/login-form';
import { isAuthBypassActive } from '@/lib/auth/bypass';
import { pageMetadata } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: AppLocale }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'marketing.auth.login' });
  return pageMetadata({
    locale,
    path: 'login',
    title: t('title'),
    description: t('subtitle'),
    robots: { index: false, follow: true },
  });
}

export default async function LoginPage({ params }: { params: Promise<{ locale: AppLocale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  // Module 2.A.1.bypass — short-circuit through the dev-login route when
  // bypass is active. Real users would never see the login page in dev.
  if (isAuthBypassActive()) {
    redirect(`/api/auth/dev-login?next=/${locale}/dashboard`);
  }
  return (
    <AuthShell>
      <LoginForm />
    </AuthShell>
  );
}
