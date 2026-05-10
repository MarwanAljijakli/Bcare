'use client';

import { Heart } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { WizardActions } from '../wizard-actions';
import { useRouter } from '@/i18n/routing';

export function WelcomeStep() {
  const t = useTranslations('marketing.auth.onboardingWizard.welcome');
  const router = useRouter();
  return (
    <section className="space-y-6 text-center">
      <div className="bg-primary/10 text-primary mx-auto grid h-16 w-16 place-items-center rounded-2xl">
        <Heart aria-hidden="true" className="h-8 w-8" />
      </div>
      <h1 className="text-fg text-balance text-3xl font-bold leading-tight tracking-tight md:text-4xl">
        {t('title')}
      </h1>
      <p className="text-fg-muted mx-auto max-w-md text-balance text-base leading-relaxed">
        {t('body')}
      </p>
      <WizardActions
        showSaveLater={false}
        nextLabel={t('cta')}
        onNext={() => router.push('/onboarding/about_you')}
      />
    </section>
  );
}
