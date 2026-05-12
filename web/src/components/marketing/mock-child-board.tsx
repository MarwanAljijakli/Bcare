import { Volume2, ChevronLeft, Heart, Apple, Smile, Music, Home, Cloud } from 'lucide-react';
import { useLocale } from 'next-intl';
import { DeviceFrame } from './device-frame';
import type { AppLocale } from '@/i18n/routing';
import { cn } from '@/lib/cn';

/**
 * Mock of the child AAC board. Renders representative bilingual tiles, a
 * sentence-strip at the top, a category rail on the leading edge, and a
 * speak button bottom-center. Locale-aware so the same component shows the
 * Arabic mirror when rendered inside `dir=rtl`.
 *
 * No interactive behavior — this is a marketing surface. The real board
 * lives in Module 3 with full accessibility and event handling.
 */
export function MockChildBoard({ className }: { className?: string }) {
  const locale = useLocale() as AppLocale;
  const isAr = locale === 'ar';

  const sentence = isAr
    ? [
        { label: 'أنا', icon: Smile },
        { label: 'أريد', icon: Heart },
        { label: 'تفّاحة', icon: Apple },
      ]
    : [
        { label: 'I', icon: Smile },
        { label: 'want', icon: Heart },
        { label: 'apple', icon: Apple },
      ];

  const categories = [
    { en: 'People', ar: 'أشخاص', icon: Smile, active: false },
    { en: 'Feelings', ar: 'مشاعر', icon: Heart, active: true },
    { en: 'Food', ar: 'طعام', icon: Apple, active: false },
    { en: 'Play', ar: 'لعب', icon: Music, active: false },
    { en: 'Home', ar: 'البيت', icon: Home, active: false },
    { en: 'Outside', ar: 'خارج', icon: Cloud, active: false },
  ];

  const tiles = isAr
    ? [
        { label: 'سعيد', helper: 'sa-eed', tone: 'sand' },
        { label: 'حزين', helper: 'ha-zeen', tone: 'mint' },
        { label: 'أحبّ', helper: 'u-hibb', tone: 'blue' },
        { label: 'متعب', helper: 'mut-ab', tone: 'sand' },
        { label: 'هادئ', helper: 'ha-de', tone: 'mint' },
        { label: 'خائف', helper: 'kha-ef', tone: 'blue' },
      ]
    : [
        { label: 'happy', helper: 'hap·py', tone: 'sand' },
        { label: 'sad', helper: 'sad', tone: 'mint' },
        { label: 'love', helper: 'love', tone: 'blue' },
        { label: 'tired', helper: 'tired', tone: 'sand' },
        { label: 'calm', helper: 'calm', tone: 'mint' },
        { label: 'scared', helper: 'scared', tone: 'blue' },
      ];

  return (
    <DeviceFrame variant="tablet" className={className} label="BlueCare child communication board">
      <div className="bg-child-bg flex aspect-[4/3] flex-col">
        {/* Sentence strip */}
        <div className="bg-bg-elevated border-border flex items-center gap-3 border-b px-5 py-4">
          <span className="text-fg-subtle text-xs font-medium uppercase tracking-wide">
            {isAr ? 'الجملة' : 'Sentence'}
          </span>
          <div className="flex flex-1 items-center gap-2 overflow-hidden">
            {sentence.map((s, i) => (
              <SentenceChip key={i} label={s.label} Icon={s.icon} />
            ))}
          </div>
          <button
            type="button"
            tabIndex={-1}
            aria-hidden="true"
            className="bg-primary text-primary-fg inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold shadow-sm"
          >
            <Volume2 aria-hidden="true" className="h-4 w-4" />
            {isAr ? 'استمع' : 'Speak'}
          </button>
        </div>

        {/* Categories rail + tile grid */}
        <div className="flex flex-1 overflow-hidden">
          <aside className="bg-bg-muted/50 flex flex-col gap-1 p-3">
            {categories.map((c) => {
              const Icon = c.icon;
              return (
                <button
                  key={c.en}
                  type="button"
                  tabIndex={-1}
                  aria-hidden="true"
                  className={cn(
                    'flex h-14 w-14 flex-col items-center justify-center gap-0.5 rounded-2xl transition-colors',
                    c.active
                      ? 'bg-primary text-primary-fg shadow-sm'
                      : 'bg-bg-elevated text-fg-muted',
                  )}
                >
                  <Icon aria-hidden="true" className="h-5 w-5" />
                  <span className="text-[10px] font-semibold leading-none">
                    {isAr ? c.ar : c.en}
                  </span>
                </button>
              );
            })}
          </aside>

          <div className="flex-1 p-4">
            <div className="grid h-full grid-cols-3 gap-3">
              {tiles.map((t, i) => (
                <Tile key={i} label={t.label} helper={t.helper} tone={t.tone as Tone} />
              ))}
            </div>
          </div>
        </div>

        {/* Bottom toolbar */}
        <div className="bg-bg-elevated border-border flex items-center justify-between border-t px-5 py-3">
          <button
            type="button"
            tabIndex={-1}
            aria-hidden="true"
            className="text-fg-muted inline-flex items-center gap-2 text-sm font-medium"
          >
            <ChevronLeft aria-hidden="true" className={cn('h-4 w-4', isAr && 'rotate-180')} />
            {isAr ? 'تراجع' : 'Back'}
          </button>
          <div className="text-fg-subtle text-xs">{isAr ? '٤ نجوم اليوم' : '4 stars today'}</div>
        </div>
      </div>
    </DeviceFrame>
  );
}

type Tone = 'blue' | 'mint' | 'sand';

function Tile({ label, helper, tone }: { label: string; helper: string; tone: Tone }) {
  const toneClasses: Record<Tone, string> = {
    blue: 'bg-primary/10 ring-primary/30',
    mint: 'bg-accent/30 ring-accent/40',
    sand: 'bg-secondary/40 ring-secondary/40',
  };
  return (
    <div
      role="presentation"
      className={cn(
        'border-child-tile-border bg-child-tile flex aspect-square flex-col items-center justify-center gap-1 rounded-2xl border p-2 ring-2 ring-inset',
        toneClasses[tone],
      )}
    >
      <div className={cn('grid h-12 w-12 place-items-center rounded-xl', toneClasses[tone])}>
        {/* Stylized pictogram silhouette — a soft circle with two highlights */}
        <svg viewBox="0 0 32 32" className="text-fg h-7 w-7" aria-hidden="true">
          <circle cx="16" cy="13" r="6" fill="currentColor" opacity="0.85" />
          <rect x="8" y="20" width="16" height="8" rx="4" fill="currentColor" opacity="0.85" />
        </svg>
      </div>
      <span className="text-fg text-base font-semibold leading-tight">{label}</span>
      <span className="text-fg-subtle text-[10px]">{helper}</span>
    </div>
  );
}

function SentenceChip({
  label,
  Icon,
}: {
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <span className="border-border bg-bg text-fg flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium">
      <Icon aria-hidden="true" className="text-primary h-3.5 w-3.5" />
      {label}
    </span>
  );
}
