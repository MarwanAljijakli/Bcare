/**
 * Session helpers — re-auth gate, current-user lookup, sign-out.
 *
 * "Re-auth required" routes (account export, account delete, consent
 * revoke, PIN reset) call `requireRecentAuth()` which rejects if the
 * session token is older than `RECENT_AUTH_WINDOW_MS` (5 minutes by
 * default). Users with an older session must re-authenticate via magic
 * link or password before the action proceeds.
 *
 * The check uses the JWT's `iat` claim which Supabase mints fresh on
 * every sign-in, password change, and refresh — so a stale long-lived
 * cookie can't be silently abused for sensitive operations.
 */

import { createSupabaseServerClient } from '@/lib/supabase/server';

/** Window after sign-in (or last password verification) during which
 *  sensitive actions are permitted without a fresh re-auth. */
export const RECENT_AUTH_WINDOW_MS = 5 * 60 * 1000;

export interface SessionInfo {
  userId: string;
  email: string | null;
  /** Unix epoch seconds, from the JWT `iat` claim. */
  issuedAtSec: number;
  /** Computed convenience: ms since the session was issued. */
  ageMs: number;
}

/**
 * Returns the current user + session age, or null if unauthenticated.
 * Never throws on missing session.
 */
export async function getSessionInfo(): Promise<SessionInfo | null> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return null;

    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData.session;
    // No active session → not signed in.
    if (!session) return null;

    // Decode the JWT iat. We don't verify the signature here — Supabase
    // already validated it at getSession-time; we just want the iat claim
    // for age computation. Token is `header.payload.signature` base64url.
    const parts = session.access_token.split('.');
    let issuedAtSec = Math.floor(Date.now() / 1000);
    if (parts.length === 3 && parts[1]) {
      try {
        const payload = JSON.parse(
          Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'),
        ) as { iat?: number };
        if (typeof payload.iat === 'number') issuedAtSec = payload.iat;
      } catch {
        // Best-effort; if decode fails we treat the session as just-issued.
      }
    }

    return {
      userId: userData.user.id,
      email: userData.user.email ?? null,
      issuedAtSec,
      ageMs: Date.now() - issuedAtSec * 1000,
    };
  } catch {
    return null;
  }
}

/** Throws if no session OR if the session is older than the recent window. */
export async function requireRecentAuth(): Promise<SessionInfo> {
  const info = await getSessionInfo();
  if (!info) throw new SessionError('not_signed_in');
  if (info.ageMs > RECENT_AUTH_WINDOW_MS) throw new SessionError('reauth_required');
  return info;
}

/** Throws if no session, regardless of age. Use for ordinary auth gates. */
export async function requireAuth(): Promise<SessionInfo> {
  const info = await getSessionInfo();
  if (!info) throw new SessionError('not_signed_in');
  return info;
}

export class SessionError extends Error {
  constructor(public code: 'not_signed_in' | 'reauth_required') {
    super(code);
    this.name = 'SessionError';
  }
}
