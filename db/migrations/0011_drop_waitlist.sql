-- =============================================================================
-- 0011_drop_waitlist.sql — Module 9 deprecation removal.
--
-- The `waitlist_signups` table was introduced in Module 1 as a pre-launch
-- email-capture path. BlueCare graduated past the waitlist model — every
-- user now signs up directly via /signup with consent and onboarding. The
-- table has been empty for the entire Module 2-7 build window (verified
-- pre-drop: SELECT count(*) FROM waitlist_signups → 0 on 2026-05-12).
--
-- This migration drops the table, the policy, and the /api/waitlist
-- handler is removed in a paired commit. shared/schemas/waitlist.ts is
-- removed in the same commit.
--
-- Reversible: re-running 0000_initial_schema.sql restores the table
-- definition (but not any pre-drop rows; there were none).
-- =============================================================================

drop policy if exists waitlist_anon_insert on public.waitlist_signups;
drop policy if exists waitlist_admin_select on public.waitlist_signups;
drop table if exists public.waitlist_signups;
