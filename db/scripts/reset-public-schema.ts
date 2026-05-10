/**
 * DANGEROUS — drops every BlueCare table in the public schema and recreates
 * it empty. Used for the Module 3.1 remediation when the project had stale
 * tables from an unrelated prior experiment.
 *
 * Safety:
 *   • Refuses to run unless `--confirm` is passed AND the public schema
 *     has tables NOT in the BlueCare allow-list (i.e., something
 *     non-BlueCare to drop).
 *   • Auth schema, storage schema, and extensions are never touched.
 *   • Drops via `DROP SCHEMA public CASCADE; CREATE SCHEMA public;`
 *     followed by re-granting `usage` to anon + authenticated +
 *     service_role + postgres so PostgREST can still find the schema.
 *
 * Usage (intentionally cumbersome — this is a footgun):
 *   pnpm exec tsx db/scripts/reset-public-schema.ts --confirm
 *
 * After running, you MUST run apply-migrations.ts to repopulate the
 * BlueCare schema. The two scripts are paired by design.
 */

import './lib/env';
import { sql } from './lib/sql';

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

async function main(): Promise<void> {
  const confirm = process.argv.includes('--confirm');
  const ref = process.env.NEXT_PUBLIC_SUPABASE_URL;
  console.info(`Target: ${ref}`);

  // Inventory.
  const tables = await sql<{ tablename: string }>(
    `select tablename from pg_tables where schemaname = 'public' order by tablename`,
  );
  const all = tables.rows.map((r) => r.tablename);
  const leftovers = all.filter((t) => !BLUECARE_TABLES.has(t));
  console.info(
    `Tables in public: ${all.length} total, ${leftovers.length} leftover (non-BlueCare).`,
  );
  for (const t of leftovers) console.info(`  ! ${t}`);

  if (leftovers.length === 0) {
    console.info('\nPublic schema is already clean — nothing to reset. Exiting cleanly.');
    process.exit(0);
  }

  if (!confirm) {
    console.error(
      '\nRefusing to drop without --confirm. Re-run with `--confirm` if you really want to wipe the public schema.',
    );
    process.exit(2);
  }

  console.info('\nDropping public schema (CASCADE) and re-creating empty…');
  await sql(`drop schema public cascade; create schema public;`);
  await sql(
    `grant usage on schema public to anon, authenticated, service_role, postgres;
     grant create on schema public to postgres;`,
  );
  console.info('Done. Run apply-migrations.ts next to repopulate.');
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.stack : String(e));
  process.exit(1);
});
