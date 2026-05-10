/**
 * CSRF constants — shared between client and server. This module deliberately
 * does NOT import `next/headers` so it's safe to consume from client
 * components (the tRPC provider, the account-settings client, etc.). The
 * server-only helpers (`ensureCsrfCookie`, `verifyCsrf`, `readCsrfCookie`)
 * live in `./csrf.ts`.
 */

export const CSRF_COOKIE = 'bcare-csrf';
export const CSRF_HEADER = 'x-csrf-token';
export const CSRF_TOKEN_BYTES = 32;
