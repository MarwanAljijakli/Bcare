import { ArrowRight, Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import type { AppLocale } from '@/i18n/routing';
import { Section } from '@/components/marketing/section';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/routing';
import { pageMetadata } from '@/lib/seo';

/**
 * /signup is the primary funnel for every audience. The full role-aware
 * form (parent / therapist / school) ships in Module 2 once Supabase is
 * provisioned. This stub keeps the route reachable from the header CTA so
 * the navigation never 404s, with copy that frames the wait honestly.
 *
 * The page lives in the (marketing) route group on purpose — the marketing
 * shell (header + footer + JSON-LD) is the right surrounding context until
 * we have a dedicated authenticated shell.
 */

export async function generateMetadata({ params }: { params: Promise<{ locale: AppLocale }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'marketing.auth.signup' });
  return pageMetadata({
    locale,
    path: 'signup',
    title: t('title'),
    description: t('subtitle'),
    // De-index the stub so search engines don't surface it as a real signup
    // page. Re-indexed automatically when Module 2 ships the real form.
    robots: { index: false, follow: true },
  });
}

export default async function SignupStubPage({
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
  const t = useTranslations('marketing.auth.signup');
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
      <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <Button asChild size="lg">
          <Link href="/how-it-works">
            {t('viewHowItWorks')}
            <ArrowRight aria-hidden="true" className="h-4 w-4" />
          </Link>
        </Button>
        <Button asChild size="lg" variant="ghost">
          <Link href="/">{t('backToHome')}</Link>
        </Button>
      </div>
      <p className="text-fg-subtle mt-10 text-sm">
        {t('haveAccount')}{' '}
        <Link
          href="/login"
          className="text-primary focus-visible:ring-ring rounded font-semibold underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
        >
          {t('signInLink')}
        </Link>
      </p>
    </div>
  );
}
