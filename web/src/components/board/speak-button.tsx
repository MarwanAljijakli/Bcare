'use client';

import { motion } from 'framer-motion';
import { Volume2, Loader2, Zap } from 'lucide-react';
import { useReducedMotion } from '@/lib/motion';

/**
 * Bottom-center Speak button. Press → reads the sentence through TTS.
 *
 * Phase 10.A polish:
 *   • The wrapping `motion.button` fires its press animation IMMEDIATELY
 *     (whileTap) — the user sees the button react before the network
 *     request even leaves the browser. The audio still arrives at the
 *     speed of the cache (or ElevenLabs); the perceived latency is the
 *     animation, not the round-trip.
 *   • `cachedHint` adds a subtle ⚡ "instant" badge when the last speak
 *     came back from the cache. Helps caregivers + therapists see when
 *     pre-warm is working without opening DevTools.
 *
 * Disabled when the sentence is empty — but still keyboard-focusable so
 * screen-reader users land on it and hear the explainer.
 */

interface SpeakButtonProps {
  speaking: boolean;
  disabled: boolean;
  quietMode: boolean;
  onClick: () => void;
  label: string;
  speakingLabel: string;
  emptyLabel: string;
  /** True when the most-recent speak resolved from cache. Drives the
   *  small ⚡ Instant indicator next to the button. */
  cachedHint?: boolean;
  /** "Instant" / "فوري" — bilingual badge text. */
  cachedHintLabel?: string;
}

export function SpeakButton({
  speaking,
  disabled,
  quietMode,
  onClick,
  label,
  speakingLabel,
  emptyLabel,
  cachedHint,
  cachedHintLabel,
}: SpeakButtonProps) {
  const reduced = useReducedMotion();
  const animate = reduced || quietMode ? {} : speaking ? { scale: [1, 1.04, 1] } : { scale: 1 };

  return (
    <div className="flex flex-col items-center justify-center gap-1.5 pb-6 pt-3">
      <motion.button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-disabled={disabled || undefined}
        aria-live="polite"
        animate={animate}
        transition={{ duration: 0.6, repeat: speaking ? Infinity : 0 }}
        whileTap={reduced || quietMode ? {} : { scale: 0.94 }}
        className="bg-primary text-primary-fg hover:bg-primary-hover focus-visible:ring-ring disabled:bg-bg-muted disabled:text-fg-subtle inline-flex h-16 min-w-[200px] items-center justify-center gap-3 rounded-full px-8 text-lg font-bold shadow-lg transition-shadow focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-offset-2 active:shadow-md disabled:cursor-not-allowed disabled:shadow-none"
        data-testid="speak-button"
      >
        {speaking ? (
          <Loader2 aria-hidden="true" className="h-6 w-6 animate-spin" />
        ) : (
          <Volume2 aria-hidden="true" className="h-6 w-6" />
        )}
        <span>{disabled ? emptyLabel : speaking ? speakingLabel : label}</span>
      </motion.button>
      {cachedHint && !disabled && !speaking && (
        <span
          role="status"
          aria-live="polite"
          className="text-fg-subtle inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide"
          data-testid="speak-button-cached"
        >
          <Zap aria-hidden="true" className="h-3 w-3" />
          {cachedHintLabel ?? 'Instant'}
        </span>
      )}
    </div>
  );
}
