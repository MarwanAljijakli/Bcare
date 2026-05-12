import { router } from '../trpc';
import { accountRouter } from './account';
import { boardRouter } from './board';
import { consentRouter } from './consent';
import { gamificationRouter } from './gamification';
import { invitesRouter } from './invites';
import { onboardingRouter } from './onboarding';
import { personalizationRouter } from './personalization';
import { reportsRouter } from './reports';
import { sessionsRouter } from './sessions';
import { therapistsRouter } from './therapists';
import { voiceRouter } from './voice';

export const appRouter = router({
  account: accountRouter,
  board: boardRouter,
  consent: consentRouter,
  gamification: gamificationRouter,
  invites: invitesRouter,
  onboarding: onboardingRouter,
  personalization: personalizationRouter,
  reports: reportsRouter,
  sessions: sessionsRouter,
  therapists: therapistsRouter,
  voice: voiceRouter,
});

export type AppRouter = typeof appRouter;
