import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from './types';

type CookieToSet = { name: string; value: string; options: CookieOptions };

/**
 * Server-side Supabase client for App Router. Reads/writes auth cookies through
 * Next's `cookies()` so RLS context is preserved across route handlers and
 * server components.
 *
 * Use this from server components, route handlers, and server actions only.
 * Do NOT pass it down to client components.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Some server contexts (e.g. middleware) ignore set; that's fine —
            // the response cookie has already been set elsewhere.
          }
        },
      },
    },
  );
}

/**
 * Service-role client. Bypasses RLS. Use ONLY from server-only contexts that
 * have already validated the caller's authority. Never pass through user-
 * supplied input as a where clause without explicit allow-listing.
 */
export function createSupabaseAdminClient() {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      // Service role doesn't need cookie sync.
      cookies: { getAll: () => [], setAll: () => {} },
    },
  );
}
