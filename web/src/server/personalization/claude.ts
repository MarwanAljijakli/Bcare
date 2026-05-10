/**
 * Claude Sonnet 4.6 contextual vocabulary suggestions — Quality Fix Phase 3.
 *
 * Augments (does NOT replace) the frequency-based engine in `./index.ts`.
 * The cron now runs both passes nightly:
 *   1. Frequency pass — pure DB aggregation, $0 cost, source='frequency'.
 *   2. Claude pass — short Sonnet call per child, source='claude'.
 *
 * What Claude sees per call:
 *   • Recent input distribution (top 8 symbols + counts).
 *   • Time-of-day buckets (where in the day each top symbol concentrates).
 *   • Current vocabulary on the child's board (labels only — no IDs).
 *   • Vocabulary level (starter / expanding / conversational / advanced).
 *
 * What Claude returns: 3-5 concept-level suggestions with rationale.
 * We then map each concept to a real `symbols` row by `label_en` (case-
 * insensitive, exact match first then close-match fallback). Concepts
 * with no symbol match are dropped (a future Module surfaces them as
 * "create custom symbol" prompts; out of scope today).
 *
 * Privacy:
 *   • The child's name, age, full caregiver email, etc. are NEVER sent
 *     to Claude. Only labels + counts + time bucket strings.
 *   • Claude's response text is stored in `vocabulary_suggestions.signals.rationale`
 *     so the dashboard can show it inline. The text never leaves the
 *     server's logs.
 *
 * Cost guard: every call routes through claudeForChild() which writes
 * an ai_usage_ledger row + enforces the per-child monthly cap. On
 * `cap_reached`, this function returns an empty array and the cron
 * silently falls through to the frequency-only path.
 */
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { CLAUDE_MODEL, chargeClaudeUsage, claudeForChild } from '@/lib/ai/anthropic';

interface RecentInput {
  symbol_label_en: string;
  count: number;
  time_buckets: { morning: number; midday: number; evening: number; night: number };
}

interface CurrentVocabularyEntry {
  symbol_label_en: string;
  category: string | null;
}

export interface ClaudeSuggestionInput {
  supabaseAdmin: SupabaseClient<never>;
  childId: string;
  vocabulary_level: 'starter' | 'expanding' | 'conversational' | 'advanced';
  recent_inputs: RecentInput[];
  current_vocabulary: CurrentVocabularyEntry[];
}

export interface ClaudeSuggestion {
  symbol_concept: string; // Claude's suggested label (English)
  rationale: string; // 1-2 sentence explanation
  suggested_category: string;
  priority: number; // 1..5, higher = more confident
}

const SYSTEM_PROMPT = `You are an AAC (augmentative + alternative communication) vocabulary curator helping a non-verbal autistic child. The caregiver shows you the child's recent symbol-tap pattern and the symbols already on the board. You suggest 3-5 NEXT vocabulary items the child would benefit from learning.

Reply with strict JSON only — no commentary, no fences, no preface. Schema:
{
  "suggestions": [
    {
      "symbol_concept": string,            // a single English label, lowercase, 1-3 words
      "rationale": string,                 // 1-2 sentences, calm tone, address the caregiver as "you"
      "suggested_category": string,        // one of: core_needs, feelings, people, food_drink, body, actions, places, clothing, time, weather, school, toys_play, social
      "priority": number                   // 1 (low) .. 5 (high)
    }
  ]
}

Curation guidance:
- Build on patterns you actually see in the recent_inputs. If a child uses 'water' often in mornings, suggest related morning concepts ('thirsty', 'cup', 'cold').
- Do NOT suggest items already on the current_vocabulary list (case-insensitive).
- Stay age-appropriate for a 4-7 year old non-verbal child. No abstract concepts before 'expanding' level.
- Bilingual context: AR translation will be auto-generated downstream; pick concepts that translate cleanly into Saudi Arabic.
- Tone: calm, encouraging. Never alarmist.`;

const CONCEPT_LIMIT = 5;

function buildUserMessage(input: ClaudeSuggestionInput): string {
  return JSON.stringify({
    vocabulary_level: input.vocabulary_level,
    recent_inputs: input.recent_inputs.slice(0, 8),
    current_vocabulary: input.current_vocabulary.slice(0, 60).map((v) => v.symbol_label_en),
  });
}

interface ClaudeResponseShape {
  suggestions?: Partial<ClaudeSuggestion>[];
}

function parseSuggestions(text: string): ClaudeSuggestion[] {
  const candidates: string[] = [text.trim()];
  const fence = text.match(/```(?:json)?\s*([\s\S]+?)```/i);
  if (fence?.[1]) candidates.push(fence[1].trim());
  const brace = text.match(/\{[\s\S]*\}/);
  if (brace) candidates.push(brace[0]);
  for (const c of candidates) {
    try {
      const p = JSON.parse(c) as ClaudeResponseShape;
      if (!Array.isArray(p.suggestions)) continue;
      return p.suggestions
        .filter(
          (s): s is ClaudeSuggestion =>
            typeof s.symbol_concept === 'string' &&
            typeof s.rationale === 'string' &&
            typeof s.suggested_category === 'string' &&
            typeof s.priority === 'number',
        )
        .slice(0, CONCEPT_LIMIT)
        .map((s) => ({
          symbol_concept: s.symbol_concept.trim().toLowerCase(),
          rationale: s.rationale.trim(),
          suggested_category: s.suggested_category.trim(),
          priority: Math.max(1, Math.min(5, Math.round(s.priority))),
        }));
    } catch {
      /* try next */
    }
  }
  return [];
}

/**
 * Ask Claude for 3-5 next-vocabulary suggestions for a child. Returns
 * an empty array on cap-reached, parse-failure, or any other error —
 * the caller should always treat this as additive on top of the
 * frequency engine, never as the sole source.
 */
export async function claudeSuggestVocabulary(
  input: ClaudeSuggestionInput,
): Promise<ClaudeSuggestion[]> {
  const guard = await claudeForChild({
    supabaseAdmin: input.supabaseAdmin,
    childId: input.childId,
    service: 'claude_suggest',
    estimatedCostUsd: 0.01, // ~3K input + 600 output tokens upper bound
    call: {
      system: SYSTEM_PROMPT,
      user: buildUserMessage(input),
      max_tokens: 600,
      temperature: 0.4, // Lean creative — we want diversity in suggestions.
    },
  });
  if (!guard.ok) return [];

  const suggestions = parseSuggestions(guard.result.text);

  // Update the ledger row with actual token usage.
  await chargeClaudeUsage({
    supabaseAdmin: input.supabaseAdmin,
    childId: input.childId,
    service: 'claude_suggest',
    input_tokens: guard.result.input_tokens,
    output_tokens: guard.result.output_tokens,
  });

  return suggestions;
}

interface SymbolLookupRow {
  id: string;
  label_en: string;
  category: string | null;
}

/**
 * Map Claude's concept-level suggestions to real `symbols` rows + filter
 * out anything already on the child's board or recently rejected.
 *
 * Returns a list of `vocabulary_suggestions` row payloads ready for
 * insertion (the cron handles the actual INSERT after deduplication).
 */
export async function mapConceptsToSymbolRows(
  supabaseAdmin: SupabaseClient<never>,
  childId: string,
  suggestions: ClaudeSuggestion[],
  excludeSymbolIds: Set<string>,
): Promise<
  Array<{
    child_id: string;
    symbol_id: string;
    source: 'claude';
    score: number;
    reason: string;
    signals: { rationale: string; suggested_category: string; priority: number; model: string };
    status: 'pending';
  }>
> {
  if (suggestions.length === 0) return [];
  const concepts = suggestions.map((s) => s.symbol_concept);
  // Case-insensitive lookup via ilike against any of the concepts.
  const symbolsRes = await (
    supabaseAdmin.from('symbols') as never as {
      select: (cols: string) => {
        in: (col: string, v: string[]) => Promise<{ data: SymbolLookupRow[] | null }>;
      };
    }
  )
    .select('id, label_en, category')
    .in(
      'label_en',
      // Try both the lowercased + space-trimmed forms first; the symbols
      // catalog stores labels in their canonical case (e.g., "I" or "thank
      // you"), so we match flexibly here.
      concepts.flatMap((c) => [c, c[0]!.toUpperCase() + c.slice(1)]),
    );
  const byLabelLower = new Map<string, SymbolLookupRow>();
  for (const r of symbolsRes.data ?? []) {
    byLabelLower.set(r.label_en.trim().toLowerCase(), r);
  }
  const out: Array<{
    child_id: string;
    symbol_id: string;
    source: 'claude';
    score: number;
    reason: string;
    signals: { rationale: string; suggested_category: string; priority: number; model: string };
    status: 'pending';
  }> = [];
  for (const s of suggestions) {
    const sym = byLabelLower.get(s.symbol_concept);
    if (!sym) continue;
    if (excludeSymbolIds.has(sym.id)) continue;
    out.push({
      child_id: childId,
      symbol_id: sym.id,
      source: 'claude',
      score: s.priority / 5,
      reason: s.rationale.slice(0, 200),
      signals: {
        rationale: s.rationale,
        suggested_category: s.suggested_category,
        priority: s.priority,
        model: CLAUDE_MODEL,
      },
      status: 'pending',
    });
  }
  return out;
}

// =============================================================================
// Cron-side orchestrator. Reads everything Claude needs from the DB,
// calls Claude, maps to symbols, inserts into vocabulary_suggestions.
// =============================================================================

interface InputAggregateRow {
  symbol_id: string | null;
  created_at: string;
}

interface SymbolMetaRow {
  id: string;
  label_en: string;
}

interface ChildVocabRow {
  symbol_id: string;
  category: string | null;
}

interface ChildMetaRow {
  vocabulary_level: 'starter' | 'expanding' | 'conversational' | 'advanced';
}

function bucketHour(hour: number): keyof RecentInput['time_buckets'] {
  if (hour >= 6 && hour <= 11) return 'morning';
  if (hour >= 12 && hour <= 17) return 'midday';
  if (hour >= 18 && hour <= 21) return 'evening';
  return 'night';
}

export interface ClaudeSuggestionPassResult {
  childId: string;
  callsAttempted: number;
  conceptsReturned: number;
  suggestionsInserted: number;
  costUsd: number;
}

/**
 * Run the Claude suggestion pass for a single child. Caller is the
 * personalization cron, AFTER recomputeChild has finished its
 * frequency-only pass + landed today's progress_metrics row.
 */
export async function claudeSuggestionsForChild(
  supabaseAdmin: SupabaseClient<never>,
  childId: string,
): Promise<ClaudeSuggestionPassResult> {
  const result: ClaudeSuggestionPassResult = {
    childId,
    callsAttempted: 0,
    conceptsReturned: 0,
    suggestionsInserted: 0,
    costUsd: 0,
  };

  // 1. Child metadata.
  const childRes = await (
    supabaseAdmin.from('children') as never as {
      select: (cols: string) => {
        eq: (
          col: string,
          v: string,
        ) => {
          maybeSingle: () => Promise<{ data: ChildMetaRow | null }>;
        };
      };
    }
  )
    .select('vocabulary_level')
    .eq('id', childId)
    .maybeSingle();
  const child = childRes.data;
  if (!child) return result;

  // 2. Recent inputs (last 30 days, top 8 symbols by frequency).
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const inputsRes = await (
    supabaseAdmin.from('input_events') as never as {
      select: (cols: string) => {
        eq: (
          col: string,
          v: string,
        ) => {
          gte: (col: string, v: string) => Promise<{ data: InputAggregateRow[] | null }>;
        };
      };
    }
  )
    .select('symbol_id, created_at')
    .eq('child_id', childId)
    .gte('created_at', since);
  const events = inputsRes.data ?? [];

  // Aggregate by symbol_id with time-of-day buckets.
  const byId = new Map<string, RecentInput['time_buckets'] & { count: number }>();
  for (const ev of events) {
    if (!ev.symbol_id) continue;
    const hour = new Date(ev.created_at).getUTCHours();
    const bucket = bucketHour(hour);
    const cur = byId.get(ev.symbol_id) ?? {
      morning: 0,
      midday: 0,
      evening: 0,
      night: 0,
      count: 0,
    };
    cur[bucket]++;
    cur.count++;
    byId.set(ev.symbol_id, cur);
  }
  const top = Array.from(byId.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 8);
  if (top.length === 0) {
    // Brand-new child with no events yet — let the frequency pass seed
    // suggestions; Claude needs signal to be useful.
    return result;
  }

  // 3. Resolve symbol labels for the top inputs + the current vocabulary.
  const topIds = top.map(([id]) => id);
  const symRes = await (
    supabaseAdmin.from('symbols') as never as {
      select: (cols: string) => {
        in: (col: string, v: string[]) => Promise<{ data: SymbolMetaRow[] | null }>;
      };
    }
  )
    .select('id, label_en')
    .in('id', topIds);
  const labelById = new Map<string, string>();
  for (const r of symRes.data ?? []) labelById.set(r.id, r.label_en);

  const recent_inputs: RecentInput[] = top
    .map(([id, agg]) => {
      const label = labelById.get(id);
      if (!label) return null;
      return {
        symbol_label_en: label,
        count: agg.count,
        time_buckets: {
          morning: agg.morning,
          midday: agg.midday,
          evening: agg.evening,
          night: agg.night,
        },
      };
    })
    .filter((r): r is RecentInput => r !== null);

  // 4. Current vocabulary.
  const vocabRes = await (
    supabaseAdmin.from('vocabulary_sets') as never as {
      select: (cols: string) => {
        eq: (col: string, v: string) => Promise<{ data: ChildVocabRow[] | null }>;
      };
    }
  )
    .select('symbol_id, category')
    .eq('child_id', childId);
  const vocabRows = vocabRes.data ?? [];
  const vocabSymbolIds = new Set(vocabRows.map((v) => v.symbol_id));
  const vocabLabelLookup = await (
    supabaseAdmin.from('symbols') as never as {
      select: (cols: string) => {
        in: (col: string, v: string[]) => Promise<{ data: SymbolMetaRow[] | null }>;
      };
    }
  )
    .select('id, label_en')
    .in('id', Array.from(vocabSymbolIds).slice(0, 60));
  const vocabLabels = new Map<string, string>();
  for (const r of vocabLabelLookup.data ?? []) vocabLabels.set(r.id, r.label_en);
  const current_vocabulary = vocabRows
    .map((v) => ({
      symbol_label_en: vocabLabels.get(v.symbol_id) ?? '',
      category: v.category,
    }))
    .filter((v) => v.symbol_label_en.length > 0);

  // 5. Recently-rejected symbols (60-day cooldown, matches the existing
  //    frequency-engine convention so we never resurrect a rejected
  //    suggestion within the cooldown window).
  const cooldownStart = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
  const rejectedRes = await (
    supabaseAdmin.from('vocabulary_suggestions') as never as {
      select: (cols: string) => {
        eq: (
          col: string,
          v: string,
        ) => {
          eq: (
            col2: string,
            v2: string,
          ) => {
            gte: (col: string, v: string) => Promise<{ data: { symbol_id: string }[] | null }>;
          };
        };
      };
    }
  )
    .select('symbol_id')
    .eq('child_id', childId)
    .eq('status', 'rejected')
    .gte('reviewed_at', cooldownStart);
  const excludeSymbolIds = new Set(vocabSymbolIds);
  for (const r of rejectedRes.data ?? []) excludeSymbolIds.add(r.symbol_id);

  // 6. Call Claude.
  result.callsAttempted = 1;
  const concepts = await claudeSuggestVocabulary({
    supabaseAdmin,
    childId,
    vocabulary_level: child.vocabulary_level,
    recent_inputs,
    current_vocabulary,
  });
  result.conceptsReturned = concepts.length;
  if (concepts.length === 0) return result;

  // 7. Map to symbol IDs.
  const rows = await mapConceptsToSymbolRows(supabaseAdmin, childId, concepts, excludeSymbolIds);
  if (rows.length === 0) return result;

  // 8. Insert. Conflict-tolerant — if the same suggestion already exists
  //    pending, we don't duplicate.
  const ins = await (
    supabaseAdmin.from('vocabulary_suggestions') as never as {
      insert: (rows: Record<string, unknown>[]) => Promise<{ error: { message: string } | null }>;
    }
  ).insert(
    rows.map((r) => ({
      ...r,
      // Expire in 30 days, matching the frequency-engine convention.
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    })),
  );
  if (!ins.error) result.suggestionsInserted = rows.length;

  return result;
}

/**
 * Iterate every active child and run claudeSuggestionsForChild against
 * each. Best-effort; one child's failure does not halt the batch.
 */
export async function claudeSuggestionsForAll(
  supabaseAdmin: SupabaseClient<never>,
): Promise<{ children: number; results: ClaudeSuggestionPassResult[] }> {
  const list = await (
    supabaseAdmin.from('children') as never as {
      select: (cols: string) => {
        is: (col: string, v: null) => Promise<{ data: { id: string }[] | null }>;
      };
    }
  )
    .select('id')
    .is('deleted_at', null);
  const children = list.data ?? [];
  const results: ClaudeSuggestionPassResult[] = [];
  for (const c of children) {
    try {
      results.push(await claudeSuggestionsForChild(supabaseAdmin, c.id));
    } catch (e) {
      console.error(
        `claude suggestions failed for ${c.id}:`,
        e instanceof Error ? e.message : String(e),
      );
    }
  }
  return { children: children.length, results };
}
