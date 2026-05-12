import { setRequestLocale } from 'next-intl/server';
import { LevelSettingsClient } from './level-settings-client';
import type { AppLocale } from '@/i18n/routing';
import type { VocabLevel } from '@/lib/levels';
import { pageMetadata } from '@/lib/seo';

/**
 * /settings/level — Phase 10.D.
 *
 * Parent override for the child's `vocabulary_level`. Auto-promotion
 * happens in the personalization cron when ≥80% of the active tier is
 * mastered; this page lets caregivers force a level change at any
 * time (e.g., promoting early after watching a strong therapy
 * session, or stepping back if a tier change felt premature).
 */

export async function generateMetadata({ params }: { params: Promise<{ locale: AppLocale }> }) {
  const { locale } = await params;
  return pageMetadata({
    locale,
    path: 'settings/level',
    title: locale === 'ar' ? 'مستوى التعلّم' : 'Learning level',
    description:
      locale === 'ar'
        ? 'اختر مستوى مفردات طفلك ومتى يتقدّم إلى المستوى التالي.'
        : "Choose your child's vocabulary level and when they unlock the next tier.",
    robots: { index: false, follow: false },
  });
}

export default async function LevelSettingsPage({
  params,
}: {
  params: Promise<{ locale: AppLocale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { createSupabaseServerClient } = await import('@/lib/supabase/server');
  const supabase = await createSupabaseServerClient();
  const { data: childRows } = await (
    supabase.from('children') as never as {
      select: (cols: string) => {
        is: (
          col: string,
          v: null,
        ) => {
          order: (
            col: string,
            opts: { ascending: boolean },
          ) => {
            limit: (n: number) => Promise<{
              data:
                | {
                    id: string;
                    preferred_name: string | null;
                    vocabulary_level: VocabLevel | null;
                  }[]
                | null;
            }>;
          };
        };
      };
    }
  )
    .select('id, preferred_name, vocabulary_level')
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(1);
  const child = (childRows ?? [])[0] ?? null;
  if (!child) {
    return (
      <main className="container space-y-4 py-10">
        <h1 className="text-fg text-2xl font-bold">
          {locale === 'ar' ? 'مستوى التعلّم' : 'Learning level'}
        </h1>
        <p className="text-fg-muted text-sm">
          {locale === 'ar'
            ? 'لا يوجد ملف طفل بعد. أكمل الإعداد أولًا.'
            : 'No child profile yet. Complete onboarding first.'}
        </p>
      </main>
    );
  }
  return (
    <LevelSettingsClient
      locale={locale}
      childId={child.id}
      childName={child.preferred_name?.trim() || null}
      initialLevel={(child.vocabulary_level ?? 'starter') as VocabLevel}
    />
  );
}
