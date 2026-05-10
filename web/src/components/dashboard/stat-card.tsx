import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * Single stat card — a Linear-grade stat tile. Big number, calm sublabel,
 * optional icon. Used in the dashboard hero row and the streak callout.
 *
 * Pure server component; no JS shipped to the client.
 */
export function StatCard({
  label,
  value,
  sublabel,
  icon,
  tone = 'default',
  testId,
}: {
  label: string;
  value: string;
  sublabel?: string;
  icon?: ReactNode;
  tone?: 'default' | 'accent';
  testId?: string;
}) {
  return (
    <div
      data-testid={testId}
      className={cn(
        'border-border bg-bg-elevated relative flex h-full flex-col gap-2 rounded-2xl border p-5 shadow-sm',
        tone === 'accent' && 'border-primary/30 bg-primary/5',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-fg-subtle text-xs font-semibold uppercase tracking-wide">
          {label}
        </span>
        {icon ? (
          <span
            aria-hidden="true"
            className={cn(
              'grid h-8 w-8 place-items-center rounded-lg',
              tone === 'accent' ? 'text-primary bg-primary/10' : 'text-fg-muted bg-bg-muted',
            )}
          >
            {icon}
          </span>
        ) : null}
      </div>
      <div className="text-fg text-3xl font-bold tabular-nums leading-tight tracking-tight md:text-4xl">
        {value}
      </div>
      {sublabel ? <p className="text-fg-muted text-xs leading-relaxed">{sublabel}</p> : null}
    </div>
  );
}
