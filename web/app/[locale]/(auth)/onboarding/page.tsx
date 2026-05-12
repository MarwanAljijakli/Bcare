import { redirect } from 'next/navigation';
import type { AppLocale } from '@/i18n/routing';

/**
 * /onboarding (no [step]) — redirect to the user's saved step or 'welcome'.
 * The auth/callback route lands users here after magic-link verification.
 */
export default async function OnboardingIndex({
  params,
}: {
  params: Promise<{ locale: AppLocale }>;
}) {
  const { locale } = await params;

  let target = 'welcome';
  try {
    const { createSupabaseServerClient } = await import('@/lib/supabase/server');
    const supabase = await createSupabaseServerClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) redirect(`/${locale}/login`);
    const { data } = await (
      supabase.from('draft_onboarding') as never as {
        select: (cols: string) => {
          eq: (
            col: string,
            v: string,
          ) => {
            maybeSingle: () => Promise<{ data: { step: string } | null }>;
          };
        };
      }
    )
      .select('step')
      .eq('user_id', userData.user.id)
      .maybeSingle();
    if (data?.step) target = data.step;
  } catch {
    // Real-mode unavailable → land on welcome anyway.
  }

  redirect(`/${locale}/onboarding/${target}`);
}
