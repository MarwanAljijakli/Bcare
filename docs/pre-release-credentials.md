# Pre-release credentials & manual setup

This is the list of external services + env vars you need to provision
**before** flipping AUTH_BYPASS off and going public. Each item is
code-ready (the wiring is committed); only the credential is missing.

Estimated total provisioning time: **~30 minutes** if you have credit
cards / SSO ready for each vendor.

---

## 1. Sentry (error monitoring)

**Why**: catches runtime errors with stack traces, URL, and user role.
Strict event filter scrubs request bodies + child content already.

**Provision**:

1. Sign in at <https://sentry.io> (free Developer tier — 5K errors/mo,
   plenty for launch).
2. Create a new project → platform "Next.js" → name `bluecare-web`.
3. Copy the DSN from Project Settings → Client Keys.
4. On Vercel:
   ```bash
   vercel env add SENTRY_DSN production
   vercel env add SENTRY_DSN preview
   vercel env add NEXT_PUBLIC_SENTRY_DSN production
   vercel env add NEXT_PUBLIC_SENTRY_DSN preview
   ```
   (Use the same DSN for both keys.)
5. Force-redeploy. The SDK initializes only when the DSN is present —
   missing key = silent no-op (verified via env-gated guard in
   sentry.{client,server,edge}.config.ts).

**Verification**: trigger a test error via `throw new Error('test')`
in a dev route, see it appear in the Sentry dashboard within 60s.

---

## 2. PostHog (product analytics)

**Why**: page-view + caregiver-action analytics. Strict event allow-
list (page*view, dashboard*_, settings\__, admin*\*, voice_test*_,
help\__, therapist*\*, onboarding_step*\*). NEVER fires on /board.

**Provision**:

1. Sign in at <https://posthog.com> (free tier — 1M events/mo).
2. Create project `bluecare`.
3. Copy the Project API Key from Project Settings.
4. On Vercel:
   ```bash
   vercel env add NEXT_PUBLIC_POSTHOG_KEY production
   vercel env add NEXT_PUBLIC_POSTHOG_KEY preview
   vercel env add NEXT_PUBLIC_POSTHOG_HOST production
   vercel env add NEXT_PUBLIC_POSTHOG_HOST preview
   ```
   Set `NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com` (or `eu`
   if you chose the EU region).
5. Force-redeploy. The client only loads when the key is present.

**Verification**: open the dashboard, see `page_view` events flowing
within seconds.

---

## 3. Upstash Redis (rate limiter persistence)

**Why**: replaces the in-memory rate limiter (which resets on every
cold start) with a Redis-backed sliding window. The auth limiter
falls through to in-memory if Upstash hiccups, so this is purely an
upgrade — there is no downside to provisioning it.

**Provision**:

1. Sign in at <https://upstash.com> (free tier — 10K commands/day,
   way more than auth-route rate-limiting needs).
2. Create a Redis database → region "Frankfurt" or your nearest
   (Sydney is closest to your Supabase region).
3. From the database detail page copy:
   - `UPSTASH_REDIS_REST_URL` (looks like `https://xxxx.upstash.io`)
   - `UPSTASH_REDIS_REST_TOKEN` (the read+write token)
4. On Vercel:
   ```bash
   vercel env add UPSTASH_REDIS_REST_URL production
   vercel env add UPSTASH_REDIS_REST_URL preview
   vercel env add UPSTASH_REDIS_REST_TOKEN production
   vercel env add UPSTASH_REDIS_REST_TOKEN preview
   ```
5. Force-redeploy.

**Verification**: hit `/api/auth/login` 11 times in 10 minutes from
the same IP. The 11th attempt should 429. Then on a fresh Vercel
cold start (force a redeploy), the limit state should persist —
proves Redis is in use, not in-memory.

---

## 4. Supabase Auth Hooks — custom mailer (optional but recommended)

**Why**: the bilingual EN+AR email templates committed in
`db/supabase/email-templates/` only render if you wire the custom
mailer hook. Without this step, Supabase falls back to its default
English-only templates.

**Provision**:

1. Deploy the auth-hook function:
   ```bash
   cd db/supabase/auth-hooks
   supabase functions deploy custom-mailer --project-ref ikaaxfhenfbpfjqboixk
   ```
   (Requires Supabase CLI logged in as project owner.)
2. In the Supabase dashboard: Authentication → Hooks → Custom Mailer
   Hook → set URI to your deployed Edge Function URL.
3. Enable the hook.

**Verification**: trigger a signup with `preferred_locale: 'ar'` in
user_metadata. The recovery email should arrive in Arabic.

---

## 5. (Optional) Test Supabase project for RLS integration tests

**Why**: the RLS integration suite in `tests/rls/` runs against a
real Supabase project to verify cross-caregiver isolation. Don't
point it at production — create a throwaway project.

**Provision**:

1. <https://supabase.com> → New Project, name `bluecare-test`.
2. Apply the full migration stack against it:
   ```bash
   SUPABASE_PROJECT_REF=<new-ref> pnpm tsx db/scripts/apply-migrations.ts
   ```
3. Copy the URL + anon key + service-role key.
4. Add to your local `.env.test` (NOT committed):
   ```
   TEST_SUPABASE_URL=https://<ref>.supabase.co
   TEST_SUPABASE_ANON_KEY=...
   TEST_SUPABASE_SERVICE_ROLE_KEY=...
   ```
5. Run `pnpm test:rls`.

This step is **not blocking** for launch. Real RLS protection is
enforced by the production project's policies, which were validated
during the Module 2.B integration suite. The test-project suite is
an ongoing regression net, not a launch gate.

---

## 6. (Optional) VERCEL_TOKEN

**Why**: enables the /admin landing system-health card to surface
the latest Vercel deploy state (current SHA, build status, etc).
Without it, the deploy card falls back to env-var-derived info
(VERCEL_GIT_COMMIT_SHA + VERCEL_DEPLOYMENT_ID set at build time).

**Provision**:

1. <https://vercel.com/account/tokens> → Create Token, scope to the
   bluecare-ten project, expire in 90 days.
2. On Vercel itself:
   ```bash
   vercel env add VERCEL_TOKEN production
   vercel env add VERCEL_TOKEN preview
   ```

Not blocking — the admin health card works without it.

---

## Summary table

| Item                        | Required for launch?  | Env vars needed                                                                 |
| --------------------------- | --------------------- | ------------------------------------------------------------------------------- |
| Sentry                      | **Yes**               | `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`                                          |
| PostHog                     | **Yes** (for product) | `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`                           |
| Upstash Redis               | **Yes** (persistence) | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`                            |
| Supabase custom mailer hook | **Yes** (AR email)    | Hook deployment + dashboard wiring                                              |
| Test Supabase project       | Optional              | `TEST_SUPABASE_URL`, `TEST_SUPABASE_ANON_KEY`, `TEST_SUPABASE_SERVICE_ROLE_KEY` |
| Vercel token                | Optional              | `VERCEL_TOKEN`                                                                  |

After all "required" items are provisioned + verified, run the
pre-launch checklist in `docs/runbook.md` (step 0 demotes the dev
caregiver back to non-admin BEFORE the bypass env vars come out).
