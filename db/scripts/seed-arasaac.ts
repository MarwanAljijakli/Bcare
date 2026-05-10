/**
 * ARASAAC bootstrap seed — operator-runnable.
 *
 * Reads `db/seed/arasaac-core.json` (~40 high-priority bilingual symbols
 * covering the "starter" vocabulary level), downloads each pictogram from
 * ARASAAC's public CDN, uploads to the `symbols-public` Supabase Storage
 * bucket, and inserts a row in `public.symbols` pointing at the stored
 * object path.
 *
 * ARASAAC pictograms are CC BY-NC-SA. Attribution string is committed to
 * the row metadata + rendered on /accessibility and on /board footer.
 *
 * Usage (run from repo root):
 *   pnpm exec tsx --env-file=./web/.env.local ./db/scripts/seed-arasaac.ts
 *   (or from db/: pnpm exec tsx --env-file=../web/.env.local scripts/seed-arasaac.ts)
 *
 * Idempotency: looks up the seed library row by name; reuses its id. For
 * each symbol, looks up by `arasaac:<id>` tag and SKIPS if already
 * present. Re-running on top of an existing seed is safe + fast.
 *
 * Image source: ARASAAC ships PNGs at
 *   https://static.arasaac.org/pictograms/{id}/{id}_300.png
 * and the API root at /api/pictograms/{id} also returns the PNG bytes
 * directly (the API_HOST below is the canonical reference). We hit the
 * static CDN to keep the egress profile predictable.
 */

import './lib/env';
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const ARASAAC_PICTOGRAM_URL = (id: string) =>
  `https://static.arasaac.org/pictograms/${id}/${id}_300.png`;
const ARASAAC_LICENSE = 'CC BY-NC-SA — ARASAAC (https://arasaac.org)';
const STARTER_LIBRARY_NAME = 'ARASAAC Core (bilingual starter set)';
const BUCKET = 'symbols-public';
const OBJECT_PATH = (id: string) => `arasaac/${id}.png`;

interface SeedRow {
  arasaac_id: string;
  category: string;
  label_en: string;
  label_ar: string;
  phonetic_en: string;
  phonetic_ar: string;
}

interface LibraryRow {
  id: string;
  name: string;
}

interface SymbolRow {
  id: string;
  tags: string[];
}

async function main(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRole) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
    console.error(
      'Run with: pnpm exec tsx --env-file=./web/.env.local ./db/scripts/seed-arasaac.ts',
    );
    process.exit(2);
  }

  const supabase = createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const here = dirname(fileURLToPath(import.meta.url));
  const seedPath = join(here, '..', 'seed', 'arasaac-core.json');
  const raw = await readFile(seedPath, 'utf8');
  const rows = JSON.parse(raw) as SeedRow[];
  console.info(`Loaded ${rows.length} seed rows from ${seedPath}.`);

  // 1. Library row — select first; insert if missing.
  let libraryId: string;
  const libQuery = await supabase
    .from('symbol_libraries')
    .select('id, name')
    .eq('name', STARTER_LIBRARY_NAME)
    .maybeSingle();
  if (libQuery.error) {
    console.error('Library lookup failed:', libQuery.error.message);
    process.exit(1);
  }
  if ((libQuery.data as LibraryRow | null)?.id) {
    libraryId = (libQuery.data as LibraryRow).id;
    console.info(`= Library exists (id=${libraryId.slice(0, 8)}…).`);
  } else {
    const libInsert = await supabase
      .from('symbol_libraries')
      .insert({
        name: STARTER_LIBRARY_NAME,
        source: 'arasaac',
        attribution: ARASAAC_LICENSE,
        is_public: true,
      })
      .select('id')
      .single();
    if (libInsert.error || !libInsert.data) {
      console.error('Library insert failed:', libInsert.error?.message ?? 'no row');
      process.exit(1);
    }
    libraryId = (libInsert.data as { id: string }).id;
    console.info(`✓ Library created (id=${libraryId.slice(0, 8)}…).`);
  }

  // 2. Pre-fetch which symbol tags already exist so re-runs don't fight
  //    against the symbols table's lack of unique constraints.
  const existing = await supabase.from('symbols').select('id, tags').eq('library_id', libraryId);
  if (existing.error) {
    console.error('Existing-symbol lookup failed:', existing.error.message);
    process.exit(1);
  }
  const existingTags = new Set<string>();
  for (const s of (existing.data ?? []) as SymbolRow[]) {
    for (const t of s.tags ?? []) existingTags.add(t);
  }
  console.info(`Found ${existingTags.size} pre-existing tags in this library.`);

  let okCount = 0;
  let skipCount = 0;
  let failCount = 0;

  for (const row of rows) {
    const tag = `arasaac:${row.arasaac_id}`;
    const objectPath = OBJECT_PATH(row.arasaac_id);

    if (existingTags.has(tag)) {
      // Already in DB. Make sure the storage object exists too — re-fetch
      // and re-upload only if it doesn't, so a partial earlier run
      // self-heals on a re-run.
      const head = await supabase.storage.from(BUCKET).list('arasaac', {
        search: `${row.arasaac_id}.png`,
        limit: 1,
      });
      if (!head.error && (head.data ?? []).length > 0) {
        skipCount++;
        process.stdout.write('=');
        continue;
      }
      // Else fall through to re-upload + (DB row is fine).
    }

    try {
      // Fetch from ARASAAC.
      const pictoUrl = ARASAAC_PICTOGRAM_URL(row.arasaac_id);
      const res = await fetch(pictoUrl);
      if (!res.ok) {
        console.warn(`\n✗ ARASAAC ${row.arasaac_id} fetch failed: ${res.status}`);
        failCount++;
        continue;
      }
      const buf = new Uint8Array(await res.arrayBuffer());

      // Upload (upsert) to symbols-public.
      const upload = await supabase.storage.from(BUCKET).upload(objectPath, buf, {
        contentType: 'image/png',
        upsert: true,
      });
      if (upload.error) {
        console.warn(`\n✗ Upload ${row.arasaac_id} failed: ${upload.error.message}`);
        failCount++;
        continue;
      }

      if (!existingTags.has(tag)) {
        // Insert the symbol row.
        const symInsert = await supabase.from('symbols').insert({
          library_id: libraryId,
          label_en: row.label_en,
          label_ar: row.label_ar,
          phonetic_en: row.phonetic_en,
          phonetic_ar: row.phonetic_ar,
          image_path: objectPath,
          categories: [row.category],
          tags: [tag],
          status: 'active',
        });
        if (symInsert.error) {
          console.warn(`\n✗ Symbol insert ${row.arasaac_id} failed: ${symInsert.error.message}`);
          failCount++;
          continue;
        }
      }

      okCount++;
      process.stdout.write('.');
    } catch (e) {
      console.warn(`\n✗ ${row.arasaac_id}:`, e instanceof Error ? e.message : String(e));
      failCount++;
    }
  }

  console.info(
    `\n\n✓ ${okCount} symbols seeded, ${skipCount} already present, ${failCount} failed.`,
  );
  if (failCount > 0) process.exit(1);
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.stack : String(e));
  process.exit(1);
});
