import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { protectedMutationProcedure, protectedProcedure, router } from '../trpc';
import {
  awardStarOnSpeak,
  getState,
  setSelectedTheme,
  THEMES,
  type ThemeKey,
} from '@/server/gamification';

/**
 * Gamification tRPC — three procedures:
 *   • getState(childId)         — current stars, streak, unlocked themes,
 *                                 selected theme. Caregiver + therapist
 *                                 with grant can read.
 *   • awardOnSpeak(childId)     — called from the board's recordOutput
 *                                 path on TTS success. Server enforces the
 *                                 5-stars-per-day hard cap and streak math.
 *   • setSelectedTheme(childId, theme)
 *                                — caregiver picks from unlocked themes.
 */

interface ChildRow {
  id: string;
  caregiver_id: string;
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
    .select('id, caregiver_id')
    .eq('id', childId)
    .maybeSingle();
  const child = res.data;
  if (!child || child.caregiver_id !== ctx.session.userId) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'child_not_found' });
  }
  return child;
}

export const gamificationRouter = router({
  getState: protectedProcedure
    .input(z.object({ childId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await requireOwnedChild(ctx, input.childId);
      return getState(ctx.supabaseAdmin as never, input.childId);
    }),

  awardOnSpeak: protectedMutationProcedure
    .input(z.object({ childId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // The child's caregiver is the only legitimate caller. Therapists
      // could in theory trigger an award via session replay; that's not
      // exposed yet (Module 6 may add it).
      await requireOwnedChild(ctx, input.childId);
      return awardStarOnSpeak(ctx.supabaseAdmin as never, input.childId);
    }),

  setSelectedTheme: protectedMutationProcedure
    .input(
      z.object({
        childId: z.string().uuid(),
        theme: z.enum(THEMES as unknown as [ThemeKey, ...ThemeKey[]]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireOwnedChild(ctx, input.childId);
      const next = await setSelectedTheme(ctx.supabaseAdmin as never, input.childId, input.theme);

      // Audit-log the theme change so caregivers can see what's been
      // selected over time.
      await (
        ctx.supabaseAdmin.from('audit_log') as never as {
          insert: (row: Record<string, unknown>) => Promise<unknown>;
        }
      ).insert({
        actor_id: ctx.session.userId,
        action: 'admin_action',
        target_type: 'gamification_state',
        target_id: input.childId,
        metadata: { kind: 'theme_selected', theme: input.theme },
      });

      return next;
    }),
});
