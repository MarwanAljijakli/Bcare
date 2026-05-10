'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { WizardActions } from '../wizard-actions';
import { useRouter } from '@/i18n/routing';
import { trpc } from '@/lib/trpc/client';

const FIELDS = [
  { key: 'motion', options: ['full', 'reduced', 'off'] },
  { key: 'audio', options: ['full', 'soft', 'off'] },
  { key: 'contrast', options: ['standard', 'high'] },
  { key: 'touch', options: ['standard', 'large', 'extra-large'] },
  { key: 'fontScale', options: [1, 1.25, 1.5] },
] as const;

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
  const upsert = trpc.onboarding.upsertDraft.useMutation();

  async function save(advance: boolean) {
    await upsert.mutateAsync({
      step: advance ? 'vocabulary_level' : 'sensory',
      patch: { child: { sensoryProfile: profile } },
    });
    router.push(advance ? '/onboarding/vocabulary_level' : '/onboarding/about_child');
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
                  <span className="text-fg font-medium">{t(`${key}.options.${String(opt)}`)}</span>
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
      />
    </section>
  );
}
