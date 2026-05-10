import { useTranslations } from 'next-intl';
import { DashboardSection } from './dashboard-section';
import { SuggestionRowClient } from './suggestion-row-client';
import type { DashboardSuggestion } from '@/server/dashboard/types';

/**
 * Pending vocabulary suggestions card.
 *
 * Server shell + a client island per row (the only client-side JS on
 * the dashboard tree besides the language/theme switchers).
 */
export function PendingSuggestionsCard({ suggestions }: { suggestions: DashboardSuggestion[] }) {
  const t = useTranslations('marketing.app.dashboard.v6');

  return (
    <DashboardSection
      eyebrow={t('suggestions.eyebrow')}
      heading={t('suggestions.heading')}
      description={t('suggestions.description')}
    >
      {suggestions.length === 0 ? (
        <div className="border-border-muted bg-bg-muted/30 text-fg-muted rounded-xl border border-dashed p-5 text-sm leading-relaxed">
          {t('suggestions.empty')}
        </div>
      ) : (
        <ul className="space-y-2">
          {suggestions.map((s) => (
            <SuggestionRowClient
              key={s.id}
              suggestion={s}
              labels={{
                approve: t('suggestions.approve'),
                reject: t('suggestions.reject'),
                sourceFrequency: t('suggestions.source.frequency'),
                sourceLlm: t('suggestions.source.llm'),
                pending: t('suggestions.pending'),
              }}
            />
          ))}
        </ul>
      )}
    </DashboardSection>
  );
}
