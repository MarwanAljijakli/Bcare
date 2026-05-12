import { z } from 'zod';
import { protectedProcedure, router } from '../trpc';

/**
 * Reports router — Module 6.1 PDF export.
 *
 * Single `summary` query returning the full set of numbers the
 * `<ProgressReportPdf>` component needs for a single (child, window)
 * pair. Windows are 7 / 30 / 90 days; we return a flat shape that's
 * easy to feed into both `@react-pdf/renderer` and a future on-screen
 * preview.
 *
 * RLS-scoped via the cookie-bound client. Caregivers + therapists with
 * an active grant can both run this; the migration 0010 read policies
 * cover the underlying tables.
 *
 * Includes (per the directive):
 *   • vocabulary growth chart (per-day active_vocabulary_size points)
 *   • top symbols (rolled up across the window)
 *   • session frequency (per-day session count)
 *   • multimodal breakdown (sum of input_events.modality buckets)
 *   • therapist notes (sessions whose therapist_notes is non-empty)
 */

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

export const reportsRouter = router({
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

      // Child header — RLS-scoped.
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

      // progress_metrics in the window — vocabulary sparkline + modality breakdown.
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

      // Build vocab sparkline filling in zeros for missing days so the
      // chart always has `window` points.
      const metricMap = new Map(metrics.map((m) => [m.day, m]));
      const vocabSparkline: { day: string; size: number }[] = [];
      for (let i = input.window - 1; i >= 0; i--) {
        const d = new Date(end);
        d.setUTCDate(d.getUTCDate() - i);
        const key = dayKey(d);
        vocabSparkline.push({ day: key, size: metricMap.get(key)?.active_vocabulary_size ?? 0 });
      }

      // Aggregate multimodal breakdown across the window.
      const multimodalBreakdown = { symbol: 0, speech: 0, gesture: 0, keyboard: 0 };
      for (const m of metrics) {
        multimodalBreakdown.symbol += m.modality_breakdown?.symbol ?? 0;
        multimodalBreakdown.speech += m.modality_breakdown?.speech ?? 0;
        multimodalBreakdown.gesture += m.modality_breakdown?.gesture ?? 0;
        multimodalBreakdown.keyboard += m.modality_breakdown?.keyboard ?? 0;
      }

      // Top symbols — re-aggregate across the window's per-day top lists.
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

      // Sessions in the window — drive session frequency + totals + notes.
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
});
