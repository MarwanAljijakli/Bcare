import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { protectedMutationProcedure, protectedProcedure, router } from '../trpc';
import { isLlmAvailable } from '@/lib/ai/openai';

/**
 * Personalization tRPC router — caregiver-review surface for the
 * frequency-based suggestion engine + the optional LLM upgrade.
 *
 * Procedures:
 *   • listPending(childId)    — pending suggestions for the child
 *                               (caregiver must own the child).
 *   • approve(suggestionId)   — mark approved + insert into
 *                               vocabulary_sets at the next position.
 *   • reject(suggestionId)    — mark rejected + record reason; the
 *                               cron's 60-day cooldown stops the
 *                               same symbol from re-appearing.
 *   • toggle.get(childId)     — return ai_suggestion_mode +
 *                               whether the LLM upgrade is available.
 *   • toggle.set(childId)     — caregiver flips between auto / review
 *                               and (when available) llm-on / llm-off.
 *   • runNow(childId)         — manual recompute (Module 6 dashboard
 *                               surface; useful when caregivers want
 *                               immediate suggestions instead of
 *                               waiting for the nightly cron).
 *
 * Every mutation is audit-logged via the service-role admin client.
 */

const REJECTION_REASONS = [
  'not_relevant',
  'not_yet',
  'wrong_category',
  'duplicate',
  'other',
] as const;

interface SuggestionRow {
  id: string;
  child_id: string;
  symbol_id: string;
  source: 'frequency' | 'llm';
  score: string;
  reason: string | null;
  signals: Record<string, unknown>;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  created_at: string;
  expires_at: string;
}

interface ChildRow {
  id: string;
  caregiver_id: string;
  ai_suggestion_mode: 'auto' | 'review';
}

async function requireOwnedChild(
  ctx: { supabase: { from: (t: string) => unknown }; session: { userId: string } },
  childId: string,
): Promise<ChildRow> {
  const res = await (
    ctx.supabase.from('children') as never as {
      select: (cols: string) => {
        eq: (
          col: string,
          v: string,
        ) => {
          maybeSingle: () => Promise<{ data: ChildRow | null }>;
        };
      };
    }
  )
    .select('id, caregiver_id, ai_suggestion_mode')
    .eq('id', childId)
    .maybeSingle();
  const child = res.data;
  if (!child || child.caregiver_id !== ctx.session.userId) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'child_not_found' });
  }
  return child;
}

export const personalizationRouter = router({
  listPending: protectedProcedure
    .input(z.object({ childId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await requireOwnedChild(ctx, input.childId);
      const res = await (
        ctx.supabase.from('vocabulary_suggestions') as never as {
          select: (cols: string) => {
            eq: (
              col: string,
              v: string,
            ) => {
              eq: (
                col2: string,
                v2: string,
              ) => {
                order: (
                  col: string,
                  opts: { ascending: boolean },
                ) => Promise<{ data: SuggestionRow[] | null }>;
              };
            };
          };
        }
      )
        .select(
          'id, child_id, symbol_id, source, score, reason, signals, status, created_at, expires_at',
        )
        .eq('child_id', input.childId)
        .eq('status', 'pending')
        .order('score', { ascending: false });

      const rows = (res.data ?? []) as SuggestionRow[];
      return rows.map((r) => ({ ...r, score: Number(r.score) }));
    }),

  approve: protectedMutationProcedure
    .input(z.object({ suggestionId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const lookup = await (
        ctx.supabase.from('vocabulary_suggestions') as never as {
          select: (cols: string) => {
            eq: (
              col: string,
              v: string,
            ) => {
              maybeSingle: () => Promise<{ data: SuggestionRow | null }>;
            };
          };
        }
      )
        .select(
          'id, child_id, symbol_id, status, score, reason, signals, source, created_at, expires_at',
        )
        .eq('id', input.suggestionId)
        .maybeSingle();
      const s = lookup.data;
      if (!s) throw new TRPCError({ code: 'NOT_FOUND', message: 'suggestion_not_found' });
      if (s.status !== 'pending') {
        throw new TRPCError({ code: 'CONFLICT', message: `suggestion_${s.status}` });
      }
      await requireOwnedChild(ctx, s.child_id);

      // Compute the next position in vocabulary_sets — append at the end.
      const posRes = await (
        ctx.supabase.from('vocabulary_sets') as never as {
          select: (cols: string) => {
            eq: (
              col: string,
              v: string,
            ) => {
              order: (
                col: string,
                opts: { ascending: boolean },
              ) => {
                limit: (n: number) => Promise<{ data: { position: number }[] | null }>;
              };
            };
          };
        }
      )
        .select('position')
        .eq('child_id', s.child_id)
        .order('position', { ascending: false })
        .limit(1);
      const nextPos = ((posRes.data ?? [])[0]?.position ?? -1) + 1;

      // Insert vocabulary_sets row.
      await (
        ctx.supabase.from('vocabulary_sets') as never as {
          insert: (row: Record<string, unknown>) => Promise<unknown>;
        }
      ).insert({
        child_id: s.child_id,
        symbol_id: s.symbol_id,
        position: nextPos,
        category: null,
        frequency: 0,
        is_favorite: 0,
        meta: { addedFromSuggestion: s.id, source: s.source },
      });

      // Mark suggestion approved.
      await (
        ctx.supabase.from('vocabulary_suggestions') as never as {
          update: (patch: Record<string, unknown>) => {
            eq: (col: string, v: string) => Promise<unknown>;
          };
        }
      )
        .update({
          status: 'approved',
          reviewed_at: new Date().toISOString(),
          reviewed_by_id: ctx.session.userId,
        })
        .eq('id', s.id);

      // Audit-log via admin client (RLS denies normal inserts to audit_log).
      await (
        ctx.supabaseAdmin.from('audit_log') as never as {
          insert: (row: Record<string, unknown>) => Promise<unknown>;
        }
      ).insert({
        actor_id: ctx.session.userId,
        action: 'admin_action',
        target_type: 'vocabulary_suggestion',
        target_id: s.id,
        metadata: {
          kind: 'vocab_suggestion_approved',
          childId: s.child_id,
          symbolId: s.symbol_id,
          source: s.source,
        },
      });

      return { ok: true };
    }),

  reject: protectedMutationProcedure
    .input(
      z.object({
        suggestionId: z.string().uuid(),
        reason: z.enum(REJECTION_REASONS).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const lookup = await (
        ctx.supabase.from('vocabulary_suggestions') as never as {
          select: (cols: string) => {
            eq: (
              col: string,
              v: string,
            ) => {
              maybeSingle: () => Promise<{ data: SuggestionRow | null }>;
            };
          };
        }
      )
        .select('id, child_id, symbol_id, status, source')
        .eq('id', input.suggestionId)
        .maybeSingle();
      const s = lookup.data;
      if (!s) throw new TRPCError({ code: 'NOT_FOUND', message: 'suggestion_not_found' });
      if (s.status !== 'pending') {
        throw new TRPCError({ code: 'CONFLICT', message: `suggestion_${s.status}` });
      }
      await requireOwnedChild(ctx, s.child_id);

      await (
        ctx.supabase.from('vocabulary_suggestions') as never as {
          update: (patch: Record<string, unknown>) => {
            eq: (col: string, v: string) => Promise<unknown>;
          };
        }
      )
        .update({
          status: 'rejected',
          reviewed_at: new Date().toISOString(),
          reviewed_by_id: ctx.session.userId,
          rejection_reason: input.reason ?? null,
        })
        .eq('id', s.id);

      await (
        ctx.supabaseAdmin.from('audit_log') as never as {
          insert: (row: Record<string, unknown>) => Promise<unknown>;
        }
      ).insert({
        actor_id: ctx.session.userId,
        action: 'admin_action',
        target_type: 'vocabulary_suggestion',
        target_id: s.id,
        metadata: {
          kind: 'vocab_suggestion_rejected',
          childId: s.child_id,
          symbolId: s.symbol_id,
          reason: input.reason ?? null,
        },
      });

      return { ok: true };
    }),

  toggle: router({
    get: protectedProcedure
      .input(z.object({ childId: z.string().uuid() }))
      .query(async ({ ctx, input }) => {
        const child = await requireOwnedChild(ctx, input.childId);
        return {
          mode: child.ai_suggestion_mode,
          llmAvailable: isLlmAvailable(),
        };
      }),

    set: protectedMutationProcedure
      .input(
        z.object({
          childId: z.string().uuid(),
          mode: z.enum(['auto', 'review']),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        await requireOwnedChild(ctx, input.childId);
        await (
          ctx.supabase.from('children') as never as {
            update: (patch: { ai_suggestion_mode: 'auto' | 'review' }) => {
              eq: (col: string, v: string) => Promise<unknown>;
            };
          }
        )
          .update({ ai_suggestion_mode: input.mode })
          .eq('id', input.childId);

        await (
          ctx.supabaseAdmin.from('audit_log') as never as {
            insert: (row: Record<string, unknown>) => Promise<unknown>;
          }
        ).insert({
          actor_id: ctx.session.userId,
          action: 'admin_action',
          target_type: 'children',
          target_id: input.childId,
          metadata: { kind: 'ai_suggestion_mode_changed', mode: input.mode },
        });

        return { ok: true };
      }),
  }),

  runNow: protectedMutationProcedure
    .input(z.object({ childId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await requireOwnedChild(ctx, input.childId);
      // Lazy-load the engine to keep the tRPC bundle small.
      const { recomputeChild } = await import('@/server/personalization');
      const result = await recomputeChild(ctx.supabaseAdmin as never, input.childId);

      await (
        ctx.supabaseAdmin.from('audit_log') as never as {
          insert: (row: Record<string, unknown>) => Promise<unknown>;
        }
      ).insert({
        actor_id: ctx.session.userId,
        action: 'admin_action',
        target_type: 'personalization',
        target_id: input.childId,
        metadata: {
          kind: 'personalization_recomputed_manual',
          ...result,
        },
      });

      return result;
    }),
});
