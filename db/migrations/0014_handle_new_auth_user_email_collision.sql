-- Phase 11.D — handle_new_auth_user trigger: clear email-collision orphans
--
-- Before this migration, when a caregiver signed up with an email whose
-- auth.users row had previously been deleted (test cycles, account
-- delete + resignup, etc.) the public.users mirror INSERT failed with a
-- unique-violation on `email`. The original EXCEPTION block caught it
-- but did nothing to repair the state, leaving the new auth.users.id
-- without a matching public.users row. Every downstream FK write
-- (draft_onboarding, profiles, children, etc.) then failed and the
-- onboarding wizard surfaced a generic error banner on step 2.
--
-- Forensic evidence (2026-05-13 production):
--   • One real caregiver with auth.users.id=e4ee3a46-…, email
--     marwan2004000@gmail.com had NO public.users row because a
--     3-day-old orphan with the same email blocked the trigger insert.
--   • Production query `select au.id from auth.users au left join
--     public.users u on u.id = au.id where u.id is null` returned 1 row.
--
-- Repair strategy: before inserting the new public.users row, drop any
-- stale row that holds the same email under a different id. The stale
-- row is inaccessible (its auth.users row is gone) so deleting it is
-- safe. consent_records that point at the stale id are dropped first
-- to satisfy the FK; they were tied to the dead auth.users anyway.
--
-- Idempotent: `create or replace function` swaps the body in place; the
-- DELETE statements are no-ops when no collision exists.

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
  --
  -- Phase 11.D Bug 4 fix: when a user signs up with the same email as
  -- a stale orphan (auth.users was deleted but public.users mirror
  -- remained), the unique constraint on email used to silently abort
  -- the mirror INSERT inside the EXCEPTION block, leaving the new
  -- auth.users.id without a matching public.users row and breaking
  -- every downstream FK write. The orphan row is inaccessible (its
  -- auth.users is gone), so reclaim the email slot before inserting.
  begin
    -- Drop consent_records tied to the orphan first (FK requirement).
    delete from public.consent_records
    where granted_by_id in (
      select id from public.users where email = new.email and id != new.id
    );

    delete from public.users
    where email = new.email and id != new.id;

    insert into public.users (id, email, email_confirmed)
    values (new.id, new.email, new.email_confirmed_at is not null)
    on conflict (id) do nothing;
  exception when others then
    -- A failure here is genuinely fatal for the application (no
    -- public.users row means RLS will reject every subsequent request),
    -- but we still want the auth.users insert to commit so the user can
    -- re-attempt. Surface the error to Postgres logs.
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
        null,
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
      raise warning 'handle_new_auth_user: consent fanout failed for %: %', new.id, sqlerrm;
    end;
  end if;

  return new;
end;
$$;
