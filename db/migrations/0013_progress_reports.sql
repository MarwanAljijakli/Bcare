-- =============================================================================
-- Phase 10.E — Claude-generated progress reports.
--
-- A Claude Sonnet analysis of a child's AAC usage over a period
-- (weekly / monthly / quarterly). Produces structured strengths /
-- growth areas / parent suggestions / therapist observations / risk
-- notes / bilingual summaries. Stored as JSONB so we can evolve the
-- payload shape without churning columns.
--
-- Cost: ~$0.05–$0.10 per generation (3–5K input tokens of aggregated
-- metrics + ~1K output tokens of structured advice). Hard-capped at
-- $0.50/generation by the analyzer aborting when aiGuard would charge
-- more. Per-child monthly cap stays $20.
--
-- Idempotent — every CREATE uses IF NOT EXISTS.
-- =============================================================================

-- Extend the ai_service enum with the report category. ENUM ALTERs
-- must live in their own transaction with no other DDL that depends
-- on the new value, so we keep this minimal.
alter type public.ai_service add value if not exists 'claude_report';

-- Period type enum — discrete buckets so the dashboard can show
-- weekly/monthly tabs without parsing date ranges.
do $$ begin
  if not exists (select 1 from pg_type where typname = 'report_period_type') then
    create type public.report_period_type as enum ('weekly', 'monthly', 'quarterly');
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_type where typname = 'report_generated_by') then
    create type public.report_generated_by as enum ('cron', 'manual');
  end if;
end $$;

create table if not exists public.progress_reports (
  id              uuid primary key default gen_random_uuid(),
  child_id        uuid not null references public.children(id) on delete cascade,
  generated_at    timestamptz not null default now(),
  period_start    timestamptz not null,
  period_end      timestamptz not null,
  period_type     report_period_type not null default 'weekly',
  generated_by    report_generated_by not null default 'cron',
  payload_json    jsonb not null default '{}'::jsonb,
  pdf_url         text,
  cost_usd        numeric(10, 6) not null default 0,
  input_tokens    integer not null default 0,
  output_tokens   integer not null default 0,
  created_at      timestamptz not null default now()
);

create index if not exists progress_reports_child_idx
  on public.progress_reports (child_id);

create index if not exists progress_reports_child_generated_idx
  on public.progress_reports (child_id, generated_at desc);

create index if not exists progress_reports_period_idx
  on public.progress_reports (child_id, period_type, period_end desc);

-- =============================================================================
-- RLS: caregivers read their own children's reports. Therapists with an
-- active therapist_grants row for the child read too. Admins read all.
-- Inserts come from the service-role client (cron + manual trigger via
-- the trpc generate mutation), never from the end user.
-- =============================================================================
alter table public.progress_reports enable row level security;

drop policy if exists progress_reports_read_own on public.progress_reports;
create policy progress_reports_read_own
  on public.progress_reports
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.children c
      where c.id = progress_reports.child_id
        and c.caregiver_id = auth.uid()
    )
    or exists (
      select 1
      from public.therapist_grants g
      where g.child_id = progress_reports.child_id
        and g.therapist_id = auth.uid()
        and g.revoked_at is null
    )
    or exists (
      select 1
      from public.profiles p
      where p.user_id = auth.uid() and p.role = 'admin'
    )
  );

-- Service role bypasses RLS for inserts (cron + admin manual trigger).

comment on table public.progress_reports is
  'Phase 10.E — Claude Sonnet child progress analyses. payload_json shape: strengths[], areas_for_growth[], specific_suggestions_for_parents[], specific_suggestions_for_therapists[], risks_or_concerns[], summary_paragraph_english, summary_paragraph_arabic, metrics_snapshot{}.';
