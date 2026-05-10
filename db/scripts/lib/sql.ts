import './env';

/**
 * Supabase Management API SQL transport.
 *
 * The project's service-role key (from web/.env.local) is enough for
 * PostgREST + Storage + Auth admin, but not for raw DDL. For migrations,
 * resets, and any other arbitrary SQL we use the Management API at
 * `api.supabase.com`, which authenticates via a personal access token
 * (`sbp_...`) stored in `SUPABASE_ACCESS_TOKEN`.
 *
 * Generate a token at:
 *   https://supabase.com/dashboard/account/tokens
 *
 * Used by:
 *   • db/scripts/apply-migrations.ts — apply migration files in order.
 *   • db/scripts/reset-public-schema.ts — DROP/CREATE for the wipe step.
 *   • db/scripts/verify-schema.ts — read-only inventory checks.
 *
 * Endpoint: POST /v1/projects/{ref}/database/query
 *   body: { "query": "<SQL>" }
 *   returns: array of rows (when SELECT) or empty array (DDL).
 */

const PROJECT_REF_ENV = 'NEXT_PUBLIC_SUPABASE_URL';
const TOKEN_ENV = 'SUPABASE_ACCESS_TOKEN';

export interface SqlResult<T = Record<string, unknown>> {
  rows: T[];
  count: number;
}

/** Resolve the project ref from the Supabase URL env var. */
export function projectRef(): string {
  const url = process.env[PROJECT_REF_ENV];
  if (!url) throw new Error(`Missing ${PROJECT_REF_ENV}`);
  const m = url.match(/^https:\/\/([a-z0-9]+)\.supabase\.co\/?$/i);
  if (!m) throw new Error(`${PROJECT_REF_ENV} doesn't match the expected Supabase URL shape`);
  return m[1]!;
}

/** Run a single SQL statement (or multiple, semicolon-separated) and
 *  return rows. The Management API supports DDL, DML, and SELECT.
 *
 *  Retries transient 5xx responses with exponential backoff. Supabase's
 *  Management API occasionally returns 502/503 from upstream connection
 *  resets; the request is idempotent at the HTTP layer (the server-side
 *  SQL is not, but we don't retry once the SQL itself has been
 *  attempted — only when the request never reached Postgres). */
export async function sql<T = Record<string, unknown>>(query: string): Promise<SqlResult<T>> {
  const token = process.env[TOKEN_ENV];
  if (!token) {
    throw new Error(
      `Missing ${TOKEN_ENV}. Generate one at https://supabase.com/dashboard/account/tokens and add it to web/.env.local.`,
    );
  }
  const ref = projectRef();
  const url = `https://api.supabase.com/v1/projects/${ref}/database/query`;

  const maxAttempts = 4;
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
      });
      const text = await res.text();
      if (!res.ok) {
        // Retry on gateway / connection-reset errors only — 4xx are real
        // SQL errors and should fail fast.
        const retryable =
          res.status === 502 ||
          res.status === 503 ||
          res.status === 504 ||
          /upstream connect error|connection termination|reset before headers/i.test(text);
        if (retryable && attempt < maxAttempts) {
          await new Promise((r) => setTimeout(r, 400 * 2 ** (attempt - 1)));
          continue;
        }
        throw new Error(
          `SQL failed (${res.status} ${res.statusText}): ${text.slice(0, 1000)} \n--- query ---\n${query.slice(0, 500)}`,
        );
      }
      let rows: T[] = [];
      try {
        rows = JSON.parse(text) as T[];
      } catch {
        rows = [];
      }
      return { rows, count: rows.length };
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      // Network-level fetch errors (DNS, ECONNRESET) — retry.
      if (
        attempt < maxAttempts &&
        /fetch failed|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN/i.test(lastError.message)
      ) {
        await new Promise((r) => setTimeout(r, 400 * 2 ** (attempt - 1)));
        continue;
      }
      throw lastError;
    }
  }
  throw lastError ?? new Error('sql: exhausted retries');
}

/** Convenience: returns a single scalar from `select <expr>`. */
export async function sqlScalar<V>(query: string, key: string): Promise<V | null> {
  const r = await sql<Record<string, V>>(query);
  return r.rows[0]?.[key] ?? null;
}
