import { useTranslations } from 'next-intl';
import { ChildTabs } from './child-tabs';
import type { AppLocale } from '@/i18n/routing';
import type { DashboardCaregiver, DashboardChild } from '@/server/dashboard/types';

/**
 * Greeting block — eyebrow, name greeting, optional active-child tab
 * strip. The greeting falls back to "there" when neither full_name nor
 * email are available; UX research showed a generic-but-warm fallback
 * beats a blank or bracketed "[name]".
 */
export function GreetingHeader({
  caregiver,
  children,
  activeChildId,
  activeChildName,
  locale,
}: {
  caregiver: DashboardCaregiver;
  children: DashboardChild[];
  activeChildId: string | null;
  activeChildName: string | null;
  locale: AppLocale;
}) {
  const t = useTranslations('marketing.app.dashboard.v6');
  const greetingName = caregiver.firstName ?? caregiver.email?.split('@')[0] ?? t('genericName');
  return (
    <section className="space-y-3">
      <p className="text-fg-subtle text-xs font-semibold uppercase tracking-wide">{t('eyebrow')}</p>
      <h1 className="text-fg text-balance text-3xl font-bold leading-tight tracking-tight md:text-4xl">
        {t('greeting', { name: greetingName })}
      </h1>
      <p className="text-fg-muted max-w-2xl text-base leading-relaxed">
        {activeChildName ? t('subtitleFor', { childName: activeChildName }) : t('subtitle')}
      </p>
      <ChildTabs children={children} activeChildId={activeChildId} locale={locale} />
    </section>
  );
}
