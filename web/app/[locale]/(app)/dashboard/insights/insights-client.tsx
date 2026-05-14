'use client';

import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  Lightbulb,
  Loader2,
  Sparkles,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { trpc } from '@/lib/trpc/client';

interface CopyShape {
  title: string;
  subtitle: (name: string) => string;
  summaryHeading: string;
  strengthsHeading: string;
  growthHeading: string;
  parentSuggestionsHeading: string;
  therapistSuggestionsHeading: string;
  risksHeading: string;
  historyHeading: string;
  generateNow: string;
  generating: string;
  rateLimited: string;
  insufficientData: string;
  childNotFound: string;
  capReached: string;
  costTooHigh: string;
  unknown: string;
  none: string;
  tryToday: string;
  download: string;
  weekly: string;
  monthly: string;
  quarterly: string;
  generatedOn: string;
  period: string;
  auto: string;
  manual: string;
}

const COPY: Record<'en' | 'ar', CopyShape> = {
  en: {
    title: 'Insights',
    subtitle: (name: string) =>
      name ? `Claude-generated weekly progress for ${name}.` : 'Claude-generated weekly progress.',
    summaryHeading: 'Summary',
    strengthsHeading: 'Strengths',
    growthHeading: 'Areas for growth',
    parentSuggestionsHeading: 'Try this with {name} this week',
    therapistSuggestionsHeading: 'For their therapist',
    risksHeading: 'Worth a closer look',
    historyHeading: 'Past reports',
    generateNow: 'Generate insights now',
    generating: 'Generating…',
    rateLimited: 'You can generate one report per child per day.',
    insufficientData:
      'Not enough data this week — we need at least 3 sessions for a useful report.',
    childNotFound:
      "We couldn't find your child's profile to summarize. Please refresh the page; if it keeps happening, contact support.",
    capReached: "This child's monthly AI cap is reached. Reports resume next month.",
    costTooHigh:
      'The report would have exceeded our $0.50 per-generation cap. Try again next week.',
    unknown: 'Something went wrong generating the report.',
    none: 'No reports yet. Reports generate automatically every Monday — or you can run one now.',
    tryToday: 'Try this today',
    download: 'Download as PDF',
    weekly: 'Weekly',
    monthly: 'Monthly',
    quarterly: 'Quarterly',
    generatedOn: 'Generated {date}',
    period: '{start} – {end}',
    auto: 'Auto',
    manual: 'Manual',
  },
  ar: {
    title: 'التحليلات',
    subtitle: (name: string) =>
      name ? `تقدّم أسبوعي مُولَّد بكلود لـ ${name}.` : 'تقدّم أسبوعي مُولَّد بكلود.',
    summaryHeading: 'الملخّص',
    strengthsHeading: 'نقاط القوة',
    growthHeading: 'فُرص للنموّ',
    parentSuggestionsHeading: 'جرّب هذا مع {name} هذا الأسبوع',
    therapistSuggestionsHeading: 'للمعالج',
    risksHeading: 'بحاجة لانتباه إضافي',
    historyHeading: 'التقارير السابقة',
    generateNow: 'أنشئ تحليلًا الآن',
    generating: 'جارٍ الإنشاء…',
    rateLimited: 'يمكنك إنشاء تقرير واحد لكل طفل في اليوم.',
    insufficientData: 'لا توجد بيانات كافية هذا الأسبوع — نحتاج ٣ جلسات على الأقلّ لتقرير مفيد.',
    childNotFound:
      'تعذّر العثور على ملف طفلك لإعداد الملخّص. يُرجى تحديث الصفحة؛ إذا استمرّت المشكلة فراسلنا.',
    capReached: 'سقف الذكاء الاصطناعي الشهري لهذا الطفل قد تمّ. تستأنف التقارير الشهر القادم.',
    costTooHigh: 'تجاوز التقرير سقف $٠.٥٠ لكلّ إنشاء. حاول الأسبوع المقبل.',
    unknown: 'حدث خطأ أثناء إنشاء التقرير.',
    none: 'لا توجد تقارير بعد. تُنشأ تلقائيًا كلّ اثنين — أو يمكنك تشغيل واحد الآن.',
    tryToday: 'جرّب هذا اليوم',
    download: 'حمّل كملف PDF',
    weekly: 'أسبوعي',
    monthly: 'شهري',
    quarterly: 'ربع سنوي',
    generatedOn: 'أُنشئ في {date}',
    period: 'من {start} إلى {end}',
    auto: 'تلقائي',
    manual: 'يدوي',
  },
};

interface BilingualLine {
  en: string;
  ar: string;
}

interface ReportPayload {
  strengths: BilingualLine[];
  areas_for_growth: BilingualLine[];
  specific_suggestions_for_parents: BilingualLine[];
  specific_suggestions_for_therapists: BilingualLine[];
  risks_or_concerns: BilingualLine[];
  summary_paragraph_english: string;
  summary_paragraph_arabic: string;
}

interface ReportRow {
  id: string;
  child_id: string;
  generated_at: string;
  period_start: string;
  period_end: string;
  period_type: 'weekly' | 'monthly' | 'quarterly';
  generated_by: 'cron' | 'manual';
  payload_json: ReportPayload;
}

export function InsightsClient({
  locale,
  childId,
  childName,
}: {
  locale: 'en' | 'ar';
  childId: string;
  childName: string;
}) {
  const t = COPY[locale];
  const listQuery = trpc.reports.list.useQuery({ childId, limit: 12 });
  const generateMut = trpc.reports.generate.useMutation();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const reports = useMemo(
    () => (listQuery.data?.reports ?? []) as ReportRow[],
    [listQuery.data?.reports],
  );
  const active: ReportRow | null = useMemo(() => {
    if (selectedId) return reports.find((r) => r.id === selectedId) ?? null;
    return reports[0] ?? null;
  }, [selectedId, reports]);

  async function onGenerate() {
    try {
      await generateMut.mutateAsync({ childId, periodType: 'weekly' });
      await listQuery.refetch();
    } catch {
      /* error surfaced below */
    }
  }

  const errorMessage =
    generateMut.error?.message === 'rate_limited_24h'
      ? t.rateLimited
      : generateMut.error?.message === 'insufficient_data'
        ? t.insufficientData
        : generateMut.error?.message === 'child_not_found'
          ? t.childNotFound
          : generateMut.error?.message === 'monthly_cap_reached'
            ? t.capReached
            : generateMut.error?.message === 'cost_too_high'
              ? t.costTooHigh
              : generateMut.error
                ? t.unknown
                : null;

  return (
    <main className="container space-y-8 py-10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-fg text-2xl font-bold leading-tight md:text-3xl">{t.title}</h1>
          <p className="text-fg-muted text-base">{t.subtitle(childName)}</p>
        </div>
        <Button
          type="button"
          variant="primary"
          disabled={generateMut.isPending}
          onClick={() => void onGenerate()}
        >
          {generateMut.isPending ? (
            <>
              <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
              {t.generating}
            </>
          ) : (
            <>
              <Sparkles aria-hidden="true" className="h-4 w-4" />
              {t.generateNow}
            </>
          )}
        </Button>
      </header>

      {errorMessage && (
        <div
          role="alert"
          className="border-warning/30 bg-warning/5 text-warning rounded-xl border px-4 py-3 text-sm leading-relaxed"
        >
          {errorMessage}
        </div>
      )}

      {reports.length === 0 ? (
        <p className="text-fg-muted bg-bg-elevated border-border rounded-2xl border p-8 text-center text-sm">
          {t.none}
        </p>
      ) : (
        <>
          {active && (
            <article className="border-border bg-bg-elevated space-y-8 rounded-2xl border p-6 shadow-sm md:p-8">
              <ReportHeader report={active} t={t} locale={locale} />
              <SummarySection report={active} t={t} locale={locale} />
              <BulletSection
                heading={t.strengthsHeading}
                lines={active.payload_json.strengths}
                locale={locale}
                Icon={CheckCircle2}
                tone="success"
              />
              <BulletSection
                heading={t.growthHeading}
                lines={active.payload_json.areas_for_growth}
                locale={locale}
                Icon={TrendingUp}
                tone="warning"
              />
              <BulletSection
                heading={t.parentSuggestionsHeading.replace('{name}', childName)}
                lines={active.payload_json.specific_suggestions_for_parents}
                locale={locale}
                Icon={Lightbulb}
                tone="primary"
                cta={t.tryToday}
              />
              <BulletSection
                heading={t.therapistSuggestionsHeading}
                lines={active.payload_json.specific_suggestions_for_therapists}
                locale={locale}
                Icon={FileText}
                tone="muted"
              />
              {active.payload_json.risks_or_concerns.length > 0 && (
                <BulletSection
                  heading={t.risksHeading}
                  lines={active.payload_json.risks_or_concerns}
                  locale={locale}
                  Icon={Clock}
                  tone="warning"
                />
              )}
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => window.print()}
                  aria-label={t.download}
                >
                  <Download aria-hidden="true" className="h-4 w-4" />
                  {t.download}
                </Button>
              </div>
            </article>
          )}

          {reports.length > 1 && (
            <section className="space-y-3">
              <h2 className="text-fg text-lg font-bold">{t.historyHeading}</h2>
              <ul className="space-y-2">
                {reports.map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(r.id)}
                      className={cn(
                        'border-border bg-bg-elevated text-fg hover:border-primary/40 focus-visible:ring-ring flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
                        r.id === active?.id && 'border-primary/40 bg-primary/5',
                      )}
                      aria-pressed={r.id === active?.id}
                    >
                      <span>
                        <span className="font-semibold">{t[r.period_type]}</span>{' '}
                        <span className="text-fg-muted">
                          {t.period
                            .replace('{start}', formatDate(r.period_start, locale))
                            .replace('{end}', formatDate(r.period_end, locale))}
                        </span>
                      </span>
                      <span className="text-fg-subtle inline-flex items-center gap-2 text-xs">
                        {r.generated_by === 'manual' ? t.manual : t.auto}
                        <ArrowRight aria-hidden="true" className="h-3 w-3" />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </main>
  );
}

function ReportHeader({
  report,
  t,
  locale,
}: {
  report: ReportRow;
  t: CopyShape;
  locale: 'en' | 'ar';
}) {
  return (
    <header className="space-y-1">
      <p className="text-primary text-xs font-semibold uppercase tracking-wide">
        {t[report.period_type]} • {report.generated_by === 'manual' ? t.manual : t.auto}
      </p>
      <p className="text-fg-muted text-sm">
        {t.generatedOn.replace('{date}', formatDate(report.generated_at, locale))}
      </p>
      <p className="text-fg-subtle text-xs">
        {t.period
          .replace('{start}', formatDate(report.period_start, locale))
          .replace('{end}', formatDate(report.period_end, locale))}
      </p>
    </header>
  );
}

function SummarySection({
  report,
  t,
  locale: _locale,
}: {
  report: ReportRow;
  t: CopyShape;
  locale: 'en' | 'ar';
}) {
  return (
    <section className="space-y-2">
      <h2 className="text-fg text-lg font-bold">{t.summaryHeading}</h2>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="bg-bg-muted rounded-xl p-4" lang="en" dir="ltr">
          <p className="text-fg-muted text-xs font-semibold uppercase tracking-wide">EN</p>
          <p className="text-fg mt-1 text-sm leading-relaxed">
            {report.payload_json.summary_paragraph_english}
          </p>
        </div>
        <div className="bg-bg-muted rounded-xl p-4" lang="ar" dir="rtl">
          <p className="text-fg-muted text-xs font-semibold uppercase tracking-wide">AR</p>
          <p className="text-fg mt-1 text-sm leading-relaxed">
            {report.payload_json.summary_paragraph_arabic}
          </p>
        </div>
      </div>
    </section>
  );
}

function BulletSection({
  heading,
  lines,
  locale,
  Icon,
  tone,
  cta,
}: {
  heading: string;
  lines: BilingualLine[];
  locale: 'en' | 'ar';
  Icon: LucideIcon;
  tone: 'success' | 'warning' | 'primary' | 'muted';
  cta?: string;
}) {
  if (!lines || lines.length === 0) return null;
  const toneClasses = {
    success: 'text-success bg-success/5',
    warning: 'text-warning bg-warning/5',
    primary: 'text-primary bg-primary/5',
    muted: 'text-fg-muted bg-bg-muted',
  }[tone];
  return (
    <section className="space-y-3">
      <h2 className="text-fg text-lg font-bold">{heading}</h2>
      <ul className="space-y-2.5">
        {lines.map((line, i) => (
          <li
            key={i}
            className={cn(
              'flex items-start gap-3 rounded-xl p-3',
              tone === 'muted' ? 'border-border border' : '',
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                'mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
                toneClasses,
              )}
            >
              <Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-fg text-sm leading-relaxed">
                {locale === 'ar' ? line.ar : line.en}
              </p>
              {cta && tone === 'primary' && (
                <button
                  type="button"
                  className="text-primary inline-flex items-center gap-1 text-xs font-semibold underline-offset-2 hover:underline"
                >
                  {cta} <ArrowRight aria-hidden="true" className="h-3 w-3" />
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function formatDate(iso: string, locale: 'en' | 'ar'): string {
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-SA' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(d);
  } catch {
    return iso;
  }
}
