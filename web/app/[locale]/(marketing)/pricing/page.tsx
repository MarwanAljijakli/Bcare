import { Check } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import type { AppLocale } from '@/i18n/routing';
import { Section, SectionHeader } from '@/components/marketing/section';
import { WaitlistForm } from '@/components/marketing/waitlist-form';
import { Badge } from '@/components/ui/badge';
import { pageMetadata } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: AppLocale }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'marketing.pricing.hero' });
  return pageMetadata({
    locale,
    path: 'pricing',
    title: t('title'),
    description: t('subtitle'),
  });
}

const TIERS = ['family', 'clinic', 'school'] as const;

export default async function PricingPage({ params }: { params: Promise<{ locale: AppLocale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <>
      <Hero />
      <Form />
      <Tiers />
    </>
  );
}

function Hero() {
  const t = useTranslations('marketing.pricing.hero');
  return (
    <Section className="py-16 md:py-20">
      <SectionHeader eyebrow={t('eyebrow')} title={t('title')} subtitle={t('subtitle')} />
    </Section>
  );
}

function Form() {
  return (
    <Section tone="muted" className="py-12">
      <WaitlistForm />
    </Section>
  );
}

function Tiers() {
  const t = useTranslations('marketing.pricing.tiers');
  return (
    <Section>
      <SectionHeader title={t('title')} subtitle={t('subtitle')} />
      <div className="grid gap-6 md:grid-cols-3">
        {TIERS.map((tier) => {
          const bullets = [0, 1, 2, 3] as const;
          return (
            <div
              key={tier}
              className="border-border bg-bg-elevated flex flex-col rounded-2xl border p-6 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <h3 className="text-fg text-xl font-bold tracking-tight">
                  {t(`${tier}.name` as 'family.name')}
                </h3>
                <Badge variant="outline">{t(`${tier}.footnote` as 'family.footnote')}</Badge>
              </div>
              <p className="text-fg-muted mt-3 text-sm leading-relaxed">
                {t(`${tier}.tagline` as 'family.tagline')}
              </p>

              <ul className="mt-6 flex-1 space-y-3">
                {bullets.map((b) => (
                  <li key={b} className="flex items-start gap-2 text-sm leading-relaxed">
                    <Check aria-hidden="true" className="text-primary mt-0.5 h-4 w-4 shrink-0" />
                    <span className="text-fg">
                      {t(`${tier}.bullets.${b}` as 'family.bullets.0')}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </Section>
  );
}
