import * as Sentry from '@sentry/nextjs';

/**
 * Sentry server (Node.js runtime) SDK initialization — Module 9.2.
 *
 * No-op when SENTRY_DSN is not configured. Filters identical to the
 * client config (no child content, no request bodies, scrubbed URLs).
 */
const dsn = process.env.SENTRY_DSN;
if (dsn && dsn.length > 0) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.05,
    environment: process.env.VERCEL_ENV ?? 'development',
    sendDefaultPii: false,
    beforeSend(event) {
      if (event.request) {
        delete event.request.data;
        delete event.request.cookies;
      }
      if (event.request?.url) {
        event.request.url = event.request.url.split('?')[0] ?? event.request.url;
      }
      return event;
    },
  });
}
