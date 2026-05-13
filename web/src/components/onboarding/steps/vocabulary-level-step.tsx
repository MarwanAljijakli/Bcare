'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useStepError } from '../use-step-error';
import { WizardActions } from '../wizard-actions';
import { useRouter } from '@/i18n/routing';
import { trpc } from '@/lib/trpc/client';

const LEVELS = ['starter', 'expanding', 'conversational', 'advanced'] as const;
type Level = (typeof LEVELS)[number];

export function VocabularyLevelStep({ initial }: { initial: Level | undefined }) {
  const t = useTranslations('marketing.auth.onboardingWizard.vocabularyLevel');
  const router = useRouter();
  const [level, setLevel] = useState<Level>(initial ?? 'starter');
  const { errorMessage, captureError, clearError } = useStepError();
  const upsert = trpc.onboarding.upsertDraft.useMutation();

  async function save(advance: boolean) {
    clearError();
    try {
      await upsert.mutateAsync({
        step: advance ? 'voice' : 'vocabulary_level',
        patch: { child: { vocabularyLevel: level } },
      });
      router.push(advance ? '/onboarding/voice' : '/onboarding/sensory');
    } catch (e) {
      captureError(e);
    }
  }

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-fg text-2xl font-bold tracking-tight md:text-3xl">{t('title')}</h1>
        <p className="text-fg-muted text-base leading-relaxed">{t('subtitle')}</p>
      </header>
      <fieldset className="space-y-2">
        <legend className="sr-only">{t('legend')}</legend>
        {LEVELS.map((value) => (
          <label
            key={value}
            className="border-border bg-bg-elevated has-[:checked]:border-primary has-[:checked]:bg-primary/5 flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition-colors"
          >
            <input
              type="radio"
              name="vlevel"
              value={value}
              checked={level === value}
              onChange={() => setLevel(value)}
              className="text-primary mt-1 h-4 w-4"
            />
            <span className="flex-1">
              <span className="text-fg block text-sm font-semibold">{t(`${value}.label`)}</span>
              <span className="text-fg-muted mt-0.5 block text-xs leading-relaxed">
                {t(`${value}.description`)}
              </span>
            </span>
          </label>
        ))}
      </fieldset>
      <WizardActions
        backHref="/onboarding/sensory"
        onNext={() => save(true)}
        onSaveLater={() => save(false)}
        pending={upsert.isPending}
        error={errorMessage}
      />
    </section>
  );
}
