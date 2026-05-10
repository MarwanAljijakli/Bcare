/**
 * Auth bypass — Module 2.A.1.bypass.
 *
 * When `AUTH_BYPASS_USER_ID` is set, every visitor is auto-signed-in as
 * the matching test caregiver. RLS stays fully enforced — we are
 * skipping the human auth step (email handshake), NOT the database
 * security model. Used during Modules 6–9 buildout so every page is
 * testable in a real browser without email-loop ceremony.
 *
 * Flip OFF before market launch — see docs/runbook.md
 * § "Pre-launch auth re-enablement checklist."
 *
 * The bypass user ID itself is NEVER exposed client-side. Only the
 * boolean `NEXT_PUBLIC_AUTH_BYPASS=1` is public so the loud DevModeBanner
 * can render.
 */

const SERVER_BYPASS_ENV = 'AUTH_BYPASS_USER_ID';
const PUBLIC_FLAG_ENV = 'NEXT_PUBLIC_AUTH_BYPASS';

/** Server-side: true when AUTH_BYPASS_USER_ID is set (and non-empty). */
export function isAuthBypassActive(): boolean {
  const id = process.env[SERVER_BYPASS_ENV];
  return !!id && id.trim().length > 0;
}

/** Server-only: returns the bypass user UUID, or null when not active.
 *  NEVER expose this value to the client. */
export function bypassUserId(): string | null {
  const id = process.env[SERVER_BYPASS_ENV];
  if (!id || id.trim().length === 0) return null;
  return id.trim();
}

/** Client-or-server: matches the public flag exposed to the browser.
 *  Used by the DevModeBanner; keeps the user-id env var secret. */
export function isAuthBypassFlagged(): boolean {
  return process.env[PUBLIC_FLAG_ENV] === '1';
}

/** Reserved email for the dev test caregiver. Any logic that needs to
 *  identify the test user goes through this constant. */
export const DEV_CAREGIVER_EMAIL = 'dev-caregiver@bluecare.test';
