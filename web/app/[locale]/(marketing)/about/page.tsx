import { Heart, Languages, ShieldCheck, UserCog } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import type { AppLocale } from '@/i18n/routing';
import { Section, SectionHeader } from '@/components/marketing/section';
import { pageMetadata } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: AppLocale }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'marketing.about.hero' });
  return pageMetadata({ locale, path: 'about', title: t('title') });
}

export default async function AboutPage({ params }: { params: Promise<{ locale: AppLocale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <>
      <Hero />
      <Story />
      <Principles />
    </>
  );
}

function Hero() {
  const t = useTranslations('marketing.about.hero');
  return (
    <Section className="py-16 md:py-20">
      <SectionHeader eyebrow={t('eyebrow')} title={t('title')} subtitle={t('subtitle')} />
    </Section>
  );
}

function Story() {
  const t = useTranslations('marketing.about.story');
  return (
    <Section tone="muted">
      <div className="mx-auto max-w-2xl">
        <h2 className="text-fg text-balance text-3xl font-bold leading-tight tracking-tight md:text-4xl">
          {t('title')}
        </h2>
        <div className="text-fg-muted prose-lg mt-8 space-y-6 text-base leading-relaxed">
          <p>{t('p1')}</p>
          <p>{t('p2')}</p>
          <p>{t('p3')}</p>
        </div>
      </div>
    </Section>
  );
}

const ICONS = [Heart, Languages, ShieldCheck, UserCog] as const;

function Principles() {
  const t = useTranslations('marketing.about.principles');
  return (
    <Section>
      <SectionHeader title={t('title')} />
      <div className="grid gap-6 md:grid-cols-2">
        {[0, 1, 2, 3].map((i) => {
          const Icon = ICONS[i]!;
          return (
            <div key={i} className="border-border bg-bg-elevated rounded-2xl border p-6 shadow-sm">
              <div className="bg-accent text-accent-fg mb-4 grid h-11 w-11 place-items-center rounded-xl">
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
