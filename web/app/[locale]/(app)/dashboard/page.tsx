import { setRequestLocale, getTranslations } from 'next-intl/server';
import type { AppLocale } from '@/i18n/routing';
import type { DashboardPayload } from '@/server/dashboard/types';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { pageMetadata } from '@/lib/seo';
import { loadDashboard } from '@/server/dashboard/load';

/**
 * Caregiver/therapist dashboard — Module 6.
 *
 * The placeholder 4-card grid that lived here through Modules 2-5 is
 * gone; this page now renders the full Linear-grade surface from
 * `<DashboardShell>` over a single batched server-side data load.
 *
 * Auth gate: the parent `(app)/layout.tsx` redirects unauthenticated
 * visitors to `/login` (or `/api/auth/dev-login` under Module 2.A.1.bypass).
 * By the time this page runs, `supabase.auth.getUser()` is guaranteed
 * to return a user.
 *
 * RLS: the cookie-bound supabase client carries the caregiver's session
 * cookie; every read in `loadDashboard()` is automatically scoped to
 * "rows the caregiver can see" — children they own + (post-Module-7)
 * children they have a therapist_grant for. Never filter by
 * caregiver_id in app code.
 */

export async function generateMetadata({ params }: { params: Promise<{ locale: AppLocale }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'marketing.app.dashboard.v6' });
  return pageMetadata({
    locale,
    path: 'dashboard',
    title: t('title'),
    description: t('subtitle'),
    robots: { index: false, follow: false },
  });
}

async function loadDashboardSafe(args: {
  locale: AppLocale;
  childIdParam: string | null;
}): Promise<DashboardPayload> {
  // Best-effort. If anything in the data path throws (Supabase
  // unreachable, transient RLS hiccup, project drift), render the
  // "newCaregiver" empty state rather than 500. The parent auth gate
  // already redirected anonymous visitors away.
  try {
    const { createSupabaseServerClient } = await import('@/lib/supabase/server');
    const supabase = await createSupabaseServerClient();
    const userRes = await supabase.auth.getUser();
    if (!userRes.data.user) {
      return {
        caregiver: { firstName: null, email: null, locale: args.locale, isAdmin: false },
        children: [],
        activeChildId: null,
        hero: {
          todayStars: 0,
          currentStreakDays: 0,
          longestStreakDays: 0,
          activeVocabularySize: 0,
          todayInputCount: 0,
        },
        today: {
          modality: { symbol: 0, speech: 0, gesture: 0, keyboard: 0 },
          successRate: 0,
          avgSentenceLength: 0,
          last24hInputs: 0,
          hasData: false,
        },
        recentSessions: [],
        topSymbols: [],
        vocabSparkline: [],
        suggestions: [],
        empty: {
          newCaregiver: true,
          noSessions: true,
          noMetrics: true,
          noSuggestions: true,
        },
      };
    }
    return await loadDashboard({
      // Cast through `never` — the generated Database type carries
      // schema metadata that the loader's relaxed signature ignores.
      // See web/app/api/cron/personalization/route.ts for the same trick.
      supabase: supabase as never,
      userId: userRes.data.user.id,
      locale: args.locale,
      childIdParam: args.childIdParam,
    });
  } catch {
    return {
      caregiver: { firstName: null, email: null, locale: args.locale, isAdmin: false },
      children: [],
      activeChildId: null,
      hero: {
        todayStars: 0,
        currentStreakDays: 0,
        longestStreakDays: 0,
        activeVocabularySize: 0,
        todayInputCount: 0,
      },
      today: {
        modality: { symbol: 0, speech: 0, gesture: 0, keyboard: 0 },
        successRate: 0,
        avgSentenceLength: 0,
        last24hInputs: 0,
        hasData: false,
      },
      recentSessions: [],
      topSymbols: [],
      vocabSparkline: [],
      suggestions: [],
      empty: {
        newCaregiver: true,
        noSessions: true,
        noMetrics: true,
        noSuggestions: true,
      },
    };
  }
}

export default async function DashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: AppLocale }>;
  searchParams: Promise<{ child?: string }>;
}) {
  const { locale } = await params;
  const { child: childIdParam } = await searchParams;
  setRequestLocale(locale);

  const payload = await loadDashboardSafe({
    locale,
    childIdParam: childIdParam ?? null,
  });

  return <DashboardShell payload={payload} />;
}
