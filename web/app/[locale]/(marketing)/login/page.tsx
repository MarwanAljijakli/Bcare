import { Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import type { AppLocale } from '@/i18n/routing';
import { Section } from '@/components/marketing/section';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/routing';
import { pageMetadata } from '@/lib/seo';

/**
 * /login stub — same pattern as /signup. Module 2 replaces this with the
 * real magic-link / password sign-in form. We keep it here so the header
 * CTA ("Sign in") never 404s.
 */

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

export default async function LoginStubPage({
  params,
}: {
  params: Promise<{ locale: AppLocale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <Section className="py-16 md:py-24">
      <Inner />
    </Section>
  );
}

function Inner() {
  const t = useTranslations('marketing.auth.login');
  return (
    <div className="mx-auto max-w-xl text-center">
      <p className="border-border bg-bg-elevated text-fg-muted mb-6 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-medium">
        <Sparkles aria-hidden="true" className="text-primary h-4 w-4" />
        {t('eyebrow')}
      </p>
      <h1 className="text-fg text-balance text-4xl font-bold leading-tight tracking-tight md:text-5xl">
        {t('title')}
      </h1>
      <p className="text-fg-muted mt-5 text-balance text-lg leading-relaxed">{t('subtitle')}</p>
      <div className="border-border bg-bg-muted text-fg-muted mt-10 rounded-2xl border border-dashed p-6 text-start text-sm leading-relaxed">
        {t('comingSoon')}
      </div>
      <div className="mt-8 flex justify-center">
        <Button asChild size="lg" variant="ghost">
          <Link href="/">{t('backToHome')}</Link>
        </Button>
      </div>
      <p className="text-fg-subtle mt-10 text-sm">
        {t('needAccount')}{' '}
        <Link
          href="/signup"
          className="text-primary focus-visible:ring-ring rounded font-semibold underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
        >
          {t('signUpLink')}
        </Link>
      </p>
    </div>
  );
}
