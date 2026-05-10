'use client';

import { Mic, MicOff } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/cn';

/**
 * Hold-to-speak button. Uses pointerdown / pointerup so it works for
 * touch + mouse + pen with the same handler.
 *
 * The actual recognizer is invoked by the parent via `onStart`/`onStop`;
 * this component is purely the visual + interaction surface so the
 * recognizer-mocking story can render the button in every state.
 *
 * Auto-releases on pointercancel + on Escape so a touch that drifts off
 * the button doesn't leave the recognizer hanging.
 */

interface HoldToSpeakButtonProps {
  onStart: () => void;
  onStop: () => void;
  available: boolean;
  listening: boolean;
  label: string;
  unavailableLabel: string;
}

export function HoldToSpeakButton({
  onStart,
  onStop,
  available,
  listening,
  label,
  unavailableLabel,
}: HoldToSpeakButtonProps) {
  const [pressed, setPressed] = useState(false);

  function press() {
    if (!available || pressed) return;
    setPressed(true);
    onStart();
  }

  function release() {
    if (!pressed) return;
    setPressed(false);
    onStop();
  }

  return (
    <button
      type="button"
      disabled={!available}
      onPointerDown={press}
      onPointerUp={release}
      onPointerCancel={release}
      onPointerLeave={release}
      onKeyDown={(e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          press();
        } else if (e.key === 'Escape') {
          release();
        }
      }}
      onKeyUp={(e) => {
        if (e.key === ' ' || e.key === 'Enter') release();
      }}
      aria-pressed={listening}
      aria-disabled={!available || undefined}
      data-testid="hold-to-speak"
      className={cn(
        'focus-visible:ring-ring inline-flex h-12 items-center justify-center gap-2 rounded-full border-2 px-5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-offset-2',
        listening
          ? 'border-primary bg-primary text-primary-fg'
          : 'border-border bg-bg-elevated text-fg hover:border-primary/40',
        !available && 'cursor-not-allowed opacity-60',
      )}
    >
      {available ? (
        <Mic className="h-4 w-4" aria-hidden="true" />
      ) : (
        <MicOff className="h-4 w-4" aria-hidden="true" />
      )}
      {available ? label : unavailableLabel}
    </button>
  );
}
