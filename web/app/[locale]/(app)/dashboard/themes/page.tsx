import { redirect } from 'next/navigation';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { ThemesClient } from './themes-client';
import type { AppLocale } from '@/i18n/routing';
import { pageMetadata } from '@/lib/seo';

/**
 * /dashboard/themes — caregiver-only theme picker. Module 5.
 * The picker is gated behind the (app) auth shell + per-child ownership
 * check. Themes the child hasn't yet unlocked are rendered as locked
 * with their unlock threshold for transparency, never with a "buy" CTA
 * (BlueCare is free).
 */

export async function generateMetadata({ params }: { params: Promise<{ locale: AppLocale }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'marketing.app.themes' });
  return pageMetadata({
    locale,
    path: 'dashboard/themes',
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

export default async function ThemesPage({ params }: { params: Promise<{ locale: AppLocale }> }) {
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
      if (!child) bounceTo = 'onboarding';
      else {
        childId = child.id;
        childName = child.preferred_name || child.full_name;
      }
    }
  } catch {
    /* fall through; the client surfaces an empty-state */
  }
  if (bounceTo === 'login') redirect(`/${locale}/login`);
  if (bounceTo === 'onboarding') redirect(`/${locale}/onboarding`);

  if (!childId) return null;
  return <ThemesClient childId={childId} childName={childName ?? ''} />;
}
