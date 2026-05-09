import {
  Database,
  Lock,
  ShieldCheck,
  KeyRound,
  ScrollText,
  GaugeCircle,
  EyeOff,
  Camera,
  Download,
  Trash2,
  Undo2,
  Search,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import type { AppLocale } from '@/i18n/routing';
import { Section, SectionHeader } from '@/components/marketing/section';
import { pageMetadata } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: AppLocale }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'marketing.security.hero' });
  return pageMetadata({
    locale,
    path: 'security',
    title: t('title'),
    description: t('subtitle'),
  });
}

const CONTROL_ICONS = [
  Database,
  Lock,
  ShieldCheck,
  KeyRound,
  ScrollText,
  GaugeCircle,
  EyeOff,
  Camera,
] as const;
const RIGHTS_ICONS = [Download, Trash2, Undo2, Search] as const;

export default async function SecurityPage({ params }: { params: Promise<{ locale: AppLocale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <>
      <Hero />
      <Controls />
      <Rights />
      <Disclosure />
    </>
  );
}

function Hero() {
  const t = useTranslations('marketing.security.hero');
  return (
    <Section className="py-16 md:py-20">
      <SectionHeader eyebrow={t('eyebrow')} title={t('title')} subtitle={t('subtitle')} />
    </Section>
  );
}

function Controls() {
  const t = useTranslations('marketing.security.controls');
  return (
    <Section tone="muted">
      <SectionHeader title={t('title')} />
      <div className="grid gap-6 md:grid-cols-2">
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
          const Icon = CONTROL_ICONS[i]!;
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

function Rights() {
  const t = useTranslations('marketing.security.rights');
  return (
    <Section>
      <SectionHeader title={t('title')} />
      <div className="grid gap-6 md:grid-cols-2">
        {[0, 1, 2, 3].map((i) => {
          const Icon = RIGHTS_ICONS[i]!;
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

function Disclosure() {
  const t = useTranslations('marketing.security.disclosure');
  return (
    <Section tone="muted">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-fg text-2xl font-bold tracking-tight">{t('title')}</h2>
        <p className="text-fg-muted mt-4 text-base leading-relaxed">{t('body')}</p>
      </div>
    </Section>
  );
}
