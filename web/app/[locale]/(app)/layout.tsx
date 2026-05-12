import { redirect } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import type { AppLocale } from '@/i18n/routing';
import { AppProviders } from '@/app/[locale]/providers';
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
