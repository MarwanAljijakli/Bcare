import { useTranslations } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import type { AppLocale } from '@/i18n/routing';
import { Logo } from '@/components/brand/logo';
import { LanguageSwitcher } from '@/components/language-switcher';
import { ThemeSwitcher } from '@/components/theme-switcher';
import { Link } from '@/i18n/routing';

/**
 * /settings sub-shell — slim header + sidebar nav. Linear-grade density
 * comes in Module 6 dashboard work; this is the Module 2.B baseline.
 */
export default async function SettingsLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: AppLocale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <div className="flex min-h-dvh flex-col">
      <SettingsHeader />
      <div className="container flex flex-1 gap-8 py-8 lg:gap-12">
        <Sidebar />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}

function SettingsHeader() {
  const t = useTranslations('common');
  return (
    <header className="border-border bg-bg/80 sticky top-0 z-20 border-b backdrop-blur">
      <div className="container flex h-16 items-center justify-between gap-3">
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
      </div>
    </header>
  );
}

function Sidebar() {
  const t = useTranslations('marketing.app.settings.nav');
  const items: Array<{
    key: 'level' | 'voice' | 'privacy' | 'therapists' | 'account';
    href:
      | '/settings/level'
      | '/settings/voice'
      | '/settings/privacy'
      | '/settings/therapists'
      | '/settings/account';
  }> = [
    { key: 'level', href: '/settings/level' },
    { key: 'voice', href: '/settings/voice' },
    { key: 'privacy', href: '/settings/privacy' },
    { key: 'therapists', href: '/settings/therapists' },
    { key: 'account', href: '/settings/account' },
  ];
  return (
    <aside className="hidden w-56 shrink-0 lg:block">
      <nav aria-label="Settings" className="space-y-1">
        {items.map((it) => (
          <Link
            key={it.key}
            href={it.href}
            className="text-fg-muted hover:text-fg hover:bg-bg-muted focus-visible:ring-ring block rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          >
            {t(it.key)}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
