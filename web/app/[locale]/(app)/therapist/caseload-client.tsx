'use client';

import { Activity, Calendar, ChevronRight, Loader2, Users } from 'lucide-react';
import Link from 'next/link';
import { trpc } from '@/lib/trpc/client';

interface Props {
  locale: 'en' | 'ar';
}

function fmtRelative(iso: string | null, locale: 'en' | 'ar'): string {
  if (!iso) return locale === 'ar' ? 'لا توجد جلسات' : 'No sessions yet';
  try {
    const ms = Date.now() - new Date(iso).getTime();
    const days = Math.floor(ms / (24 * 60 * 60 * 1000));
    if (days < 1) return locale === 'ar' ? 'اليوم' : 'today';
    if (days < 7)
      return locale === 'ar' ? `قبل ${days} ${days === 1 ? 'يوم' : 'أيام'}` : `${days}d ago`;
    if (days < 30) {
      const w = Math.floor(days / 7);
      return locale === 'ar' ? `قبل ${w} ${w === 1 ? 'أسبوع' : 'أسابيع'}` : `${w}w ago`;
    }
    return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-SA' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function TherapistCaseloadClient({ locale }: Props) {
  const query = trpc.therapists.caseload.useQuery();
  const T = LABELS[locale];

  return (
    <main className="container space-y-8 py-10">
      <header className="space-y-2">
        <h1 className="text-fg text-3xl font-bold tracking-tight">{T.title}</h1>
        <p className="text-fg-muted max-w-2xl text-base leading-relaxed">{T.subtitle}</p>
      </header>

      {query.isLoading && (
        <div className="text-fg-muted flex items-center gap-2 text-sm">
          <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
          {T.loading}
        </div>
      )}

      {query.error && (
        <p className="text-xs text-amber-700 dark:text-amber-300">
          {T.error}: {query.error.message}
        </p>
      )}

      {query.data && query.data.length === 0 && (
        <div className="border-border-muted bg-bg-elevated space-y-3 rounded-2xl border border-dashed p-6">
          <Users aria-hidden="true" className="text-fg-muted h-6 w-6" />
          <p className="text-fg-muted text-sm">{T.empty}</p>
          <p className="text-fg-subtle text-xs">{T.emptyHint}</p>
        </div>
      )}

      {query.data && query.data.length > 0 && (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {query.data.map((item) => (
            <li key={item.grantId}>
              <Link
                href={`/${locale}/dashboard?child=${item.childId}`}
                className="border-border bg-bg-elevated hover:bg-bg-elevated/80 block rounded-2xl border p-4 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-fg truncate text-lg font-semibold">{item.childName}</p>
                    {item.caregiverEmail && (
                      <p className="text-fg-subtle truncate text-xs">{item.caregiverEmail}</p>
                    )}
                  </div>
                  <ChevronRight
                    aria-hidden="true"
                    className="text-fg-muted h-5 w-5 flex-shrink-0"
                  />
                </div>
                <div className="text-fg-muted mt-3 grid grid-cols-2 gap-2 text-xs">
                  <span className="inline-flex items-center gap-1">
                    <Calendar aria-hidden="true" className="h-3.5 w-3.5" />
                    {fmtRelative(item.lastSessionAt, locale)}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Activity aria-hidden="true" className="h-3.5 w-3.5" />
                    {item.inputsLast30d} {T.inputs30d}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

const LABELS = {
  en: {
    title: 'My caseload',
    subtitle:
      'Children whose caregivers have granted you access to their board. Click into one to see sessions, top symbols, and add your notes.',
    loading: 'Loading caseload…',
    error: 'Could not load caseload',
    empty: 'No active grants yet.',
    emptyHint:
      'Ask the caregiver to issue a 12-character invite from their dashboard, then paste it at /accept-invite.',
    inputs30d: 'inputs / 30d',
  },
  ar: {
    title: 'قائمة العملاء',
    subtitle:
      'الأطفال الذين منحك أولياء أمورهم حق الوصول إلى لوحاتهم. اضغط على بطاقة لرؤية الجلسات والرموز الأكثر استخدامًا، وإضافة ملاحظاتك.',
    loading: 'جاري التحميل…',
    error: 'تعذّر تحميل القائمة',
    empty: 'لا توجد إذونات نشطة بعد.',
    emptyHint:
      'اطلب من مقدّم الرعاية إصدار رمز من 12 حرفًا من لوحته، ثم الصق الرمز في /accept-invite.',
    inputs30d: 'إدخال / ٣٠ يومًا',
  },
} as const;
