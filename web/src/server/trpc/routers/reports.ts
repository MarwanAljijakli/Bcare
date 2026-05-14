import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { protectedMutationProcedure, protectedProcedure, router } from '../trpc';
import { analyzeChild, type ReportPayload } from '@/server/reports/claude-analyzer';

/**
 * Reports router — Module 6.1 (PDF summary) + Phase 10.E (Claude reports).
 *
 * Two independent feature surfaces share this namespace:
 *
 * 1. `summary` (Module 6.1) — returns the flat shape that the
 *    `<ProgressReportPdf>` component needs for a single (child, window)
 *    pair (7 / 30 / 90 days). Drives the existing PDF export at
 *    /dashboard/reports/*.
 *
 * 2. `list` / `get` / `generate` (Phase 10.E) — Claude-driven progress
 *    reports persisted in `progress_reports`. Manual generation is
 *    rate-limited to 1 per 24h per child; the weekly cron uses the
 *    admin client and bypasses the rate limit. Drives the new
 *    /dashboard/insights surface.
 *
 * All procedures are RLS-scoped via the cookie-bound client. Caregivers
 * read their own children; therapists read via the
 * therapist_caregiver_grants pattern; both go through the policies
 * declared in migrations 0010 + 0011.
 */

// ---------- Module 6.1: PDF summary ----------

interface SessionRow {
  id: string;
  started_at: string;
  duration_seconds: number | null;
  input_count: number | null;
  output_count: number | null;
  successful_selections: number | null;
  therapist_notes: string | null;
}

interface ProgressRow {
  day: string;
  active_vocabulary_size: number;
  input_count: number;
  modality_breakdown: {
    symbol?: number;
    speech?: number;
    gesture?: number;
    keyboard?: number;
  } | null;
  top_symbols: { symbolId: string; count: number }[] | null;
}

interface SymbolRow {
  id: string;
  label_en: string | null;
  label_ar: string | null;
}

export interface ProgressReportPayload {
  child: { id: string; name: string };
  window: 7 | 30 | 90;
  windowStart: string;
  windowEnd: string;
  vocabSparkline: { day: string; size: number }[];
  sessionFrequency: { day: string; count: number }[];
  topSymbols: { symbolId: string; label_en: string; label_ar: string; count: number }[];
  multimodalBreakdown: {
    symbol: number;
    speech: number;
    gesture: number;
    keyboard: number;
  };
  totals: {
    sessions: number;
    inputs: number;
    outputs: number;
    successfulSelections: number;
    avgSessionDurationSeconds: number;
  };
  therapistNotes: { sessionId: string; date: string; notes: string }[];
}

function dayKey(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ---------- Phase 10.E: Claude progress reports ----------

const periodTypeEnum = z.enum(['weekly', 'monthly', 'quarterly']);
const MANUAL_RATE_LIMIT_MS = 24 * 60 * 60 * 1000;

interface ChildRow {
  id: string;
  caregiver_id: string;
}

async function getOwnedChild(
  ctx: { supabase: { from: (t: string) => unknown }; session: { userId: string } },
  childId: string,
): Promise<ChildRow> {
  const res = await (
    ctx.supabase.from('children') as never as {
      select: (cols: string) => {
        eq: (col: string, v: string) => { maybeSingle: () => Promise<{ data: ChildRow | null }> };
      };
    }
  )
    .select('id, caregiver_id')
    .eq('id', childId)
    .maybeSingle();
  const child = res.data;
  if (!child || child.caregiver_id !== ctx.session.userId) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'child_not_found' });
  }
  return child;
}

interface ProgressReportRow {
  id: string;
  child_id: string;
  generated_at: string;
  period_start: string;
  period_end: string;
  period_type: 'weekly' | 'monthly' | 'quarterly';
  generated_by: 'cron' | 'manual';
  payload_json: ReportPayload & { metrics_snapshot?: unknown; raw_text?: string };
  cost_usd: string | number | null;
}

// ---------- Router ----------

export const reportsRouter = router({
  /**
   * Module 6.1 — flat PDF summary for the on-screen + PDF report.
   */
  summary: protectedProcedure
    .input(
      z.object({
        childId: z.string().uuid(),
        window: z.union([z.literal(7), z.literal(30), z.literal(90)]),
      }),
    )
    .query(async ({ ctx, input }): Promise<ProgressReportPayload> => {
      const end = new Date();
      const start = new Date(end);
      start.setUTCDate(start.getUTCDate() - (input.window - 1));
      const startKey = dayKey(start);
      const startIso = start.toISOString();

      const childRes = await (
        ctx.supabase.from('children') as never as {
          select: (cols: string) => {
            eq: (
              col: string,
              v: string,
            ) => {
              maybeSingle: () => Promise<{
                data: { id: string; full_name: string; preferred_name: string | null } | null;
              }>;
            };
          };
        }
      )
        .select('id, full_name, preferred_name')
        .eq('id', input.childId)
        .maybeSingle();
      const childName =
        childRes.data?.preferred_name?.trim() || childRes.data?.full_name?.trim() || 'Child';

      const metricsRes = await (
        ctx.supabase.from('progress_metrics') as never as {
          select: (cols: string) => {
            eq: (
              col: string,
              v: string,
            ) => {
              gte: (
                col: string,
                v: string,
              ) => {
                order: (
                  col: string,
                  opts: { ascending: boolean },
                ) => Promise<{ data: ProgressRow[] | null }>;
              };
            };
          };
        }
      )
        .select('day, active_vocabulary_size, input_count, modality_breakdown, top_symbols')
        .eq('child_id', input.childId)
        .gte('day', startKey)
        .order('day', { ascending: true });
      const metrics = metricsRes.data ?? [];

      const metricMap = new Map(metrics.map((m) => [m.day, m]));
      const vocabSparkline: { day: string; size: number }[] = [];
      for (let i = input.window - 1; i >= 0; i--) {
        const d = new Date(end);
        d.setUTCDate(d.getUTCDate() - i);
        const key = dayKey(d);
        vocabSparkline.push({ day: key, size: metricMap.get(key)?.active_vocabulary_size ?? 0 });
      }

      const multimodalBreakdown = { symbol: 0, speech: 0, gesture: 0, keyboard: 0 };
      for (const m of metrics) {
        multimodalBreakdown.symbol += m.modality_breakdown?.symbol ?? 0;
        multimodalBreakdown.speech += m.modality_breakdown?.speech ?? 0;
        multimodalBreakdown.gesture += m.modality_breakdown?.gesture ?? 0;
        multimodalBreakdown.keyboard += m.modality_breakdown?.keyboard ?? 0;
      }

      const symbolCounts = new Map<string, number>();
      for (const m of metrics) {
        for (const t of m.top_symbols ?? []) {
          symbolCounts.set(t.symbolId, (symbolCounts.get(t.symbolId) ?? 0) + t.count);
        }
      }
      const topSymbolIds = Array.from(symbolCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([id]) => id);
      let topSymbols: ProgressReportPayload['topSymbols'] = [];
      if (topSymbolIds.length > 0) {
        const symRes = await (
          ctx.supabase.from('symbols') as never as {
            select: (cols: string) => {
              in: (col: string, vs: string[]) => Promise<{ data: SymbolRow[] | null }>;
            };
          }
        )
          .select('id, label_en, label_ar')
          .in('id', topSymbolIds);
        const symMap = new Map((symRes.data ?? []).map((r) => [r.id, r]));
        topSymbols = topSymbolIds.map((id) => {
          const sym = symMap.get(id);
          return {
            symbolId: id,
            label_en: sym?.label_en ?? '',
            label_ar: sym?.label_ar ?? '',
            count: symbolCounts.get(id) ?? 0,
          };
        });
      }

      const sessionsRes = await (
        ctx.supabase.from('sessions') as never as {
          select: (cols: string) => {
            eq: (
              col: string,
              v: string,
            ) => {
              gte: (
                col: string,
                v: string,
              ) => {
                order: (
                  col: string,
                  opts: { ascending: boolean },
                ) => Promise<{ data: SessionRow[] | null }>;
              };
            };
          };
        }
      )
        .select(
          'id, started_at, duration_seconds, input_count, output_count, successful_selections, therapist_notes',
        )
        .eq('child_id', input.childId)
        .gte('started_at', startIso)
        .order('started_at', { ascending: true });
      const sessions = sessionsRes.data ?? [];

      const sessionFreqMap = new Map<string, number>();
      let totalDuration = 0;
      let totalInputs = 0;
      let totalOutputs = 0;
      let totalSuccessful = 0;
      const notes: ProgressReportPayload['therapistNotes'] = [];
      for (const s of sessions) {
        const key = s.started_at.slice(0, 10);
        sessionFreqMap.set(key, (sessionFreqMap.get(key) ?? 0) + 1);
        totalDuration += s.duration_seconds ?? 0;
        totalInputs += s.input_count ?? 0;
        totalOutputs += s.output_count ?? 0;
        totalSuccessful += s.successful_selections ?? 0;
        if (s.therapist_notes && s.therapist_notes.trim().length > 0) {
          notes.push({
            sessionId: s.id,
            date: s.started_at,
            notes: s.therapist_notes.trim(),
          });
        }
      }
      const sessionFrequency: ProgressReportPayload['sessionFrequency'] = [];
      for (let i = input.window - 1; i >= 0; i--) {
        const d = new Date(end);
        d.setUTCDate(d.getUTCDate() - i);
        const key = dayKey(d);
        sessionFrequency.push({ day: key, count: sessionFreqMap.get(key) ?? 0 });
      }

      const avgSessionDurationSeconds =
        sessions.length > 0 ? Math.round(totalDuration / sessions.length) : 0;

      return {
        child: { id: input.childId, name: childName },
        window: input.window,
        windowStart: startKey,
        windowEnd: dayKey(end),
        vocabSparkline,
        sessionFrequency,
        topSymbols,
        multimodalBreakdown,
        totals: {
          sessions: sessions.length,
          inputs: totalInputs,
          outputs: totalOutputs,
          successfulSelections: totalSuccessful,
          avgSessionDurationSeconds,
        },
        therapistNotes: notes,
      };
    }),

  /** Phase 10.E — list Claude reports for a child, newest first. */
  list: protectedProcedure
    .input(
      z.object({
        childId: z.string().uuid(),
        limit: z.number().int().min(1).max(50).default(12),
      }),
    )
    .query(async ({ ctx, input }) => {
      await getOwnedChild(ctx, input.childId);
      const res = await (
        ctx.supabase.from('progress_reports') as never as {
          select: (cols: string) => {
            eq: (
              col: string,
              v: string,
            ) => {
              order: (
                col: string,
                opts: { ascending: boolean },
              ) => {
                limit: (n: number) => Promise<{ data: ProgressReportRow[] | null }>;
              };
            };
          };
        }
      )
        .select(
          'id, child_id, generated_at, period_start, period_end, period_type, generated_by, payload_json, cost_usd',
        )
        .eq('child_id', input.childId)
        .order('generated_at', { ascending: false })
        .limit(input.limit);
      return { reports: res.data ?? [] };
    }),

  /** Phase 10.E — get a single report by id (RLS-scoped). */
  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const res = await (
        ctx.supabase.from('progress_reports') as never as {
          select: (cols: string) => {
            eq: (
              col: string,
              v: string,
            ) => { maybeSingle: () => Promise<{ data: ProgressReportRow | null }> };
          };
        }
      )
        .select(
          'id, child_id, generated_at, period_start, period_end, period_type, generated_by, payload_json, cost_usd',
        )
        .eq('id', input.id)
        .maybeSingle();
      if (!res.data) throw new TRPCError({ code: 'NOT_FOUND' });
      return res.data;
    }),

  /**
   * Phase 10.E — manually generate a new Claude report. Rate-limited to
   * 1/24h per child. Defaults to a 7-day weekly window ending now.
   */
  generate: protectedMutationProcedure
    .input(
      z.object({
        childId: z.string().uuid(),
        periodType: periodTypeEnum.default('weekly'),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await getOwnedChild(ctx, input.childId);

      const latest = await (
        ctx.supabase.from('progress_reports') as never as {
          select: (cols: string) => {
            eq: (
              col: string,
              v: string,
            ) => {
              order: (
                col: string,
                opts: { ascending: boolean },
              ) => {
                limit: (n: number) => Promise<{ data: { generated_at: string }[] | null }>;
              };
            };
          };
        }
      )
        .select('generated_at')
        .eq('child_id', input.childId)
        .order('generated_at', { ascending: false })
        .limit(1);
      const last = latest.data?.[0]?.generated_at;
      if (last && Date.now() - new Date(last).getTime() < MANUAL_RATE_LIMIT_MS) {
        throw new TRPCError({
          code: 'TOO_MANY_REQUESTS',
          message: 'rate_limited_24h',
        });
      }

      const periodEnd = new Date();
      const windowDays =
        input.periodType === 'weekly' ? 7 : input.periodType === 'monthly' ? 30 : 90;
      const periodStart = new Date(periodEnd.getTime() - windowDays * 24 * 60 * 60 * 1000);

      const result = await analyzeChild({
        supabaseAdmin: ctx.supabaseAdmin as never,
        childId: input.childId,
        periodStart,
        periodEnd,
        periodType: input.periodType,
        generatedBy: 'manual',
      });

      if (result.skipped === 'insufficient_data') {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'insufficient_data',
        });
      }
      // Phase 12.C.2 — surface child-not-found separately from the
      // session-count check so the UI banner stops blaming session count
      // when the real failure is a missing child / SQL typo / RLS.
      if (result.skipped === 'child_not_found') {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'child_not_found',
        });
      }
      if (result.skipped === 'cap_reached') {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'monthly_cap_reached',
        });
      }
      if (result.skipped === 'cost_too_high') {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'cost_too_high',
        });
      }

      return {
        ok: true,
        reportId: result.reportId,
        costUsd: result.costUsd,
      };
    }),
});
