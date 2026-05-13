'use client';

import { AlertCircle, ArrowLeft, ArrowRight, Loader2, Save } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/routing';

interface WizardActionsProps {
  backHref?: string;
  onNext: () => void | Promise<void>;
  nextLabel?: string;
  pending?: boolean;
  showSaveLater?: boolean;
  onSaveLater?: () => void | Promise<void>;
  saveLaterPending?: boolean;
  /**
   * Localized error message to display above the primary action. The step
   * component owns this state (cleared on successful submit, set in the
   * step's try/catch around `mutateAsync`) and passes the resolved string
   * in. Rendered with `role="alert"` + `aria-live="assertive"` so screen
   * readers announce it the instant it appears.
   */
  error?: string | null;
}

export function WizardActions({
  backHref,
  onNext,
  nextLabel,
  pending,
  showSaveLater = true,
  onSaveLater,
  saveLaterPending,
  error,
}: WizardActionsProps) {
  const t = useTranslations('marketing.auth.onboardingWizard');
  return (
    <div className="mt-8 flex flex-col gap-3">
      {error && (
        <div
          role="alert"
          aria-live="assertive"
          className="border-danger/30 bg-danger/5 text-danger flex items-start gap-2 rounded-xl border px-3 py-2.5 text-sm"
        >
          <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <p className="leading-relaxed">{error}</p>
        </div>
      )}
      <Button
        type="button"
        size="lg"
        onClick={() => {
          // Fire-and-forget intentionally: the step component awaits the
          // mutation inside `onNext` and updates its own error state. We
          // don't want to block on the promise here (the step manages its
          // own `pending` indicator via the mutation's isPending flag).
          // Errors are surfaced via the `error` prop above, NOT swallowed.
          Promise.resolve(onNext()).catch((err) => {
            // The step's try/catch will have already populated `error`.
            // This catch exists purely so unhandled-promise warnings don't
            // appear in the browser console for steps that forgot — every
            // step component should still catch its own errors.
            console.error('[wizard-actions] onNext rejected', err);
          });
        }}
        disabled={pending}
        className="w-full"
      >
        {pending ? (
          <>
            <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
            {t('saving')}
          </>
        ) : (
          <>
            {nextLabel ?? t('next')}
            <ArrowRight aria-hidden="true" className="h-4 w-4" />
          </>
        )}
      </Button>
      <div className="flex items-center justify-between text-xs">
        {backHref ? (
          <Button asChild size="sm" variant="ghost">
            <Link href={backHref}>
              <ArrowLeft aria-hidden="true" className="h-3.5 w-3.5" />
              {t('back')}
            </Link>
          </Button>
        ) : (
          <span />
        )}
        {showSaveLater && onSaveLater && (
          <button
            type="button"
            onClick={() => {
              Promise.resolve(onSaveLater()).catch((err) => {
                console.error('[wizard-actions] onSaveLater rejected', err);
              });
            }}
            disabled={saveLaterPending}
            className="text-fg-muted hover:text-fg focus-visible:ring-ring inline-flex items-center gap-1 rounded text-xs font-medium underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          >
            <Save aria-hidden="true" className="h-3.5 w-3.5" />
            {saveLaterPending ? t('saving') : t('saveLater')}
          </button>
        )}
      </div>
    </div>
  );
}
