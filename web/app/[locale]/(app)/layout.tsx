import { redirect } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import type { AppLocale } from '@/i18n/routing';
import { AppProviders } from '@/app/[locale]/providers';
import { isAuthBypassActive } from '@/lib/auth/bypass';
import { ensureCsrfCookie } from '@/lib/auth/csrf';

/**
 * Authenticated app shell. Wraps tRPC + auth-required pages.
 * Bounces to /login if no session is present.
 */
export default async function AppLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: AppLocale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await ensureCsrfCookie();

  // Auth gate — redirect to /login when no session. The redirect happens
  // server-side so unauthorized users never see anything.
  //
  // CRITICAL: `redirect()` throws a NEXT_REDIRECT error that the framework
  // catches to perform the redirect. We MUST NOT wrap that throw in a
  // try/catch (or the redirect gets silently swallowed and the request
  // 500s after the page tries to render with no user). We compute the
  // intent inside the try, then redirect outside.
  let needsAuthRedirect = false;
  try {
    const { createSupabaseServerClient } = await import('@/lib/supabase/server');
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getUser();
    if (!data.user) needsAuthRedirect = true;
  } catch {
    // Supabase unreachable / misconfigured. Treat as unauthenticated so
    // the user lands on /login rather than seeing a 500.
    needsAuthRedirect = true;
  }
  if (needsAuthRedirect) {
    // Module 2.A.1.bypass — when bypass is on, route an unauthenticated
    // visitor through /api/auth/dev-login (which mints a real session via
    // verifyOtp) instead of /login. The redirect chain is:
    //   GET /[locale]/(app)/anything → 307 /api/auth/dev-login?next=…
    //   GET /api/auth/dev-login       → mint session + 303 to ?next.
    // Real RLS still applies; we are just skipping the human handshake.
    if (isAuthBypassActive()) {
      // The next-intl middleware excludes /api, so this URL is safe to
      // build without locale prefix.
      redirect(`/api/auth/dev-login?next=/${locale}/dashboard`);
    }
    redirect(`/${locale}/login`);
  }

  return (
    <AppProviders>
      <main id="main" tabIndex={-1} className="bg-bg min-h-dvh">
        {children}
      </main>
    </AppProviders>
  );
}
