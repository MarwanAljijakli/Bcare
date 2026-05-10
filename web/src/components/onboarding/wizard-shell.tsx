'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { type ReactNode } from 'react';
import { WIZARD_STEPS, type WizardStep } from '@/components/onboarding/wizard-steps';
import { cn } from '@/lib/cn';
import { useReducedMotion } from '@/lib/motion';

// Re-export the step list + type so existing client-side imports keep
// working. Server components MUST import these from
// '@/components/onboarding/wizard-steps' directly — pulling them through
// this 'use client' file turns them into a runtime Proxy that throws on
// `.includes()`, etc. See docs/known-issues.md → Module 2.A.1.fix.3.
export { WIZARD_STEPS, type WizardStep };

export function WizardShell({ step, children }: { step: WizardStep; children: ReactNode }) {
  const t = useTranslations('marketing.auth.onboardingWizard');
  const reduced = useReducedMotion();
  const stepIndex = WIZARD_STEPS.indexOf(step);
  const total = WIZARD_STEPS.length;

  return (
    <div className="mx-auto w-full max-w-[560px]">
      <div className="mb-6">
        <p className="text-fg-subtle mb-2 text-xs font-medium uppercase tracking-wide">
          {t('progress', { current: stepIndex + 1, total })}
        </p>
        <div
          className="bg-bg-muted h-1.5 w-full overflow-hidden rounded-full"
          role="progressbar"
          aria-valuenow={stepIndex + 1}
          aria-valuemin={1}
          aria-valuemax={total}
          aria-label={t('progress', { current: stepIndex + 1, total })}
        >
          <div
            className="bg-primary h-full rounded-full transition-all"
            style={{
              width: `${((stepIndex + 1) / total) * 100}%`,
              transitionDuration: reduced ? '0ms' : '320ms',
            }}
          />
        </div>
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: reduced ? 0 : 0.18, ease: [0.2, 0, 0, 1] }}
          className={cn('w-full')}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
