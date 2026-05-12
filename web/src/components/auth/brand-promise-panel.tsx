'use client';

import { Quote } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Logo } from '@/components/brand/logo';
import { MockChildBoard } from '@/components/marketing/mock-child-board';
import { cn } from '@/lib/cn';
import { useReducedMotion } from '@/lib/motion';

/**
 * The right-column brand panel on /signup and /login. Calm gradient using
 * brand-blue + mint, the BlueCare wordmark, a rotating testimonial line,
 * and a small mock child board so visitors see the product they're about
 * to use.
 *
 * Hidden below lg (collapses to nothing — the form column fills the full
 * viewport on smaller screens). Rotation respects prefers-reduced-motion:
 * when reduced, the testimonial stays on the first line.
 */

const TESTIMONIAL_INTERVAL_MS = 6_000;

export function BrandPromisePanel() {
  return (
    <aside
      // Right column on lg+; flexbox-reversed in RTL so visually it lands on
      // the leading-aside edge in both directions (form column anchored
      // toward the leading-content edge).
      className="bg-primary text-primary-fg relative isolate hidden overflow-hidden lg:flex lg:flex-col lg:items-stretch lg:justify-between"
      aria-hidden="false"
    >
      {/* Soft conic gradient with a touch of mint; subtle dot pattern
          overlay using radial-gradient for a hand-made feel without an
          external asset. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            'linear-gradient(140deg, var(--color-primary) 0%, color-mix(in oklab, var(--color-primary) 70%, var(--color-child-accent)) 60%, color-mix(in oklab, var(--color-primary) 30%, var(--color-child-accent)) 100%)',
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 opacity-25"
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.55) 1px, transparent 0)',
          backgroundSize: '22px 22px',
        }}
      />

      <PanelHeader />
      <PanelMiddle />
      <PanelFooter />
    </aside>
  );
}

function PanelHeader() {
  const t = useTranslations('marketing.auth.shell');
  return (
    <div className="px-12 pt-12">
      <div className="text-primary inline-flex items-center gap-2 rounded-full bg-white px-4 py-1.5 text-sm font-semibold shadow-sm">
        <span aria-hidden="true" className="bg-primary h-2 w-2 rounded-full" />
        {t('panelEyebrow')}
      </div>
      <div className="mt-10">
        {/* Larger lockup; force a light scheme by passing through. */}
        <Logo size="xl" wordmark="auto" className="text-primary-fg" />
      </div>
    </div>
  );
}

function PanelMiddle() {
  return (
    <div className="flex flex-1 items-center px-12">
      <Testimonial />
    </div>
  );
}

function PanelFooter() {
  return (
    <div className="px-12 pb-12">
      <div className="rounded-3xl bg-white/10 p-3 shadow-2xl backdrop-blur">
        <MockChildBoard />
      </div>
    </div>
  );
}

function Testimonial() {
  const t = useTranslations('marketing.auth.shell');
  // next-intl exposes raw arrays via useMessages; we read three keys directly
  // to keep the type narrow without a separate getter.
  const lines = [t('testimonials.0'), t('testimonials.1'), t('testimonials.2')];
  const [index, setIndex] = useState(0);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) return;
    const id = window.setInterval(
      () => setIndex((i) => (i + 1) % lines.length),
      TESTIMONIAL_INTERVAL_MS,
    );
    return () => window.clearInterval(id);
  }, [reduced, lines.length]);

  const active = lines[reduced ? 0 : index] ?? lines[0]!;

  return (
    <figure className="max-w-md">
      <Quote aria-hidden="true" className="text-primary-fg/60 mb-6 h-10 w-10 shrink-0" />
      <blockquote
        // role="status" + aria-live polite: screen readers announce the
        // rotation calmly, never urgently.
        role="status"
        aria-live="polite"
        className="text-balance text-2xl font-semibold leading-snug tracking-tight md:text-3xl"
      >
        {active}
      </blockquote>
      <figcaption className="text-primary-fg/80 mt-4 text-sm font-medium">
        {t('testimonialAttribution')}
      </figcaption>

      {/* Subtle dot indicators — tap to jump to a specific testimonial. */}
      {!reduced && (
        <div className="mt-6 flex items-center gap-2" aria-label="testimonial pager">
          {lines.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Show testimonial ${i + 1}`}
              aria-pressed={i === index}
              onClick={() => setIndex(i)}
              className={cn(
                'focus-visible:ring-primary-fg/70 group inline-flex h-6 min-w-[24px] items-center justify-center rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent',
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  'block h-1.5 rounded-full transition-all',
                  i === index
                    ? 'bg-primary-fg w-8'
                    : 'bg-primary-fg/40 group-hover:bg-primary-fg/60 w-3',
                )}
              />
            </button>
          ))}
        </div>
      )}
    </figure>
  );
}
