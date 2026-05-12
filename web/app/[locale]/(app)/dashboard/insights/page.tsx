import { redirect } from 'next/navigation';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { InsightsClient } from './insights-client';
import type { AppLocale } from '@/i18n/routing';
import { pageMetadata } from '@/lib/seo';

/**
 * /dashboard/insights — Phase 10.E.
 *
 * Parent-facing AI insights driven by Claude Sonnet analyses of each
 * child's AAC usage. Caregivers always read their own children's
 * reports; therapists with active grants read via RLS on the
 * progress_reports table.
 *
 * The page resolves the caregiver's first child server-side and hands
 * it to the client component. The client lists reports newest-first,
 * surfaces the latest summary, and exposes "Generate insights now"
 * (rate-limited to 1/24h per child by the tRPC mutation).
 */

export async function generateMetadata({ params }: { params: Promise<{ locale: AppLocale }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'marketing.app.insights' });
  return pageMetadata({
    locale,
    path: 'dashboard/insights',
    title: t('title'),
    description: t('subtitle'),
    robots: { index: false, follow: false },
  });
}

interface ChildRow {
  id: string;
  preferred_name: string | null;
  full_name: string;
}

export default async function InsightsPage({ params }: { params: Promise<{ locale: AppLocale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  let childId: string | null = null;
  let childName: string | null = null;
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
              order: (
                col: string,
                opts: { ascending: boolean },
              ) => {
                limit: (n: number) => Promise<{ data: ChildRow[] | null }>;
              };
            };
          };
        }
      )
        .select('id, preferred_name, full_name')
        .eq('caregiver_id', userData.user.id)
        .order('created_at', { ascending: true })
        .limit(1);
      const child = childRes.data?.[0];
      if (!child) {
        bounceTo = 'onboarding';
      } else {
        childId = child.id;
        childName = child.preferred_name || child.full_name;
      }
    }
  } catch {
    /* fall through to client */
  }
  if (bounceTo === 'login') redirect(`/${locale}/login`);
  if (bounceTo === 'onboarding') redirect(`/${locale}/onboarding`);
  if (!childId) return null;

  return <InsightsClient locale={locale} childId={childId} childName={childName ?? ''} />;
}
