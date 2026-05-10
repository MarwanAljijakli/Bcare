/**
 * Sample N random symbols + their latest audit verdict. Used after the
 * acceptance audit to surface a spot-check inventory for the operator.
 *
 * Output is markdown so it pastes cleanly into chat or seed-quality-report.md.
 *
 * Usage:
 *   pnpm exec tsx db/scripts/sample-symbols.ts          # 5 random samples
 *   pnpm exec tsx db/scripts/sample-symbols.ts 10       # 10 random samples
 */
import './lib/env';
import { createClient } from '@supabase/supabase-js';

interface SymbolRow {
  id: string;
  label_en: string;
  label_ar: string;
  image_path: string;
  category: string | null;
  tags: string[];
}

interface AuditRow {
  symbol_id: string;
  matches: boolean;
  confidence: number;
  claude_description: string;
  audited_at: string;
}

async function main(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const sr = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabase = createClient(url, sr, { auth: { persistSession: false } });
  const n = Math.max(1, Math.min(50, Number(process.argv[2] ?? 5)));

  const all = await (
    supabase.from('symbols') as never as {
      select: (cols: string) => {
        eq: (col: string, v: string) => Promise<{ data: SymbolRow[] | null }>;
      };
    }
  )
    .select('id, label_en, label_ar, image_path, category, tags')
    .eq('status', 'active');
  const symbols = all.data ?? [];
  if (symbols.length === 0) {
    console.error('No active symbols.');
    process.exit(1);
  }
  // Fisher-Yates shuffle, take first N
  const shuffled = [...symbols];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
  }
  const sampled = shuffled.slice(0, n);

  // Pull latest audit row per symbol (one query, then in-JS pick).
  const auditRes = await (
    supabase.from('symbol_audit') as never as {
      select: (cols: string) => {
        in: (
          col: string,
          v: string[],
        ) => {
          order: (
            col: string,
            opts: { ascending: boolean },
          ) => Promise<{
            data: AuditRow[] | null;
          }>;
        };
      };
    }
  )
    .select('symbol_id, matches, confidence, claude_description, audited_at')
    .in(
      'symbol_id',
      sampled.map((s) => s.id),
    )
    .order('audited_at', { ascending: false });
  const latestBySymbol = new Map<string, AuditRow>();
  for (const r of auditRes.data ?? []) {
    if (!latestBySymbol.has(r.symbol_id)) latestBySymbol.set(r.symbol_id, r);
  }

  const SUPABASE_PUBLIC = url.replace(/\/$/, '');
  console.info(`# ${n} random symbols from the verified seed\n`);
  for (const s of sampled) {
    const audit = latestBySymbol.get(s.id);
    const imgUrl = `${SUPABASE_PUBLIC}/storage/v1/object/public/symbols-public/${s.image_path}`;
    console.info(`## ${s.label_en} / ${s.label_ar}`);
    console.info(`- **Image**: ${imgUrl}`);
    console.info(`- **Category**: ${s.category ?? '—'}`);
    console.info(
      `- **ARASAAC ID**: ${s.tags.find((t) => t.startsWith('arasaac:'))?.slice('arasaac:'.length) ?? '?'}`,
    );
    if (audit) {
      console.info(
        `- **Audit verdict**: ${audit.matches ? '✓ matches' : '✗ MISMATCH'} (confidence ${audit.confidence.toFixed(2)})`,
      );
      console.info(`- **Claude says image shows**: ${audit.claude_description}`);
    } else {
      console.info('- **Audit verdict**: (no audit row yet)');
    }
    console.info('');
  }
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.stack : String(e));
  process.exit(1);
});
