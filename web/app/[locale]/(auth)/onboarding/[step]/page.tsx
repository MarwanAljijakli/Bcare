import { notFound, redirect } from 'next/navigation';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import type { AppLocale } from '@/i18n/routing';
import { AppProviders } from '@/app/[locale]/providers';
import { AuthShell } from '@/components/auth/auth-shell';
import { AboutChildStep } from '@/components/onboarding/steps/about-child-step';
import { AboutYouStep } from '@/components/onboarding/steps/about-you-step';
import { ConsentStep } from '@/components/onboarding/steps/consent-step';
import { PinStep } from '@/components/onboarding/steps/pin-step';
import { ReviewStep } from '@/components/onboarding/steps/review-step';
import { SensoryStep } from '@/components/onboarding/steps/sensory-step';
import { VocabularyLevelStep } from '@/components/onboarding/steps/vocabulary-level-step';
import { VoiceStep } from '@/components/onboarding/steps/voice-step';
import { WelcomeStep } from '@/components/onboarding/steps/welcome-step';
import { WizardShell } from '@/components/onboarding/wizard-shell';
// IMPORTANT: pull step constants from the non-client module. Importing
// them through wizard-shell.tsx (a 'use client' file) turns them into a
// server-side Proxy that throws on `.includes()`. See
// docs/known-issues.md → Module 2.A.1.fix.3 postmortem.
import { WIZARD_STEPS, type WizardStep } from '@/components/onboarding/wizard-steps';
import { ensureCsrfCookie } from '@/lib/auth/csrf';
import { pageMetadata } from '@/lib/seo';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: AppLocale; step: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'marketing.auth.onboarding' });
  return pageMetadata({
    locale,
    path: 'onboarding',
    title: t('title'),
    description: t('subtitle'),
    robots: { index: false, follow: false },
  });
}

export default async function OnboardingStepPage({
  params,
}: {
  params: Promise<{ locale: AppLocale; step: string }>;
}) {
  const { locale, step } = await params;
  setRequestLocale(locale);

  if (!WIZARD_STEPS.includes(step as WizardStep)) notFound();

  // Mint a CSRF cookie so the in-page tRPC calls have a token to echo.
  await ensureCsrfCookie();

  // Load the user's draft so steps can pre-fill from prior input.
  let draft: { step: string; payload: Record<string, unknown> } | null = null;
  try {
    const { createSupabaseServerClient } = await import('@/lib/supabase/server');
    const supabase = await createSupabaseServerClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      // Not signed in → bounce to /login.
      redirect(`/${locale}/login`);
    }
    const { data } = await (
      supabase.from('draft_onboarding') as never as {
        select: (cols: string) => {
          eq: (
            col: string,
            v: string,
          ) => {
            maybeSingle: () => Promise<{
              data: { step: string; payload: Record<string, unknown> } | null;
            }>;
          };
        };
      }
    )
      .select('step, payload')
      .eq('user_id', userData.user.id)
      .maybeSingle();
    draft = data ?? null;
  } catch {
    // No real Supabase available → render with empty draft so the page still works.
  }

  const payload = (draft?.payload ?? {}) as {
    profile?: { fullName?: string; relationship?: string };
    child?: {
      fullName?: string;
      preferredName?: string;
      dateOfBirth?: string;
      locale?: 'en' | 'ar';
      vocabularyLevel?: 'starter' | 'expanding' | 'conversational' | 'advanced';
      voiceId?: string;
      sensoryProfile?: {
        motion: 'full' | 'reduced' | 'off';
        audio: 'full' | 'soft' | 'off';
        contrast: 'standard' | 'high';
        touch: 'standard' | 'large' | 'extra-large';
        fontScale: 1 | 1.25 | 1.5;
      };
    };
    consentScopes?: Record<string, boolean>;
  };

  return (
    <AppProviders>
      <AuthShell>
        <WizardShell step={step as WizardStep}>
          {step === 'welcome' && <WelcomeStep />}
          {step === 'about_you' && <AboutYouStep initial={payload.profile ?? {}} />}
          {step === 'about_child' && <AboutChildStep initial={payload.child ?? {}} />}
          {step === 'sensory' && <SensoryStep initial={payload.child?.sensoryProfile ?? {}} />}
          {step === 'vocabulary_level' && (
            <VocabularyLevelStep initial={payload.child?.vocabularyLevel} />
          )}
          {step === 'voice' && <VoiceStep initial={payload.child?.voiceId} />}
          {step === 'consent' && <ConsentStep initial={payload.consentScopes ?? {}} />}
          {step === 'pin' && <PinStep />}
          {step === 'review' && <ReviewStep draft={payload} />}
        </WizardShell>
      </AuthShell>
    </AppProviders>
  );
}
