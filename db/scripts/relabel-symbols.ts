/**
 * Phase 10.F.9 — manually relabel the two known symbol mismatches
 * called out by the Phase 10.G CHECKPOINT.
 *
 *   hand → give    (the pictogram is actually a "give" gesture)
 *   soup → ladle   (the pictogram is actually a ladle)
 *
 * Safe to re-run: each relabel reads the current row, applies the
 * change only if the label still matches the legacy text, and skips
 * otherwise. Never destructive on rows the operator already corrected
 * by hand.
 *
 * Usage:
 *   pnpm exec tsx db/scripts/relabel-symbols.ts            # apply
 *   pnpm exec tsx db/scripts/relabel-symbols.ts --dry-run  # preview
 */
import './lib/env';
import { createClient } from '@supabase/supabase-js';

interface Relabel {
  from_en: string;
  to_en: string;
  to_ar: string;
  to_phonetic_en?: string;
  to_phonetic_ar?: string;
}

const RELABELS: Relabel[] = [
  {
    from_en: 'hand',
    to_en: 'give',
    to_ar: 'أعطِني',
    to_phonetic_en: 'give',
    to_phonetic_ar: 'aa-teh-nee',
  },
  {
    from_en: 'soup',
    to_en: 'ladle',
    to_ar: 'مغرفة',
    to_phonetic_en: 'la-duhl',
    to_phonetic_ar: 'mig-ra-fah',
  },
];

interface SymbolRow {
  id: string;
  label_en: string;
  label_ar: string;
  phonetic_en: string | null;
  phonetic_ar: string | null;
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const sr = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !sr) {
    console.error('SUPABASE env vars missing — load db/.env.local first.');
    process.exit(1);
  }
  const supabase = createClient(url, sr, { auth: { persistSession: false } });

  for (const r of RELABELS) {
    const res = (await (
      supabase.from('symbols') as never as {
        select: (cols: string) => {
          eq: (col: string, v: string) => Promise<{ data: SymbolRow[] | null; error: unknown }>;
        };
      }
    )
      .select('id, label_en, label_ar, phonetic_en, phonetic_ar')
      .eq('label_en', r.from_en)) as { data: SymbolRow[] | null };

    const rows = res.data ?? [];
    if (rows.length === 0) {
      console.info(`[skip] "${r.from_en}" not found (already relabeled?)`);
      continue;
    }
    for (const row of rows) {
      console.info(`[plan] ${row.id}: ${row.label_en}/${row.label_ar} → ${r.to_en}/${r.to_ar}`);
      if (dryRun) continue;
      const upd = await (
        supabase.from('symbols') as never as {
          update: (row: Record<string, unknown>) => {
            eq: (col: string, v: string) => Promise<{ error: unknown }>;
          };
        }
      )
        .update({
          label_en: r.to_en,
          label_ar: r.to_ar,
          phonetic_en: r.to_phonetic_en ?? row.phonetic_en,
          phonetic_ar: r.to_phonetic_ar ?? row.phonetic_ar,
          updated_at: new Date().toISOString(),
        })
        .eq('id', row.id);
      if (upd.error) {
        console.error(`[error] ${row.id}: ${JSON.stringify(upd.error)}`);
      } else {
        console.info(`[ok]   ${row.id} relabeled.`);
      }
    }
  }
  if (dryRun) console.info('\nDry run — no rows changed. Re-run without --dry-run to apply.');
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
