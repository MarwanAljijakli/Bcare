import { protectedProcedure, router } from '../trpc';

/**
 * Therapists router — Module 6.1.
 *
 * Specifically the THERAPIST-FACING surface (caseload). The CAREGIVER-
 * facing flows (issuing + revoking invites) live in `invites.ts`. Two
 * separate routers because the surfaces and authorization shapes are
 * different — the caseload doesn't take a caregiver perspective at all.
 *
 * `caseload` reads the therapist_grants rows the caller owns as the
 * THERAPIST_ID side and resolves the child name + caregiver email for
 * each. RLS scopes both reads:
 *   • therapist_grants_therapist_select gates the grants list to
 *     `therapist_id = auth.uid() AND revoked_at is null`.
 *   • children_therapist_read (added in migration 0010) lets the
 *     therapist read the child row for any grant they own.
 *
 * The caregiver email is best-effort. RLS on `users` is
 * `users_self_select` only (plus admin), so a cookie-bound read for a
 * caregiver row the therapist doesn't own returns nothing. We fall
 * through to the admin client for that one field; nothing else.
 */

interface GrantRow {
  id: string;
  caregiver_id: string;
  child_id: string;
  granted_at: string;
}

interface ChildRow {
  id: string;
  full_name: string;
  preferred_name: string | null;
}

interface UserRow {
  id: string;
  email: string;
}

export interface CaseloadItem {
  grantId: string;
  childId: string;
  childName: string;
  caregiverEmail: string | null;
  grantedAt: string;
  /** Most-recent session for the child (date only). null when no
   *  sessions exist. */
  lastSessionAt: string | null;
  /** Last 30 days' input count from progress_metrics — gives the
   *  caseload index a quick "active this month?" signal. */
  inputsLast30d: number;
}

export const therapistsRouter = router({
  caseload: protectedProcedure.query(async ({ ctx }): Promise<CaseloadItem[]> => {
    const grantsRes = await (
      ctx.supabase.from('therapist_grants') as never as {
        select: (cols: string) => {
          eq: (
            col: string,
            v: string,
          ) => {
            is: (
              col: string,
              v: null,
            ) => {
              order: (
                col: string,
                opts: { ascending: boolean },
              ) => Promise<{ data: GrantRow[] | null }>;
            };
          };
        };
      }
    )
      .select('id, caregiver_id, child_id, granted_at')
      .eq('therapist_id', ctx.session.userId)
      .is('revoked_at', null)
      .order('granted_at', { ascending: false });
    const grants = grantsRes.data ?? [];
    if (grants.length === 0) return [];

    const childIds = grants.map((g) => g.child_id);
    const caregiverIds = Array.from(new Set(grants.map((g) => g.caregiver_id)));

    // Children — RLS-scoped via the therapist read policy.
    const childrenRes = await (
      ctx.supabase.from('children') as never as {
        select: (cols: string) => {
          in: (col: string, vs: string[]) => Promise<{ data: ChildRow[] | null }>;
        };
      }
    )
      .select('id, full_name, preferred_name')
      .in('id', childIds);
    const childMap = new Map<string, ChildRow>((childrenRes.data ?? []).map((c) => [c.id, c]));

    // Caregiver emails — best-effort via admin client. If the admin
    // client is unconfigured for any reason, we surface null and the UI
    // shows "—" instead of the email.
    let caregiverMap = new Map<string, string>();
    try {
      const usersRes = await (
        ctx.supabaseAdmin.from('users') as never as {
          select: (cols: string) => {
            in: (col: string, vs: string[]) => Promise<{ data: UserRow[] | null }>;
          };
        }
      )
        .select('id, email')
        .in('id', caregiverIds);
      caregiverMap = new Map((usersRes.data ?? []).map((u) => [u.id, u.email]));
    } catch {
      /* admin client unavailable — fall through */
    }

    // Per-child recency + activity. One sessions + one progress_metrics
    // read keyed by child_id, RLS-scoped via the new therapist policies.
    const sessionsRes = await (
      ctx.supabase.from('sessions') as never as {
        select: (cols: string) => {
          in: (
            col: string,
            vs: string[],
          ) => {
            order: (
              col: string,
              opts: { ascending: boolean },
            ) => Promise<{ data: { child_id: string; started_at: string }[] | null }>;
          };
        };
      }
    )
      .select('child_id, started_at')
      .in('child_id', childIds)
      .order('started_at', { ascending: false });
    const latestSession = new Map<string, string>();
    for (const row of sessionsRes.data ?? []) {
      if (!latestSession.has(row.child_id)) latestSession.set(row.child_id, row.started_at);
    }

    const since = new Date();
    since.setUTCDate(since.getUTCDate() - 30);
    const sinceKey = `${since.getUTCFullYear()}-${String(since.getUTCMonth() + 1).padStart(2, '0')}-${String(since.getUTCDate()).padStart(2, '0')}`;
    const metricsRes = await (
      ctx.supabase.from('progress_metrics') as never as {
        select: (cols: string) => {
          in: (
            col: string,
            vs: string[],
          ) => {
            gte: (
              col: string,
              v: string,
            ) => Promise<{ data: { child_id: string; input_count: number }[] | null }>;
          };
        };
      }
    )
      .select('child_id, input_count')
      .in('child_id', childIds)
      .gte('day', sinceKey);
    const inputsByChild = new Map<string, number>();
    for (const row of metricsRes.data ?? []) {
      inputsByChild.set(row.child_id, (inputsByChild.get(row.child_id) ?? 0) + row.input_count);
    }

    return grants.map<CaseloadItem>((g) => {
      const child = childMap.get(g.child_id);
      const name = child?.preferred_name?.trim() || child?.full_name?.trim() || 'Child';
      return {
        grantId: g.id,
        childId: g.child_id,
        childName: name,
        caregiverEmail: caregiverMap.get(g.caregiver_id) ?? null,
        grantedAt: g.granted_at,
        lastSessionAt: latestSession.get(g.child_id) ?? null,
        inputsLast30d: inputsByChild.get(g.child_id) ?? 0,
      };
    });
  }),
});
