-- =============================================================================
-- Quality Fix Phase 1 — symbol-image audit table.
--
-- Records every Claude vision audit pass against `public.symbols`. One
-- row per (audit_run_id, symbol_id). Used by:
--   • db/scripts/audit-symbols.ts — runs Claude vision against every
--     symbol and writes a row.
--   • /[locale]/admin/symbols-audit — operator UI showing the latest
--     run's mismatches with Approve / Replace controls.
--   • The custom-symbol upload pipeline — every caregiver upload runs
--     through the same audit on insert; if matches=false with
--     confidence > 0.7 the symbol enters status='pending_review'
--     instead of going live.
--
-- Schema rationale:
--   • audit_run_id groups every symbol audited in a single sweep.
--     Lets us compare today's run to yesterday's and detect new
--     regressions (e.g. someone re-uploaded a wrong image).
--   • recommended_label_{en,ar} stores Claude's repair suggestion. The
--     operator decides whether to accept (UPDATE symbols.label_*) or
--     re-fetch the correct ARASAAC pictogram.
--   • raw_response keeps the full Claude payload (text + token counts +
--     stop reason) for forensic re-runs without re-charging.
--
-- RLS: writes restricted to service-role (admin scripts + the upload
-- pipeline). Reads allowed for any authenticated admin user (admin
-- role check via profiles.role='admin'). Caregivers and therapists do
-- not need to see audit results.
--
-- Idempotent: every drop / index uses IF NOT EXISTS.
-- =============================================================================

create table if not exists public.symbol_audit (
  id uuid primary key default gen_random_uuid(),
  audit_run_id uuid not null,
  symbol_id uuid not null references public.symbols(id) on delete cascade,
  matches boolean not null,
  confidence numeric(4, 3) not null,
  claude_description text not null,
  recommended_label_en text,
  recommended_label_ar text,
  raw_response jsonb not null default '{}'::jsonb,
  model text not null default 'claude-sonnet-4-6',
  audited_at timestamptz not null default now()
);

create index if not exists symbol_audit_run_idx
  on public.symbol_audit (audit_run_id, audited_at desc);
create index if not exists symbol_audit_symbol_idx
  on public.symbol_audit (symbol_id, audited_at desc);
create index if not exists symbol_audit_mismatch_idx
  on public.symbol_audit (audit_run_id) where matches = false;

alter table public.symbol_audit enable row level security;

-- Read-only for admin role; service role bypasses RLS implicitly.
drop policy if exists symbol_audit_admin_read on public.symbol_audit;
create policy symbol_audit_admin_read on public.symbol_audit
  for select using (
    exists (
      select 1 from public.profiles p
       where p.user_id = auth.uid() and p.role = 'admin'
    )
  );
