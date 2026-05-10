'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { WizardActions } from '../wizard-actions';
import { useRouter } from '@/i18n/routing';
import { trpc } from '@/lib/trpc/client';

const SCOPES = [
  'data_processing',
  'ai_personalization',
  'voice_recording',
  'webcam_processing',
  'analytics_dashboard',
] as const;
type Scope = (typeof SCOPES)[number];
type ConsentMap = Record<Scope, boolean>;

export function ConsentStep({ initial }: { initial: Partial<ConsentMap> }) {
  const t = useTranslations('marketing.auth.onboardingWizard.consent');
  const router = useRouter();
  const [scopes, setScopes] = useState<ConsentMap>({
    data_processing: initial.data_processing ?? false,
    ai_personalization: initial.ai_personalization ?? false,
    voice_recording: initial.voice_recording ?? false,
    webcam_processing: initial.webcam_processing ?? false,
    analytics_dashboard: initial.analytics_dashboard ?? false,
  });
  const [error, setError] = useState<string | null>(null);
  const upsert = trpc.onboarding.upsertDraft.useMutation();

  async function save(advance: boolean) {
    if (advance && !scopes.data_processing) {
      setError(t('coreRequired'));
      return;
    }
    setError(null);
    await upsert.mutateAsync({
      step: advance ? 'pin' : 'consent',
      patch: { consentScopes: scopes },
    });
    router.push(advance ? '/onboarding/pin' : '/onboarding/voice');
  }

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-fg text-2xl font-bold tracking-tight md:text-3xl">{t('title')}</h1>
        <p className="text-fg-muted text-base leading-relaxed">{t('subtitle')}</p>
      </header>
      <fieldset className="space-y-2">
        <legend className="sr-only">{t('legend')}</legend>
        {SCOPES.map((scope) => (
          <label
            key={scope}
            className="border-border bg-bg-elevated has-[:checked]:border-primary/40 has-[:checked]:bg-primary/5 flex cursor-pointer items-start gap-3 rounded-xl border p-4"
          >
            <input
              type="checkbox"
              checked={scopes[scope]}
              onChange={(e) => setScopes((s) => ({ ...s, [scope]: e.target.checked }))}
              className="text-primary mt-0.5 h-4 w-4"
            />
            <span className="flex-1">
              <span className="text-fg block text-sm font-semibold">
                {t(`scopes.${scope}.label`)}
              </span>
              <span className="text-fg-muted mt-1 block text-xs leading-relaxed">
                {t(`scopes.${scope}.description`)}
              </span>
              {scope === 'data_processing' && (
                <span className="text-primary mt-1 block text-xs font-medium">{t('required')}</span>
              )}
            </span>
          </label>
        ))}
      </fieldset>
      {error && (
        <p role="alert" className="text-danger text-xs">
          {error}
        </p>
      )}
      <WizardActions
        backHref="/onboarding/voice"
        onNext={() => save(true)}
        onSaveLater={() => save(false)}
        pending={upsert.isPending}
      />
    </section>
  );
}
