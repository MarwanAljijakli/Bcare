import { useTranslations } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import type { AppLocale } from '@/i18n/routing';
import type { ReactNode } from 'react';
import { Logo } from '@/components/brand/logo';
import { LanguageSwitcher } from '@/components/language-switcher';
import { OrganizationJsonLd } from '@/components/seo/jsonld';
import { ThemeSwitcher } from '@/components/theme-switcher';
import { Link } from '@/i18n/routing';

/**
 * (auth) route group layout. Distinct from (marketing) — minimal chrome,
 * full-bleed two-column composition handled by AuthShell. The header has
 * the logo + theme/language switchers; there's no marketing footer.
 *
 * Pages render inside AuthShell which paints a calm gradient brand panel
 * on the trailing edge in LTR (leading edge in RTL via natural flex
 * reversal) at lg+ breakpoints.
 */

export default async function AuthLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: AppLocale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <>
      <OrganizationJsonLd locale={locale} />
      <main id="main" tabIndex={-1} className="bg-bg min-h-dvh">
        {children}
      </main>
    </>
  );
}

/**
 * Top-of-form-column header. Used by signup/login/reset pages directly
 * because we want the header to live INSIDE the form column, not above
 * the whole grid (so it doesn't push the panel down on tall viewports).
 */
export function AuthHeader() {
  const t = useTranslations('common');
  return (
    <header className="border-border/0 flex items-center justify-between gap-3 py-5">
      <Link
        href="/"
        aria-label={t('appName')}
        className="focus-visible:ring-ring -m-2 inline-flex items-center gap-2 rounded-lg p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
      >
        <Logo size="md" wordmark="auto" />
      </Link>
      <div className="flex items-center gap-2">
        <ThemeSwitcher />
        <LanguageSwitcher />
      </div>
    </header>
  );
}
