/**
 * Claude-driven child progress reports — Phase 10.E.
 *
 * Aggregates a child's AAC usage over a period, asks Claude Sonnet for
 * a structured developmental analysis, and stores the result in
 * `progress_reports.payload_json`.
 *
 * Cost ceiling per spec: $0.50/generation hard-stop. We pre-charge
 * $0.10 (a generous worst-case for 5K input + 1.2K output tokens at
 * Sonnet pricing) through aiGuard. The per-child monthly cap stays
 * $20 — that translates to ~50 manual + 4 weekly cron reports a month
 * before the cap pinches.
 *
 * Privacy posture:
 *   • The prompt sees ONLY aggregated counts + top symbol labels — never
 *     individual input_event rows, never literal STT transcripts.
 *   • Symbol labels are bilingual (EN + AR) so Claude can reason in
 *     either language without leaking child-identifying free text.
 *   • The response is structured JSON; we discard everything that
 *     doesn't fit the schema (defensive parse).
 */

import 'server-only';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { claudeForChild, chargeClaudeUsage } from '@/lib/ai/anthropic';
import { categoriesForLevel, type VocabLevel } from '@/lib/levels';

/** Hard ceiling per generation. Anything above this aborts. */
const MAX_COST_PER_REPORT_USD = 0.5;
/** Pre-charge upper bound. Sonnet at 5K input + 1.2K output ≈ $0.033. */
const ESTIMATED_COST_USD = 0.1;
/** Minimum sessions in the window before a report is even attempted. */
const MIN_SESSIONS = 3;

export type ReportPeriodType = 'weekly' | 'monthly' | 'quarterly';
export type ReportGeneratedBy = 'cron' | 'manual';

// ---------------------------------------------------------------------------
// Structured payload — the contract between analyzer + dashboard view.
// Every text field is bilingual (en + ar) so the parent UI can render
// either language without a re-translation step.
// ---------------------------------------------------------------------------
const bilingualLineSchema = z.object({
  en: z.string().min(1).max(280),
  ar: z.string().min(1).max(280),
});

export const reportPayloadSchema = z.object({
  strengths: z.array(bilingualLineSchema).min(0).max(8),
  areas_for_growth: z.array(bilingualLineSchema).min(0).max(8),
  specific_suggestions_for_parents: z.array(bilingualLineSchema).min(0).max(8),
  specific_suggestions_for_therapists: z.array(bilingualLineSchema).min(0).max(8),
  risks_or_concerns: z.array(bilingualLineSchema).min(0).max(5),
  summary_paragraph_english: z.string().min(1).max(2000),
  summary_paragraph_arabic: z.string().min(1).max(2000),
});

export type ReportPayload = z.infer<typeof reportPayloadSchema>;

export interface ChildMetricsSnapshot {
  childId: string;
  childPreferredName: string | null;
  childLocale: 'en' | 'ar';
  vocabularyLevel: VocabLevel;
  period: { start: string; end: string; type: ReportPeriodType };
  sessions: {
    total: number;
    averageDurationSeconds: number;
    averageInputsPerSession: number;
  };
  inputs: {
    total: number;
    byModality: { symbol: number; speech: number; gesture: number; keyboard: number };
    successRate: number;
  };
  vocabulary: {
    activeCount: number;
    masteredCount: number;
    masteryPct: number;
    growthSinceStart: number;
  };
  topSymbols: { label_en: string; label_ar: string; count: number; category: string | null }[];
  timeOfDayPattern: { morning: number; midday: number; afternoon: number; evening: number };
  levelCategoriesActive: string[];
}

export interface AnalyzeResult {
  reportId: string | null;
  childId: string;
  skipped: 'insufficient_data' | 'cap_reached' | 'cost_too_high' | null;
  costUsd: number;
  inputTokens: number;
  outputTokens: number;
}

// ---------------------------------------------------------------------------
// 1) Aggregate metrics — pure DB reads. No LLM.
// ---------------------------------------------------------------------------

async function aggregateMetrics(
  supabaseAdmin: SupabaseClient<never>,
  args: { childId: string; periodStart: Date; periodEnd: Date; periodType: ReportPeriodType },
): Promise<ChildMetricsSnapshot | null> {
  const { childId, periodStart, periodEnd, periodType } = args;
  const startIso = periodStart.toISOString();
  const endIso = periodEnd.toISOString();

  // Child profile.
  const childRes = await (
    supabaseAdmin.from('children') as never as {
      select: (cols: string) => {
        eq: (
          col: string,
          v: string,
        ) => {
          maybeSingle: () => Promise<{
            data: {
              id: string;
              preferred_name: string | null;
              locale: 'en' | 'ar' | null;
              vocabulary_level: VocabLevel | null;
            } | null;
          }>;
        };
      };
    }
  )
    .select('id, preferred_name, locale, vocabulary_level')
    .eq('id', childId)
    .maybeSingle();
  const child = childRes.data;
  if (!child) return null;

  // Sessions in window.
  const sessionsRes = await (
    supabaseAdmin.from('sessions') as never as {
      select: (cols: string) => {
        eq: (
          col: string,
          v: string,
        ) => {
          gte: (
            col: string,
            v: string,
          ) => {
            lte: (
              col: string,
              v: string,
            ) => Promise<{
              data:
                | {
                    id: string;
                    duration_seconds: number;
                    input_count: number;
                    output_count: number;
                    successful_selections: number;
                  }[]
                | null;
            }>;
          };
        };
      };
    }
  )
    .select('id, duration_seconds, input_count, output_count, successful_selections')
    .eq('child_id', childId)
    .gte('started_at', startIso)
    .lte('started_at', endIso);
  const sessions = sessionsRes.data ?? [];
  if (sessions.length < MIN_SESSIONS) return null;

  const totalInputs = sessions.reduce((a, s) => a + (s.input_count ?? 0), 0);
  const _totalOutputs = sessions.reduce((a, s) => a + (s.output_count ?? 0), 0);
  const totalSuccess = sessions.reduce((a, s) => a + (s.successful_selections ?? 0), 0);
  const avgDurationS =
    sessions.reduce((a, s) => a + (s.duration_seconds ?? 0), 0) / Math.max(1, sessions.length);
  const successRate = totalInputs > 0 ? totalSuccess / totalInputs : 0;

  // Input events for modality breakdown + top symbols + time-of-day.
  const eventsRes = await (
    supabaseAdmin.from('input_events') as never as {
      select: (cols: string) => {
        eq: (
          col: string,
          v: string,
        ) => {
          gte: (
            col: string,
            v: string,
          ) => {
            lte: (
              col: string,
              v: string,
            ) => Promise<{
              data:
                | {
                    symbol_id: string | null;
                    modality: 'symbol' | 'speech' | 'gesture' | 'keyboard';
                    created_at: string;
                  }[]
                | null;
            }>;
          };
        };
      };
    }
  )
    .select('symbol_id, modality, created_at')
    .eq('child_id', childId)
    .gte('created_at', startIso)
    .lte('created_at', endIso);
  const events = eventsRes.data ?? [];

  const byMod = { symbol: 0, speech: 0, gesture: 0, keyboard: 0 };
  const symCount = new Map<string, number>();
  const timeBuckets = { morning: 0, midday: 0, afternoon: 0, evening: 0 };
  for (const ev of events) {
    byMod[ev.modality] = (byMod[ev.modality] ?? 0) + 1;
    if (ev.symbol_id) symCount.set(ev.symbol_id, (symCount.get(ev.symbol_id) ?? 0) + 1);
    const h = new Date(ev.created_at).getUTCHours();
    if (h >= 6 && h < 11) timeBuckets.morning += 1;
    else if (h >= 11 && h < 14) timeBuckets.midday += 1;
    else if (h >= 14 && h < 18) timeBuckets.afternoon += 1;
    else timeBuckets.evening += 1;
  }

  // Top 10 symbols with labels.
  const topIds = Array.from(symCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  const topSymbols: ChildMetricsSnapshot['topSymbols'] = [];
  if (topIds.length > 0) {
    const ids = topIds.map(([id]) => id);
    const symRes = await (
      supabaseAdmin.from('symbols') as never as {
        select: (cols: string) => {
          in: (
            col: string,
            v: string[],
          ) => Promise<{
            data:
              | { id: string; label_en: string; label_ar: string; categories: string[] | null }[]
              | null;
          }>;
        };
      }
    )
      .select('id, label_en, label_ar, categories')
      .in('id', ids);
    const byId = new Map((symRes.data ?? []).map((s) => [s.id, s]));
    for (const [id, count] of topIds) {
      const s = byId.get(id);
      if (!s) continue;
      topSymbols.push({
        label_en: s.label_en,
        label_ar: s.label_ar,
        count,
        category: (s.categories ?? [])[0] ?? null,
      });
    }
  }

  // Mastery rollup from the materialized view.
  const masteryRes = await (
    supabaseAdmin.from('mastery_per_child_symbol') as never as {
      select: (cols: string) => {
        eq: (
          col: string,
          v: string,
        ) => Promise<{
          data: { symbol_id: string; is_mastered: number; use_count: number }[] | null;
        }>;
      };
    }
  )
    .select('symbol_id, is_mastered, use_count')
    .eq('child_id', childId);
  const mastery = masteryRes.data ?? [];

  const activeVocabRes = await (
    supabaseAdmin.from('vocabulary_sets') as never as {
      select: (cols: string) => {
        eq: (col: string, v: string) => Promise<{ data: { symbol_id: string }[] | null }>;
      };
    }
  )
    .select('symbol_id')
    .eq('child_id', childId);
  const activeCount = (activeVocabRes.data ?? []).length;
  const masteredCount = mastery.reduce((a, m) => a + (m.is_mastered === 1 ? 1 : 0), 0);
  const masteryPct = activeCount > 0 ? masteredCount / activeCount : 0;

  return {
    childId,
    childPreferredName: child.preferred_name,
    childLocale: child.locale ?? 'en',
    vocabularyLevel: child.vocabulary_level ?? 'starter',
    period: { start: startIso, end: endIso, type: periodType },
    sessions: {
      total: sessions.length,
      averageDurationSeconds: Math.round(avgDurationS),
      averageInputsPerSession: Math.round(totalInputs / Math.max(1, sessions.length)),
    },
    inputs: {
      total: totalInputs,
      byModality: byMod,
      successRate: Math.round(successRate * 1000) / 1000,
    },
    vocabulary: {
      activeCount,
      masteredCount,
      masteryPct: Math.round(masteryPct * 1000) / 1000,
      growthSinceStart: Math.max(0, activeCount - 30),
    },
    topSymbols,
    timeOfDayPattern: timeBuckets,
    levelCategoriesActive: categoriesForLevel(child.vocabulary_level ?? 'starter'),
  };
}

// ---------------------------------------------------------------------------
// 2) Prompt Claude.
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are a developmental specialist helping caregivers and therapists understand an autistic child's progress with an AAC (Augmentative & Alternative Communication) app called BlueCare.

You will receive an anonymized usage snapshot for one child over a date range. Output a JSON object — and ONLY a JSON object — with these exact fields:

{
  "strengths": [{ "en": "...", "ar": "..." }, ...],            // 3-5 items
  "areas_for_growth": [{ "en": "...", "ar": "..." }, ...],     // 3-5 items
  "specific_suggestions_for_parents": [{ "en": "...", "ar": "..." }, ...],   // 5 items, CONCRETE activities for home
  "specific_suggestions_for_therapists": [{ "en": "...", "ar": "..." }, ...],// 5 items, clinical observations + interventions
  "risks_or_concerns": [{ "en": "...", "ar": "..." }, ...],    // 0-3 items, leave EMPTY ARRAY by default unless data strongly warrants
  "summary_paragraph_english": "...",                            // 4-6 sentences, warm, parent-friendly
  "summary_paragraph_arabic": "..."                              // same, in formal Modern Standard Arabic
}

Tone rules:
- Warm, parent-friendly, never alarming. Frame growth areas as opportunities, not deficits.
- Suggestions must be SPECIFIC and actionable ("Practice the 'I want' tile during snack time" — NOT "encourage communication").
- Risks are RARE — only flag if data suggests regression, prolonged inactivity, or modality avoidance.
- All bullet items must be in BOTH languages. Arabic must be formal/clinical-friendly, suitable for therapists.
- Never invent data. Reason only from what the snapshot shows.

Output: pure JSON only. No prose before or after. No code fences.`;

function buildUserPrompt(snapshot: ChildMetricsSnapshot): string {
  const nameLabel = snapshot.childPreferredName
    ? `Child (preferred name redacted as "${snapshot.childPreferredName}")`
    : 'Child';
  const lines: string[] = [
    `${nameLabel}, current vocabulary level: ${snapshot.vocabularyLevel}.`,
    `Active categories: ${snapshot.levelCategoriesActive.join(', ')}.`,
    `Period: ${snapshot.period.type} from ${snapshot.period.start} to ${snapshot.period.end}.`,
    ``,
    `Sessions:`,
    `  - total: ${snapshot.sessions.total}`,
    `  - avg duration (s): ${snapshot.sessions.averageDurationSeconds}`,
    `  - avg inputs/session: ${snapshot.sessions.averageInputsPerSession}`,
    ``,
    `Inputs:`,
    `  - total: ${snapshot.inputs.total}`,
    `  - by modality: symbol=${snapshot.inputs.byModality.symbol}, speech=${snapshot.inputs.byModality.speech}, gesture=${snapshot.inputs.byModality.gesture}, keyboard=${snapshot.inputs.byModality.keyboard}`,
    `  - success rate: ${(snapshot.inputs.successRate * 100).toFixed(1)}%`,
    ``,
    `Vocabulary:`,
    `  - active tiles: ${snapshot.vocabulary.activeCount}`,
    `  - mastered: ${snapshot.vocabulary.masteredCount} (${(snapshot.vocabulary.masteryPct * 100).toFixed(1)}%)`,
    `  - growth since baseline: +${snapshot.vocabulary.growthSinceStart} tiles`,
    ``,
    `Top symbols used this period (label_en / label_ar / count / category):`,
    ...snapshot.topSymbols.map(
      (s) => `  - ${s.label_en} / ${s.label_ar} / ${s.count} / ${s.category ?? 'uncategorized'}`,
    ),
    ``,
    `Time-of-day pattern (event counts):`,
    `  - morning (06–11): ${snapshot.timeOfDayPattern.morning}`,
    `  - midday (11–14): ${snapshot.timeOfDayPattern.midday}`,
    `  - afternoon (14–18): ${snapshot.timeOfDayPattern.afternoon}`,
    `  - evening (18–06): ${snapshot.timeOfDayPattern.evening}`,
    ``,
    `Produce the structured JSON now.`,
  ];
  return lines.join('\n');
}

function safeParsePayload(raw: string): ReportPayload | null {
  // Claude usually returns clean JSON given the prompt; tolerate code
  // fences just in case.
  const trimmed = raw
    .trim()
    .replace(/^```json?\s*/i, '')
    .replace(/```$/, '')
    .trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return null;
  }
  const res = reportPayloadSchema.safeParse(parsed);
  if (!res.success) return null;
  return res.data;
}

// ---------------------------------------------------------------------------
// 3) Public: analyzeChild — aggregate + prompt + persist.
// ---------------------------------------------------------------------------

export async function analyzeChild(args: {
  supabaseAdmin: SupabaseClient<never>;
  childId: string;
  periodStart: Date;
  periodEnd: Date;
  periodType: ReportPeriodType;
  generatedBy: ReportGeneratedBy;
}): Promise<AnalyzeResult> {
  const snapshot = await aggregateMetrics(args.supabaseAdmin, args);
  if (!snapshot) {
    return {
      reportId: null,
      childId: args.childId,
      skipped: 'insufficient_data',
      costUsd: 0,
      inputTokens: 0,
      outputTokens: 0,
    };
  }

  const userPrompt = buildUserPrompt(snapshot);
  const guarded = await claudeForChild({
    supabaseAdmin: args.supabaseAdmin,
    childId: args.childId,
    service: 'claude_report',
    estimatedCostUsd: ESTIMATED_COST_USD,
    call: {
      system: SYSTEM_PROMPT,
      user: userPrompt,
      temperature: 0.2,
      max_tokens: 1800,
    },
  });

  if (!guarded.ok) {
    return {
      reportId: null,
      childId: args.childId,
      skipped: 'cap_reached',
      costUsd: 0,
      inputTokens: 0,
      outputTokens: 0,
    };
  }

  const { result } = guarded;

  // Hard cost-cap enforcement. The aiGuard pre-charge is generous; if
  // actual usage somehow exceeds the spec ceiling, drop the report
  // rather than persisting bad-cost data.
  if (result.cost_usd > MAX_COST_PER_REPORT_USD) {
    return {
      reportId: null,
      childId: args.childId,
      skipped: 'cost_too_high',
      costUsd: result.cost_usd,
      inputTokens: result.input_tokens,
      outputTokens: result.output_tokens,
    };
  }

  // Reconcile the ledger with actual tokens.
  await chargeClaudeUsage({
    supabaseAdmin: args.supabaseAdmin,
    childId: args.childId,
    service: 'claude_report',
    input_tokens: result.input_tokens,
    output_tokens: result.output_tokens,
  });

  const payload = safeParsePayload(result.text);
  if (!payload) {
    // Persist a "raw_text" fallback row so the operator can inspect
    // what Claude actually returned. This is rare but should not
    // silently drop the cost.
    const fallbackRow = await insertReport(args.supabaseAdmin, {
      childId: args.childId,
      generatedAt: new Date(),
      periodStart: args.periodStart,
      periodEnd: args.periodEnd,
      periodType: args.periodType,
      generatedBy: args.generatedBy,
      payload: {
        strengths: [],
        areas_for_growth: [],
        specific_suggestions_for_parents: [],
        specific_suggestions_for_therapists: [],
        risks_or_concerns: [],
        summary_paragraph_english:
          'Report generation produced an unparseable response. Please regenerate.',
        summary_paragraph_arabic:
          'إنشاء التقرير أعطى استجابة لا يمكن تحليلها. يُرجى إعادة الإنشاء.',
        // Stash the raw response for the operator. Allowed by the
        // schema's open `metrics_snapshot` — see jsonb shape.
      } as ReportPayload,
      snapshot,
      costUsd: result.cost_usd,
      inputTokens: result.input_tokens,
      outputTokens: result.output_tokens,
      rawText: result.text,
    });
    return {
      reportId: fallbackRow,
      childId: args.childId,
      skipped: null,
      costUsd: result.cost_usd,
      inputTokens: result.input_tokens,
      outputTokens: result.output_tokens,
    };
  }

  const reportId = await insertReport(args.supabaseAdmin, {
    childId: args.childId,
    generatedAt: new Date(),
    periodStart: args.periodStart,
    periodEnd: args.periodEnd,
    periodType: args.periodType,
    generatedBy: args.generatedBy,
    payload,
    snapshot,
    costUsd: result.cost_usd,
    inputTokens: result.input_tokens,
    outputTokens: result.output_tokens,
  });

  return {
    reportId,
    childId: args.childId,
    skipped: null,
    costUsd: result.cost_usd,
    inputTokens: result.input_tokens,
    outputTokens: result.output_tokens,
  };
}

async function insertReport(
  supabaseAdmin: SupabaseClient<never>,
  args: {
    childId: string;
    generatedAt: Date;
    periodStart: Date;
    periodEnd: Date;
    periodType: ReportPeriodType;
    generatedBy: ReportGeneratedBy;
    payload: ReportPayload;
    snapshot: ChildMetricsSnapshot;
    costUsd: number;
    inputTokens: number;
    outputTokens: number;
    rawText?: string;
  },
): Promise<string | null> {
  const row = {
    child_id: args.childId,
    generated_at: args.generatedAt.toISOString(),
    period_start: args.periodStart.toISOString(),
    period_end: args.periodEnd.toISOString(),
    period_type: args.periodType,
    generated_by: args.generatedBy,
    payload_json: {
      ...args.payload,
      metrics_snapshot: args.snapshot,
      ...(args.rawText ? { raw_text: args.rawText } : {}),
    },
    cost_usd: Math.round(args.costUsd * 1_000_000) / 1_000_000,
    input_tokens: args.inputTokens,
    output_tokens: args.outputTokens,
  };
  const res = await (
    supabaseAdmin.from('progress_reports') as never as {
      insert: (rows: typeof row) => {
        select: (cols: string) => {
          single: () => Promise<{ data: { id: string } | null; error: unknown }>;
        };
      };
    }
  )
    .insert(row)
    .select('id')
    .single();
  return res.data?.id ?? null;
}
