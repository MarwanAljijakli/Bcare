import { ArrowRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import type { AppLocale } from '@/i18n/routing';
import { FaqList } from '@/components/marketing/faq-list';
import { MockChildBoard } from '@/components/marketing/mock-child-board';
import { Section, SectionHeader } from '@/components/marketing/section';
import { FaqJsonLd } from '@/components/seo/jsonld';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/routing';
import { pageMetadata } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: AppLocale }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'marketing.howItWorks' });
  return pageMetadata({ locale, path: 'how-it-works', title: t('title') });
}

const FAQ_KEYS = [0, 1, 2, 3, 4, 5] as const;

export default async function HowItWorksPage({
  params,
}: {
  params: Promise<{ locale: AppLocale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'marketing.howItWorks.faq.items' });
  // next-intl returns .raw() for indexed arrays; messages are typed as any.
  const items = FAQ_KEYS.map((i) => ({
    q: t(`${i}.q`),
    a: t(`${i}.a`),
  }));

  return (
    <>
      <FaqJsonLd questions={items.map((i) => ({ question: i.q, answer: i.a }))} />
      <Hero />
      <Steps />
      <BoardClose />
      <Faq items={items} />
    </>
  );
}

function Hero() {
  const t = useTranslations('marketing.howItWorks');
  return (
    <Section className="py-16 md:py-20">
      <SectionHeader title={t('title')} subtitle={t('subtitle')} />
    </Section>
  );
}

function Steps() {
  const t = useTranslations('marketing.howItWorks.steps');
  const steps = ['setup', 'communicate', 'learn', 'share'] as const;
  return (
    <Section tone="muted" className="py-16">
      <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-2">
        {steps.map((key) => (
          <div key={key} className="border-border bg-bg-elevated rounded-2xl border p-7 shadow-sm">
            <h3 className="text-fg text-xl font-semibold tracking-tight">{t(`${key}.title`)}</h3>
            <p className="text-fg-muted mt-3 text-base leading-relaxed">{t(`${key}.body`)}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

function BoardClose() {
  const tCta = useTranslations('marketing.landing.hero');
  return (
    <Section>
      <div className="grid items-center gap-10 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <MockChildBoard />
        </div>
        <div className="lg:col-span-5">
          <h2 className="text-fg text-balance text-3xl font-bold leading-tight tracking-tight md:text-4xl">
            One board. Three ways to say it.
          </h2>
          <p className="text-fg-muted mt-4 text-balance text-lg leading-relaxed">
            Symbols, voice, and gestures share the same sentence strip. Your child can mix them
            however the moment calls for.
          </p>
          <div className="mt-8">
            <Button asChild size="lg">
              <Link href="/pricing">
                {tCta('ctaPrimary')}
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </Section>
  );
}

function Faq({ items }: { items: Array<{ q: string; a: string }> }) {
  const t = useTranslations('marketing.howItWorks.faq');
  return (
    <Section tone="muted">
      <SectionHeader title={t('title')} />
      <FaqList items={items} idPrefix="howitworks" />
    </Section>
  );
}
