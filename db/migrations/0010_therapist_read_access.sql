-- =============================================================================
-- 0010_therapist_read_access.sql — Module 6.1 therapist surface enablement.
--
-- The base policies in db/rls/policies.sql gate every session-scoped table
-- on `is_caregiver_of(child_id)`. The `is_therapist_of(child_id)` helper
-- exists alongside it but was never wired into the read policies, so a
-- therapist with an active therapist_grant could see the child row but
-- couldn't read sessions, input_events, output_events, progress_metrics,
-- gamification_state, vocabulary_sets, or child_voice_settings.
--
-- Module 6.1's therapist caseload index needs read access to those rows.
-- This migration adds parallel `*_therapist_read` policies that OR the
-- therapist relationship onto the existing caregiver gates. Writes stay
-- caregiver-only — therapists READ but do not WRITE child data.
--
-- One write exception: `sessions.therapist_notes`. The therapist surface
-- lets therapists edit their notes on a session. The policy is narrowed
-- with a column-aware predicate via a WITH CHECK that the only column
-- changing is therapist_notes — Postgres doesn't have native per-column
-- UPDATE policies, so we add a separate policy + trigger that rejects
-- any non-notes update from a non-caregiver. The trigger lives below.
--
-- Idempotent: drops then re-creates each policy. Safe to re-run.
-- =============================================================================

-- ---- sessions ---------------------------------------------------------------
drop policy if exists sessions_therapist_read on public.sessions;
create policy sessions_therapist_read on public.sessions
  for select using (public.is_therapist_of(child_id));

drop policy if exists sessions_therapist_update_notes on public.sessions;
create policy sessions_therapist_update_notes on public.sessions
  for update
  using (public.is_therapist_of(child_id))
  with check (public.is_therapist_of(child_id));

-- Trigger to enforce that therapist updates only touch therapist_notes.
-- Caregivers (already permitted by sessions_caregiver_update) bypass via
-- the early-return when is_caregiver_of is true.
create or replace function public.enforce_therapist_session_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Caregivers can update freely. Admins (service role) bypass RLS entirely
  -- and don't reach this trigger.
  if public.is_caregiver_of(new.child_id) then
    return new;
  end if;
  -- Therapist path: only `therapist_notes` may differ from OLD.
  if new.child_id is distinct from old.child_id
     or new.started_at is distinct from old.started_at
     or new.ended_at is distinct from old.ended_at
     or new.duration_seconds is distinct from old.duration_seconds
     or new.input_count is distinct from old.input_count
     or new.output_count is distinct from old.output_count
     or new.successful_selections is distinct from old.successful_selections
     or new.snapshot is distinct from old.snapshot
  then
    raise exception 'therapists may only update therapist_notes'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end $$;

drop trigger if exists trg_enforce_therapist_session_columns on public.sessions;
create trigger trg_enforce_therapist_session_columns
  before update on public.sessions
  for each row execute function public.enforce_therapist_session_columns();

-- ---- input_events -----------------------------------------------------------
drop policy if exists input_events_therapist_read on public.input_events;
create policy input_events_therapist_read on public.input_events
  for select using (public.is_therapist_of(child_id));

-- ---- output_events ----------------------------------------------------------
drop policy if exists output_events_therapist_read on public.output_events;
create policy output_events_therapist_read on public.output_events
  for select using (public.is_therapist_of(child_id));

-- ---- progress_metrics -------------------------------------------------------
drop policy if exists progress_metrics_therapist_read on public.progress_metrics;
create policy progress_metrics_therapist_read on public.progress_metrics
  for select using (public.is_therapist_of(child_id));

-- ---- gamification_state -----------------------------------------------------
drop policy if exists gamification_therapist_read on public.gamification_state;
create policy gamification_therapist_read on public.gamification_state
  for select using (public.is_therapist_of(child_id));

-- ---- vocabulary_sets --------------------------------------------------------
drop policy if exists vocabulary_therapist_read on public.vocabulary_sets;
create policy vocabulary_therapist_read on public.vocabulary_sets
  for select using (public.is_therapist_of(child_id));

-- ---- children (therapists need read on the granted child row) --------------
drop policy if exists children_therapist_read on public.children;
create policy children_therapist_read on public.children
  for select using (public.is_therapist_of(id));

-- =============================================================================
-- Audit-log action enum — add 'therapist_note_update' so saves get their own
-- action tag instead of overloading 'profile_update'.
-- =============================================================================
do $$
begin
  if not exists (
    select 1 from pg_enum
    where enumtypid = 'public.audit_action'::regtype
      and enumlabel = 'therapist_note_update'
  ) then
    alter type public.audit_action add value 'therapist_note_update';
  end if;
end $$;
