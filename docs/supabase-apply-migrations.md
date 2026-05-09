# Apply BlueCare migrations to Supabase

> Click-by-click guide. Apply in order: schema → policies. Both are
> idempotent (safe to re-run if anything goes sideways).

You'll do this once today, then again whenever a new migration file is
added under `db/migrations/`. Total time: ~5 minutes.

---

## Step 1 — Open the Supabase SQL Editor

1. Go to <https://supabase.com/dashboard/project/ikaaxfhenfbpfjqboixk>.
2. In the left sidebar, click **SQL Editor** (the database icon with `>_` on it).
3. Click **+ New query** at the top right.

## Step 2 — Apply the schema

1. Open `db/migrations/0000_initial_schema.sql` in your editor (VS Code, GitHub web, whatever).
2. Select all (Ctrl+A), copy.
3. Paste into the Supabase SQL Editor query box.
4. Click **Run** (bottom right, or Ctrl+Enter).
5. Wait for "Success. No rows returned." Should take 1–2 seconds.

If you get an error, take a screenshot and tell me — most errors mean an
older partial run left the database in a half-state. The script is
idempotent so re-running usually fixes it; truly stuck states may need a
targeted `DROP TYPE IF EXISTS` for the affected enum.

## Step 3 — Apply RLS policies + triggers

1. Click **+ New query** again to start a fresh tab.
2. Open `db/rls/policies.sql` in your editor.
3. Select all (Ctrl+A), copy.
4. Paste into the new SQL Editor tab.
5. Click **Run**.

The script enables RLS on every public table, creates the helper functions
(`app_role()`, `is_caregiver_of(child)`, `is_therapist_of(child)`,
`is_admin()`), creates per-table policies, and installs three triggers on
`auth.users`:

- `on_auth_user_created` mirrors `auth.users` → `public.users`.
- `on_auth_user_consent_signup` writes the signup consent attestation into
  `public.consent_records`.
- `..._set_updated_at` triggers bump `updated_at` on row update.

## Step 4 — Verify

1. In the SQL Editor, paste:
   ```sql
   select tablename from pg_tables where schemaname = 'public' order by tablename;
   ```
2. Click **Run**. You should see 18 rows: `ai_usage_ledger`, `audit_log`,
   `children`, `consent_records`, `custom_voices`, `draft_onboarding`,
   `gamification_state`, `input_events`, `output_events`, `profiles`,
   `progress_metrics`, `sessions`, `symbol_libraries`, `symbols`,
   `therapist_grants`, `therapist_invites`, `users`, `vocabulary_sets`,
   `waitlist_signups`. (That's 19 because `users` is the mirror — you'll
   see all 18 product tables plus our `users` mirror.)

3. Verify RLS is on:

   ```sql
   select tablename, rowsecurity from pg_tables where schemaname = 'public' order by tablename;
   ```

   Every row should show `rowsecurity = true`.

4. Verify the consent trigger:
   ```sql
   select tgname, tgrelid::regclass from pg_trigger where tgname like 'on_auth_user_%';
   ```
   You should see `on_auth_user_created` and `on_auth_user_consent_signup`,
   both targeting `auth.users`.

If all three checks pass, the database is ready. The next end-to-end test
is to sign up via <https://bcare-ten.vercel.app/en/signup> with a real
email — you should receive a magic link, and after clicking it your row
should appear in `public.users` with a corresponding row in
`public.consent_records`.

## Future migrations

When a new migration file is added (say `0002_module-3-board.sql`), repeat
Steps 2–4 with that file. The migration files are designed to be
applied in numerical order; each one is idempotent on its own.

Module 9 hardening replaces this manual paste flow with `drizzle-kit migrate`
running in CI against the `DATABASE_URL` connection string.
