'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Star } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useReducedMotion } from '@/lib/motion';

/**
 * Soft 200ms milestone celebration. A single Star icon scales from 0
 * to 1 and back. Auto-dismisses after 1200ms. Triggered when the
 * caller bumps `key` (a fresh value forces a remount).
 *
 * Calm-first design constraints:
 *   • prefers-reduced-motion → skip the animation entirely; render
 *     nothing. Caregivers who set this on the OS get a silent
 *     experience.
 *   • child's quiet mode → caller passes `silent` to skip render too.
 *   • One celebration at a time. The component manages its own
 *     dismiss timer; rapid taps just reset.
 *   • No leaderboards, no comparison, no time pressure.
 */

interface StarCelebrationProps {
  triggerKey: number;
  silent?: boolean;
  /** Localized "Nice!" / "أحسنت!" caption. */
  caption?: string;
}

export function StarCelebration({ triggerKey, silent, caption }: StarCelebrationProps) {
  const reduced = useReducedMotion();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (triggerKey === 0) return;
    if (reduced || silent) return;
    setVisible(true);
    const id = window.setTimeout(() => setVisible(false), 1200);
    return () => window.clearTimeout(id);
  }, [triggerKey, reduced, silent]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key={triggerKey}
          role="status"
          aria-live="polite"
          aria-label={caption}
          className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <motion.div
            className="bg-bg-elevated/90 border-warning/40 text-warning flex items-center gap-2 rounded-2xl border-2 px-5 py-3 shadow-lg backdrop-blur"
            initial={{ scale: 0.6, y: 12, opacity: 0 }}
            animate={{ scale: [0.6, 1.04, 1], y: 0, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ duration: 0.22 }}
          >
            <Star aria-hidden="true" className="h-6 w-6 fill-current" />
            {caption && <span className="text-fg text-sm font-bold">{caption}</span>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
