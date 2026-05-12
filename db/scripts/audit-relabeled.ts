/**
 * Re-audit only the two rows that were relabeled by
 * db/scripts/relabel-symbols.ts. Used after the relabel to confirm
 * matched:true now that the labels match what the image shows.
 *
 * Mirrors the Claude vision prompt + parsing from audit-symbols.ts —
 * see that file for the canonical implementation; this is a tiny
 * subset that doesn't write to symbol_audit.
 *
 * Usage:
 *   pnpm dlx tsx db/scripts/audit-relabeled.ts
 */
import './lib/env';
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

const TARGETS = ['510d1b3b-e0eb-4827-845d-fdad87b4b267', '85bdaaf8-460c-4727-9af2-4d3ff2730fbe'];

function buildPublicUrl(url: string, imagePath: string): string {
  return `${url.replace(/\/$/, '')}/storage/v1/object/public/${BUCKET}/${imagePath}`;
}

async function fetchAsBase64(url: string): Promise<{
  base64: string;
  mediaType: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif';
}> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch ${url}: ${res.status}`);
  const buf = await res.arrayBuffer();
  const ct = res.headers.get('content-type') ?? 'image/png';
  let mt: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif' = 'image/png';
  if (ct.includes('jpeg') || ct.includes('jpg')) mt = 'image/jpeg';
  else if (ct.includes('webp')) mt = 'image/webp';
  else if (ct.includes('gif')) mt = 'image/gif';
  return { base64: Buffer.from(buf).toString('base64'), mediaType: mt };
}

async function main(): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const sr = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!supabaseUrl || !sr || !anthropicKey) {
    console.error('Missing env (SUPABASE_*, ANTHROPIC_API_KEY).');
    process.exit(1);
  }
  const supabase = createClient(supabaseUrl, sr, { auth: { persistSession: false } });
  const anthropic = new Anthropic({ apiKey: anthropicKey });

  const rowsRes = await (
    supabase.from('symbols') as never as {
      select: (cols: string) => {
        in: (col: string, vs: string[]) => Promise<{ data: SymbolRow[] | null; error: unknown }>;
      };
    }
  )
    .select('id, label_en, label_ar, image_path, status')
    .in('id', TARGETS);
  const rows = rowsRes.data ?? [];
  if (rows.length === 0) {
    console.error('No symbols found for target IDs.');
    process.exit(1);
  }

  let allMatched = true;
  for (const row of rows) {
    const url = buildPublicUrl(supabaseUrl, row.image_path);
    const { base64, mediaType } = await fetchAsBase64(url);
    const resp = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 600,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data: base64 },
            },
            {
              type: 'text',
              text: visionAuditPrompt({ labelEn: row.label_en, labelAr: row.label_ar }),
            },
          ],
        },
      ],
    });
    const text = resp.content[0]?.type === 'text' ? resp.content[0].text : '';
    const parsed = parseVisionFinding(text);
    if (!parsed) {
      console.error(`  ${row.id} (${row.label_en} / ${row.label_ar}): unparseable response`);
      allMatched = false;
      continue;
    }
    const flag = parsed.matches ? '✓' : '✗';
    console.info(
      `  ${flag} ${row.id}: ${row.label_en} / ${row.label_ar} → matches=${parsed.matches} (confidence ${parsed.confidence.toFixed(2)})`,
    );
    if (parsed.recommended_label_en) {
      console.info(
        `     recommended: ${parsed.recommended_label_en} / ${parsed.recommended_label_ar}`,
      );
    }
    if (!parsed.matches) allMatched = false;
  }

  if (!allMatched) {
    console.error('\n✗ At least one row still mismatched.');
    process.exit(2);
  }
  console.info('\n✓ Both relabeled rows now match the image.');
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.stack : String(e));
  process.exit(1);
});
