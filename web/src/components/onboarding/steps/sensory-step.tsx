'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useStepError } from '../use-step-error';
import { WizardActions } from '../wizard-actions';
import { useRouter } from '@/i18n/routing';
import { trpc } from '@/lib/trpc/client';

// fontScale options carry numeric values stored on the sensory profile (1,
// 1.25, 1.5) but the i18n LOOKUP key cannot contain dots — next-intl uses
// `.` as a path separator, so `t('fontScale.options.1.25')` would traverse
// `messages.fontScale.options[1][25]` and fall back to the raw key. We map
// each numeric to a dot-free i18n suffix (x100 / x125 / x150) for the t()
// call. The value-on-the-wire stays numeric.
const FIELDS = [
  { key: 'motion', options: ['full', 'reduced', 'off'] as const },
  { key: 'audio', options: ['full', 'soft', 'off'] as const },
  { key: 'contrast', options: ['standard', 'high'] as const },
  { key: 'touch', options: ['standard', 'large', 'extra-large'] as const },
  { key: 'fontScale', options: [1, 1.25, 1.5] as const },
] as const;

const FONT_SCALE_I18N_KEY: Record<1 | 1.25 | 1.5, 'x100' | 'x125' | 'x150'> = {
  1: 'x100',
  1.25: 'x125',
  1.5: 'x150',
};

type SensoryProfile = {
  motion: 'full' | 'reduced' | 'off';
  audio: 'full' | 'soft' | 'off';
  contrast: 'standard' | 'high';
  touch: 'standard' | 'large' | 'extra-large';
  fontScale: 1 | 1.25 | 1.5;
};

export function SensoryStep({ initial }: { initial: Partial<SensoryProfile> }) {
  const t = useTranslations('marketing.auth.onboardingWizard.sensory');
  const router = useRouter();
  const [profile, setProfile] = useState<SensoryProfile>({
    motion: initial.motion ?? 'full',
    audio: initial.audio ?? 'full',
    contrast: initial.contrast ?? 'standard',
    touch: initial.touch ?? 'standard',
    fontScale: initial.fontScale ?? 1,
  });
  const { errorMessage, captureError, clearError } = useStepError();
  const upsert = trpc.onboarding.upsertDraft.useMutation();

  async function save(advance: boolean) {
    clearError();
    try {
      await upsert.mutateAsync({
        step: advance ? 'vocabulary_level' : 'sensory',
        patch: { child: { sensoryProfile: profile } },
      });
      router.push(advance ? '/onboarding/vocabulary_level' : '/onboarding/about_child');
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
      <div className="space-y-5">
        {FIELDS.map(({ key, options }) => (
          <fieldset key={key}>
            <legend className="text-fg text-sm font-medium leading-none">
              {t(`${key}.label`)}
            </legend>
            <p className="text-fg-subtle mb-2 mt-1 text-xs">{t(`${key}.helper`)}</p>
            <div className="grid grid-cols-3 gap-2">
              {options.map((opt) => (
                <label
                  key={String(opt)}
                  className="border-border has-[:checked]:border-primary has-[:checked]:bg-primary/5 flex cursor-pointer items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm"
                >
                  <input
                    type="radio"
                    name={`sensory-${key}`}
                    value={String(opt)}
                    checked={(profile[key as keyof SensoryProfile] as unknown) === opt}
                    onChange={() => setProfile((p) => ({ ...p, [key]: opt as never }))}
                    className="sr-only"
                  />
                  <span className="text-fg font-medium">
                    {key === 'fontScale'
                      ? t(`fontScale.options.${FONT_SCALE_I18N_KEY[opt as 1 | 1.25 | 1.5]}`)
                      : t(`${key}.options.${String(opt)}`)}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        ))}
      </div>
      <WizardActions
        backHref="/onboarding/about_child"
        onNext={() => save(true)}
        onSaveLater={() => save(false)}
        pending={upsert.isPending}
        error={errorMessage}
      />
    </section>
  );
}
