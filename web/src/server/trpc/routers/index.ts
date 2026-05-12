import { router } from '../trpc';
import { accountRouter } from './account';
import { adminRouter } from './admin';
import { boardRouter } from './board';
import { consentRouter } from './consent';
import { gamificationRouter } from './gamification';
import { invitesRouter } from './invites';
import { levelsRouter } from './levels';
import { onboardingRouter } from './onboarding';
import { personalizationRouter } from './personalization';
import { reportsRouter } from './reports';
import { sessionsRouter } from './sessions';
import { therapistsRouter } from './therapists';
import { voiceRouter } from './voice';

export const appRouter = router({
  account: accountRouter,
  admin: adminRouter,
  board: boardRouter,
  consent: consentRouter,
  gamification: gamificationRouter,
  invites: invitesRouter,
  levels: levelsRouter,
  onboarding: onboardingRouter,
  personalization: personalizationRouter,
  reports: reportsRouter,
  sessions: sessionsRouter,
  therapists: therapistsRouter,
  voice: voiceRouter,
});

export type AppRouter = typeof appRouter;
