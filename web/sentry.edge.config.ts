import * as Sentry from '@sentry/nextjs';

/**
 * Sentry edge-runtime SDK initialization — Module 9.2.
 *
 * Same env-gated, content-scrubbed config as the Node + browser configs.
 */
const dsn = process.env.SENTRY_DSN;
if (dsn && dsn.length > 0) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.05,
    environment: process.env.VERCEL_ENV ?? 'development',
    sendDefaultPii: false,
  });
}
