'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink } from '@trpc/client';
import { createTRPCReact } from '@trpc/react-query';
import { useState, type ReactNode } from 'react';
import superjson from 'superjson';
import type { AppRouter } from '@/server/trpc/routers';
import { CSRF_COOKIE, CSRF_HEADER } from '@/lib/auth/csrf-shared';

export const trpc = createTRPCReact<AppRouter>();

/**
 * Thrown when the client cannot obtain a CSRF token. The cookie is normally
 * minted by `ensureCsrfCookie()` server-side, but Next.js 14 silently
 * disallows `cookies().set()` from a Server Component context — so a cold
 * onboarding load lands the user on the page with no cookie. The lazy-mint
 * below calls `/api/csrf` (a Route Handler, where `cookies().set()` works)
 * before the first mutation; if THAT fails we surface this typed error so
 * the onboarding banner can show the correct localized message instead of
 * a silent button-does-nothing failure.
 */
export class CsrfMintError extends Error {
  readonly code = 'CSRF_MINT_FAILED' as const;
  constructor(detail?: string) {
    super(detail ?? 'Could not mint CSRF token');
    this.name = 'CsrfMintError';
  }
}

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.split('; ').find((c) => c.startsWith(`${name}=`));
  if (!match) return null;
  const value = decodeURIComponent(match.split('=')[1] ?? '');
  return value.length > 0 ? value : null;
}

/**
 * Mint the CSRF cookie via `/api/csrf` if it's not already present in
 * `document.cookie`. Idempotent — if the cookie is there, returns it
 * immediately without a network round-trip.
 *
 * Throws `CsrfMintError` if the mint endpoint is unreachable or returns
 * a non-2xx status. The caller propagates this through to the onboarding
 * step's error banner.
 */
async function ensureClientCsrfToken(): Promise<string> {
  let token = readCookie(CSRF_COOKIE);
  if (token) return token;
  try {
    const res = await fetch('/api/csrf', {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store',
    });
    if (!res.ok) {
      throw new CsrfMintError(`mint_status_${res.status}`);
    }
  } catch (err) {
    if (err instanceof CsrfMintError) throw err;
    throw new CsrfMintError('mint_network');
  }
  token = readCookie(CSRF_COOKIE);
  if (!token) throw new CsrfMintError('mint_no_cookie');
  return token;
}

/**
 * Maps a thrown error from a tRPC mutation to a stable i18n key for the
 * onboarding error banner. Keep the surface narrow — four buckets is enough
 * for users to know what to do next (try again, sign in again, check
 * connection, or fall through to generic).
 */
export function mapTrpcErrorToKey(err: unknown): 'csrf' | 'signedOut' | 'offline' | 'generic' {
  if (err == null) return 'generic';

  // Client-side mint failure — raised by ensureClientCsrfToken above.
  // Errors from the link layer get wrapped by tRPC; check both directly
  // and on the `.cause` chain (TRPCClientError uses `.cause` for the
  // originating throw).
  if (err instanceof CsrfMintError) return 'csrf';
  if (err instanceof Error) {
    const cause = (err as Error & { cause?: unknown }).cause;
    if (cause instanceof CsrfMintError) return 'csrf';
    const msg = (err.message ?? '').toLowerCase();
    if (msg.includes('csrf')) return 'csrf';
    if (msg.includes('not_signed_in') || msg.includes('unauthorized')) {
      return 'signedOut';
    }
    if (
      msg.includes('failed to fetch') ||
      msg.includes('network') ||
      msg.includes('networkerror') ||
      msg.includes('load failed')
    ) {
      return 'offline';
    }
  }
  // TRPCClientError shape — surfaces server-side TRPCError codes.
  if (typeof err === 'object' && err !== null && 'data' in err) {
    const data = (err as { data?: { code?: string; httpStatus?: number } }).data;
    if (data?.code === 'UNAUTHORIZED' || data?.httpStatus === 401) {
      return 'signedOut';
    }
    if (data?.code === 'FORBIDDEN' || data?.httpStatus === 403) {
      // The server's CSRF middleware throws before it reaches a TRPCError,
      // so 403 here is generally not CSRF — but we treat reauth-required
      // and CSRF mismatch as the same "try again" bucket.
      return 'csrf';
    }
  }
  return 'generic';
}

export function TrpcProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 60_000, refetchOnWindowFocus: false, retry: 1 },
          mutations: { retry: 0 },
        },
      }),
  );
  const [client] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: '/api/trpc',
          transformer: superjson,
          // Async so we can lazy-mint the CSRF cookie on first use without
          // forcing every page to call `/api/csrf` on mount. Throws
          // `CsrfMintError` if the mint endpoint is unreachable — the
          // mutation rejects and the step's error banner localizes the
          // failure (see mapTrpcErrorToKey + the `errors.csrf` i18n key).
          async headers() {
            const token = await ensureClientCsrfToken();
            return { [CSRF_HEADER]: token };
          },
          // Defense-in-depth: if a tRPC version change ever stops calling
          // `headers()` for some request path, we ALSO inject the header
          // here at the fetch boundary. Both paths converge on the same
          // ensureClientCsrfToken() so there's only one mint code path.
          // A throw here propagates as-is — tRPC will surface it the
          // same way it surfaces the `headers()` throw above.
          async fetch(input, init) {
            const headers = new Headers(init?.headers);
            if (!headers.has(CSRF_HEADER)) {
              const token = await ensureClientCsrfToken();
              headers.set(CSRF_HEADER, token);
            }
            return fetch(input, { ...init, headers });
          },
        }),
      ],
    }),
  );

  return (
    <trpc.Provider client={client} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  );
}
