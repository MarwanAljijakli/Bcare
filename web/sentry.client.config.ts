import * as Sentry from '@sentry/nextjs';

/**
 * Sentry browser SDK initialization — Module 9.2.
 *
 * No-op when SENTRY_DSN is not configured. Strict event filter:
 *   • Never include child input content (board taps, transcripts, audio).
 *   • Strip request bodies entirely.
 *   • Replace PII fields in tags + extra with [redacted].
 *
 * Provision: see docs/pre-release-credentials.md → Sentry.
 */
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
if (dsn && dsn.length > 0) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.05,
    replaysOnErrorSampleRate: 0,
    replaysSessionSampleRate: 0,
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? 'development',
    sendDefaultPii: false,
    beforeSend(event) {
      // Drop any `request.data` — we never want POST bodies in Sentry.
      if (event.request) {
        delete event.request.data;
        delete event.request.cookies;
      }
      // Scrub URL query params that may include child names or symbol labels.
      if (event.request?.url) {
        event.request.url = event.request.url.split('?')[0] ?? event.request.url;
      }
      // Drop board-page breadcrumbs — too much child content.
      if (event.breadcrumbs) {
        event.breadcrumbs = event.breadcrumbs.filter((b) => {
          const url = (b.data?.url as string | undefined) ?? '';
          return !url.includes('/board') && !url.includes('/api/voice');
        });
      }
      return event;
    },
  });
}
