import { z } from 'zod';
import { publicProcedure, router } from '../trpc';

/**
 * Help router — Module 8.
 *
 * Single procedure: `feedback` records an anonymous 👍/👎 vote on a
 * help article. We use a public (non-auth) procedure because help is
 * a public surface; the feedback is anonymous by design — we never
 * attach actor_id, only the article slug + the helpful boolean.
 *
 * The row goes into audit_log because that's the existing single
 * table that already accepts service-role inserts with arbitrary
 * metadata. A separate `help_feedback` table would be cleaner long-
 * term but Module 9's migration consolidation isn't the place to
 * add it.
 */
export const helpRouter = router({
  feedback: publicProcedure
    .input(
      z.object({
        slug: z.string().min(1).max(120),
        locale: z.enum(['en', 'ar']),
        helpful: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await (
        ctx.supabaseAdmin.from('audit_log') as never as {
          insert: (row: Record<string, unknown>) => Promise<unknown>;
        }
      ).insert({
        actor_id: null, // anonymous by design
        action: 'admin_action', // reuse existing enum; metadata.kind disambiguates
        target_type: 'help_article',
        target_id: input.slug,
        metadata: {
          kind: 'help_feedback',
          article_slug: input.slug,
          locale: input.locale,
          helpful_bool: input.helpful,
        },
      });
      return { ok: true };
    }),
});
