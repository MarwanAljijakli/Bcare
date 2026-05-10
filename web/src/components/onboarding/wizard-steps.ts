/**
 * The wizard step list — extracted into its own non-client module so server
 * components can import the array + type without crashing.
 *
 * History: this used to live in `wizard-shell.tsx`, which is `'use client'`.
 * Server components in `app/[locale]/(auth)/onboarding/[step]/page.tsx`
 * imported `WIZARD_STEPS` and called `WIZARD_STEPS.includes(step)` server-
 * side, which throws under Next.js's "client-module values come back as a
 * Proxy on the server" rule. Production /en/onboarding/welcome 500'd with
 * "Attempted to call includes() from the server but includes is on the
 * client." Module 2.A.1.fix.3 moved the constants here so the server
 * component imports a plain array, and `wizard-shell.tsx` re-exports them
 * for client-side consumers.
 */

export const WIZARD_STEPS = [
  'welcome',
  'about_you',
  'about_child',
  'sensory',
  'vocabulary_level',
  'voice',
  'consent',
  'pin',
  'review',
] as const;

export type WizardStep = (typeof WIZARD_STEPS)[number];
