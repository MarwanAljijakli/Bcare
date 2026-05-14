'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import { useStepError } from '../use-step-error';
import { WizardActions } from '../wizard-actions';
import type { AppLocale } from '@/i18n/routing';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRouter } from '@/i18n/routing';
import { trpc } from '@/lib/trpc/client';

export function AboutYouStep({
  initial,
}: {
  initial: { fullName?: string; relationship?: string };
}) {
  const t = useTranslations('marketing.auth.onboardingWizard.aboutYou');
  const router = useRouter();
  // URL locale is the source of truth for the caregiver's preferred
  // language. The user is provably in /en/onboarding or /ar/onboarding
  // when this component renders. We stamp it into the draft on every
  // save so finalize() commits the right value to profiles.preferred_locale
  // instead of silently defaulting to 'en' (Phase 11.B Bug 3).
  const urlLocale = useLocale() as AppLocale;
  const [fullName, setFullName] = useState(initial.fullName ?? '');
  const [relationship, setRelationship] = useState(initial.relationship ?? '');
  const [errors, setErrors] = useState<{ fullName?: string }>({});
  const { errorMessage, captureError, clearError } = useStepError();
  const upsert = trpc.onboarding.upsertDraft.useMutation();

  async function save(advance: boolean) {
    if (fullName.trim().length < 2) {
      setErrors({ fullName: t('fullNameError') });
      return;
    }
    setErrors({});
    clearError();
    try {
      await upsert.mutateAsync({
        step: advance ? 'about_child' : 'about_you',
        patch: {
          profile: {
            fullName: fullName.trim(),
            relationship: relationship.trim() || undefined,
            locale: urlLocale,
          },
        },
      });
      router.push(advance ? '/onboarding/about_child' : '/onboarding/welcome');
    } catch (e) {
      captureError(e);
    }
  }

  // Enter-to-advance is wired on each Input via a shared keydown handler so
  // we don't need a non-native interactive role on the parent section.
  function onInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      void save(true);
    }
  }

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-fg text-balance text-2xl font-bold leading-tight tracking-tight md:text-3xl">
          {t('title')}
        </h1>
        <p className="text-fg-muted text-base leading-relaxed">{t('subtitle')}</p>
      </header>
      <div className="space-y-5">
        <div>
          <Label htmlFor="aboutyou-name">{t('fullNameLabel')}</Label>
          <Input
            id="aboutyou-name"
            autoComplete="name"
            value={fullName}
            onChange={(e: FormEvent<HTMLInputElement>) =>
              setFullName((e.target as HTMLInputElement).value)
            }
            onKeyDown={onInputKeyDown}
            placeholder={t('fullNamePlaceholder')}
            className="mt-2"
            aria-invalid={!!errors.fullName || undefined}
          />
          {errors.fullName && (
            <p role="alert" className="text-danger mt-1.5 text-xs">
              {errors.fullName}
            </p>
          )}
        </div>
        <div>
          <Label htmlFor="aboutyou-rel">{t('relationshipLabel')}</Label>
          <Input
            id="aboutyou-rel"
            value={relationship}
            onChange={(e: FormEvent<HTMLInputElement>) =>
              setRelationship((e.target as HTMLInputElement).value)
            }
            onKeyDown={onInputKeyDown}
            placeholder={t('relationshipPlaceholder')}
            className="mt-2"
          />
        </div>
      </div>
      <WizardActions
        backHref="/onboarding/welcome"
        onNext={() => save(true)}
        onSaveLater={() => save(false)}
        pending={upsert.isPending}
        error={errorMessage}
      />
    </section>
  );
}
