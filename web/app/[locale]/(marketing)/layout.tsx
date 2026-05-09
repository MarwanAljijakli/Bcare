import { setRequestLocale } from 'next-intl/server';
import type { AppLocale } from '@/i18n/routing';
import { MarketingFooter } from '@/components/marketing/marketing-footer';
import { MarketingHeader } from '@/components/marketing/marketing-header';
import { OrganizationJsonLd, WebsiteJsonLd } from '@/components/seo/jsonld';

/**
 * Marketing route group. All public-facing pages render inside the same
 * shell — sticky header with primary nav + theme/language switchers,
 * shared footer with three-column site map, and JSON-LD that asserts the
 * Organization + WebSite identity.
 */
export default async function MarketingLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: AppLocale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <>
      <OrganizationJsonLd locale={locale} />
      <WebsiteJsonLd locale={locale} />
      <MarketingHeader />
      <main id="main" tabIndex={-1} className="flex min-h-[calc(100dvh-4rem)] flex-col">
        {children}
      </main>
      <MarketingFooter />
    </>
  );
}
