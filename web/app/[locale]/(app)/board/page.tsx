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

  // Same redirect-outside-try pattern as the (app) layout. `redirect()`
  // throws a NEXT_REDIRECT sentinel error that the framework catches —
  // wrapping it in our own catch block silently swallows the redirect
  // and 500s the page. Compute intent inside try, redirect outside.
  let bounceTo: 'login' | 'onboarding' | null = null;
  try {
    const { createSupabaseServerClient } = await import('@/lib/supabase/server');
    const supabase = await createSupabaseServerClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      bounceTo = 'login';
    } else {
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
      if ((childRes.data?.length ?? 0) === 0) bounceTo = 'onboarding';
    }
  } catch {
    // Supabase unreachable — let the client bootstrap surface the error
    // rather than 500'ing the page.
  }
  if (bounceTo === 'login') redirect(`/${locale}/login`);
  if (bounceTo === 'onboarding') redirect(`/${locale}/onboarding`);

  return <BoardClient locale={locale} />;
}
