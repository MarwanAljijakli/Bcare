import { type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * Vertical section rhythm. Used by every marketing page so the rhythm stays
 * consistent without each page guessing at padding values.
 */
export function Section({
  children,
  tone = 'default',
  className,
  ...rest
}: HTMLAttributes<HTMLElement> & {
  tone?: 'default' | 'muted' | 'primary';
  children: ReactNode;
}) {
  return (
    <section
      className={cn(
        'py-20 md:py-28',
        tone === 'muted' && 'bg-bg-muted',
        tone === 'primary' && 'bg-primary text-primary-fg',
        className,
      )}
      {...rest}
    >
      <div className="container">{children}</div>
    </section>
  );
}

export function SectionHeader({
  eyebrow,
  title,
  subtitle,
  align = 'center',
  className,
}: {
  eyebrow?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  align?: 'start' | 'center';
  className?: string;
}) {
  return (
    <header
      className={cn('mb-12 max-w-2xl', align === 'center' && 'mx-auto text-center', className)}
    >
      {eyebrow && (
        <p className="text-primary mb-3 text-sm font-semibold uppercase tracking-wide">{eyebrow}</p>
      )}
      <h2 className="text-fg text-balance text-3xl font-bold leading-tight tracking-tight md:text-4xl">
        {title}
      </h2>
      {subtitle && (
        <p className="text-fg-muted mt-4 text-balance text-base leading-relaxed md:text-lg">
          {subtitle}
        </p>
      )}
    </header>
  );
}
