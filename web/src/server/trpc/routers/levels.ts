/**
 * Levels tRPC router — Phase 10.D.
 *
 * Reads and writes a child's vocabulary_level + exposes mastery progress
 * for the board badge and the /settings/level page. Auto-promotion lives
 * in the personalization cron; this router is the manual-override and
 * read surface.
 */

import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { protectedMutationProcedure, protectedProcedure, router } from '../trpc';
import {
  AUTO_PROMOTION_PCT,
  LEVEL_CATEGORIES,
  LEVEL_PROGRESSION,
  LEVEL_REGRESSION,
  LEVEL_TARGET_COUNTS,
  MASTERY_SESSIONS_THRESHOLD,
  MASTERY_USES_THRESHOLD,
  VOCAB_LEVELS,
  type VocabLevel,
  categoriesForLevel,
  levelOrdinal,
} from '@/lib/levels';

const levelEnum = z.enum(VOCAB_LEVELS as unknown as [VocabLevel, ...VocabLevel[]]);

interface ChildRow {
  id: string;
  caregiver_id: string;
  vocabulary_level: VocabLevel | null;
}

interface MasteryRow {
  symbol_id: string;
  use_count: number;
  session_count: number;
  is_mastered: number;
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
    .select('id, caregiver_id, vocabulary_level')
    .eq('id', childId)
    .maybeSingle();
  const child = res.data;
  if (!child || child.caregiver_id !== ctx.session.userId) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'child_not_found' });
  }
  return child;
}

export const levelsRouter = router({
  /**
   * Get the child's current level + mastery counts for the board badge
   * and /settings/level page. Returns mastered counts both for the
   * active level AND each tier — the parent override page uses this
   * to motivate promotion ("you're 12/20 away from Conversational").
   */
  get: protectedProcedure
    .input(z.object({ childId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const child = await getOwnedChild(ctx, input.childId);
      const level: VocabLevel = child.vocabulary_level ?? 'starter';

      // Pull mastery rows + the symbol categories needed to bucket
      // them by tier. Two cheap queries.
      const mastery = (await (
        ctx.supabase.from('mastery_per_child_symbol') as never as {
          select: (cols: string) => {
            eq: (col: string, v: string) => Promise<{ data: MasteryRow[] | null; error: unknown }>;
          };
        }
      )
        .select('symbol_id, use_count, session_count, is_mastered')
        .eq('child_id', child.id)) as { data: MasteryRow[] | null };

      const masteryRows = mastery.data ?? [];
      const masteredSymbolIds = new Set(
        masteryRows.filter((m) => m.is_mastered === 1).map((m) => m.symbol_id),
      );

      // Pull the active vocab so we know which symbols + categories
      // are even on the child's board today.
      const vocabRes = await (
        ctx.supabase.from('vocabulary_sets') as never as {
          select: (cols: string) => {
            eq: (col: string, v: string) => Promise<{ data: { symbol_id: string }[] | null }>;
          };
        }
      )
        .select('symbol_id')
        .eq('child_id', child.id);
      const symbolIds = (vocabRes.data ?? []).map((r) => r.symbol_id);

      let activeSymbolCount = 0;
      let activeMastered = 0;
      if (symbolIds.length > 0) {
        const symRes = await (
          ctx.supabase.from('symbols') as never as {
            select: (cols: string) => {
              in: (
                col: string,
                vs: string[],
              ) => Promise<{ data: { id: string; categories: string[] | null }[] | null }>;
            };
          }
        )
          .select('id, categories')
          .in('id', symbolIds);
        const activeCats = categoriesForLevel(level);
        for (const s of symRes.data ?? []) {
          const cats = s.categories ?? [];
          const inActive = cats.some((c) => activeCats.includes(c));
          if (inActive) {
            activeSymbolCount += 1;
            if (masteredSymbolIds.has(s.id)) activeMastered += 1;
          }
        }
      }

      const masteryPct =
        activeSymbolCount > 0 ? Math.min(1, activeMastered / activeSymbolCount) : 0;
      const readyForNext = masteryPct >= AUTO_PROMOTION_PCT && LEVEL_PROGRESSION[level] !== level;

      return {
        level,
        ordinal: levelOrdinal(level),
        totalLevels: VOCAB_LEVELS.length,
        targetSymbols: LEVEL_TARGET_COUNTS[level],
        active: { symbols: activeSymbolCount, mastered: activeMastered, masteryPct },
        nextLevel: LEVEL_PROGRESSION[level],
        readyForNext,
        thresholds: {
          uses: MASTERY_USES_THRESHOLD,
          sessions: MASTERY_SESSIONS_THRESHOLD,
          autoPromotionPct: AUTO_PROMOTION_PCT,
        },
        tierCategories: LEVEL_CATEGORIES,
      };
    }),

  /**
   * Manually set the child's level. Parent override — bypasses the
   * mastery rule. Writes an audit_log row so we can see when human
   * intervention overrode the system's auto-promotion logic.
   */
  set: protectedMutationProcedure
    .input(z.object({ childId: z.string().uuid(), level: levelEnum }))
    .mutation(async ({ ctx, input }) => {
      const child = await getOwnedChild(ctx, input.childId);
      const previous = child.vocabulary_level ?? 'starter';
      if (previous === input.level) {
        return { ok: true, level: input.level, changed: false };
      }

      await (
        ctx.supabase.from('children') as never as {
          update: (row: Record<string, unknown>) => {
            eq: (col: string, v: string) => Promise<{ error: unknown }>;
          };
        }
      )
        .update({ vocabulary_level: input.level, updated_at: new Date().toISOString() })
        .eq('id', child.id);

      // Audit-log via admin client (bypasses RLS so we can write
      // regardless of who triggered it).
      await (
        ctx.supabaseAdmin.from('audit_log') as never as {
          insert: (row: Record<string, unknown>) => Promise<unknown>;
        }
      ).insert({
        actor_id: ctx.session.userId,
        action: 'child_update',
        target_type: 'child',
        target_id: child.id,
        metadata: {
          kind: 'vocabulary_level_set',
          previous,
          next: input.level,
          source: 'parent_override',
        },
      });

      return { ok: true, level: input.level, changed: true, previous };
    }),

  /**
   * Bump the child up one level explicitly (parent celebrates a
   * milestone). Reuses `set` for the actual write.
   */
  promote: protectedMutationProcedure
    .input(z.object({ childId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const child = await getOwnedChild(ctx, input.childId);
      const current: VocabLevel = child.vocabulary_level ?? 'starter';
      const next = LEVEL_PROGRESSION[current];
      if (next === current) return { ok: true, level: current, changed: false };

      await (
        ctx.supabase.from('children') as never as {
          update: (row: Record<string, unknown>) => {
            eq: (col: string, v: string) => Promise<{ error: unknown }>;
          };
        }
      )
        .update({ vocabulary_level: next, updated_at: new Date().toISOString() })
        .eq('id', child.id);

      await (
        ctx.supabaseAdmin.from('audit_log') as never as {
          insert: (row: Record<string, unknown>) => Promise<unknown>;
        }
      ).insert({
        actor_id: ctx.session.userId,
        action: 'child_update',
        target_type: 'child',
        target_id: child.id,
        metadata: {
          kind: 'vocabulary_level_promoted',
          previous: current,
          next,
          source: 'parent_override',
        },
      });

      return { ok: true, level: next, changed: true, previous: current };
    }),

  /** Step down a level — useful if a promotion felt premature. */
  demote: protectedMutationProcedure
    .input(z.object({ childId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const child = await getOwnedChild(ctx, input.childId);
      const current: VocabLevel = child.vocabulary_level ?? 'starter';
      const prev = LEVEL_REGRESSION[current];
      if (prev === current) return { ok: true, level: current, changed: false };

      await (
        ctx.supabase.from('children') as never as {
          update: (row: Record<string, unknown>) => {
            eq: (col: string, v: string) => Promise<{ error: unknown }>;
          };
        }
      )
        .update({ vocabulary_level: prev, updated_at: new Date().toISOString() })
        .eq('id', child.id);

      await (
        ctx.supabaseAdmin.from('audit_log') as never as {
          insert: (row: Record<string, unknown>) => Promise<unknown>;
        }
      ).insert({
        actor_id: ctx.session.userId,
        action: 'child_update',
        target_type: 'child',
        target_id: child.id,
        metadata: {
          kind: 'vocabulary_level_demoted',
          previous: current,
          next: prev,
          source: 'parent_override',
        },
      });

      return { ok: true, level: prev, changed: true, previous: current };
    }),
});
