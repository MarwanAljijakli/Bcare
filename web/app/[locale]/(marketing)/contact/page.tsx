import { Mail, ShieldCheck, Eye, Newspaper } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import type { AppLocale } from '@/i18n/routing';
import { Section, SectionHeader } from '@/components/marketing/section';
import { pageMetadata } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: AppLocale }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'marketing.contact' });
  return pageMetadata({ locale, path: 'contact', title: t('title') });
}

const ENTRIES: Array<{
  key: 'general' | 'security' | 'accessibility' | 'press';
  icon: typeof Mail;
  email: string;
}> = [
  { key: 'general', icon: Mail, email: 'hello@bluecare.app' },
  { key: 'security', icon: ShieldCheck, email: 'security@bluecare.app' },
  { key: 'accessibility', icon: Eye, email: 'accessibility@bluecare.app' },
  { key: 'press', icon: Newspaper, email: 'press@bluecare.app' },
];

export default async function ContactPage({ params }: { params: Promise<{ locale: AppLocale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <Section className="py-16 md:py-24">
      <Inner />
    </Section>
  );
}

function Inner() {
  const t = useTranslations('marketing.contact');
  return (
    <div className="mx-auto max-w-2xl">
      <SectionHeader title={t('title')} subtitle={t('subtitle')} align="start" />

      <ul className="border-border bg-bg-elevated divide-border divide-y rounded-2xl border shadow-sm">
        {ENTRIES.map(({ key, icon: Icon, email }) => (
          <li key={key} className="flex items-center gap-4 p-5">
            <span className="bg-primary/10 text-primary grid h-11 w-11 shrink-0 place-items-center rounded-xl">
              <Icon aria-hidden="true" className="h-5 w-5" />
            </span>
            <a
              href={`mailto:${email}`}
              className="text-fg hover:text-primary focus-visible:ring-ring focus-visible:text-primary text-base font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
            >
              {t(`emails.${key}`)}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
