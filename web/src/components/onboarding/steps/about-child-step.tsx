'use client';

import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import { useStepError } from '../use-step-error';
import { WizardActions } from '../wizard-actions';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRouter } from '@/i18n/routing';
import { trpc } from '@/lib/trpc/client';

export function AboutChildStep({
  initial,
}: {
  initial: {
    fullName?: string;
    preferredName?: string;
    dateOfBirth?: string;
    locale?: 'en' | 'ar';
  };
}) {
  const t = useTranslations('marketing.auth.onboardingWizard.aboutChild');
  const router = useRouter();
  const [fullName, setFullName] = useState(initial.fullName ?? '');
  const [preferredName, setPreferredName] = useState(initial.preferredName ?? '');
  const [dob, setDob] = useState(initial.dateOfBirth ?? '');
  const [locale, setLocale] = useState<'en' | 'ar'>(initial.locale ?? 'en');
  const [error, setError] = useState<string | null>(null);
  const { errorMessage, captureError, clearError } = useStepError();
  const upsert = trpc.onboarding.upsertDraft.useMutation();

  async function save(advance: boolean) {
    if (fullName.trim().length < 1) {
      setError(t('fullNameError'));
      return;
    }
    setError(null);
    clearError();
    try {
      await upsert.mutateAsync({
        step: advance ? 'sensory' : 'about_child',
        patch: {
          child: {
            fullName: fullName.trim(),
            preferredName: preferredName.trim() || undefined,
            dateOfBirth: dob || undefined,
            locale,
          },
        },
      });
      router.push(advance ? '/onboarding/sensory' : '/onboarding/about_you');
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
        <div>
          <Label htmlFor="ac-name">{t('fullNameLabel')}</Label>
          <Input
            id="ac-name"
            value={fullName}
            onChange={(e: FormEvent<HTMLInputElement>) =>
              setFullName((e.target as HTMLInputElement).value)
            }
            className="mt-2"
            placeholder={t('fullNamePlaceholder')}
          />
          {error && (
            <p role="alert" className="text-danger mt-1.5 text-xs">
              {error}
            </p>
          )}
        </div>
        <div>
          <Label htmlFor="ac-pref">{t('preferredNameLabel')}</Label>
          <Input
            id="ac-pref"
            value={preferredName}
            onChange={(e: FormEvent<HTMLInputElement>) =>
              setPreferredName((e.target as HTMLInputElement).value)
            }
            className="mt-2"
            placeholder={t('preferredNamePlaceholder')}
          />
        </div>
        <div>
          <Label htmlFor="ac-dob">{t('dobLabel')}</Label>
          <Input
            id="ac-dob"
            type="date"
            value={dob}
            onChange={(e: FormEvent<HTMLInputElement>) =>
              setDob((e.target as HTMLInputElement).value)
            }
            className="mt-2"
          />
        </div>
        <fieldset>
          <legend className="text-fg text-sm font-medium leading-none">{t('localeLabel')}</legend>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {(['en', 'ar'] as const).map((code) => (
              <label
                key={code}
                className="border-border has-[:checked]:border-primary has-[:checked]:bg-primary/5 flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 text-sm"
              >
                <input
                  type="radio"
                  name="ac-locale"
                  value={code}
                  checked={locale === code}
                  onChange={() => setLocale(code)}
                  className="text-primary h-4 w-4"
                />
                <span lang={code} className="text-fg font-medium">
                  {code === 'ar' ? 'العربية' : 'English'}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      </div>
      <WizardActions
        backHref="/onboarding/about_you"
        onNext={() => save(true)}
        onSaveLater={() => save(false)}
        pending={upsert.isPending}
        error={errorMessage}
      />
    </section>
  );
}
