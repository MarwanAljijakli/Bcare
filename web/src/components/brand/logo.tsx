import { cn } from '@/lib/cn';

/**
 * Brand mark — the heart / child / puzzle image. The mark is the whole
 * brand identity, so `wordmark` is accepted for backward compatibility but
 * no longer renders a separate text wordmark.
 *
 * Sizes follow a 4-step scale: sm 24px, md 32px, lg 48px, xl 64px. The
 * height is fixed; width is auto so the image keeps its natural aspect.
 */
export function Logo({
  size = 'md',
  wordmark: _wordmark = 'none',
  className,
}: {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  wordmark?: 'none' | 'auto';
  className?: string;
}) {
  const px = SIZE_PX[size];
  const width = Math.round(px * (NATURAL_W / NATURAL_H));

  return (
    <span
      className={cn('inline-flex items-center align-middle', className)}
      dir="ltr"
      aria-hidden="true"
    >
      <img
        src="/brand/logo-mark.png"
        alt=""
        width={width}
        height={px}
        decoding="async"
        loading="eager"
        style={{ height: px, width: 'auto' }}
      />
    </span>
  );
}

const SIZE_PX = { sm: 24, md: 32, lg: 48, xl: 64 } as const;
const NATURAL_W = 593;
const NATURAL_H = 435;
