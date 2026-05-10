import { redirect } from 'next/navigation';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { PersonalizationClient } from './personalization-client';
import type { AppLocale } from '@/i18n/routing';
import { pageMetadata } from '@/lib/seo';

/**
 * /dashboard/personalization — caregiver-review surface for vocabulary
 * suggestions. Lists pending suggestions with one-tap approve / reject.
 *
 * The page resolves the caregiver's first child server-side; Module 6
 * adds a multi-child switcher that swaps `childId` here without a route
 * change.
 */

export async function generateMetadata({ params }: { params: Promise<{ locale: AppLocale }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'marketing.app.personalization' });
  return pageMetadata({
    locale,
    path: 'dashboard/personalization',
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

export default async function PersonalizationPage({
  params,
}: {
  params: Promise<{ locale: AppLocale }>;
}) {
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
    // Real-mode unavailable → still render so the client gets a friendly
    // empty-state error rather than 500.
  }
  if (bounceTo === 'login') redirect(`/${locale}/login`);
  if (bounceTo === 'onboarding') redirect(`/${locale}/onboarding`);

  if (!childId) {
    // Defensive — should be unreachable; the redirects above handle it.
    return null;
  }

  return <PersonalizationClient childId={childId} childName={childName ?? ''} />;
}
