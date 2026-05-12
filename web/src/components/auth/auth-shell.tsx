import { useTranslations } from 'next-intl';
import { BrandPromisePanel } from './brand-promise-panel';
import type { ReactNode } from 'react';
import { Logo } from '@/components/brand/logo';
import { LanguageSwitcher } from '@/components/language-switcher';
import { ThemeSwitcher } from '@/components/theme-switcher';
import { Link } from '@/i18n/routing';

/**
 * Two-column auth shell. Form column on the leading edge (left in LTR,
 * right in RTL via flex/grid auto-reversal), brand-promise panel on the
 * trailing edge at lg+. Below lg the panel is hidden and the form column
 * fills the viewport.
 *
 * The form column has its own header (logo + theme/language switchers)
 * docked at the top, the form vertically centered in the remaining space,
 * and a small footer link below the form. The whole composition stays
 * scrollable on short viewports.
 */
export function AuthShell({
  children,
  /** Small-print line below the form — used for "By creating you confirm…". */
  fineprint,
}: {
  children: ReactNode;
  fineprint?: ReactNode;
}) {
  const t = useTranslations('common');
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="flex min-h-dvh flex-col lg:min-h-0">
        <div className="container">
          <header className="flex items-center justify-between gap-3 py-5">
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
        </div>

        <div className="flex flex-1 items-center justify-center px-6 pb-10 pt-4 sm:px-10">
          <div className="w-full max-w-[480px]">{children}</div>
        </div>

        {fineprint && (
          <div className="container pb-8">
            <p className="text-fg-subtle mx-auto max-w-[480px] text-center text-xs leading-relaxed">
              {fineprint}
            </p>
          </div>
        )}
      </div>
      <BrandPromisePanel />
    </div>
  );
}
