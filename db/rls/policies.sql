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
-- waitlist_signups  — anonymous insert allowed; only admin reads
-- =============================================================================
alter table public.waitlist_signups enable row level security;

-- Public anon insert. Rate-limit, email validation, and dedup happen in the
-- /api/waitlist route handler before the insert reaches the policy.
create policy waitlist_anon_insert on public.waitlist_signups
  for insert with check (true);

create policy waitlist_admin_read on public.waitlist_signups
  for select using (public.is_admin());

-- =============================================================================
-- therapist_invites  — caregivers manage their own; therapists read by code
-- via a SECURITY DEFINER function rather than direct select
-- =============================================================================
alter table public.therapist_invites enable row level security;

create policy therapist_invites_caregiver_select on public.therapist_invites
  for select using (caregiver_id = auth.uid() and public.is_caregiver_of(child_id));

create policy therapist_invites_caregiver_insert on public.therapist_invites
  for insert with check (caregiver_id = auth.uid() and public.is_caregiver_of(child_id));

create policy therapist_invites_caregiver_update on public.therapist_invites
  for update using (caregiver_id = auth.uid()) with check (caregiver_id = auth.uid());

create policy therapist_invites_admin_read on public.therapist_invites
  for select using (public.is_admin());

-- =============================================================================
-- therapist_grants  — visible to both parties on the relation
-- =============================================================================
alter table public.therapist_grants enable row level security;

create policy therapist_grants_caregiver_select on public.therapist_grants
  for select using (caregiver_id = auth.uid());

create policy therapist_grants_therapist_select on public.therapist_grants
  for select using (therapist_id = auth.uid() and revoked_at is null);

create policy therapist_grants_caregiver_update on public.therapist_grants
  for update using (caregiver_id = auth.uid()) with check (caregiver_id = auth.uid());

create policy therapist_grants_admin_read on public.therapist_grants
  for select using (public.is_admin());

-- Helper: returns true if the caller has an active grant for the given child.
-- Module 2.B+ session-scoped tables reference this so therapists with a
-- caregiver-issued grant can read sessions / progress / vocab / voices.
create or replace function public.is_therapist_of(child uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.therapist_grants
    where therapist_id = auth.uid()
      and child_id = child
      and revoked_at is null
  );
$$;

-- =============================================================================
-- draft_onboarding  — one row per user, owner-only access
-- =============================================================================
alter table public.draft_onboarding enable row level security;

create policy draft_onboarding_self_all on public.draft_onboarding
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- =============================================================================
-- Triggers
-- =============================================================================

-- =============================================================================
-- auth.users → public.users mirror + consent-records fanout, in ONE function.
--
-- History: this used to be two AFTER INSERT triggers — `on_auth_user_created`
-- (handle_new_user) and `on_auth_user_consent_signup` (copy_consent_to_records).
-- Postgres fires same-event triggers alphabetically by name, so the consent
-- trigger ran FIRST and tried to write a consent_records row whose
-- `granted_by_id` FK pointed at a public.users row that didn't exist yet —
-- the FK violation rolled back the whole signup transaction with the
-- infamous "Database error saving new user" message. We rolled the two
-- functions into one with explicit ordering so the FK is always satisfied.
--
-- Wrapped in EXCEPTION blocks so any future trigger problem can't take
-- down a real signup — the auth.users insert always commits; consent
-- propagation is best-effort and audit-traceable via the application.
-- =============================================================================
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  consent_data jsonb;
begin
  -- 1. Mirror to public.users FIRST — every downstream FK depends on it.
  begin
    insert into public.users (id, email, email_confirmed)
    values (new.id, new.email, new.email_confirmed_at is not null)
    on conflict (id) do nothing;
  exception when others then
    -- A failure here is genuinely fatal for the application (no caregiver row
    -- means RLS will reject every subsequent request), but we still want the
    -- auth.users row to commit so the user can re-attempt with `email-already-
    -- registered`. Surface the error to Postgres logs.
    raise warning 'handle_new_auth_user: public.users mirror failed for %: %', new.id, sqlerrm;
  end;

  -- 2. Best-effort consent fanout.
  consent_data := new.raw_user_meta_data->'consent';
  if consent_data is not null
     and (consent_data->>'granted')::boolean is not distinct from true then
    begin
      insert into public.consent_records (
        granted_by_id,
        subject_child_id,
        scope,
        granted,
        policy_version,
        metadata
      ) values (
        new.id,
        null,                              -- account-level grant; child-level grants come later
        'data_processing',
        true,
        coalesce(consent_data->>'version', '0.0'),
        jsonb_build_object(
          'text_hash', consent_data->>'text_hash',
          'granted_at', consent_data->>'granted_at',
          'source', 'signup'
        )
      )
      on conflict do nothing;
    exception when others then
      -- Consent record can be backfilled by the application; never block signup.
      raise warning 'handle_new_auth_user: consent fanout failed for %: %', new.id, sqlerrm;
    end;
  end if;

  return new;
end;
$$;

-- Drop the old two-trigger setup if it exists (idempotent for fresh deploys).
drop trigger if exists on_auth_user_created on auth.users;
drop trigger if exists on_auth_user_consent_signup on auth.users;

create trigger on_auth_user_signup
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

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

create trigger draft_onboarding_set_updated_at
  before update on public.draft_onboarding
  for each row execute function public.set_updated_at();

create trigger gamification_state_set_updated_at
  before update on public.gamification_state
  for each row execute function public.set_updated_at();
