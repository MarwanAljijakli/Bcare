'use client';

import { Sparkles, Trophy } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { DashboardSection } from './dashboard-section';
import type { AppLocale } from '@/i18n/routing';
import { Link } from '@/i18n/routing';
import { cn } from '@/lib/cn';
import { trpc } from '@/lib/trpc/client';

/**
 * Phase 12 Bug B.1 — "Next milestone" card.
 *
 * Caregivers were asking "what's the goal? what's today's challenge?" —
 * the dashboard had no goal-progress surface, only review-pending
 * suggestions (a different concept). Rather than building a new
 * challenges table + cron (B.2, deferred), this card reuses the
 * existing `levels.ts` tRPC procedure which already exposes
 * (current_level, mastered, target, next_level, readyForNext).
 *
 * Render:
 *   - Eyebrow + heading: localized level name (Starter/Expanding/…)
 *   - If the child has no mastery yet (active.symbols=0 OR mastered=0)
 *     → friendly empty state nudging them to the board.
 *   - Else → "X / Y mastered" + progress bar + "Next: <level>" footer.
 *     When `readyForNext` is true, swap the footer for a celebratory
 *     "ready to advance" badge — auto-promotion in the cron handles
 *     the actual move; caregiver can also use /settings/level.
 *
 * No new DB table, no new tRPC endpoint. Pure consumer of levels.get.
 */
export function NextMilestoneCard({
  childId,
  locale,
}: {
  childId: string | null;
  locale: AppLocale;
}) {
  const t = useTranslations('marketing.app.dashboard.v6.nextMilestone');
  const query = trpc.levels.get.useQuery(
    { childId: childId ?? '' },
    {
      enabled: !!childId,
      staleTime: 60_000,
    },
  );

  // No active child — render nothing; the dashboard's empty-state
  // already covers the new-caregiver case.
  if (!childId) return null;

  const eyebrow = t('eyebrow');
  // Heading defaults to a neutral string while loading so the card
  // doesn't pop layout when the query resolves.
  const data = query.data;
  const levelLabel = data ? t(`levels.${data.level}`) : t('loading');

  return (
    <DashboardSection eyebrow={eyebrow} heading={levelLabel}>
      {!data ? (
        <div className="border-border-muted bg-bg-muted/30 h-20 animate-pulse rounded-xl border border-dashed" />
      ) : data.active.symbols === 0 || data.active.mastered === 0 ? (
        <EmptyState locale={locale} />
      ) : (
        <Progress data={data} locale={locale} />
      )}
    </DashboardSection>
  );
}

function EmptyState({ locale: _locale }: { locale: AppLocale }) {
  const t = useTranslations('marketing.app.dashboard.v6.nextMilestone');
  return (
    <div className="border-border-muted bg-bg-muted/30 text-fg-muted flex items-start gap-3 rounded-xl border border-dashed p-4 text-sm leading-relaxed">
      <Sparkles aria-hidden="true" className="text-primary mt-0.5 h-5 w-5 flex-shrink-0" />
      <div className="min-w-0 flex-1 space-y-2">
        <p>{t('emptyBody')}</p>
        <Link
          href="/board"
          className="text-primary hover:bg-primary/5 inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold underline-offset-2 hover:underline"
        >
          {t('emptyCta')}
        </Link>
      </div>
    </div>
  );
}

interface LevelsData {
  level: 'starter' | 'expanding' | 'conversational' | 'advanced';
  ordinal: number;
  totalLevels: number;
  targetSymbols: number;
  active: { symbols: number; mastered: number; masteryPct: number };
  nextLevel: 'starter' | 'expanding' | 'conversational' | 'advanced';
  readyForNext: boolean;
}

function Progress({ data, locale: _locale }: { data: LevelsData; locale: AppLocale }) {
  const t = useTranslations('marketing.app.dashboard.v6.nextMilestone');
  const pct = Math.max(0, Math.min(1, data.active.masteryPct));
  const pctLabel = `${Math.round(pct * 100)}%`;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-fg-muted text-sm leading-relaxed">
          {t('progressBody', {
            mastered: data.active.mastered,
            active: data.active.symbols,
          })}
        </p>
        <span
          aria-hidden="true"
          className="text-fg-subtle whitespace-nowrap text-xs font-semibold tabular-nums"
        >
          {pctLabel}
        </span>
      </div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct * 100)}
        aria-label={t('progressBarLabel')}
        className="bg-bg-muted h-2 w-full overflow-hidden rounded-full"
      >
        <div
          className={cn(
            'h-full rounded-full transition-all',
            data.readyForNext ? 'bg-success' : 'bg-primary',
          )}
          style={{ width: `${Math.round(pct * 100)}%` }}
        />
      </div>
      {data.readyForNext ? (
        <p className="text-success inline-flex items-center gap-1.5 text-xs font-semibold">
          <Trophy aria-hidden="true" className="h-3.5 w-3.5" />
          {t('readyForNext', { next: t(`levels.${data.nextLevel}`) })}
        </p>
      ) : (
        <p className="text-fg-subtle text-xs">
          {t('nextLevel', { next: t(`levels.${data.nextLevel}`) })}
        </p>
      )}
    </div>
  );
}
