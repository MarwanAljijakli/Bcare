/**
 * Tiny one-off: tighten the AR label on the "give" symbol to match
 * Claude's audit recommendation (أعطِ instead of أعطِني). Claude's
 * vision returned matches=false at 0.55 confidence when the row was
 * labeled أعطِني — its preferred label is the bare imperative أعطِ.
 */
import './lib/env';
import { createClient } from '@supabase/supabase-js';

const ID = '510d1b3b-e0eb-4827-845d-fdad87b4b267';

async function main(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const sr = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !sr) {
    console.error('Missing SUPABASE_* env.');
    process.exit(1);
  }
  const supabase = createClient(url, sr, { auth: { persistSession: false } });
  const res = await (
    supabase.from('symbols') as never as {
      update: (row: Record<string, unknown>) => {
        eq: (col: string, v: string) => Promise<{ error: unknown }>;
      };
    }
  )
    .update({ label_ar: 'أعطِ', updated_at: new Date().toISOString() })
    .eq('id', ID);
  if (res.error) {
    console.error(`update failed: ${JSON.stringify(res.error)}`);
    process.exit(1);
  }
  console.info(`✓ ${ID} label_ar → "أعطِ"`);
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.stack : String(e));
  process.exit(1);
});
