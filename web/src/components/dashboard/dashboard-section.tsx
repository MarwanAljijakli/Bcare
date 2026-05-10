import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * Generic section wrapper — heading slot + optional eyebrow + optional
 * action slot (e.g. a "View all" link). Keeps every dashboard panel's
 * spacing + typography consistent.
 */
export function DashboardSection({
  id,
  eyebrow,
  heading,
  description,
  action,
  className,
  children,
}: {
  id?: string;
  eyebrow?: string;
  heading: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const headingId = id ?? `dash-section-${heading.replace(/\s+/g, '-').toLowerCase()}`;
  return (
    <section
      aria-labelledby={headingId}
      className={cn(
        'border-border bg-bg-elevated rounded-2xl border p-5 shadow-sm md:p-6',
        className,
      )}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          {eyebrow ? (
            <p className="text-fg-subtle text-xs font-semibold uppercase tracking-wide">
              {eyebrow}
            </p>
          ) : null}
          <h2
            id={headingId}
            className="text-fg text-lg font-bold leading-tight tracking-tight md:text-xl"
          >
            {heading}
          </h2>
          {description ? (
            <p className="text-fg-muted mt-1 text-sm leading-relaxed">{description}</p>
          ) : null}
        </div>
        {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}
