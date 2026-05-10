-- =============================================================================
-- Module 2.A.1.fix — drop the old two-trigger auth.users setup.
--
-- Live signup was returning "Database error saving new user" because Postgres
-- fired `on_auth_user_consent_signup` BEFORE `on_auth_user_created` (alphabetical
-- order on a shared event), and the consent trigger tried to INSERT into
-- public.consent_records with a granted_by_id FK pointing at a public.users
-- row that didn't exist yet. The FK violation rolled back the whole signup
-- transaction.
--
-- Fix: db/rls/policies.sql now defines a single combined function
-- `handle_new_auth_user()` that mirrors public.users first, then handles consent
-- fanout, with EXCEPTION blocks around each side so a future trigger problem
-- can't block a real signup. This migration just drops the old artifacts on
-- already-live projects so they don't co-exist with the new trigger.
--
-- Idempotent: every drop is `if exists`.
-- =============================================================================

-- Drop the old triggers + functions on the live project. The new function +
-- trigger are created by `db/rls/policies.sql` which apply-migrations.ts runs
-- before this file.
drop trigger if exists on_auth_user_created on auth.users;
drop trigger if exists on_auth_user_consent_signup on auth.users;

drop function if exists public.handle_new_user();
drop function if exists public.copy_consent_to_records();
