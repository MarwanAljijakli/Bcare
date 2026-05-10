'use client';

import { motion } from 'framer-motion';
import { Volume2, Loader2 } from 'lucide-react';
import { useReducedMotion } from '@/lib/motion';

/**
 * Bottom-center Speak button. Press → reads the sentence through TTS.
 *
 * The wrapping `motion.button` does a very subtle 0.96 scale on press +
 * a 1.04 pulse while speaking. Both are gated by prefers-reduced-motion
 * and by the child's quiet mode (passed in via `quietMode`).
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
}

export function SpeakButton({
  speaking,
  disabled,
  quietMode,
  onClick,
  label,
  speakingLabel,
  emptyLabel,
}: SpeakButtonProps) {
  const reduced = useReducedMotion();
  const animate = reduced || quietMode ? {} : speaking ? { scale: [1, 1.04, 1] } : { scale: 1 };

  return (
    <div className="flex items-center justify-center pb-6 pt-3">
      <motion.button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-disabled={disabled || undefined}
        aria-live="polite"
        animate={animate}
        transition={{ duration: 0.6, repeat: speaking ? Infinity : 0 }}
        whileTap={reduced || quietMode ? {} : { scale: 0.96 }}
        className="bg-primary text-primary-fg hover:bg-primary-hover focus-visible:ring-ring disabled:bg-bg-muted disabled:text-fg-subtle inline-flex h-16 min-w-[200px] items-center justify-center gap-3 rounded-full px-8 text-lg font-bold shadow-lg focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:shadow-none"
        data-testid="speak-button"
      >
        {speaking ? (
          <Loader2 aria-hidden="true" className="h-6 w-6 animate-spin" />
        ) : (
          <Volume2 aria-hidden="true" className="h-6 w-6" />
        )}
        <span>{disabled ? emptyLabel : speaking ? speakingLabel : label}</span>
      </motion.button>
    </div>
  );
}
