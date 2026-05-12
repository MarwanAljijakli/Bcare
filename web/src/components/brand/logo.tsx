import { useLocale } from 'next-intl';
import type { AppLocale } from '@/i18n/routing';
import { cn } from '@/lib/cn';

/**
 * Brand mark — the speech-bubble + heart-arc glyph in two colors. Renders
 * inline so it inherits CSS vars and theme switches (no img request).
 *
 * Sizes follow a 4-step scale: sm 24px, md 32px, lg 48px, xl 64px. Use
 * `wordmark="auto"` to get a horizontal lockup that respects the active
 * locale (Arabic on the leading edge in RTL).
 */
export function Logo({
  size = 'md',
  wordmark = 'none',
  className,
}: {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  wordmark?: 'none' | 'auto';
  className?: string;
}) {
  const locale = useLocale() as AppLocale;
  const px = SIZE_PX[size];
  const showWordmark = wordmark === 'auto';

  return (
    <span
      className={cn('inline-flex items-center gap-2 align-middle', className)}
      // Force LTR ordering inside the lockup; the locale-aware wordmark
      // renders the right script and orientation. This prevents the rare
      // case where the parent `dir=rtl` would mirror the entire lockup.
      dir="ltr"
      aria-hidden="true"
    >
      <Mark px={px} />
      {showWordmark && <Wordmark locale={locale} px={px} />}
    </span>
  );
}

function Mark({ px }: { px: number }) {
  return (
    <svg width={px} height={px} viewBox="0 0 64 64" role="presentation" focusable="false">
      <path
        fill="var(--color-primary)"
        d="M32 6c12.703 0 23 9.402 23 21 0 11.598-10.297 21-23 21a26.5 26.5 0 0 1-7.5-1.07L13.6 51.55a1.7 1.7 0 0 1-2.232-2.07l2.78-7.42C10.96 38.39 9 33.32 9 27 9 15.402 19.297 6 32 6Z"
      />
      <path
        fill="var(--color-child-accent)"
        d="M32 38.5c-1.05-.97-3.7-2.94-6-5.32-2.5-2.6-3.94-5-3.94-7.4 0-2.74 2.18-4.78 4.85-4.78 1.94 0 3.65 1.07 4.45 2.7.13.27.55.27.68 0 .8-1.63 2.51-2.7 4.45-2.7 2.67 0 4.85 2.04 4.85 4.78 0 2.4-1.44 4.8-3.94 7.4-2.3 2.38-4.95 4.35-6 5.32a.63.63 0 0 1-.84 0Z"
      />
    </svg>
  );
}

function Wordmark({ locale, px }: { locale: AppLocale; px: number }) {
  // Wordmark height matches the mark; width auto. Color uses --color-fg so
  // the wordmark stays legible on every theme.
  const height = Math.round(px * 0.75);
  if (locale === 'ar') {
    return (
      <span
        lang="ar"
        dir="rtl"
        className="font-arabic text-[color:currentColor]"
        style={{ fontSize: height, fontWeight: 700, lineHeight: 1, letterSpacing: 0 }}
      >
        بلوكير
      </span>
    );
  }
  return (
    <span
      lang="en"
      className="text-[color:currentColor]"
      style={{
        fontSize: height,
        fontWeight: 600,
        lineHeight: 1,
        letterSpacing: '-0.01em',
      }}
    >
      BlueCare
    </span>
  );
}

const SIZE_PX = { sm: 24, md: 32, lg: 48, xl: 64 } as const;
