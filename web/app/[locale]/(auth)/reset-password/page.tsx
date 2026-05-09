import { ArrowLeft, Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import type { AppLocale } from '@/i18n/routing';
import { AuthShell } from '@/components/auth/auth-shell';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/routing';
import { pageMetadata } from '@/lib/seo';

/**
 * /reset-password — minimal stub for Module 2.A. The full reset flow
 * (request → email → token-bound new-password page) lands in Module 2.B
 * with the rest of the auth back-end. For now the page nudges users to
 * use a magic link instead, which is a real working sign-in path.
 */

export async function generateMetadata({ params }: { params: Promise<{ locale: AppLocale }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'marketing.auth.resetPassword' });
  return pageMetadata({
    locale,
    path: 'reset-password',
    title: t('title'),
    description: t('subtitle'),
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
      <Inner />
    </AuthShell>
  );
}

function Inner() {
  const t = useTranslations('marketing.auth.resetPassword');
  return (
    <section className="space-y-6 text-center">
      <div className="space-y-2">
        <p className="text-primary inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide">
          <Sparkles aria-hidden="true" className="h-3.5 w-3.5" />
          {t('eyebrow')}
        </p>
        <h1 className="text-fg text-balance text-3xl font-bold leading-tight tracking-tight md:text-4xl">
          {t('title')}
        </h1>
        <p className="text-fg-muted text-balance text-base leading-relaxed">{t('subtitle')}</p>
      </div>
      <div className="border-border bg-bg-muted text-fg-muted rounded-2xl border border-dashed p-5 text-start text-sm leading-relaxed">
        {t('comingSoon')}
      </div>
      <div className="flex flex-col items-center gap-2.5">
        <Button asChild size="lg">
          <Link href="/login">{t('useMagicLink')}</Link>
        </Button>
        <Button asChild size="sm" variant="ghost">
          <Link href="/login">
            <ArrowLeft aria-hidden="true" className="h-3.5 w-3.5" />
            {t('backToLogin')}
          </Link>
        </Button>
      </div>
    </section>
  );
}
