import { setRequestLocale, getTranslations } from 'next-intl/server';
import type { AppLocale } from '@/i18n/routing';
import { AuthShell } from '@/components/auth/auth-shell';
import { LoginForm } from '@/components/auth/login-form';
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
  return (
    <AuthShell>
      <LoginForm />
    </AuthShell>
  );
}
