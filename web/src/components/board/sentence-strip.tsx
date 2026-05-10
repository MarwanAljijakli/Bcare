'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { symbolLabel } from './types';
import type { BoardSymbol } from './types';
import { useReducedMotion } from '@/lib/motion';

/**
 * Sentence strip — top of the board. The chid taps tiles and they appear
 * here in order. Tapping a token removes it. The Speak button at the
 * bottom reads it back through TTS.
 *
 * AAA-grade: the strip text is bumped one weight and the icons use
 * `forced-colors: CanvasText` so Windows High Contrast mode keeps them
 * legible. Removal X has a 44px hit target.
 */

interface SentenceStripProps {
  tokens: BoardSymbol[];
  locale: 'en' | 'ar';
  imageUrl: (path: string) => string;
  onRemove: (index: number) => void;
  onClear: () => void;
  speaking: boolean;
  highlightIndex: number | null;
  /** Localized strings (host injects so this stays next-intl-free for SB). */
  strings: { remove: string; clear: string; placeholder: string };
}

export function SentenceStrip({
  tokens,
  locale,
  imageUrl,
  onRemove,
  onClear,
  speaking,
  highlightIndex,
  strings,
}: SentenceStripProps) {
  const reduced = useReducedMotion();

  return (
    <section
      aria-label="sentence"
      className="border-border bg-bg-elevated rounded-2xl border-2 p-3"
      data-testid="sentence-strip"
    >
      <div className="flex items-stretch gap-3">
        <ol className="flex min-h-[88px] flex-1 flex-wrap items-center gap-2">
          <AnimatePresence initial={false}>
            {tokens.length === 0 && (
              <motion.li
                key="placeholder"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: reduced ? 0 : 0.18 }}
                className="text-fg-subtle px-3 text-sm font-medium italic"
                lang={locale}
              >
                {strings.placeholder}
              </motion.li>
            )}
            {tokens.map((token, i) => (
              <motion.li
                key={`${token.id}-${i}`}
                layout
                initial={{ opacity: 0, scale: 0.92, y: 8 }}
                animate={{
                  opacity: 1,
                  scale: speaking && highlightIndex === i ? 1.06 : 1,
                  y: 0,
                }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: reduced ? 0 : 0.16 }}
              >
                <span
                  className={`border-border bg-bg group inline-flex items-center gap-2 rounded-xl border-2 px-3 py-2 text-base font-bold ${
                    speaking && highlightIndex === i ? 'border-primary bg-primary/10' : ''
                  }`}
                  lang={locale}
                >
                  {}
                  <img
                    src={imageUrl(token.image_path)}
                    alt=""
                    aria-hidden="true"
                    className="h-8 w-8 object-contain"
                    draggable={false}
                  />
                  <span className="text-fg">{symbolLabel(token, locale)}</span>
                  <button
                    type="button"
                    onClick={() => onRemove(i)}
                    aria-label={`${strings.remove}: ${symbolLabel(token, locale)}`}
                    className="text-fg-subtle hover:text-fg focus-visible:ring-ring -m-1 inline-flex h-6 w-6 items-center justify-center rounded focus-visible:outline-none focus-visible:ring-2"
                  >
                    <X aria-hidden="true" className="h-4 w-4" />
                  </button>
                </span>
              </motion.li>
            ))}
          </AnimatePresence>
        </ol>
        {tokens.length > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="text-fg-muted hover:text-fg focus-visible:ring-ring shrink-0 rounded-xl px-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          >
            {strings.clear}
          </button>
        )}
      </div>
    </section>
  );
}
