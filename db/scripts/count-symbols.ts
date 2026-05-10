/**
 * Quick op-tool: count symbols by status. Used by Phase 1 audit
 * pre-flight to confirm what we're about to feed to Claude vision.
 */
import './lib/env';
import { createClient } from '@supabase/supabase-js';

async function main(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const sr = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabase = createClient(url, sr, {
    auth: { persistSession: false },
  });
  const all = await (
    supabase.from('symbols') as never as {
      select: (cols: string) => Promise<{ data: { status: string }[] | null }>;
    }
  ).select('status');
  const counts: Record<string, number> = {};
  for (const r of all.data ?? []) counts[r.status] = (counts[r.status] ?? 0) + 1;
  console.info('symbols by status:');
  for (const [k, v] of Object.entries(counts).sort()) console.info(`  ${k}: ${v}`);
  console.info(`  total: ${(all.data ?? []).length}`);
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
