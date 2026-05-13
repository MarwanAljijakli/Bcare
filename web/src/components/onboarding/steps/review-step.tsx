'use client';

import { CheckCircle2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useStepError } from '../use-step-error';
import { WizardActions } from '../wizard-actions';
import { useRouter } from '@/i18n/routing';
import { trpc } from '@/lib/trpc/client';

interface ReviewStepProps {
  draft: {
    profile?: { fullName?: string; relationship?: string };
    child?: {
      fullName?: string;
      preferredName?: string;
      locale?: string;
      vocabularyLevel?: string;
    };
    consentScopes?: Record<string, boolean>;
  };
}

export function ReviewStep({ draft }: ReviewStepProps) {
  const t = useTranslations('marketing.auth.onboardingWizard.review');
  const router = useRouter();
  const { errorMessage, captureError, clearError } = useStepError();
  const finalize = trpc.onboarding.finalize.useMutation();

  async function commit() {
    clearError();
    try {
      await finalize.mutateAsync();
      router.push('/dashboard');
    } catch (e) {
      captureError(e);
    }
  }

  const grantedScopes = Object.entries(draft.consentScopes ?? {})
    .filter(([, v]) => v)
    .map(([k]) => k);

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-fg text-2xl font-bold tracking-tight md:text-3xl">{t('title')}</h1>
        <p className="text-fg-muted text-base leading-relaxed">{t('subtitle')}</p>
      </header>

      <dl className="space-y-3">
        <Row label={t('profileLabel')} value={draft.profile?.fullName ?? '—'} />
        <Row
          label={t('childLabel')}
          value={draft.child?.preferredName || draft.child?.fullName || '—'}
        />
        <Row
          label={t('localeLabel')}
          value={draft.child?.locale === 'ar' ? 'العربية' : 'English'}
        />
        <Row label={t('vocabularyLabel')} value={draft.child?.vocabularyLevel ?? 'starter'} />
        <Row
          label={t('consentLabel')}
          value={grantedScopes.length > 0 ? grantedScopes.join(', ') : t('none')}
        />
      </dl>

      <WizardActions
        backHref="/onboarding/pin"
        onNext={commit}
        onSaveLater={undefined}
        showSaveLater={false}
        nextLabel={t('cta')}
        pending={finalize.isPending}
        error={errorMessage}
      />
      <p className="text-fg-subtle text-center text-xs">
        <CheckCircle2 aria-hidden="true" className="me-1 inline-block h-3 w-3" />
        {t('trust')}
      </p>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-border bg-bg-elevated flex items-start justify-between gap-4 rounded-xl border p-3">
      <dt className="text-fg-muted text-xs font-medium uppercase tracking-wide">{label}</dt>
      <dd className="text-fg text-sm font-semibold">{value}</dd>
    </div>
  );
}
