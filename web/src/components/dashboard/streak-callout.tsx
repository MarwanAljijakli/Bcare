import { Flame } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { DashboardSection } from './dashboard-section';
import type { AppLocale } from '@/i18n/routing';
import type { DashboardHero } from '@/server/dashboard/types';
import { formatInteger } from '@/server/dashboard/format';

/**
 * Streak callout — celebrates the current streak vs longest. Calm,
 * never sensational; copy explicitly notes that stars are capped at 5
 * per day to discourage marathons.
 */
export function StreakCallout({ hero, locale }: { hero: DashboardHero; locale: AppLocale }) {
  const t = useTranslations('marketing.app.dashboard.v6');
  return (
    <DashboardSection
      eyebrow={t('streak.eyebrow')}
      heading={t('streak.heading')}
      description={t('streak.description')}
    >
      <div className="flex items-center gap-4">
        <span
          aria-hidden="true"
          className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400"
        >
          <Flame className="h-6 w-6" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-fg text-2xl font-bold tabular-nums leading-tight">
            {t('streak.current', { count: formatInteger(hero.currentStreakDays, locale) })}
          </p>
          <p className="text-fg-muted text-xs">
            {t('streak.longest', { count: formatInteger(hero.longestStreakDays, locale) })}
          </p>
        </div>
      </div>
    </DashboardSection>
  );
}
