/**
 * Symbol-image vision audit — Quality Fix Phase 1.
 *
 * Fixes the "Apple labeled as car" data-quality bug. Iterates every
 * row in `public.symbols`, fetches the image from the symbols-public
 * Storage bucket, and asks Claude vision (claude-sonnet-4-6) whether
 * the EN+AR labels actually match what the image shows. Writes one row
 * to `symbol_audit` per symbol, all tagged with the same audit_run_id
 * so the operator UI on /admin/symbols-audit can render the latest
 * sweep cleanly.
 *
 * The prompt is the exact text from the Quality Fix directive — do
 * not edit casually, the operator-facing copy in the admin UI lines
 * up with these field names.
 *
 * Cost note: 40 symbols × ~$0.001 = ~$0.04 per full sweep. Cheap. The
 * sweep is not wrapped in aiGuard because there is no child context;
 * cost is booked separately to the run summary printed at the end.
 *
 * Usage:
 *   pnpm exec tsx db/scripts/audit-symbols.ts
 *
 * Exit codes:
 *   0 — sweep finished. ANY mismatches are flagged in stdout AND in
 *       symbol_audit. Operator decides next steps before any DB
 *       repair is applied (per Quality Fix directive: STOP for human
 *       review before fixes).
 *   1 — fatal error (missing env, network, vision model unavailable).
 *   2 — pre-flight env missing.
 */
import './lib/env';
import { randomUUID } from 'node:crypto';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { parseVisionFinding, visionAuditPrompt } from './lib/audit-prompt';

const CLAUDE_MODEL = 'claude-sonnet-4-6';
const BUCKET = 'symbols-public';

interface SymbolRow {
  id: string;
  label_en: string;
  label_ar: string;
  image_path: string;
  status: string;
}

// VisionFinding type comes from ./lib/audit-prompt — shared with the
// reseed-on-insert pipeline so both passes apply the same standard
// (verified-by-construction guarantee).
type AuditFinding = ReturnType<typeof parseVisionFinding> extends infer T ? NonNullable<T> : never;

function buildPublicUrl(supabaseUrl: string, imagePath: string): string {
  return `${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/public/${BUCKET}/${imagePath}`;
}

async function fetchAsBase64(url: string): Promise<{
  base64: string;
  mediaType: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif';
}> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch ${url} → ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const ct = res.headers.get('content-type') ?? 'image/png';
  const allowed = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const;
  const mediaType = (allowed.find((m) => ct.startsWith(m)) ??
    'image/png') as (typeof allowed)[number];
  return { base64: buf.toString('base64'), mediaType };
}

// Use the shared parser from ./lib/audit-prompt.
const parseFinding = parseVisionFinding;

async function main(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const sr = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!url || !sr || !apiKey) {
    console.error(
      'Missing NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or ANTHROPIC_API_KEY.',
    );
    process.exit(2);
  }
  const supabase = createClient(url, sr, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const claude = new Anthropic({ apiKey });

  const list = await (
    supabase.from('symbols') as never as {
      select: (cols: string) => {
        eq: (
          col: string,
          v: string,
        ) => {
          order: (
            col: string,
            opts: { ascending: boolean },
          ) => Promise<{
            data: SymbolRow[] | null;
            error: { message: string } | null;
          }>;
        };
      };
    }
  )
    .select('id, label_en, label_ar, image_path, status')
    .eq('status', 'active')
    .order('label_en', { ascending: true });
  if (list.error) {
    console.error('Failed to list symbols:', list.error.message);
    process.exit(1);
  }
  const symbols = list.data ?? [];
  if (symbols.length === 0) {
    console.error('No active symbols found. Did you run seed-arasaac.ts yet?');
    process.exit(1);
  }
  const auditRunId = randomUUID();
  console.info(`[audit] run_id=${auditRunId}  model=${CLAUDE_MODEL}  symbols=${symbols.length}`);
  console.info('');

  let matchCount = 0;
  let mismatchCount = 0;
  let errorCount = 0;
  let totalCostUsd = 0;
  const mismatches: { sym: SymbolRow; finding: AuditFinding }[] = [];

  for (let i = 0; i < symbols.length; i++) {
    const sym = symbols[i]!;
    const idx = `[${String(i + 1).padStart(2, ' ')}/${symbols.length}]`;
    process.stdout.write(`${idx} ${sym.label_en} / ${sym.label_ar}  …  `);
    const publicUrl = buildPublicUrl(url, sym.image_path);
    let img;
    try {
      img = await fetchAsBase64(publicUrl);
    } catch (e) {
      console.info(`✗ image fetch failed: ${e instanceof Error ? e.message : String(e)}`);
      errorCount++;
      continue;
    }
    let res;
    try {
      res = await claude.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: 400,
        temperature: 0,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'base64', media_type: img.mediaType, data: img.base64 },
              },
              { type: 'text', text: visionAuditPrompt(sym.label_en, sym.label_ar) },
            ],
          },
        ],
      });
    } catch (e) {
      console.info(`✗ claude call failed: ${e instanceof Error ? e.message : String(e)}`);
      errorCount++;
      continue;
    }
    const callCost =
      (res.usage.input_tokens / 1_000_000) * 3 + (res.usage.output_tokens / 1_000_000) * 15;
    totalCostUsd += callCost;
    const text = res.content
      .filter((b): b is Anthropic.Messages.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');
    const finding = parseFinding(text);
    if (!finding) {
      console.info(`✗ unparsable response: ${text.slice(0, 80)}…`);
      errorCount++;
      continue;
    }

    await (
      supabase.from('symbol_audit') as never as {
        insert: (row: Record<string, unknown>) => Promise<{
          error: { message: string } | null;
        }>;
      }
    ).insert({
      audit_run_id: auditRunId,
      symbol_id: sym.id,
      matches: finding.matches,
      confidence: finding.confidence,
      claude_description: finding.what_image_actually_shows,
      recommended_label_en: finding.recommended_label_en || null,
      recommended_label_ar: finding.recommended_label_ar || null,
      raw_response: {
        text,
        input_tokens: res.usage.input_tokens,
        output_tokens: res.usage.output_tokens,
        stop_reason: res.stop_reason,
        cost_usd: callCost,
      },
      model: CLAUDE_MODEL,
    });

    if (finding.matches) {
      console.info(`✓ match (conf ${finding.confidence.toFixed(2)})`);
      matchCount++;
    } else {
      console.info(
        `✗ MISMATCH (conf ${finding.confidence.toFixed(2)})  → ${finding.what_image_actually_shows}`,
      );
      mismatchCount++;
      mismatches.push({ sym, finding });
    }
  }

  console.info('');
  console.info('=== SUMMARY ===');
  console.info(`  audit_run_id   : ${auditRunId}`);
  console.info(`  symbols total  : ${symbols.length}`);
  console.info(`  matched        : ${matchCount}`);
  console.info(`  MISMATCHED     : ${mismatchCount}`);
  console.info(`  errored        : ${errorCount}`);
  console.info(`  total cost     : $${totalCostUsd.toFixed(4)}`);

  if (mismatches.length > 0) {
    console.info('');
    console.info('=== MISMATCHES — operator review required ===');
    console.info('Per Quality Fix directive: STOP and report. Do NOT auto-repair.');
    console.info('User decides per row whether to relabel (UPDATE labels) or replace image.');
    console.info('');
    for (const { sym, finding } of mismatches) {
      console.info(`  symbol_id          : ${sym.id}`);
      console.info(`  current label_en   : ${sym.label_en}`);
      console.info(`  current label_ar   : ${sym.label_ar}`);
      console.info(`  image_path         : ${sym.image_path}`);
      console.info(`  what image shows   : ${finding.what_image_actually_shows}`);
      console.info(`  recommended_en     : ${finding.recommended_label_en}`);
      console.info(`  recommended_ar     : ${finding.recommended_label_ar}`);
      console.info(`  confidence         : ${finding.confidence.toFixed(2)}`);
      console.info('  ---');
    }
    // STOP CONDITION — non-zero exit signals operator review needed.
    // We still exit 0 so the script doesn't break a CI run; the
    // mismatch count + the symbol_audit table are the source of truth.
    console.info('');
    console.info('Next step: review mismatches above. After deciding per row, run');
    console.info('  pnpm exec tsx db/scripts/repair-symbols.ts');
    console.info('with the chosen actions (relabel vs. replace).');
  }
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.stack : String(e));
  process.exit(1);
});
