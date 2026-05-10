import { redirect } from 'next/navigation';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { BoardClient } from './board-client';
import type { AppLocale } from '@/i18n/routing';
import { pageMetadata } from '@/lib/seo';

/**
 * /board entry. Server component. Auth gate runs in the (app) layout.
 *
 * We additionally check that the caregiver has at least one child profile;
 * if not, we redirect to /onboarding so the wizard can finish first.
 *
 * The actual board UI lives in the client component because it needs
 * the Web Speech APIs + the in-flight session timer + tRPC subscriptions.
 */

export async function generateMetadata({ params }: { params: Promise<{ locale: AppLocale }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'marketing.app.board' });
  return pageMetadata({
    locale,
    path: 'board',
    title: t('title'),
    description: t('subtitle'),
    robots: { index: false, follow: false },
  });
}

export default async function BoardPage({ params }: { params: Promise<{ locale: AppLocale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Confirm a child profile exists. If not, bounce to onboarding.
  try {
    const { createSupabaseServerClient } = await import('@/lib/supabase/server');
    const supabase = await createSupabaseServerClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) redirect(`/${locale}/login`);
    const childRes = await (
      supabase.from('children') as never as {
        select: (cols: string) => {
          eq: (
            col: string,
            v: string,
          ) => {
            limit: (n: number) => Promise<{ data: { id: string }[] | null }>;
          };
        };
      }
    )
      .select('id')
      .eq('caregiver_id', userData.user.id)
      .limit(1);
    if ((childRes.data?.length ?? 0) === 0) {
      redirect(`/${locale}/onboarding`);
    }
  } catch {
    // Real-mode unavailable → still render so dev/mock keeps working;
    // the tRPC bootstrap call inside the client will surface the error.
  }

  return <BoardClient locale={locale} />;
}
