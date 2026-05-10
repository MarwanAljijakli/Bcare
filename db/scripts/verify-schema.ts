/**
 * Read-only schema inventory + sanity check. Replaces the disposable
 * probe-* scripts from the Module 3.1 debugging window.
 *
 * Reports:
 *   • Public-schema tables vs the BlueCare allow-list (any leftovers?).
 *   • RLS state per table (enabled = true required for every BlueCare table).
 *   • User-defined triggers in auth + public (verifies the auth.users →
 *     public.users mirror trigger and the consent-on-signup trigger).
 *   • Row counts per table.
 *   • Storage buckets present (symbols-public + symbols-private expected).
 *
 * Safe to run any time. Used by the runbook's "verify" step after every
 * migration apply.
 *
 * Usage:
 *   pnpm exec tsx db/scripts/verify-schema.ts
 */

import './lib/env';
import { createClient } from '@supabase/supabase-js';
import { sql } from './lib/sql';

const BLUECARE_TABLES = [
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
];

async function main(): Promise<void> {
  console.info(`Project: ${process.env.NEXT_PUBLIC_SUPABASE_URL}\n`);

  // Tables + RLS state.
  const tables = await sql<{ tablename: string; rls_enabled: boolean }>(
    `select tablename, rowsecurity as rls_enabled
     from pg_tables where schemaname = 'public' order by tablename`,
  );
  const present = new Set(tables.rows.map((r) => r.tablename));
  const missing = BLUECARE_TABLES.filter((t) => !present.has(t));
  const extra = tables.rows.map((r) => r.tablename).filter((t) => !BLUECARE_TABLES.includes(t));
  const rlsOff = tables.rows.filter((r) => !r.rls_enabled).map((r) => r.tablename);

  console.info(`Tables: ${tables.rows.length} present.`);
  if (missing.length > 0) {
    console.info(`  ✗ Missing BlueCare tables: ${missing.join(', ')}`);
  } else {
    console.info(`  ✓ All 19 BlueCare tables present.`);
  }
  if (extra.length > 0) {
    console.info(`  ! Non-BlueCare tables present: ${extra.join(', ')}`);
  }
  if (rlsOff.length > 0) {
    console.info(`  ✗ RLS DISABLED on: ${rlsOff.join(', ')}`);
  } else {
    console.info(`  ✓ RLS enabled on every public table.`);
  }

  // Triggers.
  const triggers = await sql<{ schema: string; table: string; trigger: string; func: string }>(
    `select n.nspname as schema, c.relname as "table", t.tgname as trigger, p.proname as func
     from pg_trigger t
     join pg_class c on t.tgrelid = c.oid
     join pg_namespace n on c.relnamespace = n.oid
     join pg_proc p on t.tgfoid = p.oid
     where not t.tgisinternal and (n.nspname = 'auth' or n.nspname = 'public')
     order by n.nspname, c.relname, t.tgname`,
  );
  console.info(`\nTriggers: ${triggers.rows.length}`);
  for (const t of triggers.rows) {
    console.info(`  ${t.schema}.${t.table} → ${t.trigger}() = ${t.func}`);
  }
  const hasAuthMirror = triggers.rows.some(
    (t) =>
      t.schema === 'auth' &&
      t.table === 'users' &&
      /handle_new_user|copy_to_public_users|on_auth_user_created/.test(t.trigger + t.func),
  );
  console.info(
    hasAuthMirror
      ? '  ✓ auth.users → public.users mirror trigger present.'
      : '  ✗ auth.users → public.users mirror trigger MISSING.',
  );

  // Row counts.
  console.info('\nRow counts:');
  for (const t of BLUECARE_TABLES) {
    if (!present.has(t)) continue;
    try {
      const r = await sql<{ count: number }>(`select count(*)::int as count from public.${t}`);
      const n = r.rows[0]?.count ?? 0;
      console.info(`  ${t}: ${n}`);
    } catch (e) {
      console.info(`  ${t}: ERR ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // Storage buckets.
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const buckets = await supabase.storage.listBuckets();
  console.info(`\nStorage buckets: ${(buckets.data ?? []).length}`);
  for (const b of buckets.data ?? []) {
    console.info(`  ${b.name} (${b.public ? 'public' : 'private'})`);
  }
  const expected = ['symbols-public', 'symbols-private'];
  const missingBuckets = expected.filter((b) => !(buckets.data ?? []).some((x) => x.name === b));
  if (missingBuckets.length > 0) {
    console.info(`  ✗ Missing buckets: ${missingBuckets.join(', ')}`);
  } else {
    console.info(`  ✓ Both BlueCare buckets present.`);
  }
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.stack : String(e));
  process.exit(1);
});
