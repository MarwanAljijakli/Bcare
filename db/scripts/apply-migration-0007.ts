/**
 * Direct apply of migration 0007 — tts-cache storage bucket.
 *
 * Same one-off pattern as apply-migration-0005 / 0006. The full
 * migration runner is timing out on rls/policies; this lets Phase 2
 * proceed without waiting on a 5+ minute retry.
 *
 * Usage:
 *   pnpm exec tsx db/scripts/apply-migration-0007.ts
 */
import './lib/env';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

async function main(): Promise<void> {
  const projectRef = (() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
    const m = url.match(/^https:\/\/([a-z0-9]+)\.supabase\.co\/?$/i);
    return m ? m[1]! : null;
  })();
  const accessToken = process.env.SUPABASE_ACCESS_TOKEN;
  if (!projectRef || !accessToken) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_ACCESS_TOKEN.');
    process.exit(1);
  }
  const here = dirname(fileURLToPath(import.meta.url));
  const sqlPath = join(here, '..', 'migrations', '0007_tts_cache_bucket.sql');
  const sql = await readFile(sqlPath, 'utf8');
  console.info(`[apply-0007] sending ${sql.length} bytes of SQL …`);
  const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  });
  if (!res.ok) {
    console.error(`  ✗ failed (${res.status}): ${await res.text()}`);
    process.exit(1);
  }
  console.info('  ✓ migration 0007 applied');
  console.info('tts-cache bucket created (public read, 1MB cap, audio/mpeg only)');
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.stack : String(e));
  process.exit(1);
});
