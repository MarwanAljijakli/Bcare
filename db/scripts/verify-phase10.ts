/**
 * Quick verification probe for Phase 10 migrations:
 *  - SELECT count(*) FROM public.progress_reports
 *  - SELECT EXISTS (... pg_matviews WHERE matviewname = 'mastery_per_child_symbol')
 *  - SELECT count(*) FROM pg_views WHERE viewname = 'child_level_progress'
 */
import './lib/env';
import { sql } from './lib/sql';

interface Row {
  [k: string]: unknown;
}

async function main(): Promise<void> {
  const probes: { label: string; query: string }[] = [
    {
      label: 'progress_reports row count',
      query: 'select count(*)::int as n from public.progress_reports',
    },
    {
      label: 'mastery_per_child_symbol matview exists',
      query:
        "select exists(select 1 from pg_matviews where matviewname = 'mastery_per_child_symbol') as ok",
    },
    {
      label: 'child_level_progress view exists',
      query: "select exists(select 1 from pg_views where viewname = 'child_level_progress') as ok",
    },
    {
      label: 'refresh_mastery_view function exists',
      query: "select exists(select 1 from pg_proc where proname = 'refresh_mastery_view') as ok",
    },
    {
      label: 'claude_report ai_service enum value present',
      query:
        "select exists(select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid where t.typname = 'ai_service' and e.enumlabel = 'claude_report') as ok",
    },
  ];
  for (const p of probes) {
    const rows = (await sql(p.query)) as Row[];
    const first = rows?.[0];
    console.info(`  ${p.label}:`, first ?? rows);
  }
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.stack : String(e));
  process.exit(1);
});
