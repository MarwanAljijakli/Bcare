'use client';

import { useTranslations } from 'next-intl';
import { useCallback, useState } from 'react';
import { mapTrpcErrorToKey } from '@/lib/trpc/client';

/**
 * Shared error-handling hook for onboarding step components.
 *
 * Every step that calls a tRPC mutation wraps `save()` in try/catch and
 * uses this hook to translate the thrown error into a localized banner
 * message. Centralizing the mapping (rather than copy-pasting nine
 * try/catch branches) keeps the i18n keys consistent and makes it easy
 * to add a new error bucket later.
 *
 * Usage in a step:
 *
 *   const { errorMessage, captureError, clearError } = useStepError();
 *   async function save(advance: boolean) {
 *     clearError();
 *     try { await upsert.mutateAsync(...); router.push(...); }
 *     catch (e) { captureError(e); }
 *   }
 *   <WizardActions ... error={errorMessage} />
 */
export function useStepError() {
  const t = useTranslations('marketing.auth.onboardingWizard.errors');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const captureError = useCallback(
    (err: unknown) => {
      const key = mapTrpcErrorToKey(err);
      setErrorMessage(t(key));
      // Log raw error to the browser console so support / Sentry can see
      // the underlying cause. Never swallow.
      console.error('[onboarding] mutation rejected', { key, err });
    },
    [t],
  );

  const clearError = useCallback(() => setErrorMessage(null), []);

  return { errorMessage, captureError, clearError };
}
