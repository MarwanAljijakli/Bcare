'use client';

import { Mic, MicOff, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/cn';

/**
 * Hold-to-speak button. Uses pointerdown / pointerup so it works for
 * touch + mouse + pen with the same handler.
 *
 * Phase 10.B — sequential UX states:
 *
 *   idle        → "Hold to speak"      (mic icon, neutral)
 *   listening   → "Listening…"          (mic icon, primary fill)
 *   transcribing→ "Transcribing…"       (spinner, primary fill)
 *
 * The parent owns the state via `state` instead of a single `listening`
 * boolean, so the user sees clear progress (record → upload → result)
 * rather than a single all-encompassing "listening" period.
 */

export type HoldToSpeakState = 'idle' | 'listening' | 'transcribing';

interface HoldToSpeakButtonProps {
  onStart: () => void;
  onStop: () => void;
  available: boolean;
  state: HoldToSpeakState;
  label: string;
  unavailableLabel: string;
  /** "Listening…" — shown while the mic is recording. */
  listeningLabel: string;
  /** "Transcribing…" — shown while Whisper is processing. */
  transcribingLabel: string;
}

export function HoldToSpeakButton({
  onStart,
  onStop,
  available,
  state,
  label,
  unavailableLabel,
  listeningLabel,
  transcribingLabel,
}: HoldToSpeakButtonProps) {
  const [pressed, setPressed] = useState(false);
  const listening = state === 'listening';
  const transcribing = state === 'transcribing';
  const active = listening || transcribing;

  function press() {
    if (!available || pressed || active) return;
    setPressed(true);
    onStart();
  }

  function release() {
    if (!pressed) return;
    setPressed(false);
    onStop();
  }

  let displayLabel = label;
  if (!available) displayLabel = unavailableLabel;
  else if (listening) displayLabel = listeningLabel;
  else if (transcribing) displayLabel = transcribingLabel;

  return (
    <button
      type="button"
      disabled={!available || transcribing}
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
      aria-busy={transcribing || undefined}
      aria-disabled={!available || transcribing || undefined}
      data-testid="hold-to-speak"
      data-state={state}
      className={cn(
        'focus-visible:ring-ring inline-flex h-12 items-center justify-center gap-2 rounded-full border-2 px-5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-offset-2',
        active
          ? 'border-primary bg-primary text-primary-fg'
          : 'border-border bg-bg-elevated text-fg hover:border-primary/40',
        (!available || transcribing) && 'cursor-not-allowed',
        !available && 'opacity-60',
      )}
    >
      {!available ? (
        <MicOff className="h-4 w-4" aria-hidden="true" />
      ) : transcribing ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      ) : (
        <Mic className="h-4 w-4" aria-hidden="true" />
      )}
      {displayLabel}
    </button>
  );
}
