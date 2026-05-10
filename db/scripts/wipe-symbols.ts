/**
 * Wipe-symbols — Quality Fix Phase 1.
 *
 * Removes ALL rows in `public.symbols` and the orphan-tolerant
 * references that won't cascade automatically. Used as a one-shot
 * before `reseed-symbols-from-arasaac.ts` to start clean.
 *
 * Safety latches (multiple, intentional):
 *   1. Requires --confirm on the command line. Without it, the script
 *      prints the plan + exits 0 without touching any data.
 *   2. Reads the latest `symbol_audit` run. Refuses to run unless the
 *      mismatch rate is > 50%. Quality Fix directive: "refuses to run
 *      unless audit_run shows >50% mismatch (safety latch)."
 *   3. Prints counts before + after each delete + a final summary so
 *      the operator can spot a divergence between expected and actual.
 *
 * FK landscape (verified against db/migrations/0000_initial_schema.sql
 * and 0003_vocabulary_suggestions.sql + 0006_symbol_audit.sql):
 *   • symbol_audit.symbol_id            FK → on delete cascade ✓
 *   • vocabulary_suggestions.symbol_id  FK → on delete cascade ✓
 *   • vocabulary_sets.symbol_id         NO FK, NOT NULL — must explicit
 *   • custom_voices.symbol_id           NO FK, NOT NULL — must explicit
 *   • input_events.symbol_id            nullable, no FK — keep historical
 *   • output_events.symbol_id           nullable, no FK — keep historical
 *
 * Order of operations:
 *   1. DELETE FROM vocabulary_sets WHERE symbol_id IS NOT NULL
 *   2. DELETE FROM custom_voices WHERE symbol_id IS NOT NULL
 *   3. DELETE FROM symbols
 *      └── cascades vocabulary_suggestions + symbol_audit
 *
 * Usage:
 *   pnpm exec tsx db/scripts/wipe-symbols.ts            # preview only
 *   pnpm exec tsx db/scripts/wipe-symbols.ts --confirm  # actually wipe
 *
 * Exit codes:
 *   0 — preview shown OR wipe completed.
 *   1 — error (env missing, audit refusal, delete failed).
 *   2 — pre-flight env missing.
 */
import './lib/env';
import { createClient } from '@supabase/supabase-js';

const MISMATCH_THRESHOLD = 0.5;

interface AuditRow {
  audit_run_id: string;
  matches: boolean;
}

async function main(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const sr = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !sr) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
    process.exit(2);
  }
  const supabase = createClient(url, sr, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const isConfirmed = process.argv.includes('--confirm');
  const isForce = process.argv.includes('--force');

  // 1. Safety latch — read latest audit run and confirm > 50% mismatch.
  // `--force` bypasses the latch when the operator KNOWS the seed is
  // verified-by-construction garbage (e.g. cleaning duplicates from
  // smoke-test runs of reseed-symbols-from-arasaac.ts).
  console.info('[1/4] reading latest symbol_audit run …');
  if (isForce) {
    console.info('  ⚠️  --force in effect — skipping mismatch-rate latch');
  }
  const auditRes = await (
    supabase.from('symbol_audit') as never as {
      select: (cols: string) => {
        order: (col: string, opts: { ascending: boolean }) => Promise<{ data: AuditRow[] | null }>;
      };
    }
  )
    .select('audit_run_id, matches')
    .order('audited_at', { ascending: false });
  const rows = auditRes.data ?? [];
  if (rows.length === 0) {
    if (!isForce) {
      console.error(
        '  ✗ No symbol_audit rows. Run audit-symbols.ts first so the safety latch has data.',
      );
      console.error('    Pass --force to bypass (e.g. cleaning smoke-test contamination).');
      process.exit(1);
    }
    console.info('  (no audit rows; --force bypassed the latch)');
  }
  const byRun = new Map<string, AuditRow[]>();
  for (const r of rows) {
    const list = byRun.get(r.audit_run_id) ?? [];
    list.push(r);
    byRun.set(r.audit_run_id, list);
  }
  const sorted = Array.from(byRun.entries()).sort((a, b) => b[1].length - a[1].length);
  const top = sorted[0];
  const mismatchPct = top ? top[1].filter((r) => !r.matches).length / top[1].length : 0;
  if (top) {
    const mismatched = top[1].filter((r) => !r.matches).length;
    console.info(
      `  latest run ${top[0]}  rows=${top[1].length}  mismatched=${mismatched} (${(mismatchPct * 100).toFixed(1)}%)`,
    );
  }
  if (!isForce && mismatchPct <= MISMATCH_THRESHOLD) {
    console.error(
      `  ✗ Safety latch: mismatch rate ${(mismatchPct * 100).toFixed(1)}% is not > ${(MISMATCH_THRESHOLD * 100).toFixed(0)}%. Refusing to wipe.`,
    );
    console.error(
      '    The seed appears mostly correct. Use repair-symbols.ts for selective fixes instead.',
    );
    console.error('    Pass --force to bypass (operator confirmation required).');
    process.exit(1);
  }
  if (!isForce) console.info('  ✓ safety latch cleared (>50% mismatch).');
  console.info('');

  // 2. Pre-flight counts.
  console.info('[2/4] counts before wipe …');
  const counts = await tableCounts(supabase);
  for (const [t, c] of Object.entries(counts)) console.info(`  ${t.padEnd(28)} : ${c}`);
  console.info('');

  if (!isConfirmed) {
    console.info('Preview mode. Re-run with --confirm to actually wipe.');
    console.info('');
    console.info('Plan (in order):');
    console.info('  DELETE FROM vocabulary_sets    WHERE true   (no cascade from symbols)');
    console.info('  DELETE FROM custom_voices      WHERE true   (no cascade from symbols)');
    console.info('  DELETE FROM symbols            WHERE true');
    console.info('    └─ cascades:');
    console.info('       symbol_audit, vocabulary_suggestions');
    return;
  }

  // 3. Wipe.
  console.info('[3/4] wiping …');
  // Use a sentinel filter that always matches every row (`id != all-zero-uuid`).
  const SENTINEL = '00000000-0000-0000-0000-000000000000';

  const tables: { table: string; column: string }[] = [
    { table: 'vocabulary_sets', column: 'id' },
    { table: 'custom_voices', column: 'id' },
    { table: 'symbols', column: 'id' },
  ];
  for (const { table, column } of tables) {
    const r = await (
      supabase.from(table) as never as {
        delete: () => {
          neq: (col: string, v: string) => Promise<{ error: { message: string } | null }>;
        };
      }
    )
      .delete()
      .neq(column, SENTINEL);
    if (r.error) {
      console.error(`  ✗ ${table}: ${r.error.message}`);
      process.exit(1);
    }
    console.info(`  ✓ ${table} cleared`);
  }

  // 4. Post-flight counts.
  console.info('');
  console.info('[4/4] counts after wipe …');
  const after = await tableCounts(supabase);
  for (const [t, c] of Object.entries(after)) console.info(`  ${t.padEnd(28)} : ${c}`);
  console.info('');
  console.info('=== WIPE COMPLETE ===');
  console.info('Next: pnpm exec tsx db/scripts/reseed-symbols-from-arasaac.ts');
}

async function tableCounts(
  supabase: ReturnType<typeof createClient>,
): Promise<Record<string, number>> {
  const tables = [
    'symbols',
    'vocabulary_sets',
    'vocabulary_suggestions',
    'custom_voices',
    'symbol_audit',
  ];
  const out: Record<string, number> = {};
  for (const t of tables) {
    const res = await (
      supabase.from(t) as never as {
        select: (
          cols: string,
          opts: { count: 'exact'; head: true },
        ) => Promise<{
          count: number | null;
        }>;
      }
    ).select('id', { count: 'exact', head: true });
    out[t] = res.count ?? 0;
  }
  return out;
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.stack : String(e));
  process.exit(1);
});
