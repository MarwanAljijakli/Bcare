'use client';

import { Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { VocabLevel } from '@/lib/levels';
import { trpc } from '@/lib/trpc/client';

const LEVEL_LABEL: Record<'en' | 'ar', Record<VocabLevel, string>> = {
  en: {
    starter: 'Starter',
    expanding: 'Expanding',
    conversational: 'Conversational',
    advanced: 'Advanced',
  },
  ar: {
    starter: 'بدء',
    expanding: 'متوسّع',
    conversational: 'محادثة',
    advanced: 'متقدّم',
  },
};

/**
 * Level + mastery badge on the board. Shows the child's current level
 * plus a calm "X/N mastered" line. Calm by design — no progress bar,
 * no big number; the user-facing tone is "your child is doing fine",
 * not gamified pressure.
 *
 * Hidden if the levels query hasn't resolved yet (no skeleton — we
 * don't want a flashing badge on every board mount).
 */
export function LevelBadge({ childId, locale }: { childId: string; locale: 'en' | 'ar' }) {
  const t = useTranslations('marketing.app.board');
  const query = trpc.levels.get.useQuery({ childId }, { staleTime: 60_000 });
  if (!query.data) return null;
  const { level, ordinal, totalLevels, active, readyForNext } = query.data;
  const label = LEVEL_LABEL[locale][level];

  return (
    <div
      aria-label={t('levelBadgeLabel', {
        level: label,
        mastered: active.mastered,
        total: active.symbols,
      })}
      className="border-border bg-bg-elevated text-fg-muted inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium shadow-sm"
    >
      <span className="text-fg font-semibold">
        {t('levelBadgeLevel', { ordinal, totalLevels })}: {label}
      </span>
      <span aria-hidden="true" className="text-fg-subtle">
        •
      </span>
      <span>{t('levelBadgeMastered', { mastered: active.mastered, total: active.symbols })}</span>
      {readyForNext && (
        <span className="text-primary inline-flex items-center gap-1 font-semibold">
          <Sparkles aria-hidden="true" className="h-3.5 w-3.5" />
          {t('levelBadgeReady')}
        </span>
      )}
    </div>
  );
}
