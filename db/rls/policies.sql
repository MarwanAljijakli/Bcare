-- =============================================================================
-- BlueCare — Row-Level Security policies
-- Applied via supabase/migrations/0001_rls.sql.
-- Tested by web/e2e/rls.spec.ts (Module 2) — every table in this file has at
-- least one allowed-and-denied integration test before the module ships.
-- =============================================================================

-- Helper: returns the role of the calling user (or null if unauthenticated).
create or replace function public.app_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role::text from public.profiles where user_id = auth.uid();
$$;

-- Helper: returns true if the calling user is the caregiver of the given child.
create or replace function public.is_caregiver_of(child uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.children
    where id = child and caregiver_id = auth.uid() and deleted_at is null
  );
$$;

-- Helper: returns true if the caller is admin.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.app_role() = 'admin';
$$;

-- =============================================================================
-- users  — minimal mirror of auth.users
-- =============================================================================
alter table public.users enable row level security;

create policy users_self_select on public.users
  for select using (id = auth.uid());

create policy users_admin_select on public.users
  for select using (public.is_admin());

-- Inserts come from a SECURITY DEFINER trigger on auth.users; no direct insert
-- policy is granted to authenticated users.

-- =============================================================================
-- profiles
-- =============================================================================
alter table public.profiles enable row level security;

create policy profiles_self_select on public.profiles
  for select using (user_id = auth.uid());

create policy profiles_self_update on public.profiles
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy profiles_self_insert on public.profiles
  for insert with check (user_id = auth.uid());

create policy profiles_admin_select on public.profiles
  for select using (public.is_admin());

-- =============================================================================
-- children  — owned by caregiver, read by therapist with explicit grant (grant
-- table is added in the therapist-sharing migration in Module 6).
-- =============================================================================
alter table public.children enable row level security;

create policy children_caregiver_select on public.children
  for select using (caregiver_id = auth.uid() and deleted_at is null);

create policy children_caregiver_insert on public.children
  for insert with check (caregiver_id = auth.uid());

create policy children_caregiver_update on public.children
  for update using (caregiver_id = auth.uid()) with check (caregiver_id = auth.uid());

create policy children_caregiver_delete on public.children
  for update using (caregiver_id = auth.uid()) with check (caregiver_id = auth.uid());

create policy children_admin_select on public.children
  for select using (public.is_admin());

-- =============================================================================
-- symbol_libraries
-- =============================================================================
alter table public.symbol_libraries enable row level security;

create policy symbol_libraries_public_read on public.symbol_libraries
  for select using (is_public = true);

create policy symbol_libraries_owner_read on public.symbol_libraries
  for select using (owner_id = auth.uid());

create policy symbol_libraries_owner_write on public.symbol_libraries
  for insert with check (owner_id = auth.uid());

create policy symbol_libraries_admin_all on public.symbol_libraries
  for all using (public.is_admin()) with check (public.is_admin());

-- =============================================================================
-- symbols
-- =============================================================================
alter table public.symbols enable row level security;

-- Anyone authenticated can read active symbols (the global pictogram catalog).
create policy symbols_active_read on public.symbols
  for select using (status = 'active');

-- Submitters can read their pending submissions to track moderation.
create policy symbols_self_pending_read on public.symbols
  for select using (submitted_by = auth.uid());

create policy symbols_caregiver_submit on public.symbols
  for insert with check (
    submitted_by = auth.uid()
    and public.app_role() in ('caregiver', 'therapist')
  );

create policy symbols_admin_moderate on public.symbols
  for update using (public.is_admin()) with check (public.is_admin());

-- =============================================================================
-- vocabulary_sets
-- =============================================================================
alter table public.vocabulary_sets enable row level security;

create policy vocabulary_caregiver_all on public.vocabulary_sets
  for all using (public.is_caregiver_of(child_id))
  with check (public.is_caregiver_of(child_id));

-- =============================================================================
-- sessions
-- =============================================================================
alter table public.sessions enable row level security;

create policy sessions_caregiver_read on public.sessions
  for select using (public.is_caregiver_of(child_id));

create policy sessions_caregiver_insert on public.sessions
  for insert with check (public.is_caregiver_of(child_id));

create policy sessions_caregiver_update on public.sessions
  for update using (public.is_caregiver_of(child_id))
  with check (public.is_caregiver_of(child_id));

create policy sessions_admin_read on public.sessions
  for select using (public.is_admin());

-- =============================================================================
-- input_events / output_events  — server-only writes (no anon access).
-- Reads gated by caregiver-of-child for the dashboard "session replay".
-- =============================================================================
alter table public.input_events enable row level security;

create policy input_events_caregiver_read on public.input_events
  for select using (public.is_caregiver_of(child_id));

create policy input_events_caregiver_insert on public.input_events
  for insert with check (public.is_caregiver_of(child_id));

alter table public.output_events enable row level security;

create policy output_events_caregiver_read on public.output_events
  for select using (public.is_caregiver_of(child_id));

create policy output_events_caregiver_insert on public.output_events
  for insert with check (public.is_caregiver_of(child_id));

-- =============================================================================
-- progress_metrics  — read by caregiver/therapist; written by server only
-- =============================================================================
alter table public.progress_metrics enable row level security;

create policy progress_metrics_caregiver_read on public.progress_metrics
  for select using (public.is_caregiver_of(child_id));

create policy progress_metrics_admin_read on public.progress_metrics
  for select using (public.is_admin());

-- Inserts/updates: service role bypasses RLS, so no policy here for them.

-- =============================================================================
-- gamification_state  — read by caregiver, server-side updated
-- =============================================================================
alter table public.gamification_state enable row level security;

create policy gamification_caregiver_read on public.gamification_state
  for select using (public.is_caregiver_of(child_id));

create policy gamification_caregiver_update on public.gamification_state
  for update using (public.is_caregiver_of(child_id))
  with check (public.is_caregiver_of(child_id));

-- =============================================================================
-- audit_log  — admin read only; inserts via server (service role)
-- =============================================================================
alter table public.audit_log enable row level security;

create policy audit_log_admin_read on public.audit_log
  for select using (public.is_admin());

-- =============================================================================
-- consent_records  — caregiver inserts for self / their child; admin reads all
-- =============================================================================
alter table public.consent_records enable row level security;

create policy consent_self_read on public.consent_records
  for select using (granted_by_id = auth.uid());

create policy consent_self_insert on public.consent_records
  for insert with check (
    granted_by_id = auth.uid()
    and (subject_child_id is null or public.is_caregiver_of(subject_child_id))
  );

create policy consent_admin_read on public.consent_records
  for select using (public.is_admin());

-- =============================================================================
-- custom_voices  — caregiver of the child only
-- =============================================================================
alter table public.custom_voices enable row level security;

create policy custom_voices_caregiver_all on public.custom_voices
  for all using (public.is_caregiver_of(child_id))
  with check (public.is_caregiver_of(child_id));

-- =============================================================================
-- ai_usage_ledger  — caregiver reads aggregate; writes via service role only
-- =============================================================================
alter table public.ai_usage_ledger enable row level security;

create policy ai_usage_caregiver_read on public.ai_usage_ledger
  for select using (public.is_caregiver_of(child_id));

create policy ai_usage_admin_read on public.ai_usage_ledger
  for select using (public.is_admin());

-- =============================================================================
-- Triggers
-- =============================================================================

-- Mirror auth.users → public.users on signup.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, email_confirmed)
  values (new.id, new.email, new.email_confirmed_at is not null)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Bump updated_at on row update for the tables that have it.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger users_set_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger children_set_updated_at
  before update on public.children
  for each row execute function public.set_updated_at();

create trigger symbols_set_updated_at
  before update on public.symbols
  for each row execute function public.set_updated_at();

create trigger vocabulary_sets_set_updated_at
  before update on public.vocabulary_sets
  for each row execute function public.set_updated_at();

create trigger gamification_state_set_updated_at
  before update on public.gamification_state
  for each row execute function public.set_updated_at();
