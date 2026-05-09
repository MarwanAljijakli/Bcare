import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema/index.js';

/**
 * Drizzle client. Exported as a singleton — Next.js route handlers and server
 * components share one connection pool per server instance. RLS is enforced at
 * the database layer; this client connects as the service role only when
 * called from a privileged server context (admin tasks, AI personalization
 * cron). User-bound queries go through the Supabase JS client which forwards
 * the user's JWT and triggers RLS.
 */

let cached: ReturnType<typeof drizzle<typeof schema>> | undefined;

export function getDb() {
  if (cached) return cached;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      '[bluecare/db] DATABASE_URL is not set. Required for the privileged Drizzle client.',
    );
  }
  // Single-connection pool keeps Vercel serverless cold-start cost minimal.
  // Bumped to 5 for Edge runtime concurrency; tune in deploy.md.
  const sql = postgres(url, { max: 5, prepare: false });
  cached = drizzle(sql, { schema, logger: process.env.NODE_ENV === 'development' });
  return cached;
}

export type Db = ReturnType<typeof getDb>;
export { schema };
