import { BookOpen, Construction, Grid3x3, Settings, Sparkles, Wand2 } from 'lucide-react';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import type { AppLocale } from '@/i18n/routing';
import { Logo } from '@/components/brand/logo';
import { LanguageSwitcher } from '@/components/language-switcher';
import { ThemeSwitcher } from '@/components/theme-switcher';
import { Link } from '@/i18n/routing';
import { pageMetadata } from '@/lib/seo';

/**
 * Placeholder dashboard — the wizard's review step finalize() lands here.
 * Three CTA cards + a "what's next" panel. The real Linear-grade dashboard
 * is built in Module 6 on top of this scaffold.
 *
 * Cards that link to surfaces not yet shipped (board, help) carry a
 * visible "Available shortly" badge and `aria-disabled` so screen readers
 * announce them as unavailable. The settings card is the one always-live
 * destination today.
 */

export async function generateMetadata({ params }: { params: Promise<{ locale: AppLocale }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'marketing.app.dashboard' });
  return pageMetadata({
    locale,
    path: 'dashboard',
    title: t('title'),
    description: t('subtitle'),
    robots: { index: false, follow: false },
  });
}

interface DashboardData {
  firstName: string | null;
  email: string | null;
}

async function loadDashboard(): Promise<DashboardData> {
  // Best-effort lookup — if Supabase isn't reachable for any reason we
  // still render the page with a generic greeting rather than crash.
  try {
    const { createSupabaseServerClient } = await import('@/lib/supabase/server');
    const supabase = await createSupabaseServerClient();
    const { data: userData } = await supabase.auth.getUser();
    const email = userData.user?.email ?? null;
    if (!userData.user) return { firstName: null, email };

    const profileRes = await (
      supabase.from('profiles') as never as {
        select: (cols: string) => {
          eq: (
            col: string,
            v: string,
          ) => {
            maybeSingle: () => Promise<{ data: { full_name: string | null } | null }>;
          };
        };
      }
    )
      .select('full_name')
      .eq('user_id', userData.user.id)
      .maybeSingle();
    const fullName = profileRes.data?.full_name?.trim() ?? null;
    const firstName = fullName ? (fullName.split(/\s+/)[0] ?? null) : null;
    return { firstName, email };
  } catch {
    return { firstName: null, email: null };
  }
}

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: AppLocale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: 'marketing.app.dashboard' });
  const tCommon = await getTranslations({ locale, namespace: 'common' });
  const { firstName, email } = await loadDashboard();

  const greetingName = firstName ?? email?.split('@')[0] ?? t('genericName');

  return (
    <div className="flex min-h-dvh flex-col">
      {/* Slim header — mirrors the /settings sub-shell so the navigation
       *  feels coherent across the (app) shell. */}
      <header className="border-border bg-bg/80 sticky top-0 z-20 border-b backdrop-blur">
        <div className="container flex h-16 items-center justify-between gap-3">
          <Link
            href="/dashboard"
            aria-label={tCommon('appName')}
            className="focus-visible:ring-ring -m-2 inline-flex items-center gap-2 rounded-lg p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          >
            <Logo size="md" wordmark="auto" />
          </Link>
          <div className="flex items-center gap-2">
            <ThemeSwitcher />
            <LanguageSwitcher />
          </div>
        </div>
      </header>

      <div className="container flex flex-1 flex-col gap-12 py-10 lg:py-14">
        {/* Welcome */}
        <section className="space-y-3">
          <p className="text-fg-subtle text-xs font-semibold uppercase tracking-wide">
            {t('eyebrow')}
          </p>
          <h1 className="text-fg text-balance text-3xl font-bold leading-tight tracking-tight md:text-4xl">
            {t('greeting', { name: greetingName })}
          </h1>
          <p className="text-fg-muted max-w-2xl text-base leading-relaxed">{t('subtitle')}</p>
        </section>

        {/* CTA cards */}
        <section aria-labelledby="dashboard-cta-heading" className="space-y-4">
          <h2 id="dashboard-cta-heading" className="sr-only">
            {t('ctas.heading')}
          </h2>
          <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6 lg:grid-cols-4">
            <CtaCard
              href="/board"
              icon={<Grid3x3 aria-hidden="true" className="h-6 w-6" />}
              title={t('ctas.board.title')}
              body={t('ctas.board.body')}
              cta={t('ctas.board.cta')}
            />
            <CtaCard
              href="/dashboard/personalization"
              icon={<Wand2 aria-hidden="true" className="h-6 w-6" />}
              title={t('ctas.personalization.title')}
              body={t('ctas.personalization.body')}
              cta={t('ctas.personalization.cta')}
            />
            <CtaCard
              href="/settings/privacy"
              icon={<Settings aria-hidden="true" className="h-6 w-6" />}
              title={t('ctas.settings.title')}
              body={t('ctas.settings.body')}
              cta={t('ctas.settings.cta')}
            />
            <CtaCard
              href="/help"
              disabled
              icon={<BookOpen aria-hidden="true" className="h-6 w-6" />}
              title={t('ctas.help.title')}
              body={t('ctas.help.body')}
              cta={t('ctas.help.cta')}
              comingSoonLabel={t('ctas.comingSoon')}
            />
          </ul>
        </section>

        {/* What's next */}
        <section
          aria-labelledby="dashboard-roadmap-heading"
          className="border-border bg-bg-elevated rounded-2xl border p-6 md:p-8"
        >
          <div className="flex items-start gap-4">
            <span
              aria-hidden="true"
              className="bg-primary/10 text-primary grid h-12 w-12 shrink-0 place-items-center rounded-xl"
            >
              <Sparkles className="h-6 w-6" />
            </span>
            <div className="min-w-0 flex-1 space-y-3">
              <div>
                <p className="text-fg-subtle text-xs font-semibold uppercase tracking-wide">
                  {t('roadmap.eyebrow')}
                </p>
                <h2
                  id="dashboard-roadmap-heading"
                  className="text-fg text-xl font-bold tracking-tight md:text-2xl"
                >
                  {t('roadmap.title')}
                </h2>
              </div>
              <p className="text-fg-muted text-sm leading-relaxed">{t('roadmap.body')}</p>
              <ul className="text-fg-muted grid gap-2 text-sm leading-relaxed sm:grid-cols-2">
                {(
                  [
                    'board',
                    'personalization',
                    'gamification',
                    'sessionReplay',
                    'therapistDashboard',
                    'pdfReports',
                  ] as const
                ).map((key) => (
                  <li key={key} className="flex items-start gap-2">
                    <span
                      aria-hidden="true"
                      className="text-primary mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-current"
                    />
                    <span>{t(`roadmap.items.${key}`)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function CtaCard({
  href,
  icon,
  title,
  body,
  cta,
  disabled = false,
  comingSoonLabel,
}: {
  href: '/board' | '/settings/privacy' | '/help' | '/dashboard/personalization';
  icon: React.ReactNode;
  title: string;
  body: string;
  cta: string;
  disabled?: boolean;
  comingSoonLabel?: string;
}) {
  const className =
    'group focus-visible:ring-ring relative flex h-full flex-col gap-3 rounded-2xl border border-border bg-bg-elevated p-6 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2';
  const interactiveClass = disabled
    ? `${className} cursor-not-allowed opacity-70`
    : `${className} hover:border-primary/40 hover:shadow-sm`;

  const inner = (
    <>
      <span
        aria-hidden="true"
        className="bg-primary/10 text-primary grid h-11 w-11 place-items-center rounded-xl"
      >
        {icon}
      </span>
      <h3 className="text-fg text-lg font-bold tracking-tight">{title}</h3>
      <p className="text-fg-muted flex-1 text-sm leading-relaxed">{body}</p>
      {disabled && comingSoonLabel ? (
        <span className="text-fg-subtle bg-bg-muted inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold">
          <Construction aria-hidden="true" className="h-3 w-3" />
          {comingSoonLabel}
        </span>
      ) : (
        <span className="text-primary text-sm font-semibold">
          {cta}
          <span
            aria-hidden="true"
            className="ms-1 inline-block transition-transform group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5"
          >
            →
          </span>
        </span>
      )}
    </>
  );

  return (
    <li className="h-full">
      {disabled ? (
        <div role="link" aria-disabled="true" className={interactiveClass}>
          {inner}
        </div>
      ) : (
        <Link href={href} className={interactiveClass}>
          {inner}
        </Link>
      )}
    </li>
  );
}
