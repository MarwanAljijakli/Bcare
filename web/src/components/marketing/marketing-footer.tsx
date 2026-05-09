import { useTranslations } from 'next-intl';
import { Logo } from '@/components/brand/logo';
import { LanguageSwitcher } from '@/components/language-switcher';
import { ThemeSwitcher } from '@/components/theme-switcher';
import { Link } from '@/i18n/routing';

type FooterHref =
  | '/how-it-works'
  | '/for-caregivers'
  | '/for-therapists'
  | '/about'
  | '/team'
  | '/contact'
  | '/security'
  | '/privacy'
  | '/terms'
  | '/accessibility';

const COLUMNS: Array<{
  title: 'product' | 'company' | 'legal';
  links: Array<{ key: string; href: FooterHref }>;
}> = [
  {
    title: 'product',
    links: [
      { key: 'howItWorks', href: '/how-it-works' },
      { key: 'forCaregivers', href: '/for-caregivers' },
      { key: 'forTherapists', href: '/for-therapists' },
    ],
  },
  {
    title: 'company',
    links: [
      { key: 'about', href: '/about' },
      { key: 'team', href: '/team' },
      { key: 'contact', href: '/contact' },
      { key: 'security', href: '/security' },
    ],
  },
  {
    title: 'legal',
    links: [
      { key: 'privacy', href: '/privacy' },
      { key: 'terms', href: '/terms' },
      { key: 'accessibility', href: '/accessibility' },
    ],
  },
];

export function MarketingFooter() {
  const t = useTranslations('footer');
  const c = useTranslations('common');
  const year = new Date().getUTCFullYear();

  return (
    <footer className="border-border border-t">
      <div className="container py-16">
        <div className="grid gap-10 md:grid-cols-12">
          <div className="md:col-span-4">
            <Link
              href="/"
              aria-label={c('appName')}
              className="focus-visible:ring-ring -m-2 inline-flex items-center gap-2 rounded-lg p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
            >
              <Logo size="md" wordmark="auto" />
            </Link>
            <p className="text-fg-muted mt-4 max-w-sm text-sm leading-relaxed">{c('tagline')}</p>
            <div className="mt-6 flex items-center gap-2">
              <ThemeSwitcher />
              <LanguageSwitcher />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 md:col-span-8 md:grid-cols-3">
            {COLUMNS.map((col) => (
              <div key={col.title}>
                <h2 className="text-fg text-sm font-semibold">{t(`${col.title}.title`)}</h2>
                <ul className="mt-4 space-y-3">
                  {col.links.map((link) => (
                    <li key={link.key}>
                      <Link
                        href={link.href}
                        className="text-fg-muted hover:text-fg focus-visible:ring-ring rounded text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                      >
                        {t(`${col.title}.${link.key}` as 'product.howItWorks')}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="border-border mt-12 flex flex-col items-start justify-between gap-3 border-t pt-6 sm:flex-row sm:items-center">
          <p className="text-fg-subtle text-xs">
            © {year} {c('appName')}. {t('allRightsReserved')}
          </p>
          <p className="text-fg-subtle text-xs">{t('originNote')}</p>
        </div>
      </div>
    </footer>
  );
}
