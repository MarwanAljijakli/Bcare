/**
 * Double-submit-cookie CSRF protection.
 *
 * On every authenticated GET we set a `bcare-csrf` cookie containing a
 * 32-byte random token. Mutating requests must echo that same token in an
 * `x-csrf-token` header; the route handler compares them and rejects on
 * mismatch. The cookie is `httpOnly: false` (so the client can read it) but
 * `SameSite=Lax`-scoped which already blocks the cross-origin attack
 * vector — the header check is defense-in-depth for sites with sub-domain
 * takeover risk.
 *
 * Cookie name + header name + length are constants here so tests, the
 * client-side fetch wrapper, and route handlers all import the same values.
 */

import { cookies } from 'next/headers';
import { CSRF_COOKIE, CSRF_HEADER, CSRF_TOKEN_BYTES } from './csrf-shared';

// Re-export for ergonomics — server callers can import everything from
// this module; client callers must import from './csrf-shared' directly.
export { CSRF_COOKIE, CSRF_HEADER };
const TOKEN_BYTES = CSRF_TOKEN_BYTES;

/** Generate a fresh hex token (server-only — uses Web Crypto). */
export function generateCsrfToken(): string {
  const bytes = new Uint8Array(TOKEN_BYTES);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Read the CSRF token from cookies (server-only). Returns null if no token
 * has been set yet — the client should call `/api/csrf` to mint one.
 */
export async function readCsrfCookie(): Promise<string | null> {
  const store = await cookies();
  return store.get(CSRF_COOKIE)?.value ?? null;
}

/**
 * Set or refresh the CSRF cookie. Call from a server action or route
 * handler that returns a Response. The cookie is readable by the client
 * (so it can echo it in headers) but bound to first-party requests only.
 */
export async function ensureCsrfCookie(): Promise<string> {
  const store = await cookies();
  let token = store.get(CSRF_COOKIE)?.value;
  if (!token) {
    token = generateCsrfToken();
    store.set(CSRF_COOKIE, token, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });
  }
  return token;
}

/**
 * Verify a request's CSRF header matches the cookie. Throws on mismatch.
 * Call this at the very top of every mutating route handler.
 */
export async function verifyCsrf(request: Request): Promise<void> {
  // Skip CSRF for cross-origin pre-flight (none of our mutating routes
  // accept CORS anyway — the same-origin SameSite cookie does the work).
  if (request.method === 'GET' || request.method === 'HEAD' || request.method === 'OPTIONS') {
    return;
  }
  const headerToken = request.headers.get(CSRF_HEADER);
  const cookieToken = await readCsrfCookie();
  if (!headerToken || !cookieToken || headerToken !== cookieToken) {
    throw new CsrfError();
  }
}

export class CsrfError extends Error {
  constructor() {
    super('CSRF token missing or mismatched');
    this.name = 'CsrfError';
  }
}
