import { ArrowRight, MessageCircle, Mic, HandHelping } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import type { AppLocale } from '@/i18n/routing';
import { MockChildBoard } from '@/components/marketing/mock-child-board';
import { MockDashboard } from '@/components/marketing/mock-dashboard';
import { Section, SectionHeader } from '@/components/marketing/section';
import { TrustStrip } from '@/components/marketing/trust-strip';
import { ProductJsonLd } from '@/components/seo/jsonld';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/routing';
import { pageMetadata } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: AppLocale }> }) {
  const { locale } = await params;
  return pageMetadata({
    locale,
    title:
      locale === 'ar'
        ? 'بلوكير — تواصل ذكي للأطفال ذوي اضطراب طيف التوحد'
        : 'BlueCare — Communication for children with autism',
  });
}

export default async function LandingPage({ params }: { params: Promise<{ locale: AppLocale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <>
      <ProductJsonLd locale={locale} />
      <Hero />
      <PostHeroTrust />
      <Features />
      <ScreenshotStrip />
      <Personalization />
      <Audiences />
      <ClosingCta />
    </>
  );
}

function Hero() {
  const t = useTranslations('marketing.landing.hero');
  return (
    <section className="relative isolate overflow-hidden">
      <div
        aria-hidden="true"
        className="from-primary/5 pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b via-transparent to-transparent"
      />
      <div className="container py-20 md:py-28">
        <div className="grid items-center gap-12 lg:grid-cols-12">
          <div className="lg:col-span-6">
            <p className="border-border bg-bg-elevated text-fg-muted mb-6 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-medium">
              <span aria-hidden="true" className="bg-primary h-2 w-2 rounded-full" />
              {t('eyebrow')}
            </p>
            <h1 className="text-fg text-balance text-5xl font-bold leading-[1.05] tracking-tight md:text-6xl">
              {t('title')}
            </h1>
            <p className="text-fg-muted mt-6 max-w-xl text-balance text-lg leading-relaxed md:text-xl">
              {t('subtitle')}
            </p>
            <div className="mt-10 flex flex-col items-start gap-3 sm:flex-row">
              <Button asChild size="xl">
                <Link href="/pricing">
                  {t('ctaPrimary')}
                  <ArrowRight aria-hidden="true" className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="xl" variant="secondary">
                <Link href="/how-it-works">{t('ctaSecondary')}</Link>
              </Button>
            </div>
          </div>

          <div className="lg:col-span-6">
            <MockChildBoard />
          </div>
        </div>
      </div>
    </section>
  );
}

function PostHeroTrust() {
  return (
    <div className="container -mt-8 mb-8 md:-mt-12 md:mb-12">
      <TrustStrip />
    </div>
  );
}

function Features() {
  const t = useTranslations('marketing.landing.features');
  const items = [
    { key: 'symbols', icon: MessageCircle },
    { key: 'voice', icon: Mic },
    { key: 'gestures', icon: HandHelping },
  ] as const;

  return (
    <Section tone="muted">
      <SectionHeader title={t('title')} subtitle={t('subtitle')} />
      <div className="grid gap-6 md:grid-cols-3">
        {items.map(({ key, icon: Icon }) => (
          <div key={key} className="border-border bg-bg-elevated rounded-2xl border p-7 shadow-sm">
            <div className="bg-primary/10 text-primary mb-5 grid h-12 w-12 place-items-center rounded-xl">
              <Icon aria-hidden="true" className="h-6 w-6" />
            </div>
            <h3 className="text-fg text-xl font-semibold tracking-tight">
              {t(`items.${key}.title`)}
            </h3>
            <p className="text-fg-muted mt-3 text-base leading-relaxed">{t(`items.${key}.body`)}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

function ScreenshotStrip() {
  return (
    <Section>
      <div className="grid items-center gap-12 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <MockDashboard />
        </div>
        <div className="lg:col-span-5">
          <p className="text-primary mb-3 text-sm font-semibold uppercase tracking-wide">
            Caregiver dashboard
          </p>
          <h2 className="text-fg text-balance text-3xl font-bold leading-tight tracking-tight md:text-4xl">
            See what changed today.
          </h2>
          <p className="text-fg-muted mt-4 text-balance text-lg leading-relaxed">
            Streaks, vocabulary growth, top symbols, recent activity — at a calm pace, with no
            pressure.
          </p>
        </div>
      </div>
    </Section>
  );
}

function Personalization() {
  const t = useTranslations('marketing.landing.personalization');
  return (
    <Section tone="muted">
      <SectionHeader title={t('title')} subtitle={t('subtitle')} />
      <ul className="border-border bg-bg-elevated divide-border mx-auto max-w-2xl divide-y rounded-2xl border shadow-sm">
        {(['bullet1', 'bullet2', 'bullet3'] as const).map((k) => (
          <li key={k} className="flex items-start gap-3 p-5">
            <span
              aria-hidden="true"
              className="bg-accent text-accent-fg mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-sm font-bold"
            >
              ✓
            </span>
            <span className="text-fg text-base leading-relaxed">{t(k)}</span>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function Audiences() {
  const t = useTranslations('marketing.landing.audiences');
  const cards = [
    { key: 'family', href: '/for-caregivers' as const },
    { key: 'therapists', href: '/for-therapists' as const },
    { key: 'schools', href: '/contact' as const },
  ];
  return (
    <Section>
      <SectionHeader title={t('title')} />
      <div className="grid gap-6 md:grid-cols-3">
        {cards.map(({ key, href }) => (
          <Link
            key={key}
            href={href}
            className="border-border bg-bg-elevated hover:border-primary focus-visible:ring-ring group rounded-2xl border p-7 shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          >
            <h3 className="text-fg text-xl font-semibold tracking-tight">
              {t(`${key}.title` as 'family.title')}
            </h3>
            <p className="text-fg-muted mt-3 text-base leading-relaxed">
              {t(`${key}.body` as 'family.body')}
            </p>
            <p className="text-primary mt-6 text-sm font-semibold">
              {t(`${key}.cta` as 'family.cta')}
            </p>
          </Link>
        ))}
      </div>
    </Section>
  );
}

function ClosingCta() {
  const t = useTranslations('marketing.landing.closingCta');
  return (
    <Section tone="primary" className="text-center">
      <div className="mx-auto max-w-2xl">
        <h2 className="text-balance text-3xl font-bold leading-tight tracking-tight md:text-4xl">
          {t('title')}
        </h2>
        <p className="mt-4 text-balance text-lg leading-relaxed opacity-90">{t('subtitle')}</p>
        <div className="mt-8">
          <Button asChild size="xl" variant="secondary">
            <Link href="/pricing">{t('cta')}</Link>
          </Button>
        </div>
      </div>
    </Section>
  );
}
