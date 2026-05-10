import { useTranslations } from 'next-intl';
import { DashboardSection } from './dashboard-section';
import type { AppLocale } from '@/i18n/routing';
import type { DashboardSessionRow } from '@/server/dashboard/types';
import {
  formatDurationShort,
  formatInteger,
  formatPercent,
  formatShortDate,
} from '@/server/dashboard/format';

/**
 * Recent sessions — a real <table> with semantic columns.
 *
 * Last 10 sessions, newest first. Today the rows are non-interactive;
 * the session-detail page lands as a separate task (see Module 6
 * "deferred surfaces" in the runbook).
 */
export function RecentSessionsTable({
  rows,
  locale,
}: {
  rows: DashboardSessionRow[];
  locale: AppLocale;
}) {
  const t = useTranslations('marketing.app.dashboard.v6');
  const units = {
    hour: t('sessions.units.hour'),
    minute: t('sessions.units.minute'),
    second: t('sessions.units.second'),
  };

  return (
    <DashboardSection
      eyebrow={t('sessions.eyebrow')}
      heading={t('sessions.heading')}
      description={t('sessions.description')}
    >
      {rows.length === 0 ? (
        <div className="border-border-muted bg-bg-muted/30 text-fg-muted rounded-xl border border-dashed p-5 text-sm leading-relaxed">
          {t('sessions.empty')}
        </div>
      ) : (
        <div className="-mx-1 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-fg-subtle border-border-muted border-b text-left text-xs font-semibold uppercase tracking-wide">
                <th scope="col" className="px-2 py-2.5 font-semibold">
                  {t('sessions.col.date')}
                </th>
                <th scope="col" className="px-2 py-2.5 font-semibold">
                  {t('sessions.col.duration')}
                </th>
                <th scope="col" className="px-2 py-2.5 text-end font-semibold">
                  {t('sessions.col.inputs')}
                </th>
                <th scope="col" className="px-2 py-2.5 text-end font-semibold">
                  {t('sessions.col.success')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-border-muted divide-y">
              {rows.map((r) => (
                <tr key={r.id} className="text-fg">
                  <td className="px-2 py-2.5 align-middle">
                    {formatShortDate(r.startedAt, locale)}
                  </td>
                  <td className="text-fg-muted px-2 py-2.5 align-middle tabular-nums">
                    {formatDurationShort(r.durationSeconds, locale, units)}
                  </td>
                  <td className="px-2 py-2.5 text-end align-middle font-semibold tabular-nums">
                    {formatInteger(r.inputCount, locale)}
                  </td>
                  <td className="px-2 py-2.5 text-end align-middle font-semibold tabular-nums">
                    {r.inputCount > 0 ? formatPercent(r.successRate, locale) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </DashboardSection>
  );
}
