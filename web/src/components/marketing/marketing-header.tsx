import { useTranslations } from 'next-intl';
import { Logo } from '@/components/brand/logo';
import { LanguageSwitcher } from '@/components/language-switcher';
import { ThemeSwitcher } from '@/components/theme-switcher';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/routing';

const NAV: Array<{
  key: 'howItWorks' | 'forCaregivers' | 'forTherapists' | 'about';
  href: '/how-it-works' | '/for-caregivers' | '/for-therapists' | '/about';
}> = [
  { key: 'howItWorks', href: '/how-it-works' },
  { key: 'forCaregivers', href: '/for-caregivers' },
  { key: 'forTherapists', href: '/for-therapists' },
  { key: 'about', href: '/about' },
];

/**
 * Marketing-site header. Sticky with backdrop blur.
 *
 * Right-side cluster ordering is "Sign in, Get started" in source. Flexbox
 * preserves source order in LTR (primary on the trailing edge / right) and
 * naturally reverses in RTL (primary on the leading edge / left), matching
 * how Arabic readers expect primary actions placed.
 *
 * Both auth CTAs are visible at every viewport — they're the highest-value
 * actions on the marketing site so we never hide them behind a hamburger.
 * Nav links collapse to icons-via-screen-reader-only-text on mobile, with
 * the full menu pattern shipping when we add a /menu drawer in a later pass.
 */
export function MarketingHeader() {
  const tNav = useTranslations('nav');
  const tCommon = useTranslations('common');

  return (
    <header className="bg-bg/80 supports-[backdrop-filter]:bg-bg/60 border-border sticky top-0 z-20 border-b backdrop-blur">
      <div className="container flex h-16 items-center justify-between gap-3">
        <Link
          href="/"
          aria-label={tCommon('appName')}
          className="focus-visible:ring-ring -m-2 inline-flex items-center gap-2 rounded-lg p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
        >
          {/* Wordmark hidden on the smallest phones to make room for both
              auth CTAs; mark + wordmark visible from sm (640px) onward. */}
          <Logo size="md" className="sm:hidden" />
          <Logo size="md" wordmark="auto" className="hidden sm:inline-flex" />
        </Link>

        <nav aria-label={tNav('home')} className="hidden items-center gap-1 md:flex">
          {NAV.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              className="text-fg-muted hover:text-fg focus-visible:text-fg focus-visible:ring-ring rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
            >
              {tNav(item.key)}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <ThemeSwitcher className="hidden sm:inline-flex" />
          <LanguageSwitcher className="hidden sm:inline-flex" />
          {/* Source order: Sign in, Get started.
              LTR renders [Sign in][Get started] (primary on right).
              RTL flips to [Get started][Sign in] (primary on reading-end).
              Both are reachable at every viewport. */}
          <Button asChild size="sm" variant="ghost">
            <Link href="/login">{tNav('signIn')}</Link>
          </Button>
          <Button asChild size="sm" variant="primary">
            <Link href="/signup">{tNav('getStarted')}</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
