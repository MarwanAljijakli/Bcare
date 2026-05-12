import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { protectedMutationProcedure, protectedProcedure, router } from '../trpc';

/**
 * Sessions router — Module 6.1.
 *
 * Backs the /dashboard/sessions/[id] replay surface:
 *   • `detail` returns session metadata + ordered input events + the
 *     symbols referenced by those events + child name. RLS-scoped via
 *     the cookie-bound supabase client.
 *   • `updateNotes` writes the therapist_notes column on a session.
 *     The 0010_therapist_read_access.sql migration gates therapist
 *     writes to only this column via a row-level trigger; caregivers
 *     can write the full row by RLS.
 *   • Audit-logged via the admin client on every notes save (the
 *     audit_log table is service-role-write-only by Module 2 policy).
 *
 * Why we surface raw `input_events` instead of the dashboard's
 * pre-aggregated payload: the replay UI needs the exact sequence with
 * per-event latency + modality icons, which the aggregations throw
 * away. The event list is small (a single session is bounded — the
 * board's hard cap on session length keeps this ≤ a few hundred rows).
 */

interface SessionRow {
  id: string;
  child_id: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  input_count: number | null;
  output_count: number | null;
  successful_selections: number | null;
  therapist_notes: string | null;
}

interface InputEventRow {
  id: string;
  modality: 'symbol' | 'speech' | 'gesture' | 'keyboard';
  symbol_id: string | null;
  latency_ms: number | null;
  was_corrected: number;
  payload: Record<string, unknown> | null;
  created_at: string;
}

interface SymbolRow {
  id: string;
  label_en: string | null;
  label_ar: string | null;
  image_path: string | null;
}

interface ChildRow {
  id: string;
  full_name: string;
  preferred_name: string | null;
}

export const sessionsRouter = router({
  detail: protectedProcedure
    .input(z.object({ sessionId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      // 1. Session row, RLS-scoped (caregiver OR therapist-with-grant).
      const sessRes = await (
        ctx.supabase.from('sessions') as never as {
          select: (cols: string) => {
            eq: (
              col: string,
              v: string,
            ) => { maybeSingle: () => Promise<{ data: SessionRow | null }> };
          };
        }
      )
        .select(
          'id, child_id, started_at, ended_at, duration_seconds, input_count, output_count, successful_selections, therapist_notes',
        )
        .eq('id', input.sessionId)
        .maybeSingle();
      const session = sessRes.data;
      if (!session) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'session_not_found' });
      }

      // 2. Child header — preferred name, RLS-scoped.
      const childRes = await (
        ctx.supabase.from('children') as never as {
          select: (cols: string) => {
            eq: (
              col: string,
              v: string,
            ) => { maybeSingle: () => Promise<{ data: ChildRow | null }> };
          };
        }
      )
        .select('id, full_name, preferred_name')
        .eq('id', session.child_id)
        .maybeSingle();

      // 3. Ordered input events.
      const eventsRes = await (
        ctx.supabase.from('input_events') as never as {
          select: (cols: string) => {
            eq: (
              col: string,
              v: string,
            ) => {
              order: (
                col: string,
                opts: { ascending: boolean },
              ) => Promise<{ data: InputEventRow[] | null }>;
            };
          };
        }
      )
        .select('id, modality, symbol_id, latency_ms, was_corrected, payload, created_at')
        .eq('session_id', input.sessionId)
        .order('created_at', { ascending: true });
      const events = eventsRes.data ?? [];

      // 4. Symbols referenced by those events — single in() lookup so the
      //    page only triggers one symbol read per session.
      const symbolIds = Array.from(
        new Set(events.map((e) => e.symbol_id).filter((s): s is string => !!s)),
      );
      let symbols: SymbolRow[] = [];
      if (symbolIds.length > 0) {
        const symRes = await (
          ctx.supabase.from('symbols') as never as {
            select: (cols: string) => {
              in: (col: string, vs: string[]) => Promise<{ data: SymbolRow[] | null }>;
            };
          }
        )
          .select('id, label_en, label_ar, image_path')
          .in('id', symbolIds);
        symbols = symRes.data ?? [];
      }

      // 5. Who is the caller — caregiver of this child, therapist with grant,
      //    or admin? The UI uses this to decide whether to show "Editing
      //    as therapist" framing on the notes editor.
      const isCaregiverRes = await (
        ctx.supabaseAdmin.from('children') as never as {
          select: (cols: string) => {
            eq: (
              col: string,
              v: string,
            ) => {
              eq: (
                col2: string,
                v2: string,
              ) => { maybeSingle: () => Promise<{ data: { id: string } | null }> };
            };
          };
        }
      )
        .select('id')
        .eq('id', session.child_id)
        .eq('caregiver_id', ctx.session.userId)
        .maybeSingle();
      const callerRole: 'caregiver' | 'therapist' = isCaregiverRes.data ? 'caregiver' : 'therapist';

      return {
        session,
        child: childRes.data,
        events,
        symbols,
        callerRole,
      };
    }),

  /** Save therapist_notes. Audit-logged. */
  updateNotes: protectedMutationProcedure
    .input(
      z.object({
        sessionId: z.string().uuid(),
        notes: z.string().max(4096),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Cookie-bound update — RLS gates whether the caller is allowed
      // (caregiver OR therapist-with-grant; the 0010 trigger ensures
      // therapists only touch this column).
      const updRes = await (
        ctx.supabase.from('sessions') as never as {
          update: (patch: { therapist_notes: string }) => {
            eq: (col: string, v: string) => Promise<{ error: { message: string } | null }>;
          };
        }
      )
        .update({ therapist_notes: input.notes })
        .eq('id', input.sessionId);
      if (updRes.error) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: updRes.error.message });
      }

      // Audit-log (service role; audit_log is write-restricted to it).
      await (
        ctx.supabaseAdmin.from('audit_log') as never as {
          insert: (row: Record<string, unknown>) => Promise<unknown>;
        }
      ).insert({
        actor_id: ctx.session.userId,
        action: 'therapist_note_update',
        target_type: 'session',
        target_id: input.sessionId,
        metadata: { notes_length: input.notes.length },
      });

      return { ok: true };
    }),
});
