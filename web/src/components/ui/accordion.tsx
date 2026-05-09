'use client';

import { ChevronDown } from 'lucide-react';
import { type ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * Native `<details>`/`<summary>` accordion. Fully keyboard-accessible by
 * default, no JS required, works with screen readers out of the box. We
 * drop in our own chevron rotation via the [open] selector.
 *
 * Each item is independently collapsible — that's what we want for FAQs,
 * and it stays within the "no new dependencies in Module 1" constraint.
 */

export function Accordion({
  type: _type,
  collapsible: _collapsible,
  className,
  children,
}: {
  type?: 'single' | 'multiple';
  collapsible?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return <div className={className}>{children}</div>;
}

export function AccordionItem({
  value: _value,
  className,
  children,
}: {
  value?: string;
  className?: string;
  children: ReactNode;
}) {
  return <details className={cn('border-border group border-b', className)}>{children}</details>;
}

export function AccordionTrigger({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <summary
      className={cn(
        'group/trigger text-fg flex flex-1 cursor-pointer list-none items-center justify-between gap-4 py-5 text-start text-base font-semibold transition-colors',
        'hover:text-primary',
        'focus-visible:ring-ring rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        '[&::-webkit-details-marker]:hidden',
        className,
      )}
    >
      {children}
      <ChevronDown
        aria-hidden="true"
        className="text-fg-subtle h-4 w-4 shrink-0 transition-transform duration-200 group-open:rotate-180"
      />
    </summary>
  );
}

export function AccordionContent({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn('text-fg-muted pb-5 pe-2 text-base leading-relaxed', className)}>
      {children}
    </div>
  );
}
