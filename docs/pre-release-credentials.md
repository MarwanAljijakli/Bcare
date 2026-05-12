# Pre-release credentials & manual setup

This is the operator handoff for the 5 services + 1 manual step that
need to land before flipping AUTH_BYPASS off and going public. Each
section is a numbered click-by-click walkthrough. Total time if you
have credit cards / SSO ready: ~30 minutes.

The code for every integration is already in tree — none of these
need any new pull request. Each integration runs as a silent no-op
when its credential is missing, so you can land them one at a time
without breaking anything.

---

## 1. Sentry (error monitoring) — 5 minutes

**Why**: catches runtime errors with full stack traces. Scrubs request
bodies + URL query strings before they leave the browser, so child
content never reaches Sentry's servers.

**Provision**:

1. Go to <https://sentry.io/signup/> and sign up (use Google SSO or
   email/password — both work).
2. After confirming your email, you land on a "Set up your first
   project" screen. Pick:
   - **Platform**: Next.js
   - **Project name**: `bluecare-web`
   - **Team**: Default (don't worry about creating one)
   - Click **"Create Project"**.
3. The next screen shows a setup wizard with code snippets. Scroll
   past the code (we already wrote it) and look for the **DSN**.
   It looks like `https://abc123def456@o1234567.ingest.sentry.io/7654321`.
   Copy the entire URL.
4. Open a terminal in this repo and run:
   ```bash
   vercel env add SENTRY_DSN
   ```
   Paste your DSN when prompted. Select **Production** and **Preview**
   (use spacebar to select, Enter to confirm).
5. Run again with the public twin:
   ```bash
   vercel env add NEXT_PUBLIC_SENTRY_DSN
   ```
   Same DSN, same scopes.
6. Force a redeploy:
   ```bash
   vercel --prod --force
   ```

**What you'll see when it works**:

- After the redeploy completes (~2 minutes), trigger a test error by
  visiting any 404 path like
  <https://bcare-ten.vercel.app/this-does-not-exist>.
- In Sentry's web UI, click **Issues** in the left sidebar. Within
  60 seconds, you should see at least one row.
- The row will say "404 / NotFoundError" with the URL + your user-
  agent + your role (if any). It will NOT contain any child content
  or request body — the `beforeSend` filter scrubs those.

**Free tier limits**: 5,000 errors/month. Way more than you'll need.

---

## 2. PostHog (product analytics) — 5 minutes

**Why**: page-view + caregiver-action analytics so you can see which
features get used. Strict allow-list — only events starting with
`page_view`, `dashboard_*`, `settings_*`, `admin_*`, `voice_test_*`,
`help_*`, `therapist_*`, `onboarding_step_*` fire. NEVER fires on the
child's communication board (`/board`).

**Provision**:

1. Go to <https://posthog.com/signup>.
2. Sign up with Google or email. After verifying, you'll be asked to
   choose a region: pick **US** unless you have a specific reason to
   pick EU.
3. The first screen asks for your **organization name** — type
   `BlueCare` and click **Create**.
4. Inside the organization, click **"+ New project"** in the
   left sidebar. Project name: `bluecare-production`. Click
   **Create**.
5. The next screen shows your **Project API Key**. It looks like
   `phc_aBcDeFgH1234567890XyZ`. Copy it.
6. In a terminal:
   ```bash
   vercel env add NEXT_PUBLIC_POSTHOG_KEY
   ```
   Paste the key. Select Production + Preview.
7. Add the host (it's the same for everyone in US region):
   ```bash
   vercel env add NEXT_PUBLIC_POSTHOG_HOST
   ```
   Value: `https://us.i.posthog.com`. Production + Preview.
8. Force redeploy:
   ```bash
   vercel --prod --force
   ```

**What you'll see when it works**:

- After redeploy, open <https://bcare-ten.vercel.app/en/dashboard> in
  a browser.
- Switch back to the PostHog tab. Click **"Activity"** in the left
  sidebar.
- Within 30 seconds, a `page_view` event should appear with your
  URL.
- Navigate around the dashboard for 10 seconds — each page nav
  generates one event. The Activity feed should fill up.

**Free tier limits**: 1M events/month. Plenty.

---

## 3. Upstash Redis (rate-limit persistence) — 5 minutes

**Why**: the auth rate limiter currently falls back to in-memory,
which resets on every Vercel cold start. Upstash Redis gives the
limiter a persistent sliding window across all Vercel instances.

**Provision**:

1. Go to <https://upstash.com/sign-up> and sign in with GitHub (other
   methods work but GitHub is fastest).
2. After landing in the console, click **"+ Create database"** in the
   top right.
3. Fill in:
   - **Name**: `bluecare-rate-limit`
   - **Type**: Regional (don't pick Global — costs more)
   - **Primary region**: pick the closest to your Supabase region.
     Supabase is in Sydney for this project; pick **Tokyo** (or
     Singapore) — they're the nearest Upstash regions.
   - **Eviction**: leave default
   - **TLS**: leave on
4. Click **Create**.
5. On the database detail page, scroll to the **REST API** section.
   You'll see two values:
   - `UPSTASH_REDIS_REST_URL` — looks like `https://xxxxx-12345.upstash.io`
   - `UPSTASH_REDIS_REST_TOKEN` — looks like a long random string
6. Copy each one into Vercel:
   ```bash
   vercel env add UPSTASH_REDIS_REST_URL
   # paste URL, pick Production + Preview
   vercel env add UPSTASH_REDIS_REST_TOKEN
   # paste token, pick Production + Preview
   ```
7. Force redeploy.

**What you'll see when it works**:

- In the Upstash console, your database detail page has a **Metrics**
  tab. After a few minutes of any traffic, you should start seeing
  commands per second in the chart.
- Test the limit by hitting `/api/auth/login` 11 times in 10 minutes
  from the same browser. The 11th attempt should return 429 with
  "Too many login attempts."
- Force a Vercel redeploy (cold start). The limit state should
  persist — try login again, you should still be rate-limited until
  the 10-minute window expires.

**Free tier limits**: 10,000 commands/day. Auth rate-limiting uses
maybe 50/day at our scale.

---

## 4. Supabase custom mailer hook (bilingual email) — 10 minutes

**Why**: the bilingual EN+AR email templates we committed in
`db/supabase/email-templates/*.html` only render when you wire the
custom mailer hook. Without this step, Supabase falls back to its
default English-only templates.

**Provision**:

1. Make sure you have the Supabase CLI installed:
   ```bash
   pnpm dlx supabase --version
   # should print v1.x or v2.x
   ```
2. Authenticate (only needs to run once):
   ```bash
   pnpm dlx supabase login
   ```
   This opens your browser. Sign in with the account that owns the
   `ikaaxfhenfbpfjqboixk` Supabase project.
3. Deploy the custom-mailer function:
   ```bash
   pnpm dlx supabase functions deploy custom-mailer \
     --project-ref ikaaxfhenfbpfjqboixk \
     --file db/supabase/auth-hooks/custom-mailer.ts
   ```
   You should see "✓ Deployed Function custom-mailer" in the output.
4. Open the Supabase dashboard:
   <https://supabase.com/dashboard/project/ikaaxfhenfbpfjqboixk/auth/hooks>
5. Find the **Custom Email Provider** section. Click **Enable**.
6. The URL field shows your function URL — it should look like
   `https://ikaaxfhenfbpfjqboixk.supabase.co/functions/v1/custom-mailer`.
   This auto-populates from step 3.
7. Click **Save**.

**What you'll see when it works**:

- Trigger a signup with Arabic locale by visiting
  <https://bcare-ten.vercel.app/ar/signup> in a fresh browser and
  filling out the form.
- The magic-link email that arrives should be in Arabic, using the
  template from `db/supabase/email-templates/magic-link.ar.html`.
- If you signed up with `/en/signup`, the email arrives in English
  using `magic-link.en.html`.

**Free tier limits**: 500K Edge Function invocations/month. Auth
emails are nowhere near that.

---

## 5. Manual screen-reader pass (VoiceOver + NVDA) — 60-90 minutes

**Why**: WCAG 2.2 requires that every interactive element announces
correctly to a screen reader. axe-core catches structural issues, but
only a human listening can confirm the actual announcement makes
sense in context.

This step requires:

- A **macOS** machine for VoiceOver (built into the OS).
- A **Windows** machine for NVDA (free at
  <https://www.nvaccess.org/download/>).

### macOS / VoiceOver — how to drive it

1. Press **Cmd-F5** to enable VoiceOver. The "Welcome to VoiceOver"
   overlay appears the first time; press Escape to dismiss after
   reading.
2. Open Safari (Chrome and Firefox also work, but Safari has the best
   VoiceOver integration).
3. Navigate to the URL you want to test.
4. Press **Control + Option + A** to start "Read All" from the top
   of the page. Listen straight through.
5. Press **Tab** to advance through each focusable element. Each
   announcement should make sense — element name, role, and state.
6. Note anything that announces incorrectly. Common issues:
   - Announces "button" without a name (missing `aria-label`)
   - Announces visual decoration as if it were content
   - Skips a heading level (jumps H1 → H3)
   - Tabs into a disabled element
7. Press Cmd-F5 again to disable VoiceOver when done.

### Windows / NVDA — how to drive it

1. Launch NVDA. The yellow "NVDA" splash appears.
2. Open Chrome and navigate to the URL.
3. Press **NVDA + Down Arrow** (default: Insert + Down, or Caps-Lock
   - Down) to start "Read All from cursor." Listen.
4. Press **Tab** to advance through focusable elements.
5. Same checklist as VoiceOver above.
6. Press **NVDA + Q** to exit when done.

### Surfaces to test (in order)

For each, walk Tab-by-Tab + Read-All. Record findings in
`docs/a11y-test-report.md` under the matching section's "Manual SR
pass" checkbox.

| #   | URL                           | What to listen for                                                                                                                                                |
| --- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `/en` marketing               | Brand mark announces with "BlueCare logo." Headings flow H1 → H2 → H3 in order. CTA reads "Get started, link."                                                    |
| 2   | `/ar` marketing               | Same as above but in Arabic. NVDA announces "right-to-left" direction.                                                                                            |
| 3   | `/en/signup`                  | Every form field has a label that's read with the input ("Email, edit"). Required fields say "required."                                                          |
| 4   | `/en/board`                   | Each tile reads with both EN + AR labels + category. Sentence-strip updates announce via aria-live. Speak button reads "Speak assembled phrase, button."          |
| 5   | `/en/dashboard`               | Hero stats read as a group ("Today's stars, 0; Streak, 3 days; …"). Recent sessions table announces as a table with column headers.                               |
| 6   | `/en/dashboard/sessions/<id>` | Each event in the timeline reads with its modality icon + label + timestamp. Notes textarea has a label + character count.                                        |
| 7   | `/en/dashboard/reports`       | Window picker buttons announce state ("Last 30 days, selected"). Download button announces with type ("PDF, link").                                               |
| 8   | `/en/settings/privacy`        | Toggles announce state ("Data-processing consent, switch, on").                                                                                                   |
| 9   | `/en/admin`                   | 4 cards each read as a region with a name. Auto-refresh doesn't fire during navigation (aria-live=polite respects pauses).                                        |
| 10  | `/en/admin/users`             | Table reads correctly. `j`/`k` navigation announces row + selection state.                                                                                        |
| 11  | `/en/admin/audit`             | Each row reads with action, actor, time. Expand button announces state ("expanded, button").                                                                      |
| 12  | `/en/help`                    | Search input has a label. Card grid is a list with each card as a list item.                                                                                      |
| 13  | `/en/help/<slug>`             | TOC sidebar is a navigation landmark. Each heading copy-link announces ("Copy link to section, button"). 👍/👎 buttons read with intent ("Yes, helpful, button"). |
| 14  | `/en/therapist`               | Caseload grid reads as a list. Each tile announces with child name + caregiver email + recency.                                                                   |

### Recording findings

After every surface, update `docs/a11y-test-report.md`:

- Check the `[ ] Manual VoiceOver pass` box (and the NVDA pass) if
  everything announces correctly.
- For each issue: add a numbered "Known issues" entry with the
  surface, the element, what it announced, what it should have
  announced, and the suspected fix (usually a missing `aria-label`
  or `aria-describedby`).

Once all checkboxes are checked, sign the file at the bottom with
your name + date.

---

## 6. (Optional) Test Supabase project — RLS integration tests

Not a launch blocker. The production project's RLS was validated
during Module 2.B with an integration suite. The test-project suite
is an ongoing regression net.

If you want to wire it:

1. <https://supabase.com/dashboard> → New Project, name `bluecare-test`.
2. Apply the full migration stack:
   ```bash
   SUPABASE_PROJECT_REF=<new-ref> \
   SUPABASE_ACCESS_TOKEN=<your-pat> \
     pnpm tsx db/scripts/apply-migrations.ts
   ```
3. Copy the URL + anon key + service-role key from the project's API
   settings page.
4. Add to your local `.env.test` (gitignored):
   ```
   TEST_SUPABASE_URL=https://<ref>.supabase.co
   TEST_SUPABASE_ANON_KEY=...
   TEST_SUPABASE_SERVICE_ROLE_KEY=...
   ```
5. Remove the `describe.skip` from `db/tests/rls.spec.ts` and run
   `pnpm test`.

---

## 7. (Optional) VERCEL_TOKEN

Used only by the admin landing's Deploy card to surface the most
recent deploy state via the Vercel REST API. Without it, the card
falls back to the build-time env vars (which is already pretty good).

To wire:

1. <https://vercel.com/account/tokens> → **Create Token**. Scope to
   the `bluecare-ten` project. Expire in 90 days.
2. ```bash
   vercel env add VERCEL_TOKEN
   ```

Not blocking.

---

## Summary table

| Service               |     Required?      |      Time | Env vars / action                                     |
| --------------------- | :----------------: | --------: | ----------------------------------------------------- |
| Sentry                |      **Yes**       |     5 min | `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`                |
| PostHog               |      **Yes**       |     5 min | `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST` |
| Upstash Redis         |      **Yes**       |     5 min | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`  |
| Supabase mailer hook  | **Yes** (AR email) |    10 min | Function deploy + dashboard wiring                    |
| Manual SR pass        |      **Yes**       | 60-90 min | Human work, no env var                                |
| Test Supabase project |      Optional      |    15 min | `TEST_SUPABASE_*`                                     |
| Vercel token          |      Optional      |     2 min | `VERCEL_TOKEN`                                        |

After all "Required" items are done + verified, run the pre-launch
checklist in `docs/runbook.md`. Step 0 demotes the dev caregiver back
to non-admin BEFORE the bypass env vars come out — don't skip it.
