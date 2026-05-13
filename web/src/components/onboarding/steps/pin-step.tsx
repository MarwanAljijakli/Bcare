'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useStepError } from '../use-step-error';
import { WizardActions } from '../wizard-actions';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRouter } from '@/i18n/routing';
import { trpc } from '@/lib/trpc/client';

export function PinStep() {
  const t = useTranslations('marketing.auth.onboardingWizard.pin');
  const router = useRouter();
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { errorMessage, captureError, clearError } = useStepError();
  const setPinMut = trpc.onboarding.setPin.useMutation();

  async function save(advance: boolean) {
    if (!/^[0-9]{6}$/.test(pin)) {
      setError(t('formatError'));
      return;
    }
    if (pin !== confirm) {
      setError(t('mismatchError'));
      return;
    }
    setError(null);
    clearError();
    try {
      await setPinMut.mutateAsync({ pin });
      router.push(advance ? '/onboarding/review' : '/onboarding/consent');
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
          <Label htmlFor="pin">{t('pinLabel')}</Label>
          <Input
            id="pin"
            type="password"
            inputMode="numeric"
            autoComplete="new-password"
            maxLength={6}
            pattern="[0-9]{6}"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
            className="mt-2 tracking-widest"
            placeholder="• • • • • •"
          />
        </div>
        <div>
          <Label htmlFor="pin-confirm">{t('confirmLabel')}</Label>
          <Input
            id="pin-confirm"
            type="password"
            inputMode="numeric"
            autoComplete="new-password"
            maxLength={6}
            pattern="[0-9]{6}"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value.replace(/\D/g, '').slice(0, 6))}
            className="mt-2 tracking-widest"
            placeholder="• • • • • •"
          />
        </div>
        {error && (
          <p role="alert" className="text-danger text-xs">
            {error}
          </p>
        )}
      </div>
      <WizardActions
        backHref="/onboarding/consent"
        onNext={() => save(true)}
        onSaveLater={() => save(false)}
        pending={setPinMut.isPending}
        error={errorMessage}
      />
    </section>
  );
}
