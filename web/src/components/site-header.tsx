import { useTranslations } from 'next-intl';
import { LanguageSwitcher } from './language-switcher';
import { ThemeSwitcher } from './theme-switcher';
import { Link } from '@/i18n/routing';

/**
 * Minimal site header used on marketing pages. Auth-aware variants for the
 * dashboard and child board live in their own modules.
 */
export function SiteHeader() {
  const t = useTranslations('common');
  return (
    <header className="border-border bg-bg/80 supports-[backdrop-filter]:bg-bg/60 sticky top-0 z-20 border-b backdrop-blur">
      <div className="container flex h-16 items-center justify-between gap-4">
        <Link href="/" className="text-fg inline-flex items-center gap-2 text-lg font-semibold">
          <span
            aria-hidden="true"
            className="bg-primary text-primary-fg grid h-8 w-8 place-items-center rounded-lg"
          >
            <BlueCareGlyph />
          </span>
          <span>{t('appName')}</span>
        </Link>
        <div className="flex items-center gap-2">
          <ThemeSwitcher />
          <LanguageSwitcher />
        </div>
      </div>
    </header>
  );
}

function BlueCareGlyph() {
  // Simple inline mark — a stylized speech bubble with a heart inside.
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 12a8 8 0 0 1-11.4 7.2L4 21l1.8-5.4A8 8 0 1 1 21 12Z" />
      <path d="M9.5 11.6c0-1 .8-1.7 1.7-1.7.6 0 1 .3 1.3.7.3-.4.7-.7 1.3-.7.9 0 1.7.7 1.7 1.7 0 1.6-3 3.4-3 3.4s-3-1.8-3-3.4Z" />
    </svg>
  );
}
