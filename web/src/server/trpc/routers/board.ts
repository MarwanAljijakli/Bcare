import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { protectedMutationProcedure, protectedProcedure, router } from '../trpc';

/**
 * Board router — powers /[locale]/board.
 *
 * • `bootstrap`    — one round-trip on board mount that returns the active
 *                    child, the catalog of symbols visible to that child,
 *                    and the top-8 favorites computed from progress + recent
 *                    input_events. Free-cost (no LLM) — straight DB reads.
 * • `openSession`  — creates a `sessions` row and returns its id; subsequent
 *                    autosaves attach inputs/outputs to it.
 * • `recordInput`  — append-only insert to `input_events`. Modality-shaped
 *                    payload. Anonymous event id is server-generated.
 * • `recordOutput` — append-only insert to `output_events`.
 * • `closeSession` — stamps `ended_at` + duration + aggregate counters.
 *
 * Every event payload is carefully scoped so that NO transcription or video
 * frames ever land in the DB — only symbol IDs, modalities, and timing.
 *
 * Per the master prompt: "no analytics or logs ever touch child input
 * content." The audit log is NOT written for input events — only sessions
 * are audited at open + close.
 */

const VOICE_BUCKET = 'symbols-public';

export const boardRouter = router({
  /**
   * One-shot bootstrap. Returns:
   *   • child     — the caregiver's first child (Module 6 will add a switcher).
   *   • symbols   — the system "starter" library symbols for the child's
   *                 vocabulary level + any caregiver-added customs.
   *   • favorites — the top-8 most-used symbol ids from the last 30 days.
   *
   * The image_path returned is the storage object path; the client builds
   * the public URL via the supabase storage helper.
   */
  bootstrap: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.userId;

    // Pick the first child; Module 6 dashboard adds a header switcher.
    const childRes = await (
      ctx.supabase.from('children') as never as {
        select: (cols: string) => {
          eq: (
            col: string,
            v: string,
          ) => {
            order: (
              col: string,
              opts: { ascending: boolean },
            ) => {
              limit: (n: number) => Promise<{ data: ChildRow[] | null }>;
            };
          };
        };
      }
    )
      .select(
        'id, full_name, preferred_name, preferred_locale, preferred_theme, vocabulary_level, voice_id, sensory_profile',
      )
      .eq('caregiver_id', userId)
      .order('created_at', { ascending: true })
      .limit(1);
    const child = childRes.data?.[0] ?? null;
    if (!child) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'no_child' });
    }

    // Pull every active system symbol. The "starter" vocabulary level
    // gets the seed set; expanding/conversational/advanced will be
    // gated by Module 4 personalization. For now everyone sees the seed.
    const symbolRes = await (
      ctx.supabase.from('symbols') as never as {
        select: (cols: string) => {
          eq: (
            col: string,
            v: string,
          ) => {
            order: (
              col: string,
              opts: { ascending: boolean },
            ) => Promise<{ data: SymbolRow[] | null }>;
          };
        };
      }
    )
      .select('id, label_en, label_ar, phonetic_en, phonetic_ar, image_path, categories, tags')
      .eq('status', 'active')
      .order('global_frequency', { ascending: false });
    const symbols = symbolRes.data ?? [];

    // Favorites: top-8 by usage in the last 30 days. Computed via a
    // server-side aggregate so the client never sees raw event rows.
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const usageRes = await (
      ctx.supabase.from('input_events') as never as {
        select: (cols: string) => {
          eq: (
            col: string,
            v: string,
          ) => {
            gte: (
              col2: string,
              v2: string,
            ) => Promise<{ data: { symbol_id: string | null }[] | null }>;
          };
        };
      }
    )
      .select('symbol_id')
      .eq('child_id', child.id)
      .gte('created_at', since);
    const counts = new Map<string, number>();
    for (const row of usageRes.data ?? []) {
      if (!row.symbol_id) continue;
      counts.set(row.symbol_id, (counts.get(row.symbol_id) ?? 0) + 1);
    }
    const favorites = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([id]) => id);

    return {
      child,
      symbols,
      favorites,
      bucket: VOICE_BUCKET,
    };
  }),

  /** Open a session row. Returns its id. */
  openSession: protectedMutationProcedure
    .input(z.object({ childId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const insert: SessionInsertRow = {
        child_id: input.childId,
        started_at: new Date().toISOString(),
      };
      const res = await (
        ctx.supabase.from('sessions') as never as {
          insert: (row: SessionInsertRow) => {
            select: (cols: string) => {
              single: () => Promise<{
                data: { id: string } | null;
                error: { message: string } | null;
              }>;
            };
          };
        }
      )
        .insert(insert)
        .select('id')
        .single();
      if (res.error || !res.data) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: res.error?.message ?? 'session_open_failed',
        });
      }
      return { sessionId: res.data.id };
    }),

  /** Append an input event. Modalities: symbol / speech / gesture / keyboard. */
  recordInput: protectedMutationProcedure
    .input(
      z.object({
        sessionId: z.string().uuid(),
        childId: z.string().uuid(),
        modality: z.enum(['symbol', 'speech', 'gesture', 'keyboard']),
        symbolId: z.string().uuid().nullable().optional(),
        latencyMs: z.number().int().min(0).max(60_000).optional(),
        wasCorrected: z.boolean().optional(),
        // Modality-shaped payload. We allow-list the keys at runtime via zod
        // so no surprise transcript / video frame can sneak through.
        payload: z
          .object({
            tileId: z.string().optional(),
            position: z.number().int().optional(),
            confidence: z.number().min(0).max(1).optional(),
            durationMs: z.number().int().min(0).max(60_000).optional(),
            gestureId: z.string().optional(),
          })
          .optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const row: InputEventInsertRow = {
        session_id: input.sessionId,
        child_id: input.childId,
        modality: input.modality,
        symbol_id: input.symbolId ?? null,
        latency_ms: input.latencyMs ?? null,
        was_corrected: input.wasCorrected ? 1 : 0,
        payload: input.payload ?? {},
        anonymous_event_id: anonymousId(),
      };
      await (
        ctx.supabase.from('input_events') as never as {
          insert: (row: InputEventInsertRow) => Promise<unknown>;
        }
      ).insert(row);
      return { ok: true };
    }),

  /** Append an output event (TTS playback / sentence-strip read / visual). */
  recordOutput: protectedMutationProcedure
    .input(
      z.object({
        sessionId: z.string().uuid(),
        childId: z.string().uuid(),
        modality: z.enum(['tts', 'sentence-strip', 'visual-confirmation']),
        durationMs: z.number().int().min(0).max(60_000).optional(),
        // No transcript text — only symbol-id sequence references for
        // sentence-strip + caregiver-recorded clip pointer for tts.
        payload: z
          .object({
            symbolIds: z.array(z.string().uuid()).max(50).optional(),
            clipPath: z.string().max(512).optional(),
            voiceId: z.string().max(64).optional(),
          })
          .optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const row: OutputEventInsertRow = {
        session_id: input.sessionId,
        child_id: input.childId,
        modality: input.modality,
        duration_ms: input.durationMs ?? null,
        payload: input.payload ?? {},
        anonymous_event_id: anonymousId(),
      };
      await (
        ctx.supabase.from('output_events') as never as {
          insert: (row: OutputEventInsertRow) => Promise<unknown>;
        }
      ).insert(row);
      return { ok: true };
    }),

  /** Close a session. Stamps ended_at + aggregate counters. */
  closeSession: protectedMutationProcedure
    .input(
      z.object({
        sessionId: z.string().uuid(),
        durationSeconds: z.number().int().min(0),
        inputCount: z.number().int().min(0),
        outputCount: z.number().int().min(0),
        successfulSelections: z.number().int().min(0),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await (
        ctx.supabase.from('sessions') as never as {
          update: (patch: {
            ended_at: string;
            duration_seconds: number;
            input_count: number;
            output_count: number;
            successful_selections: number;
          }) => {
            eq: (col: string, v: string) => Promise<unknown>;
          };
        }
      )
        .update({
          ended_at: new Date().toISOString(),
          duration_seconds: input.durationSeconds,
          input_count: input.inputCount,
          output_count: input.outputCount,
          successful_selections: input.successfulSelections,
        })
        .eq('id', input.sessionId);
      return { ok: true };
    }),
});

function anonymousId(): string {
  // 16-byte hex id; no link to user/child. Used only by ops / external
  // observability to dedupe events; never written into analytics.
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

interface ChildRow {
  id: string;
  full_name: string;
  preferred_name: string | null;
  preferred_locale: 'en' | 'ar';
  preferred_theme: 'light' | 'dark' | 'hc';
  vocabulary_level: 'starter' | 'expanding' | 'conversational' | 'advanced';
  voice_id: string | null;
  sensory_profile: {
    motion: 'full' | 'reduced' | 'off';
    audio: 'full' | 'soft' | 'off';
    contrast: 'standard' | 'high';
    touch: 'standard' | 'large' | 'extra-large';
    fontScale: 1 | 1.25 | 1.5;
  };
}

interface SymbolRow {
  id: string;
  label_en: string;
  label_ar: string;
  phonetic_en: string | null;
  phonetic_ar: string | null;
  image_path: string;
  categories: string[];
  tags: string[];
}

interface SessionInsertRow {
  child_id: string;
  started_at: string;
}

interface InputEventInsertRow {
  session_id: string;
  child_id: string;
  modality: 'symbol' | 'speech' | 'gesture' | 'keyboard';
  symbol_id: string | null;
  latency_ms: number | null;
  was_corrected: number;
  payload: Record<string, unknown>;
  anonymous_event_id: string;
}

interface OutputEventInsertRow {
  session_id: string;
  child_id: string;
  modality: 'tts' | 'sentence-strip' | 'visual-confirmation';
  duration_ms: number | null;
  payload: Record<string, unknown>;
  anonymous_event_id: string;
}
