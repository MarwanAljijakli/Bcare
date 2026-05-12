import 'server-only';
import { redirect } from 'next/navigation';
import type { AppLocale } from '@/i18n/routing';

/**
 * Admin role gate — Module 7.
 *
 * Reads the caller's `profiles.role` via the cookie-bound supabase
 * client (RLS-scoped). When the caller is NOT an admin, redirects to
 * `/[locale]/dashboard`. Returns the user_id when the check passes so
 * downstream code can use it without re-reading the session.
 *
 * Under AUTH_BYPASS the dev caregiver's profile is promoted to
 * role='admin' via db/scripts/seed-dev-admin.ts. The pre-launch
 * `revoke-dev-admin.ts` flips it back BEFORE the env vars are removed.
 *
 * Throws (via redirect) — never returns when the caller lacks admin.
 * Caller doesn't need to handle the "non-admin" branch.
 */
export async function requireAdmin(locale: AppLocale): Promise<{ userId: string }> {
  const { createSupabaseServerClient } = await import('@/lib/supabase/server');
  const supabase = await createSupabaseServerClient();
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes.user;
  if (!user) redirect(`/${locale}/login`);

  const { data: profile } = await (
    supabase.from('profiles') as never as {
      select: (cols: string) => {
        eq: (
          col: string,
          v: string,
        ) => { maybeSingle: () => Promise<{ data: { role: string } | null }> };
      };
    }
  )
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!profile || profile.role !== 'admin') {
    redirect(`/${locale}/dashboard`);
  }
  return { userId: user.id };
}
