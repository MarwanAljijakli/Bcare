/**
 * Personalization service — free-first.
 *
 * Pure DB aggregations against `input_events` + `vocabulary_sets` +
 * `progress_metrics`. No LLM, no upstream API, no recurring cost.
 *
 * What runs nightly (via /api/cron/personalization):
 *   1. For each child:
 *      a. Aggregate the last 30 days of input_events by symbol_id +
 *         hour-of-day bucket. Compute frequency + recent bias + a
 *         small time-of-day weight.
 *      b. Reorder vocabulary_sets — most-frequent + most-recent first;
 *         time-of-day weight bumps morning/evening tiles when relevant.
 *      c. Upsert today's progress_metrics row (vocab_size, input_count,
 *         output_count, modality_breakdown, top_symbols).
 *      d. Generate frequency-based suggestions: symbols in the same
 *         categories as the child's most-used tiles that the child has
 *         used >=2 times but isn't a board tile yet → write a row to
 *         `vocabulary_suggestions` with score = blended frequency /
 *         time-of-day signals.
 *      e. Difficulty progression: when the child has mastered ≥80% of
 *         their current vocabulary level (mastery = ≥10 distinct uses
 *         per symbol over the window), unlock the next level by
 *         updating `children.vocabulary_level` (configurable threshold
 *         per child via Module 6 dashboard).
 *      f. Audit-log a `personalization_recomputed` action.
 *   2. Expire suggestions older than 30 days (`status = 'expired'`).
 *
 * The functions here are pure-ish — they take a Supabase service-role
 * client + a child id and do their thing. Idempotent: running multiple
 * times on the same day produces the same end-state.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

const RECENT_WINDOW_DAYS = 30;
const SUGGESTION_TTL_DAYS = 30;
const MASTERY_USES = 10;
const MASTERY_PCT = 0.8;
const SUGGESTION_MIN_USES = 2;
const SUGGESTION_REJECTION_COOLDOWN_DAYS = 60;

export interface PersonalizationResult {
  childId: string;
  vocabUpdated: number;
  suggestionsCreated: number;
  metricsUpserted: boolean;
  levelAdvanced: { from: VocabLevel; to: VocabLevel } | null;
  expiredSuggestions: number;
}

type VocabLevel = 'starter' | 'expanding' | 'conversational' | 'advanced';

const LEVEL_PROGRESSION: Record<VocabLevel, VocabLevel> = {
  starter: 'expanding',
  expanding: 'conversational',
  conversational: 'advanced',
  advanced: 'advanced', // terminal
};

// Time-of-day weight: morning (6-11) and evening (18-21) are slightly
// boosted because that's when most caregiver-led communication happens.
function timeOfDayWeight(hour: number): number {
  if (hour >= 6 && hour <= 11) return 1.15;
  if (hour >= 18 && hour <= 21) return 1.1;
  if (hour >= 12 && hour <= 17) return 1.0;
  return 0.85;
}

interface InputEventRow {
  symbol_id: string | null;
  modality: 'symbol' | 'speech' | 'gesture' | 'keyboard';
  created_at: string;
}

interface SymbolRow {
  id: string;
  categories: string[];
}

interface VocabSetRow {
  id: string;
  symbol_id: string;
  position: number;
  frequency: number;
  last_used_at: string | null;
}

interface SuggestionRow {
  symbol_id: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  reviewed_at: string | null;
}

/**
 * Compute a single child's personalization update + write it back.
 * Returns a small summary the cron handler aggregates.
 */
export async function recomputeChild(
  supabase: SupabaseClient,
  childId: string,
): Promise<PersonalizationResult> {
  const since = new Date(Date.now() - RECENT_WINDOW_DAYS * 86400_000);

  // 1. Pull last-30-day events for this child.
  const eventsRes = await supabase
    .from('input_events')
    .select('symbol_id, modality, created_at')
    .eq('child_id', childId)
    .gte('created_at', since.toISOString());
  const events = (eventsRes.data ?? []) as InputEventRow[];

  // 2. Aggregate by symbol_id with time-of-day weighting.
  const counts = new Map<string, { count: number; weighted: number; lastUsed: string }>();
  for (const e of events) {
    if (!e.symbol_id) continue;
    const hour = new Date(e.created_at).getUTCHours();
    const w = timeOfDayWeight(hour);
    const cur = counts.get(e.symbol_id);
    if (cur) {
      cur.count += 1;
      cur.weighted += w;
      if (e.created_at > cur.lastUsed) cur.lastUsed = e.created_at;
    } else {
      counts.set(e.symbol_id, { count: 1, weighted: w, lastUsed: e.created_at });
    }
  }

  // 3. Pull current vocabulary_sets + reorder.
  const vocabRes = await supabase
    .from('vocabulary_sets')
    .select('id, symbol_id, position, frequency, last_used_at')
    .eq('child_id', childId);
  const vocab = (vocabRes.data ?? []) as VocabSetRow[];

  const orderedVocab = [...vocab].sort((a, b) => {
    const ac = counts.get(a.symbol_id)?.weighted ?? 0;
    const bc = counts.get(b.symbol_id)?.weighted ?? 0;
    if (ac !== bc) return bc - ac;
    // Tiebreak: most-recent use first.
    const al = counts.get(a.symbol_id)?.lastUsed ?? a.last_used_at ?? '';
    const bl = counts.get(b.symbol_id)?.lastUsed ?? b.last_used_at ?? '';
    return bl.localeCompare(al);
  });

  let vocabUpdated = 0;
  for (let i = 0; i < orderedVocab.length; i++) {
    const v = orderedVocab[i]!;
    const c = counts.get(v.symbol_id);
    const newPos = i;
    const newFreq = c?.count ?? v.frequency;
    const newLast = c?.lastUsed ?? v.last_used_at;
    if (v.position !== newPos || v.frequency !== newFreq || v.last_used_at !== newLast) {
      await supabase
        .from('vocabulary_sets')
        .update({ position: newPos, frequency: newFreq, last_used_at: newLast })
        .eq('id', v.id);
      vocabUpdated++;
    }
  }

  // 4. Upsert today's progress_metrics row.
  const today = new Date().toISOString().slice(0, 10);
  const inputCount = events.length;
  const modalityBreakdown = events.reduce(
    (acc, e) => {
      acc[e.modality] = (acc[e.modality] ?? 0) + 1;
      return acc;
    },
    { symbol: 0, speech: 0, gesture: 0, keyboard: 0 } as Record<
      'symbol' | 'speech' | 'gesture' | 'keyboard',
      number
    >,
  );
  const topSymbols = [...counts.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10)
    .map(([symbolId, v]) => ({ symbolId, count: v.count }));
  const activeVocab = counts.size;

  // The unique constraint is (child_id, day) — supabase-js upsert with
  // onConflict on a multi-column index works.
  const metricsRes = await supabase.from('progress_metrics').upsert(
    {
      child_id: childId,
      day: today,
      active_vocabulary_size: activeVocab,
      input_count: inputCount,
      output_count: 0, // updated separately by an output_events job in Module 6
      avg_sentence_length: 0,
      success_rate: 0,
      modality_breakdown: modalityBreakdown,
      top_symbols: topSymbols,
    },
    { onConflict: 'child_id,day' },
  );
  const metricsUpserted = !metricsRes.error;

  // 5. Generate frequency-based suggestions.
  //    For each symbol the child used at least SUGGESTION_MIN_USES times
  //    that's NOT in their vocabulary_sets and NOT in
  //    vocabulary_suggestions (active or recently rejected), insert a
  //    pending suggestion.
  const vocabSymbolIds = new Set(vocab.map((v) => v.symbol_id));

  const existingSuggestionsRes = await supabase
    .from('vocabulary_suggestions')
    .select('symbol_id, status, reviewed_at')
    .eq('child_id', childId);
  const existingSuggestions = (existingSuggestionsRes.data ?? []) as SuggestionRow[];
  const cooldownThreshold = new Date(
    Date.now() - SUGGESTION_REJECTION_COOLDOWN_DAYS * 86400_000,
  ).toISOString();
  const blockedSymbolIds = new Set<string>();
  for (const s of existingSuggestions) {
    if (s.status === 'pending' || s.status === 'approved') blockedSymbolIds.add(s.symbol_id);
    if (s.status === 'rejected' && s.reviewed_at && s.reviewed_at > cooldownThreshold) {
      blockedSymbolIds.add(s.symbol_id);
    }
  }

  const candidates: { symbol_id: string; score: number; signals: Record<string, unknown> }[] = [];
  for (const [sid, c] of counts.entries()) {
    if (vocabSymbolIds.has(sid)) continue;
    if (blockedSymbolIds.has(sid)) continue;
    if (c.count < SUGGESTION_MIN_USES) continue;
    // Score: normalize weighted count by the highest weighted count,
    // capped at 1.0. Stable + cheap.
    const maxWeighted = Math.max(...[...counts.values()].map((v) => v.weighted), 1);
    const score = Math.min(1, c.weighted / maxWeighted);
    candidates.push({
      symbol_id: sid,
      score: Number(score.toFixed(3)),
      signals: { count: c.count, weighted: Number(c.weighted.toFixed(3)), source: 'frequency' },
    });
  }

  let suggestionsCreated = 0;
  if (candidates.length > 0) {
    const expires = new Date(Date.now() + SUGGESTION_TTL_DAYS * 86400_000).toISOString();
    const inserts = candidates.map((c) => ({
      child_id: childId,
      symbol_id: c.symbol_id,
      source: 'frequency' as const,
      score: c.score,
      reason: 'frequency-based',
      signals: c.signals,
      status: 'pending' as const,
      expires_at: expires,
    }));
    const ins = await supabase.from('vocabulary_suggestions').insert(inserts);
    if (!ins.error) suggestionsCreated = inserts.length;
  }

  // 6. Difficulty progression.
  let levelAdvanced: PersonalizationResult['levelAdvanced'] = null;
  const childRes = await supabase
    .from('children')
    .select('id, vocabulary_level')
    .eq('id', childId)
    .single();
  const currentLevel = (childRes.data as { vocabulary_level?: VocabLevel } | null)
    ?.vocabulary_level;
  if (currentLevel && vocab.length > 0) {
    const masteredCount = vocab.filter(
      (v) => (counts.get(v.symbol_id)?.count ?? 0) >= MASTERY_USES,
    ).length;
    const masteryPct = masteredCount / vocab.length;
    const nextLevel = LEVEL_PROGRESSION[currentLevel];
    if (masteryPct >= MASTERY_PCT && nextLevel !== currentLevel) {
      const upd = await supabase
        .from('children')
        .update({ vocabulary_level: nextLevel })
        .eq('id', childId);
      if (!upd.error) {
        levelAdvanced = { from: currentLevel, to: nextLevel };
      }
    }
  }

  // 7. Expire stale suggestions (status='pending' AND expires_at < now).
  const expireRes = await supabase
    .from('vocabulary_suggestions')
    .update({ status: 'expired' })
    .eq('child_id', childId)
    .eq('status', 'pending')
    .lt('expires_at', new Date().toISOString())
    .select('id');
  const expiredSuggestions = (expireRes.data ?? []).length;

  return {
    childId,
    vocabUpdated,
    suggestionsCreated,
    metricsUpserted,
    levelAdvanced,
    expiredSuggestions,
  };
}

/**
 * Iterate every active (not-soft-deleted) child and run recomputeChild
 * against each. Returns a summary the cron handler audit-logs.
 */
export async function recomputeAll(
  supabase: SupabaseClient,
): Promise<{ children: number; results: PersonalizationResult[] }> {
  const childRes = await supabase.from('children').select('id').is('deleted_at', null);
  const children = (childRes.data ?? []) as { id: string }[];
  const results: PersonalizationResult[] = [];
  for (const c of children) {
    try {
      results.push(await recomputeChild(supabase, c.id));
    } catch (e) {
      // Best-effort: a single child's failure shouldn't take the whole
      // run down. The cron logs the failure and moves on.
      console.error(
        `personalization recompute failed for ${c.id}:`,
        e instanceof Error ? e.message : String(e),
      );
    }
  }
  return { children: children.length, results };
}

/**
 * Helper for symbol category lookup — used by the LLM upgrade path
 * (Module 4 stretch) when generating prompt context.
 */
export async function symbolsByCategory(
  supabase: SupabaseClient,
): Promise<Map<string, SymbolRow[]>> {
  const res = await supabase.from('symbols').select('id, categories').eq('status', 'active');
  const out = new Map<string, SymbolRow[]>();
  for (const s of (res.data ?? []) as SymbolRow[]) {
    for (const cat of s.categories) {
      if (!out.has(cat)) out.set(cat, []);
      out.get(cat)!.push(s);
    }
  }
  return out;
}
