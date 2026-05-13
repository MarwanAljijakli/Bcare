import { Shield } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { NewCaregiverEmpty } from './empty-states';
import { GreetingHeader } from './greeting-header';
import { NextMilestoneCard } from './next-milestone-card';
import { PendingSuggestionsCard } from './pending-suggestions-card';
import { QuickActionsFooter } from './quick-actions-footer';
import { RecentSessionsTable } from './recent-sessions-table';
import { StatRow } from './stat-row';
import { StreakCallout } from './streak-callout';
import { TodayPanel } from './today-panel';
import { TopSymbolsCard } from './top-symbols-card';
import { VocabSparkline } from './vocab-sparkline';
import type { DashboardPayload } from '@/server/dashboard/types';
import { Logo } from '@/components/brand/logo';
import { LanguageSwitcher } from '@/components/language-switcher';
import { ThemeSwitcher } from '@/components/theme-switcher';
import { Link } from '@/i18n/routing';

/**
 * Dashboard shell — full Module 6 layout, server-rendered.
 *
 * Layout:
 *   [Header: Logo / ThemeSwitcher / LanguageSwitcher]
 *   [Greeting + ChildTabs (if >1 child)]
 *   [Hero stat row — 4 tiles]
 *   [Two-column grid:
 *      LEFT  (lg=2/3): Today panel · Recent sessions table
 *      RIGHT (lg=1/3): Streak callout · Pending suggestions · Top symbols ]
 *   [Vocabulary growth — full width sparkline]
 *   [Quick actions footer]
 *
 * Empty path: when `payload.empty.newCaregiver` we render the
 * NewCaregiverEmpty surface and skip everything else; this state should
 * only appear if the caregiver finished signup but never finished
 * onboarding (or onboarding fired its finalize step but the children
 * row was rolled back).
 */
export function DashboardShell({ payload }: { payload: DashboardPayload }) {
  const tCommon = useTranslations('common');
  const activeChild = payload.children.find((c) => c.id === payload.activeChildId) ?? null;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-border bg-bg/80 sticky top-0 z-20 border-b backdrop-blur">
        <div className="container flex h-16 items-center justify-between gap-3">
          <Link
            href="/dashboard"
            aria-label={tCommon('appName')}
            className="focus-visible:ring-ring -m-2 inline-flex items-center gap-2 rounded-lg p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          >
            <Logo size="md" wordmark="auto" />
          </Link>
          <div className="flex items-center gap-2">
            {payload.caregiver.isAdmin && (
              <Link
                href="/admin"
                className="text-fg hover:bg-bg-muted focus-visible:ring-ring inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2"
              >
                <Shield aria-hidden="true" className="h-4 w-4" />
                <span>{tCommon('admin')}</span>
              </Link>
            )}
            <ThemeSwitcher />
            <LanguageSwitcher />
          </div>
        </div>
      </header>

      <main id="main" className="container flex flex-1 flex-col gap-8 py-8 lg:gap-10 lg:py-10">
        {payload.empty.newCaregiver ? (
          <NewCaregiverEmpty />
        ) : (
          <>
            <GreetingHeader
              caregiver={payload.caregiver}
              children={payload.children}
              activeChildId={payload.activeChildId}
              activeChildName={activeChild?.name ?? null}
              locale={payload.caregiver.locale}
            />

            <StatRow hero={payload.hero} locale={payload.caregiver.locale} />

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <div className="space-y-6 lg:col-span-2">
                <TodayPanel today={payload.today} locale={payload.caregiver.locale} />
                <RecentSessionsTable
                  rows={payload.recentSessions}
                  locale={payload.caregiver.locale}
                />
              </div>
              <div className="space-y-6">
                <StreakCallout hero={payload.hero} locale={payload.caregiver.locale} />
                {/* Phase 12 B.1 — Next milestone surface. Reuses
                 *  levels.get; no new router. Slotted above pending
                 *  suggestions because the goal is more motivating
                 *  for fresh caregivers than the review-queue is. */}
                <NextMilestoneCard
                  childId={payload.activeChildId}
                  locale={payload.caregiver.locale}
                />
                <PendingSuggestionsCard suggestions={payload.suggestions} />
                <TopSymbolsCard items={payload.topSymbols} locale={payload.caregiver.locale} />
              </div>
            </div>

            <VocabSparkline points={payload.vocabSparkline} locale={payload.caregiver.locale} />

            <QuickActionsFooter />
          </>
        )}
      </main>
    </div>
  );
}
