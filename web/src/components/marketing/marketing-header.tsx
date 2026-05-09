import { useTranslations } from 'next-intl';
import { Logo } from '@/components/brand/logo';
import { LanguageSwitcher } from '@/components/language-switcher';
import { ThemeSwitcher } from '@/components/theme-switcher';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/routing';

const NAV: Array<{
  key: 'howItWorks' | 'forCaregivers' | 'forTherapists' | 'pricing' | 'about';
  href: '/how-it-works' | '/for-caregivers' | '/for-therapists' | '/pricing' | '/about';
}> = [
  { key: 'howItWorks', href: '/how-it-works' },
  { key: 'forCaregivers', href: '/for-caregivers' },
  { key: 'forTherapists', href: '/for-therapists' },
  { key: 'pricing', href: '/pricing' },
  { key: 'about', href: '/about' },
];

/**
 * Marketing-site header. Sticky with backdrop blur. Auth-aware variants for
 * the dashboard and child board live in their own modules.
 */
export function MarketingHeader() {
  const tNav = useTranslations('nav');
  const tCommon = useTranslations('common');

  return (
    <header className="bg-bg/80 supports-[backdrop-filter]:bg-bg/60 border-border sticky top-0 z-20 border-b backdrop-blur">
      <div className="container flex h-16 items-center justify-between gap-4">
        <Link
          href="/"
          aria-label={tCommon('appName')}
          className="focus-visible:ring-ring -m-2 inline-flex items-center gap-2 rounded-lg p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
        >
          <Logo size="md" wordmark="auto" />
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

        <div className="flex items-center gap-2">
          <ThemeSwitcher className="hidden sm:inline-flex" />
          <LanguageSwitcher className="hidden sm:inline-flex" />
          <Button asChild size="sm" variant="primary" className="hidden md:inline-flex">
            <Link href="/pricing">{tNav('signup')}</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
