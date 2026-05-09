'use client';

import { useEffect, useState } from 'react';

/**
 * SSR-safe `prefers-reduced-motion` hook. Returns `true` when the user has
 * requested reduced motion at the OS level. Defaults to `false` during SSR so
 * the first paint matches the post-hydration paint for users without the
 * preference (the common case); users who do prefer reduced motion will see
 * one quick re-render which is acceptable per WCAG 2.3.3 guidance.
 *
 * Components using motion MUST gate every animation on this hook (or the CSS
 * `prefers-reduced-motion: reduce` rule in globals.css, but JS-driven motion
 * needs the hook).
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mql.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  return reduced;
}

/** Scale factor for child-tile press: 1 when reduced-motion, 1.04 otherwise. */
export function pressScale(reduced: boolean): number {
  return reduced ? 1 : 1.04;
}
