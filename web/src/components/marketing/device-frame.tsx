import { type ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * A subtle "device" frame around mock product screens. Used on marketing
 * pages to make the screenshots read as product without being skeuomorphic.
 *
 * Two variants: `tablet` (rounded thick bezel, suits the child board) and
 * `desktop` (thinner top chrome, suits the dashboard).
 */
export function DeviceFrame({
  children,
  variant = 'tablet',
  className,
  label,
}: {
  children: ReactNode;
  variant?: 'tablet' | 'desktop';
  className?: string;
  label?: string;
}) {
  return (
    <div
      role={label ? 'img' : undefined}
      aria-label={label}
      className={cn(
        'border-border bg-bg-elevated relative overflow-hidden border shadow-xl',
        variant === 'tablet' ? 'rounded-[2.25rem] p-3' : 'rounded-xl p-1.5',
        className,
      )}
    >
      {variant === 'desktop' && (
        <div className="bg-bg-muted -mx-1.5 -mt-1.5 mb-2 flex h-7 items-center gap-2 px-3">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-300/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-300/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-300/70" />
        </div>
      )}
      <div
        className={cn('overflow-hidden', variant === 'tablet' ? 'rounded-[1.5rem]' : 'rounded-md')}
      >
        {children}
      </div>
    </div>
  );
}
