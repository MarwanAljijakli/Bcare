/**
 * Phase 1 — Backup the prior experiment's tables to a local, gitignored
 * directory before the public-schema wipe.
 *
 * Approach:
 *   1. Discover every public-schema table via the Management API SQL
 *      endpoint (single source of truth — bypasses PostgREST's schema
 *      cache).
 *   2. Compute the BlueCare allow-list from db/schema/index.ts (the
 *      18 BlueCare tables we authored).
 *   3. For every public-schema table NOT on the allow-list, dump it as
 *      JSON to bcare-old-experiment-backup/<table>.json.
 *   4. List the storage buckets that are NOT BlueCare's (dealroom,
 *      models) along with their object inventories — file paths + public
 *      URLs only, not blob bytes.
 *   5. Print a manifest with row counts + total bytes.
 *
 * Idempotent: re-running overwrites the backup files.
 *
 * Usage (from repo root):
 *   pnpm exec tsx --env-file=./web/.env.local ./db/scripts/backup-old-experiment.ts
 */

import './lib/env';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { sql } from './lib/sql';

const here = dirname(fileURLToPath(import.meta.url));
const BACKUP_DIR = join(here, '..', '..', 'bcare-old-experiment-backup');

// 18 BlueCare tables, in alpha order. Anything else in `public` is
// experiment leftover and goes into the backup.
const BLUECARE_TABLES = new Set([
  'ai_usage_ledger',
  'audit_log',
  'children',
  'consent_records',
  'custom_voices',
  'draft_onboarding',
  'gamification_state',
  'input_events',
  'output_events',
  'profiles',
  'progress_metrics',
  'sessions',
  'symbol_libraries',
  'symbols',
  'therapist_grants',
  'therapist_invites',
  'users',
  'vocabulary_sets',
  'waitlist_signups',
]);

// BlueCare's two storage buckets — leave them; back up the rest.
const BLUECARE_BUCKETS = new Set(['symbols-public', 'symbols-private']);

interface ManifestEntry {
  table: string;
  rows: number;
  bytes: number;
  path: string;
}

async function listPublicTables(): Promise<string[]> {
  const r = await sql<{ tablename: string }>(
    `select tablename from pg_tables where schemaname = 'public' order by tablename`,
  );
  return r.rows.map((row) => row.tablename);
}

async function dumpTable(table: string): Promise<{ rows: number; bytes: number; path: string }> {
  // Use the service-role key + supabase-js for the actual data dump because
  // PostgREST happily streams arbitrarily large result sets where the
  // Management API caps responses.
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const r = await supabase.from(table).select('*');
  if (r.error) {
    // Some leftover tables may not be in PostgREST's schema cache. Fall
    // back to the Management API.
    const direct = await sql<Record<string, unknown>>(`select * from public.${quoteIdent(table)}`);
    const json = JSON.stringify(direct.rows, null, 2);
    const path = join(BACKUP_DIR, `${table}.json`);
    await writeFile(path, json, 'utf8');
    return { rows: direct.rows.length, bytes: Buffer.byteLength(json, 'utf8'), path };
  }
  const rows = r.data ?? [];
  const json = JSON.stringify(rows, null, 2);
  const path = join(BACKUP_DIR, `${table}.json`);
  await writeFile(path, json, 'utf8');
  return { rows: rows.length, bytes: Buffer.byteLength(json, 'utf8'), path };
}

async function listStorageBuckets(): Promise<{ name: string; public: boolean }[]> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const r = await supabase.storage.listBuckets();
  if (r.error) throw new Error(r.error.message);
  return (r.data ?? []).map((b) => ({ name: b.name, public: b.public }));
}

async function inventoryBucket(
  bucket: string,
): Promise<{ key: string; size: number; publicUrl?: string }[]> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  // Recursive walk via repeated `list` calls. For our purposes the experiment
  // buckets are small; one root list is enough.
  const list = await supabase.storage.from(bucket).list('', { limit: 1000 });
  if (list.error) return [];
  const out: { key: string; size: number; publicUrl?: string }[] = [];
  for (const item of list.data ?? []) {
    if (item.name) {
      const { data } = supabase.storage.from(bucket).getPublicUrl(item.name);
      out.push({
        key: item.name,
        size: item.metadata?.size ?? 0,
        publicUrl: data.publicUrl,
      });
    }
  }
  return out;
}

function quoteIdent(s: string): string {
  return `"${s.replace(/"/g, '""')}"`;
}

async function main(): Promise<void> {
  await mkdir(BACKUP_DIR, { recursive: true });
  console.info(`Backup target: ${BACKUP_DIR}\n`);

  // Tables
  const tables = await listPublicTables();
  const leftovers = tables.filter((t) => !BLUECARE_TABLES.has(t));
  console.info(
    `Public-schema tables: ${tables.length} total, ${leftovers.length} leftover (non-BlueCare).`,
  );
  if (leftovers.length === 0) {
    console.info('Nothing to back up — public schema is already clean.');
  }

  const manifest: ManifestEntry[] = [];
  let totalRows = 0;
  let totalBytes = 0;
  for (const t of leftovers) {
    try {
      const { rows, bytes, path } = await dumpTable(t);
      manifest.push({ table: t, rows, bytes, path });
      totalRows += rows;
      totalBytes += bytes;
      console.info(`  ✓ ${t}: ${rows} rows, ${(bytes / 1024).toFixed(1)} KB`);
    } catch (e) {
      console.warn(`  ✗ ${t}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // Storage buckets
  const buckets = await listStorageBuckets();
  const leftoverBuckets = buckets.filter((b) => !BLUECARE_BUCKETS.has(b.name));
  console.info(`\nStorage buckets: ${buckets.length} total, ${leftoverBuckets.length} leftover.`);
  const bucketManifest: {
    name: string;
    public: boolean;
    objects: { key: string; size: number; publicUrl?: string }[];
  }[] = [];
  for (const b of leftoverBuckets) {
    const objects = await inventoryBucket(b.name);
    bucketManifest.push({ name: b.name, public: b.public, objects });
    const totalSize = objects.reduce((s, o) => s + o.size, 0);
    console.info(
      `  ✓ ${b.name} (${b.public ? 'public' : 'private'}): ${objects.length} objects, ${(totalSize / 1024).toFixed(1)} KB`,
    );
  }

  const manifestPath = join(BACKUP_DIR, '_manifest.json');
  await writeFile(
    manifestPath,
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        project: process.env.NEXT_PUBLIC_SUPABASE_URL,
        tables: manifest,
        buckets: bucketManifest,
        totalRows,
        totalBytes,
      },
      null,
      2,
    ),
    'utf8',
  );

  console.info(
    `\nManifest: ${manifestPath}\nTotal: ${totalRows} rows · ${(totalBytes / 1024).toFixed(1)} KB across ${manifest.length} tables.`,
  );
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.stack : String(e));
  process.exit(1);
});
