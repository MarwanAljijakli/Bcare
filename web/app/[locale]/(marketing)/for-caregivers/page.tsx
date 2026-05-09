import { ArrowRight, BookHeart, EyeOff, Sparkles, History, Lock, Download } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import type { AppLocale } from '@/i18n/routing';
import { MockChildBoard } from '@/components/marketing/mock-child-board';
import { Section, SectionHeader } from '@/components/marketing/section';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/routing';
import { pageMetadata } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: AppLocale }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'marketing.forCaregivers.hero' });
  return pageMetadata({ locale, path: 'for-caregivers', title: t('title') });
}

export default async function ForCaregiversPage({
  params,
}: {
  params: Promise<{ locale: AppLocale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <>
      <Hero />
      <Benefits />
      <Cta />
    </>
  );
}

const ICONS = [BookHeart, EyeOff, Sparkles, History, Lock, Download] as const;

function Hero() {
  const t = useTranslations('marketing.forCaregivers.hero');
  return (
    <Section className="py-16 md:py-20">
      <div className="grid items-center gap-12 lg:grid-cols-12">
        <div className="lg:col-span-6">
          <h1 className="text-fg text-balance text-4xl font-bold leading-tight tracking-tight md:text-5xl">
            {t('title')}
          </h1>
          <p className="text-fg-muted mt-5 max-w-xl text-balance text-lg leading-relaxed">
            {t('subtitle')}
          </p>
        </div>
        <div className="lg:col-span-6">
          <MockChildBoard />
        </div>
      </div>
    </Section>
  );
}

function Benefits() {
  const t = useTranslations('marketing.forCaregivers.benefits');
  return (
    <Section tone="muted">
      <SectionHeader title={t('title')} />
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((i) => {
          const Icon = ICONS[i]!;
          return (
            <div key={i} className="border-border bg-bg-elevated rounded-2xl border p-6 shadow-sm">
              <div className="bg-primary/10 text-primary mb-4 grid h-11 w-11 place-items-center rounded-xl">
                <Icon aria-hidden="true" className="h-5 w-5" />
              </div>
              <h3 className="text-fg text-lg font-semibold tracking-tight">
                {t(`items.${i}.title`)}
              </h3>
              <p className="text-fg-muted mt-2 text-base leading-relaxed">{t(`items.${i}.body`)}</p>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

function Cta() {
  const t = useTranslations('marketing.landing.hero');
  return (
    <Section className="text-center">
      <Button asChild size="xl">
        <Link href="/signup">
          {t('ctaPrimary')}
          <ArrowRight aria-hidden="true" className="h-4 w-4" />
        </Link>
      </Button>
    </Section>
  );
}
