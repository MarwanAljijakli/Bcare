import { useTranslations } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { SiteHeader } from '@/components/site-header';

export default function LandingPage({ params }: { params: { locale: string } }) {
  // Required so child server components can call `useTranslations` synchronously.
  setRequestLocale(params.locale);
  return (
    <>
      <SiteHeader />
      <main id="main" className="container py-16 md:py-24" tabIndex={-1}>
        <Hero />
      </main>
    </>
  );
}

function Hero() {
  const t = useTranslations('marketing.landing.hero');
  const c = useTranslations('common');
  return (
    <section className="mx-auto max-w-3xl text-center">
      <p className="border-border bg-bg-elevated text-fg-muted mb-6 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-medium">
        <span aria-hidden="true" className="bg-primary h-2 w-2 rounded-full" />
        {t('eyebrow')}
      </p>
      <h1 className="text-fg text-balance text-5xl font-bold leading-tight tracking-tight md:text-6xl">
        {t('title')}
      </h1>
      <p className="text-fg-muted mx-auto mt-6 max-w-2xl text-balance text-lg leading-relaxed md:text-xl">
        {t('subtitle')}
      </p>
      <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <a
          href="#"
          aria-label={t('ctaPrimary')}
          className="bg-primary text-primary-fg hover:bg-primary-hover focus-visible:ring-ring inline-flex h-12 items-center justify-center rounded-full px-7 text-base font-semibold shadow-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
        >
          {t('ctaPrimary')}
        </a>
        <a
          href="#"
          aria-label={t('ctaSecondary')}
          className="border-border bg-bg-elevated text-fg hover:bg-bg-muted focus-visible:ring-ring inline-flex h-12 items-center justify-center rounded-full border px-7 text-base font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
        >
          {t('ctaSecondary')}
        </a>
      </div>
      <p className="text-fg-subtle mt-12 text-sm">{c('tagline')}</p>
    </section>
  );
}
