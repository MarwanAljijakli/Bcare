/**
 * tRPC core: context, root builder, auth middleware.
 *
 * Context is built per-request with a cookie-bound Supabase client and the
 * current user info. `protectedProcedure` rejects unauthenticated calls;
 * `recentAuthProcedure` additionally rejects sessions older than the
 * RECENT_AUTH_WINDOW_MS (5 min) — used by sensitive routes like account
 * export, account delete, and consent revocation.
 *
 * superjson serializes Date / undefined / Map / etc. through the wire so
 * server timestamps round-trip cleanly to React without manual coercion.
 */

import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';
import type { SessionInfo } from '@/lib/auth/session';
import { verifyCsrf } from '@/lib/auth/csrf';
import { getSessionInfo, RECENT_AUTH_WINDOW_MS } from '@/lib/auth/session';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase/server';

export interface TrpcContext {
  /** Cookie-bound Supabase — RLS-scoped to the current user. */
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  /** Service-role client — bypasses RLS. Use sparingly. */
  supabaseAdmin: ReturnType<typeof createSupabaseAdminClient>;
  /** Current user + session age, or null if unauthenticated. */
  session: SessionInfo | null;
  /** The original Request for CSRF + IP lookups. */
  req: Request;
}

export async function createContext({ req }: { req: Request }): Promise<TrpcContext> {
  const supabase = await createSupabaseServerClient();
  const supabaseAdmin = createSupabaseAdminClient();
  const session = await getSessionInfo();
  return { supabase, supabaseAdmin, session, req };
}

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
  errorFormatter({ shape }) {
    return shape;
  },
});

/** Public procedure (no auth, no CSRF). Used for waitlist + signup. */
export const publicProcedure = t.procedure;

/** Mutating public procedure — adds CSRF check. */
export const publicMutationProcedure = t.procedure.use(async ({ ctx, next }) => {
  await verifyCsrf(ctx.req);
  return next();
});

/** Authenticated procedure — rejects unsigned-in callers. */
export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.session) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'not_signed_in' });
  }
  return next({ ctx: { ...ctx, session: ctx.session } });
});

/** Authenticated mutation — adds CSRF check. */
export const protectedMutationProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  await verifyCsrf(ctx.req);
  return next();
});

/** Sensitive mutation — requires recent auth (≤ 5 min). */
export const recentAuthProcedure = protectedMutationProcedure.use(async ({ ctx, next }) => {
  if (!ctx.session) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'not_signed_in' });
  }
  if (ctx.session.ageMs > RECENT_AUTH_WINDOW_MS) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'reauth_required' });
  }
  return next();
});

export const router = t.router;
export const middleware = t.middleware;
