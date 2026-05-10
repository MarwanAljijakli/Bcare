/**
 * Inspect the latest symbol_audit run. Print:
 *   - audit_run_id, started_at
 *   - total / matched / mismatched counts
 *   - per-mismatch: symbol_id, current EN/AR, claude_description, recommended EN/AR, confidence
 *
 * Used after `audit-symbols.ts` to surface the actionable list cleanly
 * (the original run's stdout can scroll past in a big terminal).
 */
import './lib/env';
import { createClient } from '@supabase/supabase-js';

interface AuditRow {
  audit_run_id: string;
  symbol_id: string;
  matches: boolean;
  confidence: number;
  claude_description: string;
  recommended_label_en: string | null;
  recommended_label_ar: string | null;
  audited_at: string;
}

interface SymbolRow {
  id: string;
  label_en: string;
  label_ar: string;
  image_path: string;
}

async function main(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const sr = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabase = createClient(url, sr, { auth: { persistSession: false } });

  // Latest run = max audited_at, then group by audit_run_id.
  const all = await (
    supabase.from('symbol_audit') as never as {
      select: (cols: string) => {
        order: (
          col: string,
          opts: { ascending: boolean },
        ) => Promise<{
          data: AuditRow[] | null;
        }>;
      };
    }
  )
    .select('*')
    .order('audited_at', { ascending: false });
  const rows = all.data ?? [];
  if (rows.length === 0) {
    console.info('No audit rows yet. Run audit-symbols.ts first.');
    return;
  }
  // Group by run_id; pick the largest (most-complete) recent run.
  const byRun = new Map<string, AuditRow[]>();
  for (const r of rows) {
    const list = byRun.get(r.audit_run_id) ?? [];
    list.push(r);
    byRun.set(r.audit_run_id, list);
  }
  console.info(`[runs available] ${byRun.size} run(s):`);
  for (const [runId, list] of byRun) {
    console.info(`  ${runId}  rows=${list.length}  start=${list[list.length - 1]?.audited_at}`);
  }
  console.info('');
  const sorted = Array.from(byRun.entries()).sort((a, b) => b[1].length - a[1].length);
  const latestRunId = sorted[0]![0];
  const runRows = sorted[0]![1];
  const matched = runRows.filter((r) => r.matches);
  const mismatched = runRows.filter((r) => !r.matches);

  // Fetch the symbol metadata for context
  const symbolIds = runRows.map((r) => r.symbol_id);
  const symLookup = await (
    supabase.from('symbols') as never as {
      select: (cols: string) => {
        in: (col: string, v: string[]) => Promise<{ data: SymbolRow[] | null }>;
      };
    }
  )
    .select('id, label_en, label_ar, image_path')
    .in('id', symbolIds);
  const symMap = new Map<string, SymbolRow>();
  for (const r of symLookup.data ?? []) symMap.set(r.id, r);

  const mismatchPct = ((mismatched.length / runRows.length) * 100).toFixed(1);
  console.info('=== LATEST SYMBOL AUDIT RUN ===');
  console.info(`  audit_run_id : ${latestRunId}`);
  console.info(`  audited_at   : ${runRows[0]?.audited_at ?? '?'}`);
  console.info(`  total        : ${runRows.length}`);
  console.info(`  matched      : ${matched.length}`);
  console.info(`  MISMATCHED   : ${mismatched.length} (${mismatchPct}%)`);
  console.info('');

  if (mismatched.length === 0) {
    console.info('No mismatches. Symbol seed is clean. Continue to next phase.');
    return;
  }

  console.info('=== MISMATCHES ===');
  for (const r of mismatched) {
    const s = symMap.get(r.symbol_id);
    console.info(`  symbol_id      : ${r.symbol_id}`);
    console.info(`  current EN/AR  : ${s?.label_en ?? '?'}  /  ${s?.label_ar ?? '?'}`);
    console.info(`  image_path     : ${s?.image_path ?? '?'}`);
    console.info(`  what it shows  : ${r.claude_description}`);
    console.info(`  recommend EN   : ${r.recommended_label_en ?? '—'}`);
    console.info(`  recommend AR   : ${r.recommended_label_ar ?? '—'}`);
    console.info(`  confidence     : ${r.confidence.toFixed(2)}`);
    console.info('  ---');
  }
  console.info('');
  if (mismatched.length / runRows.length > 0.3) {
    console.info('⚠️  MISMATCH RATE > 30%. Quality Fix stop condition triggered:');
    console.info('   "pause and we will dump the entire current seed and re-seed from');
    console.info('   scratch with a different approach."');
  }
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
