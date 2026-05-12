# Runbook

> On-call procedures for production incidents. Filled out as Module 9 hardening
> ships; baseline procedures live here from Module 0.

## Severity levels

| Sev   | Definition                                         | Response | Comms                            |
| ----- | -------------------------------------------------- | -------- | -------------------------------- |
| **1** | Child board is fully unavailable; data loss        | < 15 min | Public status post within 30 min |
| **2** | Dashboard down, board limp-mode (offline cache OK) | < 60 min | Internal-only                    |
| **3** | Single feature degraded (e.g., TTS slow)           | < 24h    | Bug ticket                       |

## Common failures

### Supabase outage

- Verify on https://status.supabase.com.
- Child board enters offline-tolerant mode automatically (Module 3).
- Surface a calm in-app banner via `web/src/components/system-banner.tsx`.
- After recovery, verify event sync from local IndexedDB.

### AI cost spike

- `ai_usage_ledger` query: `select sum(cost_usd) from ai_usage_ledger where year_month = ...` per child.
- Investigate via PostHog dashboard surfaces (no child input data is in PostHog).
- Cap is enforced in code; spike means a single-call cost is too high — adjust
  `AI_MONTHLY_BUDGET_USD_PER_CHILD` or the per-call cost estimate in `aiGuard()`.

### Auth token leak

- Rotate Supabase keys immediately; force-logout all sessions in Supabase
  dashboard.
- Run audit query against `audit_log` for `sign_in` actions in the affected
  window.
- Document in `docs/security-incidents/{date}.md`.

## Verifying production signup works

**Required at every CHECKPOINT going forward.** Production is the
email + password + email-verification flow (Phase 10.C — bypass mode
is gone). A 200 from `/api/health` and a 400 from a malformed
`/api/auth/signup` body do NOT prove signup works.

### Step 1 — curl probe against the live deploy

```bash
PROBE_EMAIL="bcare-cli+verify-$(date +%s)@gmail.com"
PROBE_HASH="$(printf 'consent-text-2026-05-09.1' | sha256sum | awk '{print $1}')"
curl -sS -i -X POST "https://bcare-ten.vercel.app/api/auth/signup" \
  -H "Content-Type: application/json" \
  -d "{\"method\":\"password\",\"email\":\"$PROBE_EMAIL\",\"password\":\"StrongPassw0rd-2026!\",\"fullName\":\"Verify Probe\",\"role\":\"family\",\"consent\":{\"granted\":true,\"version\":\"2026-05-09.1\",\"textHash\":\"$PROBE_HASH\"},\"locale\":\"en\"}"
```

Expected: HTTP 201 + body `{"ok":true,"mode":"real","method":"password"}`.
Anything else — including `"detail":"Database error saving new user"` — is a
hard fail; do not declare the CHECKPOINT done.

### Step 2 — health-auth probe + project ref match

```bash
curl -sS https://bcare-ten.vercel.app/api/health/auth
```

Expected: `{"ok":true,"supabaseProject":"ikaaxfhenfbpfjqboixk", ...}`.
Wrong `supabaseProject` = project-ref drift; rotate Vercel env vars.

### Step 3 — automated regression spec

```bash
pnpm test:e2e:real
```

Two tests, both must pass:

- `POST /api/auth/signup with a throwaway email returns 201 + ok:true`
- `GET /api/health/auth returns ok:true with the expected supabaseProject
ref + magicLinkOk:true`

### Step 4 — magic-link URL probe (mandatory since Module 2.A.1.fix.2)

```bash
curl -sS https://bcare-ten.vercel.app/api/health/auth | python -m json.tool
```

Expected:

```json
{
  "ok": true,
  "supabaseProject": "ikaaxfhenfbpfjqboixk",
  "magicLinkOk": true,
  "timestamp": "..."
}
```

`magicLinkOk:false` means the next-intl middleware is rewriting
`/auth/callback` → `/<locale>/auth/callback` and magic-link emails will
404 in the user's browser. Check `web/middleware.ts` matcher.

### Step 5 — real-browser end-to-end (manual, CHECKPOINT-only)

Once per CHECKPOINT, open https://bcare-ten.vercel.app/en/signup in a fresh
incognito window, submit a real form **using an inbox you can actually
read**, click the magic-link email, confirm `/en/onboarding/welcome` loads
(not a 404, **not a "Something went wrong" error boundary**), complete the
8-step onboarding wizard, and confirm the post-finalize redirect lands on
`/en/dashboard` with a session.

The only acceptance test is **a real human clicking a real email link
from the real production signup flow**. Admin-generated links and curl
probes are necessary but not sufficient — they take a different code
path (`admin.generateLink` returns implicit-flow `#access_token` URLs,
not the PKCE `?code=...` URLs real users get) and demonstrably hide
real bugs (Module 2.A.1.fix.2 + 2.A.1.fix.3 are both proof).

To trigger a real email through the production code path:

```bash
pnpm exec tsx db/scripts/send-test-magic-link.ts <your-email>
```

The script POSTs against the LIVE `/api/auth/login` (or `/api/auth/signup`
if the user doesn't exist yet) — same path the form would hit.

## Standard production operations (Phase 10.C)

Auth bypass mode was removed at Phase 10.C. The live site at
<https://bcare-ten.vercel.app> requires real signup to access anything
beyond marketing/help. The dev caregiver account (formerly auto-signed-in
by `/api/auth/dev-login`) was demoted to `caregiver` role and can sign
in via the normal password flow if needed for support.

### Email confirmation template

Phase 10.C ships with the production "Confirm signup" email template
checked in at `db/supabase/email-templates/confirm-signup.{en,ar}.html`.
Paste it into the Supabase dashboard so users see the BlueCare
wordmark + bilingual copy:

1. Open <https://supabase.com/dashboard/project/_/auth/templates>.
2. Pick **Confirm signup**.
3. Paste the HTML body from `confirm-signup.en.html` (English is the
   primary locale; Supabase doesn't support per-recipient templating in
   the open-source tier yet — Arabic-speaking users get the EN
   confirmation but land on `/ar/...` after click).
4. Set the **Confirmation URL** field if your project still has the
   legacy placeholder — `{{ .ConfirmationURL }}` already routes through
   `/auth/callback` because the signup API sets `emailRedirectTo`.
5. Save and send yourself a test signup to verify rendering.

If you've already pasted it from a previous CHECKPOINT, you can
confirm it's still installed by sending a test signup and checking the
inbox — the BlueCare wordmark + "Confirm my email" CTA pill should
both appear.

### Password recovery operations

- Users hit `/<locale>/reset-password`, enter their email, and receive
  a recovery email (Supabase "Reset password" template — the default
  Supabase template is fine here; we don't customize it yet).
- The recovery link points at `/auth/callback?next=/<locale>/reset-password/confirm`
  which exchanges the recovery code for a session cookie, then renders
  the **Set new password** form.
- The form posts to `/api/auth/update-password`. Errors:
  - 401 — recovery link expired or already used; ask the user to
    request a new email.
  - 400 — password too weak; surface to the user.

### Health probes

```bash
# Phase 10.C — bypass must always be false in prod.
curl -sS https://bcare-ten.vercel.app/api/health/auth \
  | jq '{ok, bypassActive, supabaseProject, magicLinkOk}'
# Expected: { "ok": true, "bypassActive": false,
#             "supabaseProject": "ikaaxfhenfbpfjqboixk",
#             "magicLinkOk": true }
```

The personalization cron (`/api/cron/personalization`) probes
`/api/health/auth` on every run. If `bypassActive` is ever observed
`true` in production, it writes an `auth_bypass_unexpectedly_active`
entry to `audit_log` — page on-call.

### Magic-link admin path (support only)

The `/api/auth/signup` and `/api/auth/login` routes still accept
`method:'magic-link'` for the rare case where a support engineer needs
to mint a one-shot login link for a stuck user (their dashboard auth
config: <https://supabase.com/dashboard/project/_/auth/users>). The UI
never surfaces it, so no normal user can trigger it.

### Historical: auth-bypass removal (closed, kept for audit)

**Status (2026-05-09 → market launch):** auth bypass is INTENTIONALLY
ACTIVE in production so Modules 6–9 can be built and tested in-browser
without email-loop ceremony. Every visitor to <https://bcare-ten.vercel.app>
is auto-signed-in as `dev-caregiver@bluecare.test`. The yellow/black
sticky banner at the top of every page is the visual proof.

### What's enforced vs. what's skipped

- **Skipped:** the email handshake. No magic-link click, no SMTP roundtrip,
  no signup form. `/api/auth/dev-login` mints a real cookie-bound Supabase
  session via `admin.generateLink → cookieClient.verifyOtp`.
- **Enforced (unchanged from real auth):** RLS, consent records, audit
  log, profile + child rows, parental PIN, every server-side auth check.
  We are skipping the human step, NOT the database security model.

### Knobs

| Env var                           | Scope            | Purpose                                            |
| --------------------------------- | ---------------- | -------------------------------------------------- |
| `AUTH_BYPASS_USER_ID`             | server-only      | The dev caregiver UUID. NEVER expose.              |
| `NEXT_PUBLIC_AUTH_BYPASS`         | public (browser) | `1` to render DevModeBanner. Boolean only.         |
| `ALLOW_AUTH_BYPASS_IN_PRODUCTION` | build-time guard | `true` to allow bypass in `VERCEL_ENV=production`. |

`next.config.mjs` THROWS at build time if `VERCEL_ENV=production` AND
`AUTH_BYPASS_USER_ID` is set AND `ALLOW_AUTH_BYPASS_IN_PRODUCTION` is
not `true`. The third flag is an explicit, auditable opt-in — a future
"let me just remove the bypass env var" misstep cannot accidentally
leave bypass active in the launch build without ALSO setting the third
flag, which would be visible in any code review of the env config.

### Pre-launch auth re-enablement checklist

Run this checklist when Modules 6–9 are done and BlueCare is ready for
real users. Every step is mandatory; skipping any one of them is a
launch blocker.

0. **Demote the dev-caregiver from admin to caregiver** (Module 7
   bypass enablement promoted them so /admin would be reachable under
   bypass). MUST run BEFORE step 1 — if the env vars come out first,
   the dev caregiver row keeps `role=admin` and any future real user
   who somehow gets re-authed against that user_id would inherit
   admin rights.

   ```bash
   pnpm tsx db/scripts/revoke-dev-admin.ts
   # → ✓ Demoted to role=caregiver.
   ```

   Verify via Supabase: `select role from profiles where user_id = '<AUTH_BYPASS_USER_ID>'` → `'caregiver'`.

1. **Remove the env vars from every Vercel scope** (production, preview,
   development):

   ```bash
   vercel env rm AUTH_BYPASS_USER_ID production
   vercel env rm AUTH_BYPASS_USER_ID preview
   vercel env rm AUTH_BYPASS_USER_ID development
   vercel env rm NEXT_PUBLIC_AUTH_BYPASS production
   vercel env rm NEXT_PUBLIC_AUTH_BYPASS preview
   vercel env rm NEXT_PUBLIC_AUTH_BYPASS development
   vercel env rm ALLOW_AUTH_BYPASS_IN_PRODUCTION production
   vercel env rm ALLOW_AUTH_BYPASS_IN_PRODUCTION preview
   vercel env rm ALLOW_AUTH_BYPASS_IN_PRODUCTION development
   ```

2. **Force redeploy** so the new bundle is built without the bypass:

   ```bash
   vercel --prod --force
   ```

3. **Verify `/api/health/auth` reports `bypassActive:false`:**

   ```bash
   curl -sS https://bcare-ten.vercel.app/api/health/auth | jq .bypassActive
   # → false
   ```

4. **Visual sweep:** load <https://bcare-ten.vercel.app/en>. The
   yellow/black DevModeBanner MUST be gone. If it's still there, the
   redeploy didn't pick up the env-var removal — repeat step 2.

5. **Real signup works:** run the production signup probe (above § "Verifying
   production signup works"). Must return 200 with `mode:"real"`.

6. **Wipe the dev caregiver + all test data:**

   ```bash
   pnpm exec tsx db/scripts/delete-dev-caregiver.ts
   ```

   This removes the auth.users row, public.users mirror, profile,
   children (cascades through sessions / events / progress /
   gamification / voices / vocabulary), and consent_records.

7. **Final sweep:** load `/en/login` in an incognito window. You should
   see the real login form, NO banner, NO auto-signin. Sign up with a
   fresh email — the magic-link flow must complete end-to-end.

After step 7, the bypass is fully removed. The cron drift detector at
`/api/cron/personalization` will stop emitting `auth_bypass_active_in_production`
audit-log entries on its next run.

## Database migrations

**Canonical path** (since Module 3.1, 2026-05-10): every migration is a `.sql`
file under `db/migrations/` (or `db/rls/policies.sql`), applied via the
idempotent runner:

```bash
pnpm exec tsx db/scripts/apply-migrations.ts            # apply all migrations
pnpm exec tsx db/scripts/apply-migrations.ts --dry-run  # preview only
pnpm exec tsx db/scripts/verify-schema.ts               # post-apply sanity check
pnpm exec tsx db/scripts/verify-end-to-end.ts           # full data-path test
```

Requires `SUPABASE_ACCESS_TOKEN` in `web/.env.local` (a personal access
token from <https://supabase.com/dashboard/account/tokens>; never commit).

**Do not paste SQL into the Supabase SQL editor for migrations.** The
editor is fine for ad-hoc reads / one-off inspection, but every change
that needs to land in version control must be a file under
`db/migrations/` so the runner can replay it on every environment.

The earlier "operator-paste" workflow caused the Module 3.1 schema-drift
incident — it was abandoned at that module's CHECKPOINT.

## Backups

- Supabase nightly backups + PITR.
- Quarterly export drill: see Module 9 runbook procedure to verify restore.

## On-call hand-off

- Slack channel: `#bluecare-oncall` (created in Module 9).
- Pager: PagerDuty (created in Module 9).
- This file is the single source of truth — when adding a procedure, add it here.
