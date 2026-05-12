/**
 * Auth bypass — REMOVED in Phase 10.C.
 *
 * The dev-only bypass mode (formerly Module 2.A.1.bypass) was deleted at
 * production launch. This module is retained as a no-op shim so any
 * stragger imports keep compiling — every function now returns `false`
 * / `null`. The bypass env vars are removed from every Vercel scope and
 * from .env.example.
 *
 * Real authentication: email + password with one-shot verification
 * email. Signup -> /api/auth/signup -> /auth/callback -> /onboarding.
 *
 * See docs/runbook.md § "Standard production operations" for the
 * current auth posture.
 */

/** Always false in production. Kept for back-compat with old imports. */
export function isAuthBypassActive(): boolean {
  return false;
}

/** Always null in production. Kept for back-compat with old imports. */
export function bypassUserId(): string | null {
  return null;
}

/** Always false in production. */
export function isAuthBypassFlagged(): boolean {
  return false;
}

/** Reserved email for the historical dev caregiver. The auth.users row
 *  remains in the database with the `caregiver` role (the
 *  revoke-dev-admin script demoted it) so a support engineer can still
 *  log into the test account via a password reset if needed. */
export const DEV_CAREGIVER_EMAIL = 'dev-caregiver@bluecare.test';
