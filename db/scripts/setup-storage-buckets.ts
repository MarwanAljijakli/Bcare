/**
 * Storage buckets bootstrap — creates the two buckets the symbol library
 * needs. Idempotent: re-running is safe.
 *
 *   • symbols-public  — public-read (bucket-level), service-role-write.
 *                       Holds ARASAAC seed art + admin-curated system art.
 *   • symbols-private — private (bucket-level). Holds caregiver-uploaded
 *                       custom symbols + recorded voice clips. Bucket
 *                       create is enough for now — the per-row RLS
 *                       policies on storage.objects (caregiver-scoped
 *                       read + write) live in db/migrations/0002 and
 *                       become load-bearing when the Module 6 caregiver
 *                       upload UI ships. Until then the service role
 *                       (used by the seed script) writes; nothing else
 *                       reads or writes the private bucket.
 *
 * Usage (run from repo root):
 *   pnpm exec tsx --env-file=web/.env.local db/scripts/setup-storage-buckets.ts
 *
 * Env required:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import './lib/env';
import { createClient } from '@supabase/supabase-js';

interface BucketSpec {
  name: string;
  public: boolean;
  fileSizeLimit: number;
  allowedMimeTypes: string[];
  description: string;
}

const BUCKETS: BucketSpec[] = [
  {
    name: 'symbols-public',
    public: true,
    fileSizeLimit: 262_144, // 256 KB
    allowedMimeTypes: ['image/png', 'image/svg+xml'],
    description: 'ARASAAC + admin-curated system pictograms (public read).',
  },
  {
    name: 'symbols-private',
    public: false,
    fileSizeLimit: 2_097_152, // 2 MB
    allowedMimeTypes: [
      'image/png',
      'image/jpeg',
      'image/svg+xml',
      'image/webp',
      'audio/webm',
      'audio/mpeg',
      'audio/wav',
    ],
    description: 'Caregiver-uploaded customs + recorded voice clips (RLS-private).',
  },
];

async function main(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRole) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
    console.error(
      'Run with: pnpm exec tsx --env-file=web/.env.local db/scripts/setup-storage-buckets.ts',
    );
    process.exit(2);
  }

  const supabase = createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Existing-bucket check is the idempotency anchor.
  const listed = await supabase.storage.listBuckets();
  if (listed.error) {
    console.error('Failed to list buckets:', listed.error.message);
    process.exit(1);
  }
  const existing = new Set((listed.data ?? []).map((b) => b.name));

  let created = 0;
  let updated = 0;
  let already = 0;

  for (const spec of BUCKETS) {
    if (existing.has(spec.name)) {
      // Update settings in case the spec evolved.
      const upd = await supabase.storage.updateBucket(spec.name, {
        public: spec.public,
        fileSizeLimit: spec.fileSizeLimit,
        allowedMimeTypes: spec.allowedMimeTypes,
      });
      if (upd.error) {
        console.warn(`✗ ${spec.name} update failed: ${upd.error.message}`);
        // Not fatal — bucket already exists; the seed script can still write.
        already++;
        continue;
      }
      updated++;
      console.info(`= ${spec.name} (already exists, settings refreshed)`);
      continue;
    }

    const create = await supabase.storage.createBucket(spec.name, {
      public: spec.public,
      fileSizeLimit: spec.fileSizeLimit,
      allowedMimeTypes: spec.allowedMimeTypes,
    });
    if (create.error) {
      console.error(`✗ ${spec.name} create failed: ${create.error.message}`);
      process.exit(1);
    }
    created++;
    console.info(`✓ ${spec.name} created (${spec.description})`);
  }

  // Verify
  const verify = await supabase.storage.listBuckets();
  const names = (verify.data ?? []).map((b) => b.name).sort();
  console.info('---');
  console.info(`Buckets present: ${names.join(', ')}`);
  console.info(
    `Created: ${created} · Updated: ${updated} · Already-present-update-failed: ${already}`,
  );
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.stack : String(e));
  process.exit(1);
});
