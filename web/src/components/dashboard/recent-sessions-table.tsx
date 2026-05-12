import Link from 'next/link';
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
 * Module 6.1 — rows are now interactive. Clicking a row navigates to
 * `/[locale]/dashboard/sessions/[id]` for the replay + therapist-notes
 * surface. The whole row is wrapped in a Next `<Link>` so keyboard +
 * screen-reader navigation work without a hidden visible link icon.
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
                <tr key={r.id} className="text-fg hover:bg-bg-elevated/50 transition-colors">
                  <td className="p-0 align-middle">
                    <Link
                      href={`/${locale}/dashboard/sessions/${r.id}`}
                      className="block px-2 py-2.5"
                    >
                      {formatShortDate(r.startedAt, locale)}
                    </Link>
                  </td>
                  <td className="text-fg-muted p-0 align-middle tabular-nums">
                    <Link
                      href={`/${locale}/dashboard/sessions/${r.id}`}
                      className="block px-2 py-2.5"
                      tabIndex={-1}
                    >
                      {formatDurationShort(r.durationSeconds, locale, units)}
                    </Link>
                  </td>
                  <td className="p-0 text-end align-middle font-semibold tabular-nums">
                    <Link
                      href={`/${locale}/dashboard/sessions/${r.id}`}
                      className="block px-2 py-2.5"
                      tabIndex={-1}
                    >
                      {formatInteger(r.inputCount, locale)}
                    </Link>
                  </td>
                  <td className="p-0 text-end align-middle font-semibold tabular-nums">
                    <Link
                      href={`/${locale}/dashboard/sessions/${r.id}`}
                      className="block px-2 py-2.5"
                      tabIndex={-1}
                    >
                      {r.inputCount > 0 ? formatPercent(r.successRate, locale) : '—'}
                    </Link>
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
