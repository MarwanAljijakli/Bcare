import { setRequestLocale } from 'next-intl/server';
import { VoiceTestClient } from './voice-test-client';
import type { AppLocale } from '@/i18n/routing';
import { pageMetadata } from '@/lib/seo';

/**
 * /voice-test — Quality Fix Phase 4 acceptance gate.
 *
 * Auth-gated by the parent (app)/layout.tsx. The native-Arabic-speaker
 * acceptance test for the Quality Fix lives here:
 *   1. Listen to 3 EN sample phrases — confirm intelligibility.
 *   2. Listen to 3 AR sample phrases — confirm Saudi-child intelligibility.
 *   3. Test the mic — confirm Whisper transcription matches.
 *
 * The page is the source of truth for "voice quality acceptable" per
 * the directive's hard constraint: "The acceptance test for voice
 * quality is a real human (Marwan, native Arabic speaker) listening
 * to real Arabic TTS and saying 'I understand this clearly.' No
 * automated test substitutes."
 */

export async function generateMetadata({ params }: { params: Promise<{ locale: AppLocale }> }) {
  const { locale } = await params;
  return pageMetadata({
    locale,
    path: 'voice-test',
    title: locale === 'ar' ? 'اختبار الصوت' : 'Voice Test',
    description:
      locale === 'ar'
        ? 'صفحة اختبار جودة الصوت — استمع إلى عبارات نموذجية وتحقق من نطق Whisper.'
        : 'Voice quality test surface — listen to sample phrases + test mic transcription.',
    robots: { index: false, follow: false },
  });
}

export default async function VoiceTestPage({
  params,
}: {
  params: Promise<{ locale: AppLocale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Resolve the active child (the dev caregiver under bypass mode has
  // exactly one child). The client needs child_id for the voice
  // endpoints' RLS auth check.
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
            limit: (
              n: number,
            ) => Promise<{ data: { id: string; preferred_name: string | null }[] | null }>;
          };
        };
      };
    }
  )
    .select('id, preferred_name')
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(1);
  const child = (childRows ?? [])[0] ?? null;

  return <VoiceTestClient locale={locale} childId={child?.id ?? null} />;
}
