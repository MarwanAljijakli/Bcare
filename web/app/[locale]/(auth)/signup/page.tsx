import { redirect } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import type { AppLocale } from '@/i18n/routing';
import { AuthShell } from '@/components/auth/auth-shell';
import { SignupForm } from '@/components/auth/signup-form';
import { isAuthBypassActive } from '@/lib/auth/bypass';
import { CONSENT_VERSION, hashConsent } from '@/lib/auth/consent';
import { pageMetadata } from '@/lib/seo';

/**
 * /[locale]/signup — production auth surface. Replaces the Module 1.5 stub.
 *
 * Renders the AuthShell (two-column with brand-promise panel on the
 * trailing edge at lg+) wrapping the client-side SignupForm. The consent
 * version + canonical text hash are computed server-side and passed to the
 * client so the client never has to compute them — and so a future change
 * to the consent text just bumps a server constant.
 *
 * `robots: { index: false, follow: true }` — the signup page should not
 * surface in search; the homepage is the indexed acquisition surface.
 */

export async function generateMetadata({ params }: { params: Promise<{ locale: AppLocale }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'marketing.auth.signup' });
  return pageMetadata({
    locale,
    path: 'signup',
    title: t('title'),
    description: t('subtitle'),
    robots: { index: false, follow: true },
  });
}

export default async function SignupPage({ params }: { params: Promise<{ locale: AppLocale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  // Module 2.A.1.bypass — short-circuit through the dev-login route when
  // bypass is active. Caregivers in dev never see the signup form.
  if (isAuthBypassActive()) {
    redirect(`/api/auth/dev-login?next=/${locale}/dashboard`);
  }
  const consentTextHash = await hashConsent();

  return (
    <AuthShell fineprint={<AgeNotice />}>
      <SignupForm consentVersion={CONSENT_VERSION} consentTextHash={consentTextHash} />
    </AuthShell>
  );
}

function AgeNotice() {
  const t = useTranslations('marketing.auth.signup');
  return <>{t('ageNotice')}</>;
}
