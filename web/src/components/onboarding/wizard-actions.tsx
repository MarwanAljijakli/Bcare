'use client';

import { ArrowLeft, ArrowRight, Loader2, Save } from 'lucide-react';
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
}

export function WizardActions({
  backHref,
  onNext,
  nextLabel,
  pending,
  showSaveLater = true,
  onSaveLater,
  saveLaterPending,
}: WizardActionsProps) {
  const t = useTranslations('marketing.auth.onboardingWizard');
  return (
    <div className="mt-8 flex flex-col gap-3">
      <Button
        type="button"
        size="lg"
        onClick={() => void onNext()}
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
            onClick={() => void onSaveLater()}
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
