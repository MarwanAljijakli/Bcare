import { useTranslations } from 'next-intl';
import { DashboardSection } from './dashboard-section';
import type { AppLocale } from '@/i18n/routing';
import type { DashboardSparklinePoint } from '@/server/dashboard/types';
import { formatInteger, formatShortDate } from '@/server/dashboard/format';

/**
 * 30-day vocabulary growth sparkline.
 *
 * Inline SVG, no chart library. The viewBox is normalized to 100×30 so
 * the line scales fluidly to any container width. The aria-label
 * summarizes min, max, and the latest value so SR users get the trend
 * without parsing pixels.
 *
 * RTL note: when `locale === 'ar'` the SVG is mirrored horizontally so
 * the most recent point sits on the LEFT (the natural reading position
 * in RTL). The data order in the points[] array is preserved.
 */
export function VocabSparkline({
  points,
  locale,
}: {
  points: DashboardSparklinePoint[];
  locale: AppLocale;
}) {
  const t = useTranslations('marketing.app.dashboard.v6');

  const sizes = points.map((p) => p.size);
  const max = Math.max(1, ...sizes);
  const last = sizes[sizes.length - 1] ?? 0;
  const allZero = sizes.every((v) => v === 0);

  const summary = t('sparkline.summary', {
    min: formatInteger(Math.min(...sizes), locale),
    max: formatInteger(max, locale),
    last: formatInteger(last, locale),
  });

  return (
    <DashboardSection
      eyebrow={t('sparkline.eyebrow')}
      heading={t('sparkline.heading')}
      description={t('sparkline.description')}
    >
      {allZero ? (
        <div className="border-border-muted bg-bg-muted/30 text-fg-muted rounded-xl border border-dashed p-5 text-sm leading-relaxed">
          {t('sparkline.empty')}
        </div>
      ) : (
        <div className="space-y-3">
          <SparklineSvg
            points={sizes}
            max={max}
            ariaLabel={`${t('sparkline.altText')}. ${summary}`}
            mirror={locale === 'ar'}
          />
          <div className="flex items-center justify-between text-xs">
            <span className="text-fg-subtle">{formatShortDate(points[0]?.day ?? '', locale)}</span>
            <span className="text-fg-muted font-semibold tabular-nums">{summary}</span>
            <span className="text-fg-subtle">
              {formatShortDate(points[points.length - 1]?.day ?? '', locale)}
            </span>
          </div>
        </div>
      )}
    </DashboardSection>
  );
}

function SparklineSvg({
  points,
  max,
  ariaLabel,
  mirror,
}: {
  points: number[];
  max: number;
  ariaLabel: string;
  mirror: boolean;
}) {
  const W = 100;
  const H = 30;
  const PAD_Y = 2;
  const innerH = H - PAD_Y * 2;
  if (points.length === 0) return null;

  const stepX = points.length > 1 ? W / (points.length - 1) : 0;
  const path = points
    .map((v, i) => {
      const x = i * stepX;
      const y = PAD_Y + (1 - v / max) * innerH;
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ');
  const area = `${path} L ${(points.length - 1) * stepX} ${H} L 0 ${H} Z`;

  const lastX = (points.length - 1) * stepX;
  const lastY = PAD_Y + (1 - (points[points.length - 1] ?? 0) / max) * innerH;

  return (
    <svg
      role="img"
      aria-label={ariaLabel}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="h-20 w-full"
      style={mirror ? { transform: 'scaleX(-1)' } : undefined}
    >
      <title>{ariaLabel}</title>
      <path d={area} className="fill-primary/10" />
      <path
        d={path}
        className="stroke-primary fill-none"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={lastX} cy={lastY} r={1.5} className="fill-primary" />
    </svg>
  );
}
