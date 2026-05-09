import { NextResponse, type NextRequest } from 'next/server';
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
    return NextResponse.redirect(new URL(safeNext, origin));
  } catch {
    const errUrl = new URL('/', origin);
    errUrl.searchParams.set('error', 'callback');
    return NextResponse.redirect(errUrl);
  }
}
