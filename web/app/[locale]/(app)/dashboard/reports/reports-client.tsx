'use client';

import { ArrowLeft, Download, FileText, Loader2 } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ProgressReportPdf } from '@/components/reports/progress-report-pdf';
import { Button } from '@/components/ui/button';
import { trpc } from '@/lib/trpc/client';

/**
 * Reports surface client. The @react-pdf/renderer modules are heavy
 * (~600 KB gzipped) so the `PDFDownloadLink` is dynamically imported
 * with `ssr: false` to keep it out of every other dashboard page's
 * bundle and out of the SSR build entirely.
 *
 * The window picker re-runs the tRPC `reports.summary` query whenever
 * the user changes the window. The download button is disabled while
 * the query is pending so the caregiver doesn't see "Download" then
 * get a stale snapshot.
 */
const PDFDownloadLink = dynamic(
  () => import('@react-pdf/renderer').then((mod) => mod.PDFDownloadLink),
  { ssr: false, loading: () => null },
);

type Window = 7 | 30 | 90;
const WINDOWS: Window[] = [7, 30, 90];

interface Props {
  locale: 'en' | 'ar';
  children: { id: string; name: string }[];
}

export function ReportsClient({ locale, children }: Props) {
  const [activeChildId, setActiveChildId] = useState<string | null>(children[0]?.id ?? null);
  const [windowDays, setWindowDays] = useState<Window>(30);

  const query = trpc.reports.summary.useQuery(
    { childId: activeChildId ?? '', window: windowDays },
    { enabled: !!activeChildId },
  );

  const T = LABELS[locale];

  // Stable filename — derives from child + window + today's date so
  // multiple exports don't collide.
  const filename = useMemo(() => {
    if (!query.data) return 'progress-report.pdf';
    const safeName = query.data.child.name.replace(/[^a-zA-Z0-9؀-ۿ]+/g, '-');
    const today = new Date().toISOString().slice(0, 10);
    return `bluecare-${safeName}-${windowDays}d-${today}.pdf`;
  }, [query.data, windowDays]);

  if (children.length === 0) {
    return (
      <main className="container py-10">
        <Link
          href={`/${locale}/dashboard`}
          className="text-fg-muted hover:text-fg inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft aria-hidden="true" className="h-4 w-4" />
          {T.back}
        </Link>
        <p className="text-fg-muted mt-6 text-sm">{T.noChildren}</p>
      </main>
    );
  }

  return (
    <main className="container space-y-8 py-10">
      <header className="space-y-2">
        <Link
          href={`/${locale}/dashboard`}
          className="text-fg-muted hover:text-fg inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft aria-hidden="true" className="h-4 w-4" />
          {T.back}
        </Link>
        <h1 className="text-fg text-3xl font-bold tracking-tight">{T.title}</h1>
        <p className="text-fg-muted max-w-2xl text-base leading-relaxed">{T.subtitle}</p>
      </header>

      {children.length > 1 && (
        <section aria-labelledby="child-picker-heading" className="space-y-2">
          <h2 id="child-picker-heading" className="text-fg-muted text-xs font-semibold uppercase">
            {T.childPickerLabel}
          </h2>
          <div className="flex flex-wrap gap-2">
            {children.map((c) => (
              <Button
                key={c.id}
                type="button"
                size="sm"
                variant={c.id === activeChildId ? 'primary' : 'ghost'}
                onClick={() => setActiveChildId(c.id)}
              >
                {c.name}
              </Button>
            ))}
          </div>
        </section>
      )}

      <section aria-labelledby="window-picker-heading" className="space-y-2">
        <h2 id="window-picker-heading" className="text-fg-muted text-xs font-semibold uppercase">
          {T.windowPickerLabel}
        </h2>
        <div className="flex gap-2">
          {WINDOWS.map((w) => (
            <Button
              key={w}
              type="button"
              size="sm"
              variant={w === windowDays ? 'primary' : 'ghost'}
              onClick={() => setWindowDays(w)}
            >
              {T.windowOption(w)}
            </Button>
          ))}
        </div>
      </section>

      <section
        aria-labelledby="export-heading"
        className="border-border bg-bg-elevated space-y-4 rounded-2xl border p-5"
      >
        <h2 id="export-heading" className="text-fg text-lg font-bold">
          {T.exportHeading}
        </h2>

        {query.isLoading && (
          <div className="text-fg-muted flex items-center gap-2 text-sm">
            <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
            {T.aggregating}
          </div>
        )}

        {query.error && (
          <p className="text-xs text-amber-700 dark:text-amber-300">
            {T.error}: {query.error.message}
          </p>
        )}

        {query.data && (
          <>
            <div className="text-fg-muted grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
              <SummaryStat label={T.summarySessions} value={query.data.totals.sessions} />
              <SummaryStat label={T.summaryInputs} value={query.data.totals.inputs} />
              <SummaryStat
                label={T.summarySuccessful}
                value={query.data.totals.successfulSelections}
              />
              <SummaryStat label={T.summaryNotes} value={query.data.therapistNotes.length} />
            </div>

            <div className="flex items-center gap-3">
              <FileText aria-hidden="true" className="text-fg-muted h-5 w-5" />
              <p className="text-fg-muted text-sm">
                {T.previewLine(query.data.windowStart, query.data.windowEnd)}
              </p>
            </div>

            <PDFDownloadLink
              document={<ProgressReportPdf payload={query.data} locale={locale} />}
              fileName={filename}
            >
              {({ loading }) => (
                <Button type="button" size="md" disabled={loading} aria-label={T.downloadAria}>
                  {loading ? (
                    <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download aria-hidden="true" className="h-4 w-4" />
                  )}
                  <span className="ms-2">{loading ? T.preparing : T.downloadPdf}</span>
                </Button>
              )}
            </PDFDownloadLink>
          </>
        )}
      </section>

      <p className="text-fg-subtle text-xs">{T.privacyNote}</p>
    </main>
  );
}

function SummaryStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="border-border-muted bg-bg/40 rounded-xl border p-3">
      <p className="text-fg-subtle text-[10px] uppercase tracking-wide">{label}</p>
      <p className="text-fg mt-1 text-xl font-bold tabular-nums">{value}</p>
    </div>
  );
}

const LABELS = {
  en: {
    back: 'Back to dashboard',
    title: 'Progress reports',
    subtitle:
      'Export a bilingual PDF summary of your child’s activity for a chosen window. Includes vocabulary growth, session frequency, top symbols, multimodal breakdown, and any therapist notes from the period.',
    childPickerLabel: 'Child',
    windowPickerLabel: 'Window',
    windowOption: (n: number) => `Last ${n} days`,
    exportHeading: 'Export',
    aggregating: 'Aggregating data…',
    error: 'Could not load data',
    summarySessions: 'Sessions',
    summaryInputs: 'Inputs',
    summarySuccessful: 'Successful',
    summaryNotes: 'Notes',
    previewLine: (s: string, e: string) => `Window: ${s} → ${e}`,
    downloadPdf: 'Download PDF',
    preparing: 'Preparing PDF…',
    downloadAria: 'Download progress report PDF',
    privacyNote:
      'Reports are generated in your browser — the PDF is never uploaded. Save it to your device or share it with your therapist directly.',
    noChildren:
      'No child profile yet. Complete onboarding first to start generating progress reports.',
  },
  ar: {
    back: 'عودة إلى لوحة القيادة',
    title: 'تقارير التقدّم',
    subtitle:
      'صدِّر تقريرًا ثنائي اللغة بتنسيق PDF لنشاط طفلك خلال الفترة التي تختارها. يشمل التقرير نمو المفردات، تكرار الجلسات، الرموز الأكثر استخدامًا، تحليل الوسائط، وأي ملاحظات للمعالج خلال هذه الفترة.',
    childPickerLabel: 'الطفل',
    windowPickerLabel: 'الفترة',
    windowOption: (n: number) => `آخر ${n} يومًا`,
    exportHeading: 'تصدير',
    aggregating: 'يتمّ تجميع البيانات…',
    error: 'تعذّر تحميل البيانات',
    summarySessions: 'الجلسات',
    summaryInputs: 'الإدخالات',
    summarySuccessful: 'ناجحة',
    summaryNotes: 'ملاحظات',
    previewLine: (s: string, e: string) => `الفترة: ${s} → ${e}`,
    downloadPdf: 'تنزيل PDF',
    preparing: 'يتمّ تجهيز الـ PDF…',
    downloadAria: 'تنزيل تقرير التقدّم PDF',
    privacyNote:
      'يتمّ إنشاء التقرير في متصفّحك — لا يتمّ تحميل ملف الـ PDF إلى أي خادم. احفظه على جهازك أو شاركه مع المعالج مباشرة.',
    noChildren: 'لا يوجد ملف طفل بعد. أكمل الإعداد أولًا للبدء بإنشاء تقارير التقدّم.',
  },
} as const;
