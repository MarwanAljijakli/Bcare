import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { protectedMutationProcedure, protectedProcedure, router } from '../trpc';

/**
 * Admin router — Module 7.
 *
 * All procedures verify the caller's profile.role='admin' before doing
 * anything. Even though RLS already gates the underlying tables on
 * is_admin(), we do the check explicitly so non-admin callers get a
 * clean FORBIDDEN error instead of an empty result set.
 *
 * Sub-areas:
 *   • users.list / users.detail  — paginated + filterable user index
 *   • symbols.queue / symbols.approve / symbols.reject  — moderation
 *   • audit.list                 — paginated audit_log viewer
 *   • health                     — aggregated system status card
 */

async function requireAdminRole(ctx: {
  supabase: { from: (t: string) => unknown };
  session: { userId: string };
}): Promise<void> {
  const res = (await (
    ctx.supabase.from('profiles') as never as {
      select: (cols: string) => {
        eq: (
          col: string,
          v: string,
        ) => { maybeSingle: () => Promise<{ data: { role: string } | null }> };
      };
    }
  )
    .select('role')
    .eq('user_id', ctx.session.userId)
    .maybeSingle()) as { data: { role: string } | null };
  if (!res.data || res.data.role !== 'admin') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'admin_required' });
  }
}

export const adminRouter = router({
  // ===========================================================================
  // users
  // ===========================================================================
  usersList: protectedProcedure
    .input(
      z.object({
        search: z.string().optional(),
        role: z.enum(['all', 'family', 'caregiver', 'therapist', 'admin']).default('all'),
        locale: z.enum(['all', 'en', 'ar']).default('all'),
        status: z.enum(['all', 'active', 'tombstoned', 'locked_out']).default('all'),
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(100).default(25),
      }),
    )
    .query(async ({ ctx, input }) => {
      await requireAdminRole(ctx);
      const offset = (input.page - 1) * input.pageSize;

      // Use the admin client so we can paginate across all users + all
      // their counts in one batch. RLS admin policies would also work
      // but pagination is easier with explicit service-role access.
      type ProfileRow = {
        user_id: string;
        full_name: string | null;
        role: string;
        locale: string;
        parental_pin_locked_until: string | null;
        created_at: string;
      };
      type UserRow = { id: string; email: string; deleted_at: string | null };

      const profilesQuery = (
        ctx.supabaseAdmin.from('profiles') as never as {
          select: (
            cols: string,
            opts?: { count?: 'exact' },
          ) => {
            order: (
              col: string,
              opts: { ascending: boolean },
            ) => {
              range: (
                from: number,
                to: number,
              ) => Promise<{ data: ProfileRow[] | null; count: number | null }>;
            };
          };
        }
      )
        .select('user_id, full_name, role, locale, parental_pin_locked_until, created_at', {
          count: 'exact',
        })
        .order('created_at', { ascending: false })
        .range(offset, offset + input.pageSize - 1);

      const { data: profileRows, count } = await profilesQuery;
      const profiles = profileRows ?? [];
      const userIds = profiles.map((p) => p.user_id);

      let users: UserRow[] = [];
      if (userIds.length > 0) {
        const usersRes = (await (
          ctx.supabaseAdmin.from('users') as never as {
            select: (cols: string) => {
              in: (col: string, vs: string[]) => Promise<{ data: UserRow[] | null }>;
            };
          }
        )
          .select('id, email, deleted_at')
          .in('id', userIds)) as { data: UserRow[] | null };
        users = usersRes.data ?? [];
      }
      const userMap = new Map(users.map((u) => [u.id, u]));

      const rows = profiles
        .map((p) => {
          const u = userMap.get(p.user_id);
          const now = Date.now();
          const lockedUntil = p.parental_pin_locked_until
            ? new Date(p.parental_pin_locked_until).getTime()
            : 0;
          let status: 'active' | 'tombstoned' | 'locked_out' = 'active';
          if (u?.deleted_at) status = 'tombstoned';
          else if (lockedUntil > now) status = 'locked_out';
          return {
            userId: p.user_id,
            email: u?.email ?? null,
            fullName: p.full_name,
            role: p.role,
            locale: p.locale,
            status,
            createdAt: p.created_at,
            lockedUntil: p.parental_pin_locked_until,
          };
        })
        // Client-side filtering for now — Module 9 will push these into SQL.
        .filter((r) => input.role === 'all' || r.role === input.role)
        .filter((r) => input.locale === 'all' || r.locale === input.locale)
        .filter((r) => input.status === 'all' || r.status === input.status)
        .filter((r) => {
          if (!input.search) return true;
          const q = input.search.toLowerCase();
          return (
            (r.email ?? '').toLowerCase().includes(q) ||
            (r.fullName ?? '').toLowerCase().includes(q)
          );
        });

      return {
        rows,
        total: count ?? rows.length,
        page: input.page,
        pageSize: input.pageSize,
      };
    }),

  userDetail: protectedProcedure
    .input(z.object({ userId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await requireAdminRole(ctx);
      const sb = ctx.supabaseAdmin;

      type ProfileRow = {
        user_id: string;
        full_name: string | null;
        role: string;
        locale: string;
        date_of_birth: string | null;
        parental_pin_set_at: string | null;
        parental_pin_locked_until: string | null;
        created_at: string;
        updated_at: string;
      };
      type UserRow = {
        id: string;
        email: string;
        email_confirmed: boolean;
        deleted_at: string | null;
        created_at: string;
      };

      const profileRes = (await (
        sb.from('profiles') as never as {
          select: (cols: string) => {
            eq: (
              col: string,
              v: string,
            ) => { maybeSingle: () => Promise<{ data: ProfileRow | null }> };
          };
        }
      )
        .select('*')
        .eq('user_id', input.userId)
        .maybeSingle()) as { data: ProfileRow | null };
      const userRes = (await (
        sb.from('users') as never as {
          select: (cols: string) => {
            eq: (
              col: string,
              v: string,
            ) => { maybeSingle: () => Promise<{ data: UserRow | null }> };
          };
        }
      )
        .select('id, email, email_confirmed, deleted_at, created_at')
        .eq('id', input.userId)
        .maybeSingle()) as { data: UserRow | null };

      if (!userRes.data && !profileRes.data) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'user_not_found' });
      }

      const childrenRes = (await (
        sb.from('children') as never as {
          select: (
            cols: string,
            opts?: { count?: 'exact'; head?: true },
          ) => {
            eq: (col: string, v: string) => Promise<{ count: number | null }>;
          };
        }
      )
        .select('id', { count: 'exact', head: true })
        .eq('caregiver_id', input.userId)) as { count: number | null };
      const consentsRes = (await (
        sb.from('consent_records') as never as {
          select: (
            cols: string,
            opts?: { count?: 'exact'; head?: true },
          ) => {
            eq: (col: string, v: string) => Promise<{ count: number | null }>;
          };
        }
      )
        .select('id', { count: 'exact', head: true })
        .eq('granted_by_id', input.userId)) as { count: number | null };

      type AuditRow = {
        id: string;
        action: string;
        target_type: string | null;
        target_id: string | null;
        metadata: Record<string, unknown>;
        created_at: string;
      };
      const auditRes = (await (
        sb.from('audit_log') as never as {
          select: (cols: string) => {
            eq: (
              col: string,
              v: string,
            ) => {
              order: (
                col: string,
                opts: { ascending: boolean },
              ) => { limit: (n: number) => Promise<{ data: AuditRow[] | null }> };
            };
          };
        }
      )
        .select('id, action, target_type, target_id, metadata, created_at')
        .eq('actor_id', input.userId)
        .order('created_at', { ascending: false })
        .limit(50)) as { data: AuditRow[] | null };

      return {
        profile: profileRes.data,
        user: userRes.data,
        childrenCount: childrenRes.count ?? 0,
        consentsCount: consentsRes.count ?? 0,
        recentAudit: auditRes.data ?? [],
      };
    }),

  // ===========================================================================
  // symbols moderation
  // ===========================================================================
  symbolsQueue: protectedProcedure.query(async ({ ctx }) => {
    await requireAdminRole(ctx);
    type SymbolRow = {
      id: string;
      label_en: string | null;
      label_ar: string | null;
      image_path: string | null;
      category: string | null;
      source: string;
      uploader_id: string | null;
      created_at: string;
    };
    const res = (await (
      ctx.supabaseAdmin.from('symbols') as never as {
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
      .select('id, label_en, label_ar, image_path, category, source, uploader_id, created_at')
      .eq('status', 'pending_review')
      .order('created_at', { ascending: false })) as { data: SymbolRow[] | null };
    return { rows: res.data ?? [] };
  }),

  symbolsApprove: protectedMutationProcedure
    .input(z.object({ symbolIds: z.array(z.string().uuid()).min(1).max(100) }))
    .mutation(async ({ ctx, input }) => {
      await requireAdminRole(ctx);
      const { error } = await (
        ctx.supabaseAdmin.from('symbols') as never as {
          update: (patch: { status: 'active' }) => {
            in: (col: string, vs: string[]) => Promise<{ error: { message: string } | null }>;
          };
        }
      )
        .update({ status: 'active' })
        .in('id', input.symbolIds);
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });

      await (
        ctx.supabaseAdmin.from('audit_log') as never as {
          insert: (rows: Record<string, unknown>[]) => Promise<unknown>;
        }
      ).insert(
        input.symbolIds.map((id) => ({
          actor_id: ctx.session.userId,
          action: 'symbol_moderate',
          target_type: 'symbol',
          target_id: id,
          metadata: { decision: 'approve' },
        })),
      );
      return { ok: true, count: input.symbolIds.length };
    }),

  symbolsReject: protectedMutationProcedure
    .input(
      z.object({
        symbolId: z.string().uuid(),
        reason: z.enum([
          'blurry',
          'wrong_subject',
          'inappropriate',
          'copyright',
          'duplicate',
          'other',
        ]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireAdminRole(ctx);
      const { error } = await (
        ctx.supabaseAdmin.from('symbols') as never as {
          update: (patch: { status: 'rejected' }) => {
            eq: (col: string, v: string) => Promise<{ error: { message: string } | null }>;
          };
        }
      )
        .update({ status: 'rejected' })
        .eq('id', input.symbolId);
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });

      await (
        ctx.supabaseAdmin.from('audit_log') as never as {
          insert: (row: Record<string, unknown>) => Promise<unknown>;
        }
      ).insert({
        actor_id: ctx.session.userId,
        action: 'symbol_moderate',
        target_type: 'symbol',
        target_id: input.symbolId,
        metadata: { decision: 'reject', reason: input.reason },
      });
      return { ok: true };
    }),

  // ===========================================================================
  // audit log viewer
  // ===========================================================================
  auditList: protectedProcedure
    .input(
      z.object({
        actorSearch: z.string().optional(),
        action: z.string().optional(),
        targetType: z.string().optional(),
        sinceDays: z.number().int().min(1).max(365).default(30),
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(100).default(50),
      }),
    )
    .query(async ({ ctx, input }) => {
      await requireAdminRole(ctx);
      const offset = (input.page - 1) * input.pageSize;
      const since = new Date();
      since.setUTCDate(since.getUTCDate() - input.sinceDays);

      type AuditRow = {
        id: string;
        actor_id: string | null;
        action: string;
        target_type: string | null;
        target_id: string | null;
        metadata: Record<string, unknown>;
        created_at: string;
      };

      // Build the query piece-by-piece. We use a fluent builder pattern
      // via `as any` since the Supabase JS generic chain is painful here.
      type Builder = {
        select: (cols: string, opts?: { count?: 'exact' }) => Builder;
        gte: (col: string, v: string) => Builder;
        eq: (col: string, v: string) => Builder;
        order: (col: string, opts: { ascending: boolean }) => Builder;
        range: (
          from: number,
          to: number,
        ) => Promise<{ data: AuditRow[] | null; count: number | null }>;
      };
      let q = (ctx.supabaseAdmin.from('audit_log') as never as Builder).select(
        'id, actor_id, action, target_type, target_id, metadata, created_at',
        {
          count: 'exact',
        },
      );
      q = q.gte('created_at', since.toISOString());
      if (input.action) q = q.eq('action', input.action);
      if (input.targetType) q = q.eq('target_type', input.targetType);
      q = q.order('created_at', { ascending: false });
      const { data, count } = await q.range(offset, offset + input.pageSize - 1);
      let rows = data ?? [];

      // Actor email lookup — best-effort.
      const actorIds = Array.from(
        new Set(rows.map((r) => r.actor_id).filter((s): s is string => !!s)),
      );
      const emailMap = new Map<string, string>();
      if (actorIds.length > 0) {
        const usersRes = (await (
          ctx.supabaseAdmin.from('users') as never as {
            select: (cols: string) => {
              in: (
                col: string,
                vs: string[],
              ) => Promise<{ data: { id: string; email: string }[] | null }>;
            };
          }
        )
          .select('id, email')
          .in('id', actorIds)) as { data: { id: string; email: string }[] | null };
        for (const u of usersRes.data ?? []) emailMap.set(u.id, u.email);
      }

      // Apply actor search filter client-side. Module 9 will push into SQL.
      if (input.actorSearch) {
        const q2 = input.actorSearch.toLowerCase();
        rows = rows.filter((r) => {
          if (r.actor_id && r.actor_id.toLowerCase().includes(q2)) return true;
          const email = r.actor_id ? (emailMap.get(r.actor_id) ?? '') : '';
          return email.toLowerCase().includes(q2);
        });
      }

      return {
        rows: rows.map((r) => ({
          ...r,
          actorEmail: r.actor_id ? (emailMap.get(r.actor_id) ?? null) : null,
        })),
        total: count ?? rows.length,
        page: input.page,
        pageSize: input.pageSize,
      };
    }),

  // ===========================================================================
  // system health (combined)
  // ===========================================================================
  health: protectedProcedure.query(async ({ ctx }) => {
    await requireAdminRole(ctx);
    type AnyObj = Record<string, unknown>;
    const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://bcare-ten.vercel.app';
    async function fetchJson(path: string): Promise<AnyObj | null> {
      try {
        const r = await fetch(`${base}${path}`, { cache: 'no-store' });
        if (!r.ok) return null;
        return (await r.json()) as AnyObj;
      } catch {
        return null;
      }
    }
    const [healthBase, healthAuth, healthVoice] = await Promise.all([
      fetchJson('/api/health'),
      fetchJson('/api/health/auth'),
      fetchJson('/api/health/voice'),
    ]);

    // Supabase ping: count tables in public schema. Best-effort.
    let tableCount: number | null = null;
    try {
      const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
      const projectRef = sbUrl.replace(/^https?:\/\//, '').split('.')[0] ?? null;
      const res = (await (
        ctx.supabaseAdmin.from('symbols') as never as {
          select: (
            cols: string,
            opts?: { count?: 'exact'; head?: true },
          ) => Promise<{
            count: number | null;
          }>;
        }
      ).select('id', { count: 'exact', head: true })) as { count: number | null };
      tableCount = res.count;
      return {
        api: healthBase,
        auth: healthAuth,
        voice: healthVoice,
        database: {
          projectRef,
          symbolsCount: tableCount,
        },
      };
    } catch {
      return {
        api: healthBase,
        auth: healthAuth,
        voice: healthVoice,
        database: { projectRef: null, symbolsCount: null },
      };
    }
  }),
});
