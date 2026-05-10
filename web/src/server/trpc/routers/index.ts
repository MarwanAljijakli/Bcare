import { router } from '../trpc';
import { accountRouter } from './account';
import { boardRouter } from './board';
import { consentRouter } from './consent';
import { gamificationRouter } from './gamification';
import { invitesRouter } from './invites';
import { onboardingRouter } from './onboarding';
import { personalizationRouter } from './personalization';

export const appRouter = router({
  account: accountRouter,
  board: boardRouter,
  consent: consentRouter,
  gamification: gamificationRouter,
  invites: invitesRouter,
  onboarding: onboardingRouter,
  personalization: personalizationRouter,
});

export type AppRouter = typeof appRouter;
