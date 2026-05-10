import createMiddleware from 'next-intl/middleware';
import { routing } from './src/i18n/routing';

// next-intl middleware: handles locale negotiation and rewrites for the
// `/[locale]/...` segment structure. Auth-aware middleware is layered on top
// in Module 2; for Module 0 this is intl only.
export default createMiddleware(routing);

export const config = {
  // Match every path except:
  //   • /api/*           — API handlers do their own auth without intl rewrites.
  //   • /_next, /_vercel — Next.js internals.
  //   • /auth/*          — locale-agnostic OAuth/magic-link callback. The
  //                        callback route lives at /auth/callback (NOT inside
  //                        the [locale] segment) because Supabase's magic-link
  //                        emails carry an absolute URL with no locale; if the
  //                        intl middleware rewrites /auth/callback → /en/auth/
  //                        callback, the framework 404s. The locale flows in
  //                        the `next` query param, which the route handler
  //                        consumes after exchangeCodeForSession.
  //   • Files with extensions (favicon, fonts, images, etc.).
  matcher: ['/((?!api|_next|_vercel|auth|.*\\..*).*)'],
};
