import { useLocale } from 'next-intl';
import type { AppLocale } from '@/i18n/routing';
import { cn } from '@/lib/cn';

/**
 * Brand mark — the heart / child / puzzle image, optionally paired with the
 * locale-aware "BlueCare" / "بلوكير" wordmark.
 *
 * Sizes follow a 4-step scale: sm 24px, md 32px, lg 48px, xl 64px. The mark
 * height is fixed; its width is auto so the image keeps its natural aspect.
 * Pass `wordmark="auto"` to render the horizontal lockup; the wordmark
 * follows the active locale (Arabic on the leading edge in RTL contexts).
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
  const markWidth = Math.round(px * (NATURAL_W / NATURAL_H));
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
      <img
        src="/brand/logo-mark.png"
        alt=""
        width={markWidth}
        height={px}
        decoding="async"
        loading="eager"
        style={{ height: px, width: 'auto' }}
      />
      {showWordmark && <Wordmark locale={locale} px={px} />}
    </span>
  );
}

function Wordmark({ locale, px }: { locale: AppLocale; px: number }) {
  // Wordmark height matches the mark; width auto. Color uses currentColor so
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
const NATURAL_W = 593;
const NATURAL_H = 435;
