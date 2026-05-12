import {
  LayoutDashboard,
  TrendingUp,
  ListChecks,
  Settings,
  FileText,
  Users,
  Search,
} from 'lucide-react';
import { useLocale } from 'next-intl';
import { DeviceFrame } from './device-frame';
import type { AppLocale } from '@/i18n/routing';
import { cn } from '@/lib/cn';

/**
 * Mock of the caregiver / therapist dashboard. Renders a sidebar nav, a
 * three-card "today" header, a bar-chart placeholder for vocabulary growth,
 * and a top-symbols list. Marketing surface only.
 */
export function MockDashboard({ className }: { className?: string }) {
  const locale = useLocale() as AppLocale;
  const isAr = locale === 'ar';

  const nav = [
    { en: 'Overview', ar: 'نظرة عامة', icon: LayoutDashboard, active: true },
    { en: 'Progress', ar: 'التقدّم', icon: TrendingUp, active: false },
    { en: 'Sessions', ar: 'الجلسات', icon: FileText, active: false },
    { en: 'Vocabulary', ar: 'المفردات', icon: ListChecks, active: false },
    { en: 'Children', ar: 'الأطفال', icon: Users, active: false },
    { en: 'Settings', ar: 'الإعدادات', icon: Settings, active: false },
  ];

  const stats = [
    {
      label: isAr ? 'جلسة اليوم' : "Today's session",
      value: isAr ? '٢٤ دقيقة' : '24 min',
      sublabel: isAr ? '٤ نجوم' : '4 stars',
      tone: 'primary',
    },
    {
      label: isAr ? 'سلسلة' : 'Streak',
      value: isAr ? '٧ أيام' : '7 days',
      sublabel: isAr ? 'هادئ ومتسق' : 'calm + consistent',
      tone: 'accent',
    },
    {
      label: isAr ? 'نجاح' : 'Success rate',
      value: isAr ? '٩٢٪' : '92%',
      sublabel: isAr ? '+٤٪ هذا الأسبوع' : '+4% this week',
      tone: 'secondary',
    },
  ];

  const topSymbols = isAr
    ? [
        { label: 'أمي', count: 18 },
        { label: 'ماء', count: 14 },
        { label: 'ألعب', count: 11 },
        { label: 'تعب', count: 7 },
      ]
    : [
        { label: 'mom', count: 18 },
        { label: 'water', count: 14 },
        { label: 'play', count: 11 },
        { label: 'tired', count: 7 },
      ];

  // Bar chart bars — vocabulary growth across the last 7 days. Heights chosen
  // to read as "real-ish" growth, not perfect.
  const bars = [38, 52, 47, 64, 71, 78, 86];

  return (
    <DeviceFrame variant="desktop" className={className} label="BlueCare caregiver dashboard">
      <div className="bg-bg flex aspect-[16/10]">
        {/* Sidebar */}
        <aside className="bg-bg-elevated border-border w-44 shrink-0 border-e p-3">
          <div className="mb-4 flex items-center gap-2 px-2 py-1.5">
            <span className="bg-primary text-primary-fg grid h-7 w-7 place-items-center rounded-md">
              <span className="text-xs font-bold">{isAr ? 'ب' : 'B'}</span>
            </span>
            <span className="text-fg text-sm font-semibold">{isAr ? 'بلوكير' : 'BlueCare'}</span>
          </div>
          <ul className="space-y-1">
            {nav.map((n) => {
              const Icon = n.icon;
              return (
                <li key={n.en}>
                  <span
                    className={cn(
                      'flex items-center gap-2 rounded-lg px-2 py-2 text-xs font-medium',
                      n.active ? 'bg-primary/10 text-primary' : 'text-fg-muted',
                    )}
                  >
                    <Icon aria-hidden="true" className="h-4 w-4" />
                    {isAr ? n.ar : n.en}
                  </span>
                </li>
              );
            })}
          </ul>
        </aside>

        {/* Main */}
        <div className="flex flex-1 flex-col">
          {/* Topbar */}
          <div className="bg-bg-elevated border-border flex items-center justify-between border-b px-5 py-3">
            <div className="text-fg text-sm font-semibold">
              {isAr ? 'سامي · ٧ سنوات' : 'Sami · age 7'}
            </div>
            <div className="border-border bg-bg-muted text-fg-muted flex items-center gap-2 rounded-md border px-2 py-1 text-xs">
              <Search aria-hidden="true" className="h-3.5 w-3.5" />
              <span>{isAr ? 'بحث (⌘ك)' : 'Search (⌘K)'}</span>
            </div>
          </div>

          <div className="grid flex-1 gap-4 p-5">
            {/* Stats row */}
            <div className="grid grid-cols-3 gap-3">
              {stats.map((s) => (
                <StatCard
                  key={s.label}
                  label={s.label}
                  value={s.value}
                  sublabel={s.sublabel}
                  tone={s.tone as 'primary' | 'accent' | 'secondary'}
                />
              ))}
            </div>

            {/* Chart + top symbols */}
            <div className="grid grid-cols-3 gap-3">
              <div className="border-border bg-bg-elevated col-span-2 rounded-xl border p-4">
                <div className="text-fg-muted mb-3 text-xs font-medium uppercase tracking-wide">
                  {isAr ? 'نمو المفردات · ٧ أيام' : 'Vocabulary growth · 7 days'}
                </div>
                <div className="flex h-20 items-end gap-2">
                  {bars.map((h, i) => (
                    <div key={i} className="flex flex-1 flex-col items-center gap-1">
                      <div
                        className="bg-primary/80 w-full rounded-t-md"
                        style={{ height: `${h}%` }}
                      />
                    </div>
                  ))}
                </div>
              </div>
              <div className="border-border bg-bg-elevated rounded-xl border p-4">
                <div className="text-fg-muted mb-3 text-xs font-medium uppercase tracking-wide">
                  {isAr ? 'أهم الرموز' : 'Top symbols'}
                </div>
                <ul className="space-y-2">
                  {topSymbols.map((s) => (
                    <li key={s.label} className="flex items-center justify-between">
                      <span className="text-fg text-xs font-medium">{s.label}</span>
                      <span className="text-fg-subtle text-xs">{s.count}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DeviceFrame>
  );
}

function StatCard({
  label,
  value,
  sublabel,
  tone,
}: {
  label: string;
  value: string;
  sublabel: string;
  tone: 'primary' | 'accent' | 'secondary';
}) {
  const toneClasses: Record<typeof tone, string> = {
    primary: 'border-primary/30 bg-primary/5',
    accent: 'border-accent/40 bg-accent/15',
    secondary: 'border-secondary/40 bg-secondary/15',
  };
  return (
    <div className={cn('rounded-xl border p-4', toneClasses[tone])}>
      <div className="text-fg-muted text-xs font-medium uppercase tracking-wide">{label}</div>
      <div className="text-fg mt-2 text-2xl font-bold leading-none">{value}</div>
      <div className="text-fg-subtle mt-1.5 text-xs">{sublabel}</div>
    </div>
  );
}
