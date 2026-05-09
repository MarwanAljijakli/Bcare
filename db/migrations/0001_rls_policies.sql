-- =============================================================================
-- BlueCare RLS policies + auth/consent triggers — paste into Supabase SQL Editor
-- AFTER applying 0000_initial_schema.sql.
-- =============================================================================
-- This file is a thin pointer to db/rls/policies.sql which is the canonical
-- source. Open db/rls/policies.sql in your editor (or on GitHub), copy the
-- entire contents, and paste them into the Supabase SQL Editor as a single
-- statement, then click Run. The policies are idempotent (every CREATE POLICY
-- has a DROP IF EXISTS-equivalent baseline via Supabase's "create policy"
-- semantics — re-running drops + recreates).
--
-- We keep the file separate so a future migration can append-only without
-- needing to touch policies.sql.
-- =============================================================================

\echo 'Apply db/rls/policies.sql via Supabase SQL Editor — see comment above.'
