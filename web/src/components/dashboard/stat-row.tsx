import { Activity, BookOpen, Flame, Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { StatCard } from './stat-card';
import type { AppLocale } from '@/i18n/routing';
import type { DashboardHero } from '@/server/dashboard/types';
import { formatInteger } from '@/server/dashboard/format';

/**
 * Hero stat row — four tiles at the top of the dashboard.
 *
 * Order is deliberate:
 *   1. Today's stars (the proudest number for caregivers)
 *   2. Current streak (calm consistency)
 *   3. Active vocabulary size (board capacity)
 *   4. Today's input count (engagement)
 */
export function StatRow({ hero, locale }: { hero: DashboardHero; locale: AppLocale }) {
  const t = useTranslations('marketing.app.dashboard.v6');
  return (
    <ul className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
      <li>
        <StatCard
          label={t('hero.stars.label')}
          value={formatInteger(hero.todayStars, locale)}
          sublabel={t('hero.stars.sublabel')}
          tone="accent"
          icon={<Sparkles className="h-4 w-4" />}
          testId="dashboard-stat-stars"
        />
      </li>
      <li>
        <StatCard
          label={t('hero.streak.label')}
          value={formatInteger(hero.currentStreakDays, locale)}
          sublabel={t('hero.streak.sublabel', {
            longest: formatInteger(hero.longestStreakDays, locale),
          })}
          icon={<Flame className="h-4 w-4" />}
          testId="dashboard-stat-streak"
        />
      </li>
      <li>
        <StatCard
          label={t('hero.vocab.label')}
          value={formatInteger(hero.activeVocabularySize, locale)}
          sublabel={t('hero.vocab.sublabel')}
          icon={<BookOpen className="h-4 w-4" />}
          testId="dashboard-stat-vocab"
        />
      </li>
      <li>
        <StatCard
          label={t('hero.taps.label')}
          value={formatInteger(hero.todayInputCount, locale)}
          sublabel={t('hero.taps.sublabel')}
          icon={<Activity className="h-4 w-4" />}
          testId="dashboard-stat-taps"
        />
      </li>
    </ul>
  );
}
