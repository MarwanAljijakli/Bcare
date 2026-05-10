/**
 * Voice settings tRPC router — Quality Fix Phase 5.
 *
 * Per-child voice preferences:
 *   • voice_id   — text, the ElevenLabs voice key (charlotte | sarah)
 *   • voice_speed — numeric(3,2), 0.75 / 1.0 / 1.25
 *   • auto_play_speak — boolean, whether the board auto-plays after Speak tap
 *
 * Caller verifies child ownership via the existing `requireOwnedChild`
 * pattern. Audit-logged on every mutation.
 */
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { protectedMutationProcedure, protectedProcedure, router } from '../trpc';

const VOICE_KEYS = ['charlotte', 'sarah'] as const;
const SPEEDS = [0.75, 1.0, 1.25] as const;

interface ChildRow {
  id: string;
  caregiver_id: string;
  voice_id: string | null;
  voice_speed: string | number | null;
  auto_play_speak: boolean | null;
}

async function getOwnedChild(
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
    .select('id, caregiver_id, voice_id, voice_speed, auto_play_speak')
    .eq('id', childId)
    .maybeSingle();
  const child = res.data;
  if (!child || child.caregiver_id !== ctx.session.userId) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'child_not_found' });
  }
  return child;
}

export const voiceRouter = router({
  get: protectedProcedure
    .input(z.object({ childId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const c = await getOwnedChild(ctx, input.childId);
      const speedNum = c.voice_speed ? Number(c.voice_speed) : 1.0;
      const voiceKey = VOICE_KEYS.find((k) => k === c.voice_id) ?? 'charlotte';
      return {
        voice: voiceKey,
        speed: Number.isFinite(speedNum) ? speedNum : 1.0,
        autoPlay: c.auto_play_speak ?? true,
      };
    }),

  set: protectedMutationProcedure
    .input(
      z.object({
        childId: z.string().uuid(),
        voice: z.enum(VOICE_KEYS).optional(),
        speed: z
          .number()
          .refine((s) => SPEEDS.includes(s as (typeof SPEEDS)[number]))
          .optional(),
        autoPlay: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await getOwnedChild(ctx, input.childId);
      const patch: Record<string, unknown> = {};
      if (input.voice !== undefined) patch.voice_id = input.voice;
      if (input.speed !== undefined) patch.voice_speed = input.speed;
      if (input.autoPlay !== undefined) patch.auto_play_speak = input.autoPlay;
      if (Object.keys(patch).length === 0) return { ok: true };

      await (
        ctx.supabase.from('children') as never as {
          update: (p: Record<string, unknown>) => {
            eq: (col: string, v: string) => Promise<unknown>;
          };
        }
      )
        .update(patch)
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
        metadata: { kind: 'voice_settings_changed', ...patch },
      });
      return { ok: true };
    }),
});
