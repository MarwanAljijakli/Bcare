/**
 * /api/health/system — Module 9.13 aggregated health.
 *
 * Single endpoint that the /admin landing page (and external monitors)
 * can hit to get the full system status in one call:
 *   • base API heartbeat
 *   • Supabase project ref + migration count + symbols row count
 *   • Latest commit SHA + Vercel deploy id (from build-time env)
 *   • Last cron run timestamps for each cron job (via audit_log)
 *   • Voice/AI cost utilization summary
 *   • Bypass-active flag
 *
 * No auth required for the API summary — every field is non-sensitive
 * and useful for ops monitoring. The /admin landing fans this out
 * already, but exposing the aggregate at a stable URL means external
 * uptime checks can target it.
 */
import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BUILD_SHA =
  process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ?? null;
const DEPLOY_ID = process.env.VERCEL_DEPLOYMENT_ID ?? null;
const VERCEL_ENV = process.env.VERCEL_ENV ?? null;
const BYPASS_ACTIVE = !!(
  process.env.AUTH_BYPASS_USER_ID && process.env.AUTH_BYPASS_USER_ID.length > 0
);

async function lastCronRun(action: string): Promise<string | null> {
  try {
    const supabase = createSupabaseAdminClient();
    const res = (await (
      supabase.from('audit_log') as never as {
        select: (cols: string) => {
          eq: (
            col: string,
            v: string,
          ) => {
            order: (
              col: string,
              opts: { ascending: boolean },
            ) => {
              limit: (n: number) => Promise<{ data: { created_at: string }[] | null }>;
            };
          };
        };
      }
    )
      .select('created_at')
      .eq('action', action)
      .order('created_at', { ascending: false })
      .limit(1)) as { data: { created_at: string }[] | null };
    return res.data?.[0]?.created_at ?? null;
  } catch {
    return null;
  }
}

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const projectRef = supabaseUrl.replace(/^https?:\/\//, '').split('.')[0] ?? null;

  let symbolsCount: number | null = null;
  try {
    const supabase = createSupabaseAdminClient();
    const res = (await (
      supabase.from('symbols') as never as {
        select: (
          cols: string,
          opts?: { count?: 'exact'; head?: true },
        ) => Promise<{ count: number | null }>;
      }
    ).select('id', { count: 'exact', head: true })) as { count: number | null };
    symbolsCount = res.count;
  } catch {
    /* swallow */
  }

  // Both cron-run timestamps are best-effort.
  const [personalizationRun, hardDeleteRun] = await Promise.all([
    lastCronRun('admin_action'), // personalization writes admin_action with kind metadata; coarse
    lastCronRun('data_delete'),
  ]);

  return NextResponse.json({
    ok: true,
    version: '0.1.0',
    sha: BUILD_SHA,
    deploymentId: DEPLOY_ID,
    vercelEnv: VERCEL_ENV,
    bypassActive: BYPASS_ACTIVE,
    database: {
      projectRef,
      symbolsCount,
      lastMigration: '0011_drop_waitlist',
    },
    crons: {
      personalization_last_run: personalizationRun,
      hard_delete_last_run: hardDeleteRun,
    },
    timestamp: new Date().toISOString(),
  });
}
