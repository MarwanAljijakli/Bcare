import { router } from '../trpc';
import { accountRouter } from './account';
import { consentRouter } from './consent';
import { invitesRouter } from './invites';
import { onboardingRouter } from './onboarding';

export const appRouter = router({
  account: accountRouter,
  consent: consentRouter,
  invites: invitesRouter,
  onboarding: onboardingRouter,
});

export type AppRouter = typeof appRouter;
