import { setRequestLocale } from 'next-intl/server';
import { ReportsClient } from './reports-client';
import type { AppLocale } from '@/i18n/routing';
import { pageMetadata } from '@/lib/seo';

/**
 * /dashboard/reports — Module 6.1 item 3.
 *
 * PDF progress-report export. The page is auth-gated by the parent
 * (app)/layout.tsx; the client component owns the window picker and
 * the @react-pdf/renderer `PDFDownloadLink` that materializes the PDF
 * blob in-browser. The tRPC `reports.summary` query feeds the
 * `<ProgressReportPdf>` component with a single batched aggregation
 * over progress_metrics + sessions for the chosen window.
 */
export async function generateMetadata({ params }: { params: Promise<{ locale: AppLocale }> }) {
  const { locale } = await params;
  return pageMetadata({
    locale,
    path: 'dashboard/reports',
    title: locale === 'ar' ? 'تقارير التقدّم' : 'Progress reports',
    description:
      locale === 'ar'
        ? 'تصدير تقارير PDF عن نمو المفردات والجلسات والملاحظات.'
        : 'Export PDF reports covering vocabulary growth, session activity, and therapist notes.',
    robots: { index: false, follow: false },
  });
}

export default async function ReportsPage({ params }: { params: Promise<{ locale: AppLocale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Resolve the active child server-side so the picker has its initial
  // value (same approach the dashboard takes). The client refetches if
  // the caregiver switches children via the existing dashboard tabs.
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
          ) => Promise<{
            data: { id: string; preferred_name: string | null; full_name: string }[] | null;
          }>;
        };
      };
    }
  )
    .select('id, preferred_name, full_name')
    .is('deleted_at', null)
    .order('created_at', { ascending: true });
  const children = (childRows ?? []).map((c) => ({
    id: c.id,
    name: c.preferred_name?.trim() || c.full_name?.trim() || 'Child',
  }));

  return <ReportsClient locale={locale} children={children} />;
}
