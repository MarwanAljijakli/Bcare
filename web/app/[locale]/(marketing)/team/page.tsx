import { ArrowRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import type { AppLocale } from '@/i18n/routing';
import { Section, SectionHeader } from '@/components/marketing/section';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/routing';
import { pageMetadata } from '@/lib/seo';

interface PersonProps {
  name: string;
  nameAr: string;
  role: string;
  roleAr: string;
  initials: string;
}

const FOUNDERS: PersonProps[] = [
  {
    name: 'Somaya Nather Dayan',
    nameAr: 'سمية ناثر ديان',
    role: 'Co-author · Senior project',
    roleAr: 'مؤلِّفة مشاركة · مشروع التخرج',
    initials: 'SD',
  },
  {
    name: 'Masa Malik Alalawi',
    nameAr: 'ماسة مالك العلوي',
    role: 'Co-author · Senior project',
    roleAr: 'مؤلِّفة مشاركة · مشروع التخرج',
    initials: 'MA',
  },
  {
    name: 'Alaa Khalid Al-Ghamdi',
    nameAr: 'آلاء خالد الغامدي',
    role: 'Co-author · Senior project',
    roleAr: 'مؤلِّفة مشاركة · مشروع التخرج',
    initials: 'AG',
  },
  {
    name: 'Fadwa Ibrahim Abushanab',
    nameAr: 'فدوى إبراهيم أبوشنب',
    role: 'Co-author · Senior project',
    roleAr: 'مؤلِّفة مشاركة · مشروع التخرج',
    initials: 'FA',
  },
];

const SUPERVISOR: PersonProps = {
  name: 'Dr. Hasanin Barhamtoshy',
  nameAr: 'د. حسنين برهمتوشي',
  role: 'Academic supervisor · Jeddah International College',
  roleAr: 'المشرف الأكاديمي · كلية جدة العالمية',
  initials: 'HB',
};

export async function generateMetadata({ params }: { params: Promise<{ locale: AppLocale }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'marketing.team.hero' });
  return pageMetadata({ locale, path: 'team', title: t('title') });
}

export default async function TeamPage({ params }: { params: Promise<{ locale: AppLocale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <>
      <Hero />
      <Founders locale={locale} />
      <Supervisor locale={locale} />
      <JoinUs />
    </>
  );
}

function Hero() {
  const t = useTranslations('marketing.team.hero');
  return (
    <Section className="py-16 md:py-20">
      <SectionHeader eyebrow={t('eyebrow')} title={t('title')} subtitle={t('subtitle')} />
    </Section>
  );
}

function Founders({ locale }: { locale: AppLocale }) {
  const t = useTranslations('marketing.team.founders');
  return (
    <Section tone="muted">
      <SectionHeader title={t('title')} />
      <div className="grid gap-6 md:grid-cols-2">
        {FOUNDERS.map((person) => (
          <PersonCard key={person.name} person={person} locale={locale} />
        ))}
      </div>
    </Section>
  );
}

function Supervisor({ locale }: { locale: AppLocale }) {
  const t = useTranslations('marketing.team.supervisor');
  return (
    <Section>
      <SectionHeader title={t('title')} />
      <div className="mx-auto max-w-md">
        <PersonCard person={SUPERVISOR} locale={locale} />
      </div>
    </Section>
  );
}

function PersonCard({ person, locale }: { person: PersonProps; locale: AppLocale }) {
  const isAr = locale === 'ar';
  return (
    <article className="border-border bg-bg-elevated flex items-center gap-4 rounded-2xl border p-6 shadow-sm">
      <div
        aria-hidden="true"
        className="bg-primary/10 text-primary grid h-14 w-14 shrink-0 place-items-center rounded-full text-base font-semibold"
      >
        {person.initials}
      </div>
      <div>
        <h3 className="text-fg text-lg font-semibold leading-tight">
          {isAr ? person.nameAr : person.name}
        </h3>
        <p className="text-fg-muted mt-1 text-sm leading-relaxed">
          {isAr ? person.roleAr : person.role}
        </p>
      </div>
    </article>
  );
}

function JoinUs() {
  const t = useTranslations('marketing.team.joinUs');
  return (
    <Section tone="muted">
      <div className="border-border bg-bg-elevated mx-auto max-w-2xl rounded-2xl border p-8 text-center shadow-sm">
        <h2 className="text-fg text-2xl font-bold tracking-tight">{t('title')}</h2>
        <p className="text-fg-muted mt-3 text-base leading-relaxed">{t('body')}</p>
        <div className="mt-6">
          <Button asChild size="lg">
            <Link href="/contact">
              {t('cta')}
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </Section>
  );
}
