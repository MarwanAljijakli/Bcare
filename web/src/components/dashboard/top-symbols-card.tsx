import { useTranslations } from 'next-intl';
import { DashboardSection } from './dashboard-section';
import type { AppLocale } from '@/i18n/routing';
import type { DashboardTopSymbol } from '@/server/dashboard/types';
import { formatInteger } from '@/server/dashboard/format';

/**
 * Top symbols card — the 6 most-used symbols across the last 30 days.
 *
 * Aggregated from `progress_metrics.top_symbols` jsonb in the loader,
 * then enriched with `symbols.label_*` + `image_path` via a single
 * batched lookup. We don't render the symbol images yet (they're in
 * the supabase storage bucket and a real <Image> roundtrip would
 * inflate the dashboard's CWV — deferred); a calm rank chip + label
 * + count keeps the card honest until the storage bucket signed-url
 * helper is wired in for Module 6.B.
 */
export function TopSymbolsCard({
  items,
  locale,
}: {
  items: DashboardTopSymbol[];
  locale: AppLocale;
}) {
  const t = useTranslations('marketing.app.dashboard.v6');

  return (
    <DashboardSection
      eyebrow={t('topSymbols.eyebrow')}
      heading={t('topSymbols.heading')}
      description={t('topSymbols.description')}
    >
      {items.length === 0 ? (
        <div className="border-border-muted bg-bg-muted/30 text-fg-muted rounded-xl border border-dashed p-5 text-sm leading-relaxed">
          {t('topSymbols.empty')}
        </div>
      ) : (
        <ol className="space-y-2">
          {items.map((s) => (
            <li
              key={s.symbolId}
              className="border-border-muted bg-bg/40 flex items-center gap-3 rounded-xl border p-3"
            >
              <span
                aria-hidden="true"
                className="bg-primary/10 text-primary grid h-8 w-8 shrink-0 place-items-center rounded-lg text-xs font-bold tabular-nums"
              >
                {formatInteger(s.rank, locale)}
              </span>
              <span className="text-fg min-w-0 flex-1 truncate text-sm font-semibold">
                {s.label}
              </span>
              <span className="text-fg-muted shrink-0 text-xs tabular-nums">
                {t('topSymbols.taps', { count: formatInteger(s.count, locale) })}
              </span>
            </li>
          ))}
        </ol>
      )}
    </DashboardSection>
  );
}
