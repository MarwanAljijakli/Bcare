/**
 * Direct apply of migration 0011 — drop waitlist_signups (Module 9).
 *
 * Pre-flight: this script refuses to run if the table has > 0 rows.
 * Don't drop a table with data without conscious approval.
 *
 * Usage:
 *   pnpm exec tsx db/scripts/apply-migration-0011.ts
 */
import './lib/env';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

async function main(): Promise<void> {
  const projectRef = (() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
    const m = url.match(/^https:\/\/([a-z0-9]+)\.supabase\.co\/?$/i);
    return m ? m[1]! : null;
  })();
  const accessToken = process.env.SUPABASE_ACCESS_TOKEN;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!projectRef || !accessToken || !url || !serviceRole) {
    console.error(
      'Missing NEXT_PUBLIC_SUPABASE_URL, SUPABASE_ACCESS_TOKEN, or SUPABASE_SERVICE_ROLE_KEY.',
    );
    process.exit(1);
  }

  const supabase = createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { count, error: countErr } = await (
    supabase.from('waitlist_signups') as never as {
      select: (
        cols: string,
        opts?: { count?: 'exact'; head?: true },
      ) => Promise<{ count: number | null; error: { message: string } | null }>;
    }
  ).select('id', { count: 'exact', head: true });
  if (countErr) {
    console.error('Pre-flight count failed:', countErr.message);
    process.exit(1);
  }
  if ((count ?? 0) > 0) {
    console.error(`Refusing to drop: waitlist_signups has ${count} row(s). Pause + review.`);
    process.exit(2);
  }
  console.info('[apply-0011] pre-flight: waitlist_signups has 0 rows. Proceeding.');

  const here = dirname(fileURLToPath(import.meta.url));
  const sqlPath = join(here, '..', 'migrations', '0011_drop_waitlist.sql');
  const sql = await readFile(sqlPath, 'utf8');
  console.info(`[apply-0011] sending ${sql.length} bytes of SQL …`);
  const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  });
  if (!res.ok) {
    console.error(`  ✗ failed (${res.status}): ${await res.text()}`);
    process.exit(1);
  }
  console.info('  ✓ migration 0011 applied — waitlist_signups dropped');
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.stack : String(e));
  process.exit(1);
});
