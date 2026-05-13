import { NextResponse, type NextRequest } from 'next/server';
import { ensureCsrfCookie } from '@/lib/auth/csrf';
import { AUTH_MODE } from '@/lib/auth/mode';

/**
 * Magic-link / signup-confirmation callback.
 *
 * Supabase emails the user a link of the form:
 *   {NEXT_PUBLIC_APP_URL}/auth/callback?code=...&next=...
 *
 * On click, we exchange the code for a session (cookies are written by
 * @supabase/ssr) and redirect to the `next` query param. If the exchange
 * fails or we're in mock mode, we route to /[locale]/login with a
 * `?error=callback` query param so the user gets a friendly message
 * instead of a stack trace.
 *
 * Phase 11.A — Fix B: we ALSO mint the CSRF cookie here, before the
 * redirect. This is the first Route Handler the user hits after email
 * verification (Route Handlers can `cookies().set()`, Server Components
 * cannot), so it's the natural place to seed the double-submit token
 * for every subsequent tRPC mutation. The tRPC client has its own
 * lazy-mint fallback (Fix A) but this avoids the extra `/api/csrf`
 * round-trip on the very first onboarding mutation.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const nextParam = searchParams.get('next') ?? '/';

  // Restrict next-redirects to same-origin paths to avoid open-redirect.
  const safeNext = nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : '/';

  if (AUTH_MODE !== 'real' || !code) {
    // Mock mode or missing code: route to the login page with an info flag.
    const fallback = new URL(safeNext.startsWith('/auth') ? '/' : safeNext, origin);
    fallback.searchParams.set('info', 'callback_mock');
    return NextResponse.redirect(fallback);
  }

  try {
    const { createSupabaseServerClient } = await import('@/lib/supabase/server');
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      const errUrl = new URL(safeNext.startsWith('/auth') ? '/' : safeNext, origin);
      errUrl.searchParams.set('error', 'callback');
      return NextResponse.redirect(errUrl);
    }
    // Seed the CSRF cookie now while we're in a Route Handler context
    // (cookies().set() works here; in Server Components it silently
    // no-ops). Best-effort — the tRPC client's lazy-mint covers the
    // case where this throws for any reason.
    try {
      await ensureCsrfCookie();
    } catch {
      /* tRPC client lazy-mint will recover via /api/csrf */
    }
    return NextResponse.redirect(new URL(safeNext, origin));
  } catch {
    const errUrl = new URL('/', origin);
    errUrl.searchParams.set('error', 'callback');
    return NextResponse.redirect(errUrl);
  }
}
