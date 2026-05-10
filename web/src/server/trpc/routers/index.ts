import { router } from '../trpc';
import { accountRouter } from './account';
import { boardRouter } from './board';
import { consentRouter } from './consent';
import { invitesRouter } from './invites';
import { onboardingRouter } from './onboarding';

export const appRouter = router({
  account: accountRouter,
  board: boardRouter,
  consent: consentRouter,
  invites: invitesRouter,
  onboarding: onboardingRouter,
});

export type AppRouter = typeof appRouter;
