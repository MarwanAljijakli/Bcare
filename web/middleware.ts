import createMiddleware from 'next-intl/middleware';
import { routing } from './src/i18n/routing';

// next-intl middleware: handles locale negotiation and rewrites for the
// `/[locale]/...` segment structure. Auth-aware middleware is layered on top
// in Module 2; for Module 0 this is intl only.
export default createMiddleware(routing);

export const config = {
  // Match every path except Next internals, public assets, and API routes
  // (API handlers do their own auth without intl rewrites).
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
