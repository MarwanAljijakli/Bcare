import type { AppLocale } from '@/i18n/routing';
import type { DashboardModalityBreakdown } from '@/server/dashboard/types';
import { formatInteger, formatPercent } from '@/server/dashboard/format';

/**
 * Modality breakdown — horizontal stacked bar with a legend below.
 *
 * Inline SVG (no chart lib). Each segment carries its own role+title for
 * SR users; the wrapper provides an aria-label summary so users with
 * screen readers can skip the segments entirely if they prefer.
 *
 * RTL flips the visual order of segments; the data order is preserved.
 */
const MODALITIES = ['symbol', 'speech', 'gesture', 'keyboard'] as const;
type Modality = (typeof MODALITIES)[number];

const TONE_CLASSES: Record<Modality, string> = {
  symbol: 'fill-primary',
  speech: 'fill-emerald-500 dark:fill-emerald-400',
  gesture: 'fill-amber-500 dark:fill-amber-400',
  keyboard: 'fill-rose-500 dark:fill-rose-400',
};

const SWATCH_CLASSES: Record<Modality, string> = {
  symbol: 'bg-primary',
  speech: 'bg-emerald-500 dark:bg-emerald-400',
  gesture: 'bg-amber-500 dark:bg-amber-400',
  keyboard: 'bg-rose-500 dark:bg-rose-400',
};

export function ModalityBar({
  breakdown,
  labels,
  locale,
}: {
  breakdown: DashboardModalityBreakdown;
  labels: { ariaLabel: string; emptyLabel: string; modality: Record<Modality, string> };
  locale: AppLocale;
}) {
  const total = breakdown.symbol + breakdown.speech + breakdown.gesture + breakdown.keyboard;

  if (total === 0) {
    return (
      <div className="border-border-muted text-fg-subtle bg-bg-muted/30 flex h-12 items-center justify-center rounded-xl border border-dashed text-xs">
        {labels.emptyLabel}
      </div>
    );
  }

  let cumulative = 0;
  const segments = MODALITIES.map((m) => {
    const value = breakdown[m];
    const pct = (value / total) * 100;
    const x = cumulative;
    cumulative += pct;
    return { m, value, pct, x };
  }).filter((s) => s.value > 0);

  const summary = MODALITIES.map(
    (m) => `${labels.modality[m]}: ${formatPercent(breakdown[m] / total, locale)}`,
  ).join(', ');

  return (
    <div className="space-y-3">
      <svg
        role="img"
        aria-label={`${labels.ariaLabel}. ${summary}.`}
        viewBox="0 0 100 8"
        preserveAspectRatio="none"
        className="h-3 w-full overflow-hidden rounded-full"
      >
        <title>{labels.ariaLabel}</title>
        <desc>{summary}</desc>
        {segments.map((s) => (
          <rect key={s.m} x={s.x} y={0} width={s.pct} height={8} className={TONE_CLASSES[s.m]} />
        ))}
      </svg>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
        {MODALITIES.map((m) => {
          const value = breakdown[m];
          const pct = total > 0 ? value / total : 0;
          return (
            <li key={m} className="flex items-center gap-2 text-xs">
              <span
                aria-hidden="true"
                className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${SWATCH_CLASSES[m]}`}
              />
              <span className="text-fg-muted shrink-0">{labels.modality[m]}</span>
              <span className="text-fg ms-auto font-semibold tabular-nums">
                {formatInteger(value, locale)}
                <span className="text-fg-subtle ms-1 font-normal">
                  ({formatPercent(pct, locale)})
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
