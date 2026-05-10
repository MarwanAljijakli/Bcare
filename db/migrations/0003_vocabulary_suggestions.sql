-- =============================================================================
-- Module 4 — vocabulary_suggestions table + RLS.
--
-- Caregivers can read + update their own children's suggestions.
-- Therapists with an active grant can read but not approve/reject
-- (curation is a clinical decision the caregiver owns).
-- Service role bypasses (cron job writes here).
-- Append-only on insert; updates only stamp `status`/`reviewed_*`/
-- `rejection_reason`.
-- =============================================================================

-- Enums
do $$ begin
  if not exists (select 1 from pg_type where typname = 'suggestion_status') then
    create type suggestion_status as enum ('pending', 'approved', 'rejected', 'expired');
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_type where typname = 'suggestion_source') then
    create type suggestion_source as enum ('frequency', 'llm');
  end if;
end $$;

-- Table
create table if not exists public.vocabulary_suggestions (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children(id) on delete cascade,
  symbol_id uuid not null references public.symbols(id) on delete cascade,
  source suggestion_source not null,
  score numeric(4, 3) not null default 0,
  reason text,
  signals jsonb not null default '{}'::jsonb,
  status suggestion_status not null default 'pending',
  reviewed_at timestamptz,
  reviewed_by_id uuid references public.users(id) on delete set null,
  rejection_reason text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists vocab_suggestions_child_status_idx
  on public.vocabulary_suggestions(child_id, status);
create index if not exists vocab_suggestions_child_symbol_idx
  on public.vocabulary_suggestions(child_id, symbol_id);
create index if not exists vocab_suggestions_expires_idx
  on public.vocabulary_suggestions(expires_at);

-- RLS
alter table public.vocabulary_suggestions enable row level security;

drop policy if exists vocab_suggestions_caregiver_select on public.vocabulary_suggestions;
create policy vocab_suggestions_caregiver_select on public.vocabulary_suggestions
  for select using (public.is_caregiver_of(child_id));

drop policy if exists vocab_suggestions_caregiver_update on public.vocabulary_suggestions;
create policy vocab_suggestions_caregiver_update on public.vocabulary_suggestions
  for update using (public.is_caregiver_of(child_id));

-- Therapists with an active grant get read-only access (Module 6).
drop policy if exists vocab_suggestions_therapist_select on public.vocabulary_suggestions;
create policy vocab_suggestions_therapist_select on public.vocabulary_suggestions
  for select using (
    exists (
      select 1 from public.therapist_grants tg
      where tg.child_id = vocabulary_suggestions.child_id
        and tg.therapist_id = auth.uid()
        and tg.revoked_at is null
    )
  );

-- No INSERT policy — service role bypass + admin only. Caregivers don't
-- author suggestions; the personalization engine does.
drop policy if exists vocab_suggestions_admin_insert on public.vocabulary_suggestions;
create policy vocab_suggestions_admin_insert on public.vocabulary_suggestions
  for insert with check (public.is_admin());

drop policy if exists vocab_suggestions_admin_delete on public.vocabulary_suggestions;
create policy vocab_suggestions_admin_delete on public.vocabulary_suggestions
  for delete using (public.is_admin());
