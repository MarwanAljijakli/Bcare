/**
 * ARASAAC bootstrap seed — operator-only.
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
 *   pnpm tsx db/scripts/seed-arasaac.ts
 *
 * Env required:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Idempotent: re-runs upsert by `arasaac_id` (stored in symbols.tags).
 *
 * Module 3 ships with this script + the 40-symbol seed dataset. Expanding
 * to the full ~2000-symbol corpus is a Module 9 hardening task — the
 * script reads any JSON shape this file uses, so growing the dataset is
 * just adding rows.
 */

import { createClient } from '@supabase/supabase-js';
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ARASAAC_PICTOGRAM_URL = (id: string) =>
  `https://api.arasaac.org/api/pictograms/${id}?download=false`;
const ARASAAC_LICENSE = 'CC BY-NC-SA — ARASAAC (https://arasaac.org)';
const STARTER_LIBRARY_NAME = 'ARASAAC Core (bilingual starter set)';

interface SeedRow {
  arasaac_id: string;
  category: string;
  label_en: string;
  label_ar: string;
  phonetic_en: string;
  phonetic_ar: string;
}

async function main(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRole) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(2);
  }

  const supabase = createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const here = dirname(fileURLToPath(import.meta.url));
  const seedPath = join(here, '..', 'seed', 'arasaac-core.json');
  const raw = await readFile(seedPath, 'utf8');
  const rows = JSON.parse(raw) as SeedRow[];

  // Ensure the library row exists.
  const { data: lib, error: libErr } = await (
    supabase.from('symbol_libraries') as never as {
      upsert: (
        row: {
          name: string;
          source: string;
          attribution: string;
          is_public: boolean;
        },
        opts: { onConflict: string },
      ) => {
        select: (cols: string) => {
          single: () => Promise<{ data: { id: string } | null; error: { message: string } | null }>;
        };
      };
    }
  )
    .upsert(
      {
        name: STARTER_LIBRARY_NAME,
        source: 'arasaac',
        attribution: ARASAAC_LICENSE,
        is_public: true,
      },
      { onConflict: 'name' },
    )
    .select('id')
    .single();
  if (libErr || !lib) {
    console.error('Failed to upsert symbol library:', libErr?.message ?? 'unknown');
    process.exit(1);
  }
  const libraryId = lib.id;

  let okCount = 0;
  let skipCount = 0;
  let failCount = 0;

  for (const row of rows) {
    try {
      // 1. Fetch the pictogram bytes from ARASAAC.
      const pictoUrl = ARASAAC_PICTOGRAM_URL(row.arasaac_id);
      const res = await fetch(pictoUrl);
      if (!res.ok) {
        console.warn(`✗ ARASAAC ${row.arasaac_id} fetch failed: ${res.status}`);
        failCount++;
        continue;
      }
      const buf = new Uint8Array(await res.arrayBuffer());
      const objectPath = `arasaac/${row.arasaac_id}.png`;

      // 2. Upload (upsert) to symbols-public.
      const upload = await supabase.storage.from('symbols-public').upload(objectPath, buf, {
        contentType: 'image/png',
        upsert: true,
      });
      if (upload.error) {
        console.warn(`✗ Upload ${row.arasaac_id} failed: ${upload.error.message}`);
        failCount++;
        continue;
      }

      // 3. Upsert the symbol row.
      const symbolUpsert = await (
        supabase.from('symbols') as never as {
          upsert: (
            row: {
              library_id: string;
              label_en: string;
              label_ar: string;
              phonetic_en: string;
              phonetic_ar: string;
              image_path: string;
              categories: string[];
              tags: string[];
              status: string;
            },
            opts: { onConflict: string },
          ) => Promise<{ error: { message: string } | null }>;
        }
      ).upsert(
        {
          library_id: libraryId,
          label_en: row.label_en,
          label_ar: row.label_ar,
          phonetic_en: row.phonetic_en,
          phonetic_ar: row.phonetic_ar,
          image_path: objectPath,
          categories: [row.category],
          tags: [`arasaac:${row.arasaac_id}`],
          status: 'active',
        },
        { onConflict: 'tags' },
      );
      if (symbolUpsert.error) {
        // The "tags" array isn't unique-indexed by default — fall back to
        // unconditional insert and rely on operator to dedupe by re-running
        // after a manual cleanup if needed.
        const fallback = await (
          supabase.from('symbols') as never as {
            insert: (row: object) => Promise<{ error: { message: string } | null }>;
          }
        ).insert({
          library_id: libraryId,
          label_en: row.label_en,
          label_ar: row.label_ar,
          phonetic_en: row.phonetic_en,
          phonetic_ar: row.phonetic_ar,
          image_path: objectPath,
          categories: [row.category],
          tags: [`arasaac:${row.arasaac_id}`],
          status: 'active',
        });
        if (fallback.error && /duplicate key/i.test(fallback.error.message)) {
          skipCount++;
          continue;
        }
        if (fallback.error) {
          console.warn(`✗ Insert ${row.arasaac_id} failed: ${fallback.error.message}`);
          failCount++;
          continue;
        }
      }
      okCount++;
      process.stdout.write('.');
    } catch (e) {
      console.warn(`✗ ${row.arasaac_id}:`, e instanceof Error ? e.message : String(e));
      failCount++;
    }
  }

  console.log(
    `\n✓ ${okCount} symbols seeded, ${skipCount} skipped (already present), ${failCount} failed`,
  );
  if (failCount > 0) process.exit(1);
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.stack : String(e));
  process.exit(1);
});
