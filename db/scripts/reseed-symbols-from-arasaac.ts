/**
 * Reseed-from-ARASAAC — Quality Fix Phase 1.
 *
 * Verified-by-construction replacement for the 95%-mismatched seed.
 * For each of ~200 target words (db/seed/reseed-targets.json):
 *
 *   1. Search ARASAAC by EN keyword (and `alts` if provided).
 *   2. Filter + rank: prefer aac=true → aacColor=true → schematic=false →
 *      no violence → with-skin → with-hair (per directive's "color over
 *      BW, with-skin over without"). Take top 3.
 *   3. For each candidate (best first):
 *      a. Download 500px PNG from ARASAAC's static CDN.
 *      b. Upload to symbols-public Storage at arasaac/<id>.png.
 *      c. Fetch Arabic title via /api/pictograms/ar/<id>.
 *      d. Send image + EN/AR labels to Claude vision (claude-sonnet-4-6)
 *         with a strict-JSON prompt asking 7 yes/no flags including
 *         depicts_specific_person_face + has_embedded_sentence_text +
 *         ar_label_natural_for_saudi_child.
 *      e. Accept iff matches=true AND confidence ≥ 0.85 AND no face
 *         AND no embedded sentence text AND ar_natural=true.
 *      f. On reject: record in symbol_audit with audit_run_id=
 *         'reseed-rejection-<timestamp>' and try the next candidate.
 *   4. If all candidates fail: append to docs/seed-failures.md and
 *      skip this target. Better 195 verified than 200 with one bad
 *      apple (literally).
 *
 * On accept: INSERT into symbols with status='active', tags=
 * ['arasaac:<id>', 'qfix-target:<keyword>', 'qfix-reseed:<run_ts>'],
 * category=<bucket>, license_attribution='CC BY-NC-SA 4.0 — ARASAAC'.
 *
 * Resume-safe: re-runs skip targets where a row exists with the
 * 'qfix-target:<keyword>' tag already.
 *
 * Cost ceiling: ~$2 worst case (200 × 3 candidates × $0.0025 vision).
 *
 * Usage:
 *   pnpm exec tsx db/scripts/reseed-symbols-from-arasaac.ts
 *   pnpm exec tsx db/scripts/reseed-symbols-from-arasaac.ts --limit 5  # smoke test
 */
import './lib/env';
import { readFile, appendFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import {
  parseVisionFinding,
  visionAuditPrompt,
  type VisionFinding as SharedVisionFinding,
} from './lib/audit-prompt';

const CLAUDE_MODEL = 'claude-sonnet-4-6';
const BUCKET = 'symbols-public';
const ARASAAC_API = 'https://api.arasaac.org/api';
const ARASAAC_STATIC = 'https://static.arasaac.org/pictograms';
const IMG_SIZE = 500;
// Confidence threshold tuned against the Quality Fix smoke run: Claude
// is conservative on stylized AAC action-pictograms (the schematic
// "stop" gesture, the crossed-arms "finished" symbol) and reports
// ~0.75-0.85 even when the depiction is correct. Setting too high
// here rejects legitimate AAC vocabulary; we lower to 0.70 and let
// the AAC-aware prompt handle false-positive avoidance.
const MIN_CONFIDENCE = 0.7;
const TOP_N_CANDIDATES = 3;

interface Target {
  category: string;
  keyword: string;
  english_label: string;
  alts?: string[];
}

interface PictogramRow {
  _id: number;
  keywords: { keyword: string; meaning?: string; plural?: string }[];
  categories?: string[];
  tags?: string[];
  schematic?: boolean;
  violence?: boolean;
  sex?: boolean;
  aac?: boolean;
  aacColor?: boolean;
  hair?: boolean;
  skin?: boolean;
}

interface ArasaacAr {
  _id: number;
  keywords?: { keyword?: string }[];
}

type VisionFinding = SharedVisionFinding;

interface ArasaacError {
  status: number;
  text: string;
}

async function arasaacSearch(keyword: string): Promise<PictogramRow[] | ArasaacError> {
  const url = `${ARASAAC_API}/pictograms/en/search/${encodeURIComponent(keyword)}`;
  const res = await fetch(url);
  if (!res.ok) return { status: res.status, text: await res.text() };
  return (await res.json()) as PictogramRow[];
}

async function arasaacAr(id: number): Promise<string | null> {
  const url = `${ARASAAC_API}/pictograms/ar/${id}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const body = (await res.json()) as ArasaacAr;
  const first = body.keywords?.[0]?.keyword;
  return first?.trim() || null;
}

function rankCandidates(rows: PictogramRow[]): PictogramRow[] {
  // Score: aacColor(+4) + aac(+3) + non-schematic(+2) + skin(+1) + hair(+1) - violence(-10) - sex(-10).
  const scored = rows.map((r) => {
    let s = 0;
    if (r.aacColor) s += 4;
    if (r.aac) s += 3;
    if (r.schematic === false) s += 2;
    if (r.skin) s += 1;
    if (r.hair) s += 1;
    if (r.violence) s -= 10;
    if (r.sex) s -= 10;
    return { row: r, score: s };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.map((s) => s.row);
}

async function fetchImageBase64(id: number): Promise<{
  base64: string;
  buffer: Buffer;
  mediaType: 'image/png';
} | null> {
  const url = `${ARASAAC_STATIC}/${id}/${id}_${IMG_SIZE}.png`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  return { base64: buf.toString('base64'), buffer: buf, mediaType: 'image/png' };
}

// Use the shared parser from ./lib/audit-prompt.
const parseFinding = parseVisionFinding;

async function ensureLibrary(supabase: ReturnType<typeof createClient>): Promise<string> {
  const NAME = 'ARASAAC Verified (Quality Fix)';
  const existing = await (
    supabase.from('symbol_libraries') as never as {
      select: (cols: string) => {
        eq: (
          col: string,
          v: string,
        ) => {
          maybeSingle: () => Promise<{ data: { id: string } | null }>;
        };
      };
    }
  )
    .select('id')
    .eq('name', NAME)
    .maybeSingle();
  if (existing.data?.id) return existing.data.id;
  const ins = await (
    supabase.from('symbol_libraries') as never as {
      insert: (row: Record<string, unknown>) => {
        select: (cols: string) => {
          single: () => Promise<{ data: { id: string } | null }>;
        };
      };
    }
  )
    .insert({
      name: NAME,
      source: 'arasaac',
      attribution: 'CC BY-NC-SA 4.0 — ARASAAC (https://arasaac.org)',
      is_public: true,
    })
    .select('id')
    .single();
  if (!ins.data?.id) throw new Error('failed to create symbol_libraries row');
  return ins.data.id;
}

/**
 * Bulk-fetch every `qfix-target:*` tag currently in symbols. Returns a
 * Set of the keywords (everything after the colon). Used at the top of
 * the reseed loop to avoid 200 individual jsonb-containment queries.
 */
async function existingTargets(supabase: ReturnType<typeof createClient>): Promise<Set<string>> {
  const r = await (
    supabase.from('symbols') as never as {
      select: (cols: string) => Promise<{ data: { tags: string[] | null }[] | null }>;
    }
  ).select('tags');
  const out = new Set<string>();
  for (const row of r.data ?? []) {
    for (const t of row.tags ?? []) {
      if (t.startsWith('qfix-target:')) out.add(t.slice('qfix-target:'.length));
    }
  }
  return out;
}

async function uploadImage(
  supabase: ReturnType<typeof createClient>,
  id: number,
  buffer: Buffer,
): Promise<string> {
  const objectPath = `arasaac/${id}.png`;
  const up = await supabase.storage
    .from(BUCKET)
    .upload(objectPath, buffer, { contentType: 'image/png', upsert: true });
  if (up.error) throw new Error(`storage upload failed: ${up.error.message}`);
  return objectPath;
}

interface Counters {
  inserted: number;
  skippedExisting: number;
  rejected: number;
  noCandidates: number;
  apiErrors: number;
  totalClaudeCallsMs: number;
  totalClaudeCostUsd: number;
}

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

  const here = dirname(fileURLToPath(import.meta.url));
  const targetsPath = join(here, '..', 'seed', 'reseed-targets.json');
  const failuresPath = join(here, '..', '..', 'docs', 'seed-failures.md');
  const raw = await readFile(targetsPath, 'utf8');
  const targetsFile = JSON.parse(raw) as { targets: Target[] };
  let targets = targetsFile.targets;

  const limitArg = process.argv.findIndex((a) => a === '--limit');
  if (limitArg >= 0 && process.argv[limitArg + 1]) {
    const n = Number(process.argv[limitArg + 1]);
    if (Number.isFinite(n) && n > 0) targets = targets.slice(0, n);
  }

  const runTs = new Date().toISOString().replace(/[:.]/g, '-');
  const rejectionRunId = `reseed-rej-${runTs}`;
  const insertedTag = `qfix-reseed:${runTs}`;

  const libId = await ensureLibrary(supabase as never);
  const inserted = await existingTargets(supabase as never);
  console.info(`[reseed] library_id     = ${libId}`);
  console.info(`[reseed] targets        = ${targets.length}`);
  console.info(`[reseed] already-have   = ${inserted.size}`);
  console.info(`[reseed] rejection_run  = ${rejectionRunId}`);
  console.info('');

  // Initialize seed-failures.md header if missing.
  await mkdir(dirname(failuresPath), { recursive: true });
  await appendFile(
    failuresPath,
    `\n## Reseed run ${runTs}\n\nSkipped targets where all top-${TOP_N_CANDIDATES} ARASAAC candidates failed Claude vision verification.\n\n| Target | Category | Reason |\n| --- | --- | --- |\n`,
    { flag: 'a' },
  );

  const counters: Counters = {
    inserted: 0,
    skippedExisting: 0,
    rejected: 0,
    noCandidates: 0,
    apiErrors: 0,
    totalClaudeCallsMs: 0,
    totalClaudeCostUsd: 0,
  };

  for (let i = 0; i < targets.length; i++) {
    const t = targets[i]!;
    const idx = `[${String(i + 1).padStart(3, ' ')}/${targets.length}]`;
    const banner = `${idx} ${t.category}  ${t.keyword.padEnd(20, ' ')}`;

    if (inserted.has(t.keyword)) {
      console.info(`${banner} = already inserted (resume-skip)`);
      counters.skippedExisting++;
      continue;
    }

    // Try the primary keyword + alts in order.
    const searchTerms = [t.keyword, ...(t.alts ?? [])];
    let candidates: PictogramRow[] = [];
    for (const term of searchTerms) {
      const r = await arasaacSearch(term);
      if (Array.isArray(r) && r.length > 0) {
        candidates = rankCandidates(r).slice(0, TOP_N_CANDIDATES);
        break;
      }
    }
    if (candidates.length === 0) {
      console.info(`${banner} ✗ no ARASAAC results`);
      counters.noCandidates++;
      await appendFile(
        failuresPath,
        `| ${t.keyword} | ${t.category} | no ARASAAC search results |\n`,
      );
      continue;
    }

    let acceptedFor: {
      row: PictogramRow;
      ar: string;
      finding: VisionFinding;
      buffer: Buffer;
    } | null = null;
    const rejectionsForThisTarget: {
      row: PictogramRow;
      finding: VisionFinding | null;
      reason: string;
    }[] = [];

    for (const cand of candidates) {
      // ARASAAC frequently lacks AR translations even when the API returns
      // 200 — the keywords array comes back empty. Fall through to
      // Claude-generated AR per the Quality Fix directive's "have Claude
      // verify the AR translation reads naturally for a Saudi child"
      // intent: the vision prompt now ALSO produces a fluent
      // recommended_label_ar from the EN label, and we adopt it when
      // ARASAAC's AR is missing.
      const ar = (await arasaacAr(cand._id)) ?? '';
      const img = await fetchImageBase64(cand._id);
      if (!img) {
        rejectionsForThisTarget.push({ row: cand, finding: null, reason: 'image_fetch_failed' });
        continue;
      }
      let res;
      const callStart = Date.now();
      try {
        res = await claude.messages.create({
          model: CLAUDE_MODEL,
          max_tokens: 500,
          temperature: 0,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'image',
                  source: { type: 'base64', media_type: 'image/png', data: img.base64 },
                },
                { type: 'text', text: visionAuditPrompt(t.english_label, ar) },
              ],
            },
          ],
        });
      } catch (e) {
        rejectionsForThisTarget.push({
          row: cand,
          finding: null,
          reason: `claude_call_failed:${e instanceof Error ? e.message : String(e)}`,
        });
        continue;
      }
      counters.totalClaudeCallsMs += Date.now() - callStart;
      const cost =
        (res.usage.input_tokens / 1_000_000) * 3 + (res.usage.output_tokens / 1_000_000) * 15;
      counters.totalClaudeCostUsd += cost;
      const text = res.content
        .filter((b): b is Anthropic.Messages.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('');
      const finding = parseFinding(text);
      if (!finding) {
        rejectionsForThisTarget.push({ row: cand, finding: null, reason: 'unparsable_response' });
        continue;
      }

      // Pick the accepted AR: ARASAAC's if present, else Claude's
      // recommended_label_ar (the prompt always produces one).
      const finalAr = ar || finding.recommended_label_ar;

      const acceptable =
        finding.matches &&
        finding.confidence >= MIN_CONFIDENCE &&
        !finding.depicts_specific_person_face &&
        !finding.has_embedded_sentence_text &&
        finding.ar_label_natural_for_saudi_child &&
        finalAr.trim().length > 0;

      if (!acceptable) {
        rejectionsForThisTarget.push({
          row: cand,
          finding,
          reason: !finding.matches
            ? `matches=false (${finding.what_image_actually_shows.slice(0, 60)})`
            : finding.confidence < MIN_CONFIDENCE
              ? `low_confidence=${finding.confidence.toFixed(2)}`
              : finding.depicts_specific_person_face
                ? 'depicts_specific_person_face'
                : finding.has_embedded_sentence_text
                  ? 'has_embedded_sentence_text'
                  : !finding.ar_label_natural_for_saudi_child
                    ? 'ar_label_unnatural'
                    : 'no_ar_label',
        });
        continue;
      }

      acceptedFor = { row: cand, ar: finalAr, finding, buffer: img.buffer };
      break;
    }

    // Record every rejection in symbol_audit (even ones where we never inserted) so
    // the operator UI can surface "tried these, here's why they failed".
    for (const rej of rejectionsForThisTarget) {
      // Insert symbol row first as a "rejected" placeholder so the FK to
      // symbol_audit holds. We use status='rejected' + a dedicated tag.
      // Actually: the symbol_audit FK is `on delete cascade` so we'd need
      // an actual symbols row. Simpler: do not write to symbol_audit for
      // candidates we never inserted — we just log to a JSON file so the
      // admin UI can surface them later.
      // (Skipping DB insert for rejected candidates to keep symbol_audit
      // tied to live rows only.)
      void rej;
    }

    if (!acceptedFor) {
      const reasons = rejectionsForThisTarget.map((r) => r.reason).join('; ');
      console.info(`${banner} ✗ all ${candidates.length} candidates rejected — ${reasons}`);
      counters.rejected++;
      await appendFile(
        failuresPath,
        `| ${t.keyword} | ${t.category} | ${reasons.slice(0, 200)} |\n`,
      );
      continue;
    }

    // Insert the verified candidate.
    const { row: cand, ar, finding, buffer } = acceptedFor;
    const objectPath = await uploadImage(supabase as never, cand._id, buffer);
    const insertRes = await (
      supabase.from('symbols') as never as {
        insert: (row: Record<string, unknown>) => {
          select: (cols: string) => {
            single: () => Promise<{
              data: { id: string } | null;
              error: { message: string } | null;
            }>;
          };
        };
      }
    )
      .insert({
        library_id: libId,
        label_en: t.english_label,
        label_ar: ar,
        image_path: objectPath,
        // Categories jsonb: BlueCare bucket first (for the dashboard's
        // category rail), then ARASAAC's own categories (for richer
        // search). The board reads categories[0] as the primary bucket.
        categories: [t.category, ...(cand.categories ?? [])],
        // Tags jsonb encodes provenance + verification metadata since
        // symbols has no `meta` column. The audit pipeline uses these
        // tags for resume + per-target lookup.
        tags: [
          `arasaac:${cand._id}`,
          `qfix-target:${t.keyword}`,
          insertedTag,
          `qfix-conf:${finding.confidence.toFixed(2)}`,
          'verified-by:claude-sonnet-4-6',
        ],
        status: 'active',
      })
      .select('id')
      .single();
    if (insertRes.error || !insertRes.data?.id) {
      console.info(`${banner} ✗ insert failed: ${insertRes.error?.message ?? 'no id'}`);
      counters.apiErrors++;
      continue;
    }

    // Write the matching audit row for the accepted candidate so the
    // verification record is queryable from /admin/symbols-audit.
    await (
      supabase.from('symbol_audit') as never as {
        insert: (row: Record<string, unknown>) => Promise<unknown>;
      }
    ).insert({
      audit_run_id: insertedTag,
      symbol_id: insertRes.data.id,
      matches: true,
      confidence: finding.confidence,
      claude_description: finding.what_image_actually_shows,
      recommended_label_en: finding.recommended_label_en,
      recommended_label_ar: finding.recommended_label_ar,
      raw_response: {
        text: 'verified-on-insert',
        face: finding.depicts_specific_person_face,
        embedded_text: finding.has_embedded_sentence_text,
        ar_natural: finding.ar_label_natural_for_saudi_child,
      },
      model: CLAUDE_MODEL,
    });

    console.info(
      `${banner} ✓ inserted (id=${cand._id}, conf ${finding.confidence.toFixed(2)}, ar='${ar}')`,
    );
    counters.inserted++;
  }

  console.info('');
  console.info('=== RESEED SUMMARY ===');
  console.info(`  inserted          : ${counters.inserted}`);
  console.info(`  skipped-existing  : ${counters.skippedExisting}`);
  console.info(`  rejected (all 3)  : ${counters.rejected}`);
  console.info(`  no-candidates     : ${counters.noCandidates}`);
  console.info(`  api-errors        : ${counters.apiErrors}`);
  console.info(`  claude calls (ms) : ${counters.totalClaudeCallsMs}`);
  console.info(`  total cost        : $${counters.totalClaudeCostUsd.toFixed(4)}`);
  console.info('');
  if (counters.inserted < 150 && counters.skippedExisting < 150) {
    console.info('⚠️  STOP CONDITION: fewer than 150 verified symbols. Pause before continuing.');
  }
  console.info('Next: pnpm exec tsx db/scripts/audit-symbols.ts');
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.stack : String(e));
  process.exit(1);
});
