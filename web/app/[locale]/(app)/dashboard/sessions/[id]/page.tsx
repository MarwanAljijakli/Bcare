import { setRequestLocale } from 'next-intl/server';
import { SessionReplayClient } from './replay-client';
import type { AppLocale } from '@/i18n/routing';
import { pageMetadata } from '@/lib/seo';

/**
 * Session detail / replay surface — Module 6.1 item 1.
 *
 * Authenticated by the (app)/layout.tsx; data is loaded client-side
 * via tRPC `sessions.detail` so the page revalidates instantly when
 * the therapist saves a note. The tRPC procedure is RLS-scoped:
 * caregivers see their own children's sessions, therapists see
 * sessions for children they have an active grant on (migration 0010).
 *
 * The Speak button re-plays the assembled phrase via the voice
 * pipeline introduced in Phase 9.A — EN routes to OpenAI, AR routes
 * to ElevenLabs, both with the Charlotte/Nova voices. The client
 * helper is the existing `speakClient`, no new wiring.
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: AppLocale; id: string }>;
}) {
  const { locale } = await params;
  return pageMetadata({
    locale,
    path: `dashboard/sessions`,
    title: locale === 'ar' ? 'تفاصيل الجلسة' : 'Session detail',
    description:
      locale === 'ar'
        ? 'إعادة عرض الجلسة + ملاحظات المعالج.'
        : 'Session replay + therapist notes editor.',
    robots: { index: false, follow: false },
  });
}

export default async function SessionDetailPage({
  params,
}: {
  params: Promise<{ locale: AppLocale; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  return <SessionReplayClient locale={locale} sessionId={id} />;
}
