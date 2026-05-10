import { useTranslations } from 'next-intl';
import { DashboardSection } from './dashboard-section';
import { ModalityBar } from './modality-bar';
import type { AppLocale } from '@/i18n/routing';
import type { DashboardToday } from '@/server/dashboard/types';
import { formatDecimal, formatInteger, formatPercent } from '@/server/dashboard/format';

/**
 * "Today" panel — modality breakdown bar, success rate, average sentence
 * length, last 24h tap count.
 *
 * When `today.hasData === false` we render a calm empty state instead
 * of zero numbers — a brand-new caregiver should not see "0%" success
 * rate and feel discouraged.
 */
export function TodayPanel({ today, locale }: { today: DashboardToday; locale: AppLocale }) {
  const t = useTranslations('marketing.app.dashboard.v6');

  return (
    <DashboardSection
      eyebrow={t('today.eyebrow')}
      heading={t('today.heading')}
      description={t('today.description')}
    >
      {!today.hasData ? (
        <div className="border-border-muted bg-bg-muted/30 text-fg-muted rounded-xl border border-dashed p-5 text-sm leading-relaxed">
          {t('today.empty')}
        </div>
      ) : (
        <div className="space-y-5">
          <ModalityBar
            breakdown={today.modality}
            locale={locale}
            labels={{
              ariaLabel: t('today.modality.ariaLabel'),
              emptyLabel: t('today.modality.empty'),
              modality: {
                symbol: t('today.modality.symbol'),
                speech: t('today.modality.speech'),
                gesture: t('today.modality.gesture'),
                keyboard: t('today.modality.keyboard'),
              },
            }}
          />
          <dl className="grid grid-cols-3 gap-3">
            <Metric
              label={t('today.successRate')}
              value={formatPercent(today.successRate, locale)}
            />
            <Metric
              label={t('today.avgSentence')}
              value={formatDecimal(today.avgSentenceLength, locale)}
            />
            <Metric label={t('today.last24h')} value={formatInteger(today.last24hInputs, locale)} />
          </dl>
        </div>
      )}
    </DashboardSection>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-border-muted bg-bg/40 rounded-xl border p-3">
      <dt className="text-fg-subtle text-[10px] font-semibold uppercase tracking-wide">{label}</dt>
      <dd className="text-fg mt-1 text-xl font-bold tabular-nums leading-tight md:text-2xl">
        {value}
      </dd>
    </div>
  );
}
