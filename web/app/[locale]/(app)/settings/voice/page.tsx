import { setRequestLocale } from 'next-intl/server';
import { VoiceSettingsClient } from './voice-settings-client';
import type { AppLocale } from '@/i18n/routing';
import { pageMetadata } from '@/lib/seo';

/**
 * /settings/voice — Quality Fix Phase 5.
 *
 * Per-child voice picker, speed slider, auto-play toggle. Reads
 * current settings server-side (from `children` row) and hands them to
 * the client component for editing via tRPC's voice.set mutation.
 */

export async function generateMetadata({ params }: { params: Promise<{ locale: AppLocale }> }) {
  const { locale } = await params;
  return pageMetadata({
    locale,
    path: 'settings/voice',
    title: locale === 'ar' ? 'إعدادات الصوت' : 'Voice settings',
    description:
      locale === 'ar'
        ? 'اختر الصوت والسرعة وإعدادات التشغيل التلقائي.'
        : 'Pick the voice, speed, and auto-play behavior.',
    robots: { index: false, follow: false },
  });
}

export default async function VoiceSettingsPage({
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
                    voice_id: string | null;
                    voice_speed: number | string | null;
                    auto_play_speak: boolean | null;
                  }[]
                | null;
            }>;
          };
        };
      };
    }
  )
    .select('id, preferred_name, voice_id, voice_speed, auto_play_speak')
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(1);
  const child = (childRows ?? [])[0] ?? null;
  if (!child) {
    return (
      <main className="container space-y-4 py-10">
        <h1 className="text-fg text-2xl font-bold">
          {locale === 'ar' ? 'إعدادات الصوت' : 'Voice settings'}
        </h1>
        <p className="text-fg-muted text-sm">
          {locale === 'ar'
            ? 'لا يوجد ملف طفل بعد. أكمل الإعداد أولًا.'
            : 'No child profile yet. Complete onboarding first.'}
        </p>
      </main>
    );
  }
  const initialSpeed = child.voice_speed ? Number(child.voice_speed) : 1.0;
  const initialVoice = (child.voice_id === 'sarah' ? 'sarah' : 'charlotte') as
    | 'charlotte'
    | 'sarah';
  return (
    <VoiceSettingsClient
      locale={locale}
      childId={child.id}
      childName={child.preferred_name?.trim() || null}
      initial={{
        voice: initialVoice,
        speed: Number.isFinite(initialSpeed) ? initialSpeed : 1.0,
        autoPlay: child.auto_play_speak ?? true,
      }}
    />
  );
}
