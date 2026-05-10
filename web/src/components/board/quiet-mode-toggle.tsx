'use client';

import { Moon, Sun } from 'lucide-react';
import { cn } from '@/lib/cn';

/**
 * Quiet mode toggle. When on, the board strips all non-essential
 * animation + audio: speak button stops pulsing, sentence-strip layout
 * animation is disabled, and TTS volume is dropped to 0.6.
 *
 * State lives in the parent; this is the visual switch.
 */

interface QuietModeToggleProps {
  on: boolean;
  onChange: (on: boolean) => void;
  labelOn: string;
  labelOff: string;
}

export function QuietModeToggle({ on, onChange, labelOn, labelOff }: QuietModeToggleProps) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      aria-pressed={on}
      data-testid="quiet-mode-toggle"
      className={cn(
        'focus-visible:ring-ring inline-flex h-10 items-center gap-2 rounded-full border-2 px-4 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-offset-2',
        on
          ? 'border-primary/40 bg-primary/10 text-primary'
          : 'border-border text-fg-muted bg-bg-elevated hover:text-fg',
      )}
    >
      {on ? (
        <Moon aria-hidden="true" className="h-4 w-4" />
      ) : (
        <Sun aria-hidden="true" className="h-4 w-4" />
      )}
      {on ? labelOn : labelOff}
    </button>
  );
}
