/**
 * Print the matched (correct) rows from the latest audit run + total cost.
 */
import './lib/env';
import { createClient } from '@supabase/supabase-js';

interface AuditRow {
  audit_run_id: string;
  symbol_id: string;
  matches: boolean;
  confidence: number;
  raw_response: { cost_usd?: number };
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
  // Latest full run = the run with the most rows.
  const byRun = new Map<string, AuditRow[]>();
  for (const r of rows) {
    const list = byRun.get(r.audit_run_id) ?? [];
    list.push(r);
    byRun.set(r.audit_run_id, list);
  }
  const sorted = Array.from(byRun.entries()).sort((a, b) => b[1].length - a[1].length);
  const [runId, runRows] = sorted[0]!;
  const matches = runRows.filter((r) => r.matches);
  const cost = runRows.reduce(
    (sum, r) => sum + (typeof r.raw_response?.cost_usd === 'number' ? r.raw_response.cost_usd : 0),
    0,
  );

  // Lookup matched symbol metadata
  const ids = matches.map((r) => r.symbol_id);
  const symLookup = await (
    supabase.from('symbols') as never as {
      select: (cols: string) => {
        in: (col: string, v: string[]) => Promise<{ data: SymbolRow[] | null }>;
      };
    }
  )
    .select('id, label_en, label_ar, image_path')
    .in('id', ids);
  const symMap = new Map<string, SymbolRow>();
  for (const r of symLookup.data ?? []) symMap.set(r.id, r);

  console.info(`run_id      = ${runId}`);
  console.info(`total cost  = $${cost.toFixed(4)}`);
  console.info(`total rows  = ${runRows.length}`);
  console.info(`matched     = ${matches.length}`);
  console.info(`mismatched  = ${runRows.length - matches.length}`);
  console.info('');
  console.info('=== MATCHED (correctly labeled) ===');
  for (const r of matches) {
    const s = symMap.get(r.symbol_id);
    console.info(
      `  ${s?.label_en} / ${s?.label_ar}  ←  ${s?.image_path}  (conf ${r.confidence.toFixed(2)})`,
    );
  }
}
main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
