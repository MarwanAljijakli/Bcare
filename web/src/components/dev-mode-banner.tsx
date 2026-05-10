'use client';

import { AlertTriangle } from 'lucide-react';
import { useEffect } from 'react';

/**
 * DevModeBanner — loud, unmissable visual indicator that auth bypass is
 * active. Renders ONLY when `NEXT_PUBLIC_AUTH_BYPASS=1`. Sticky at the
 * very top of the viewport, above every other surface (modals, toasts,
 * etc.). Yellow/black diagonal-stripe pattern, 32px tall, never
 * dismissible.
 *
 * Module 2.A.1.bypass owner: this exists so a developer cannot forget
 * the project is in bypass mode and accidentally promote a build to a
 * real user-facing launch. Pre-launch checklist in docs/runbook.md
 * removes the env var that toggles this banner; if the banner is gone,
 * bypass is off.
 */

const BYPASS_FLAG = process.env.NEXT_PUBLIC_AUTH_BYPASS;

export function DevModeBanner() {
  const active = BYPASS_FLAG === '1';

  useEffect(() => {
    if (!active) return;
    // Loud console reminder on every page navigation. console.warn is on
    // the web package's allow-list (only `console.log` is forbidden).
    console.warn(
      '⚠️  BlueCare DEV MODE — auth bypass is ACTIVE. All visitors are signed in as the test caregiver. Flip OFF before market launch (see docs/runbook.md).',
    );
  }, [active]);

  if (!active) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      // Inline styles instead of Tailwind so the banner cannot be hidden
      // by an accidental utility-class collision deeper in the tree.
      style={{
        position: 'sticky',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 2147483647, // i32 max — guaranteed above modals/toasts
        height: '32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        background:
          'repeating-linear-gradient(135deg, #facc15 0px, #facc15 14px, #1f1f1f 14px, #1f1f1f 28px)',
        color: '#1f1f1f',
        fontSize: '12px',
        fontWeight: 800,
        textShadow: '0 0 4px #facc15, 0 0 4px #facc15',
        letterSpacing: '0.02em',
        userSelect: 'none',
      }}
      data-testid="dev-mode-banner"
    >
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '0 12px',
          background: '#facc15',
          height: '100%',
        }}
      >
        <AlertTriangle aria-hidden="true" size={16} strokeWidth={3} />
        DEV MODE — Auth bypass is ON. All visitors are signed in as Test Caregiver. NEVER deploy
        this to production for real users.
      </span>
    </div>
  );
}
