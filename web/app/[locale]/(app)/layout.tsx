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
  try {
    const { createSupabaseServerClient } = await import('@/lib/supabase/server');
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getUser();
    if (!data.user) redirect(`/${locale}/login`);
  } catch {
    // Real-mode unavailable → still render so /settings shows a friendly
    // "auth not configured" via the tRPC error path.
  }

  return (
    <AppProviders>
      <main id="main" tabIndex={-1} className="bg-bg min-h-dvh">
        {children}
      </main>
    </AppProviders>
  );
}
