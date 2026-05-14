'use client';

import { ArrowDown, ArrowUp, CheckCircle2, Loader2, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import {
  LEVEL_CATEGORIES,
  LEVEL_TARGET_COUNTS,
  VOCAB_LEVELS,
  levelOrdinal,
  type VocabLevel,
} from '@/lib/levels';
import { trpc } from '@/lib/trpc/client';

const LABELS: Record<'en' | 'ar', Record<VocabLevel, string>> = {
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

const CATEGORY_LABELS: Record<'en' | 'ar', Record<string, string>> = {
  en: {
    core_needs: 'Core needs',
    feelings: 'Feelings',
    people: 'People',
    food_drink: 'Food & drink',
    body: 'Body parts',
    actions: 'Actions',
    places: 'Places',
    time: 'Time',
    clothing: 'Clothing',
    toys_play: 'Toys & play',
    social: 'Social',
    school: 'School',
    weather: 'Weather',
  },
  ar: {
    core_needs: 'الاحتياجات الأساسية',
    feelings: 'المشاعر',
    people: 'الأشخاص',
    food_drink: 'الطعام والشراب',
    body: 'أعضاء الجسم',
    actions: 'الأفعال',
    places: 'الأماكن',
    time: 'الوقت',
    clothing: 'الملابس',
    toys_play: 'الألعاب',
    social: 'التواصل الاجتماعي',
    school: 'المدرسة',
    weather: 'الطقس',
  },
};

const COPY = {
  en: {
    title: 'Learning level',
    subtitle: (name: string | null) =>
      name
        ? `Pick which symbols ${name} can see on their board today.`
        : 'Pick which symbols your child can see on their board today.',
    intro:
      'BlueCare auto-promotes when ≥80% of the current tier is mastered. Override here any time — promotion is celebratory, not gated.',
    current: 'Current level',
    activeMastered: '{mastered} of {total} active symbols mastered',
    promoteNow: 'Promote now',
    demoteNow: 'Step back',
    promoting: 'Updating…',
    promotedToast: 'Level updated.',
    readyHint: "Your child looks ready — they've mastered 80%+ of this tier.",
    tierUnlocks: 'Newly unlocked at this tier',
    levelHeader: 'Level {ordinal} of 4',
    targetSymbols: '~{count} symbols',
  },
  ar: {
    title: 'مستوى التعلّم',
    subtitle: (name: string | null) =>
      name
        ? `اختر الرموز التي يراها ${name} على لوحته اليوم.`
        : 'اختر الرموز التي يراها طفلك على لوحته اليوم.',
    intro:
      'يرفّع بلوكير تلقائيًا عند إتقان ٨٠٪ من المستوى الحالي. عدّل هنا متى شئت — الترفيع احتفال لا قَيد.',
    current: 'المستوى الحالي',
    activeMastered: 'أتقن {mastered} من {total} رمزًا نشطًا',
    promoteNow: 'رفّع الآن',
    demoteNow: 'رجوع خطوة',
    promoting: 'جارٍ التحديث…',
    promotedToast: 'تمّ تحديث المستوى.',
    readyHint: 'يبدو أنّ طفلك جاهز — أتقن أكثر من ٨٠٪ من هذا المستوى.',
    tierUnlocks: 'الجديد في هذا المستوى',
    levelHeader: 'المستوى {ordinal} من ٤',
    targetSymbols: '~{count} رمزًا',
  },
} as const;

export function LevelSettingsClient({
  locale,
  childId,
  childName,
  initialLevel,
}: {
  locale: 'en' | 'ar';
  childId: string;
  childName: string | null;
  initialLevel: VocabLevel;
}) {
  const t = COPY[locale];
  const labels = LABELS[locale];
  const cats = CATEGORY_LABELS[locale];
  const [toast, setToast] = useState<string | null>(null);

  const stateQuery = trpc.levels.get.useQuery({ childId });
  const setMut = trpc.levels.set.useMutation();
  const promoteMut = trpc.levels.promote.useMutation();
  const demoteMut = trpc.levels.demote.useMutation();
  const isBusy = setMut.isPending || promoteMut.isPending || demoteMut.isPending;

  const level = stateQuery.data?.level ?? initialLevel;
  const ordinal = levelOrdinal(level);
  const activeMastered = stateQuery.data?.active.mastered ?? 0;
  const activeSymbols = stateQuery.data?.active.symbols ?? 0;
  const ready = stateQuery.data?.readyForNext ?? false;

  async function applyAndRefresh(p: Promise<unknown>) {
    try {
      await p;
      await stateQuery.refetch();
      setToast(t.promotedToast);
      window.setTimeout(() => setToast(null), 2000);
    } catch {
      // mutation surfaces error via mut.error; no toast on failure
    }
  }

  return (
    <main className="container space-y-8 py-10">
      <header className="space-y-1">
        <h1 className="text-fg text-2xl font-bold leading-tight md:text-3xl">{t.title}</h1>
        <p className="text-fg-muted text-base leading-relaxed">{t.subtitle(childName)}</p>
        <p className="text-fg-subtle mt-2 text-sm">{t.intro}</p>
      </header>

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="border-success/30 bg-success/5 text-success rounded-xl border px-4 py-3 text-sm font-medium"
        >
          <CheckCircle2 className="me-1 inline h-4 w-4" /> {toast}
        </div>
      )}

      {ready && (
        <div
          role="note"
          className="border-primary/30 bg-primary/5 text-primary rounded-xl border px-4 py-3 text-sm font-medium leading-relaxed"
        >
          <Sparkles className="me-1 inline h-4 w-4" />
          {t.readyHint}
        </div>
      )}

      <section
        aria-label={t.current}
        className="border-border bg-bg-elevated rounded-2xl border p-6 shadow-sm"
      >
        <p className="text-fg-subtle text-xs font-semibold uppercase tracking-wide">{t.current}</p>
        <div className="mt-2 flex items-baseline gap-3">
          <span className="text-fg text-3xl font-bold">{labels[level]}</span>
          <span className="text-fg-muted text-sm">
            {t.levelHeader.replace('{ordinal}', String(ordinal))}
          </span>
        </div>
        <p className="text-fg-muted mt-2 text-sm">
          {t.activeMastered
            .replace('{mastered}', String(activeMastered))
            .replace('{total}', String(activeSymbols))}
        </p>

        <div className="mt-4 flex flex-wrap gap-3">
          <Button
            type="button"
            variant="primary"
            disabled={isBusy || level === 'advanced'}
            onClick={() => applyAndRefresh(promoteMut.mutateAsync({ childId }))}
          >
            {promoteMut.isPending ? (
              <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowUp aria-hidden="true" className="h-4 w-4" />
            )}
            {t.promoteNow}
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={isBusy || level === 'starter'}
            onClick={() => applyAndRefresh(demoteMut.mutateAsync({ childId }))}
          >
            <ArrowDown aria-hidden="true" className="h-4 w-4" />
            {t.demoteNow}
          </Button>
        </div>
      </section>

      <section aria-label="all-levels" className="space-y-3">
        {VOCAB_LEVELS.map((lvl) => {
          const isActive = lvl === level;
          const tierCats = LEVEL_CATEGORIES[lvl];
          return (
            <button
              key={lvl}
              type="button"
              disabled={isBusy || isActive}
              onClick={() => applyAndRefresh(setMut.mutateAsync({ childId, level: lvl }))}
              className={cn(
                'border-border bg-bg-elevated focus-visible:ring-ring w-full rounded-2xl border p-5 text-start shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
                isActive && 'border-primary/40 bg-primary/5',
                !isActive && !isBusy && 'hover:border-primary/30',
                isBusy && 'opacity-70',
              )}
              aria-pressed={isActive}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-fg text-lg font-bold leading-tight">{labels[lvl]}</p>
                  <p className="text-fg-muted text-xs">
                    {t.levelHeader.replace('{ordinal}', String(levelOrdinal(lvl)))} •{' '}
                    {t.targetSymbols.replace('{count}', String(LEVEL_TARGET_COUNTS[lvl]))}
                  </p>
                </div>
                {isActive && (
                  <span className="text-primary inline-flex items-center gap-1 text-xs font-semibold">
                    <CheckCircle2 className="h-4 w-4" /> {labels[lvl]}
                  </span>
                )}
              </div>
              <p className="text-fg-subtle mt-2 text-xs font-medium uppercase tracking-wide">
                {t.tierUnlocks}
              </p>
              <ul className="text-fg-muted mt-1 flex flex-wrap gap-1.5 text-sm">
                {tierCats.map((c) => (
                  <li
                    key={c}
                    className="bg-bg-muted text-fg-muted rounded-full px-2.5 py-0.5 text-xs"
                  >
                    {cats[c] ?? c}
                  </li>
                ))}
              </ul>
            </button>
          );
        })}
      </section>
    </main>
  );
}
