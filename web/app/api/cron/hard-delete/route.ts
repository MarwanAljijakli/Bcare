/**
 * Vercel Cron — daily hard-delete of tombstoned users.
 *
 * Schedule: daily at 04:00 UTC (configured in vercel.json `crons`).
 *
 * What it does:
 *   1. Selects every public.users row where deleted_at < NOW() - INTERVAL '30 days'.
 *   2. For each: hard-deletes the auth.users row via supabase.auth.admin
 *      .deleteUser() — this cascade-removes the mirror in public.users
 *      and every child/session/event/consent row hanging off it.
 *   3. Audit-logs each deletion as `data_delete` with
 *      metadata={kind:'hard_delete_cron', user_id, tombstoned_at, deleted_at_iso}.
 *
 * Auth: same Bearer-CRON_SECRET pattern as the other cron handlers.
 *
 * Safety: refuses to run when more than 100 deletes are due in a
 * single batch — that scenario implies either a backlog from a
 * disabled cron or a misconfigured retention window, and a human
 * should look at it before proceeding.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const RETENTION_DAYS = 30;
const SAFETY_BATCH_CAP = 100;

interface UserRow {
  id: string;
  email: string;
  deleted_at: string;
}

export async function GET(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (expected) {
    const provided = req.headers.get('authorization');
    if (provided !== `Bearer ${expected}`) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
  }

  const supabase = createSupabaseAdminClient();
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - RETENTION_DAYS);
  const cutoffIso = cutoff.toISOString();

  const due = (await (
    supabase.from('users') as never as {
      select: (cols: string) => {
        not: (
          col: string,
          op: string,
          v: null,
        ) => {
          lt: (
            col: string,
            v: string,
          ) => Promise<{ data: UserRow[] | null; error: { message: string } | null }>;
        };
      };
    }
  )
    .select('id, email, deleted_at')
    .not('deleted_at', 'is', null)
    .lt('deleted_at', cutoffIso)) as { data: UserRow[] | null; error: { message: string } | null };
  if (due.error) {
    return NextResponse.json({ error: due.error.message }, { status: 500 });
  }
  const rows = due.data ?? [];
  if (rows.length === 0) {
    return NextResponse.json({ ok: true, processed: 0 });
  }
  if (rows.length > SAFETY_BATCH_CAP) {
    return NextResponse.json(
      {
        error: 'safety_cap',
        detail: `${rows.length} hard-deletes due in a single batch > ${SAFETY_BATCH_CAP}. Pause + review.`,
      },
      { status: 412 },
    );
  }

  let deleted = 0;
  const failures: { userId: string; reason: string }[] = [];
  for (const row of rows) {
    try {
      const { error: delErr } = await supabase.auth.admin.deleteUser(row.id);
      if (delErr) {
        failures.push({ userId: row.id, reason: delErr.message });
        continue;
      }
      await (
        supabase.from('audit_log') as never as {
          insert: (r: Record<string, unknown>) => Promise<unknown>;
        }
      ).insert({
        actor_id: null,
        action: 'data_delete',
        target_type: 'users',
        target_id: row.id,
        metadata: {
          kind: 'hard_delete_cron',
          tombstoned_at: row.deleted_at,
          deleted_at_iso: new Date().toISOString(),
        },
      });
      deleted += 1;
    } catch (e) {
      failures.push({ userId: row.id, reason: e instanceof Error ? e.message : 'unknown' });
    }
  }
  return NextResponse.json({ ok: true, processed: rows.length, deleted, failures });
}
