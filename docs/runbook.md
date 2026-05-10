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

**Required at every CHECKPOINT going forward.** A 200 from `/api/health` and a
400 from a malformed `/api/auth/signup` body do NOT prove signup works — both
were green during the Module 2.A.1.fix incident while real users got 500s.

### Step 1 — curl probe against the live deploy

```bash
PROBE_EMAIL="bcare-cli+verify-$(date +%s)@gmail.com"
PROBE_HASH="$(printf 'consent-text-2026-05-09.1' | sha256sum | awk '{print $1}')"
curl -sS -i -X POST "https://bcare-ten.vercel.app/api/auth/signup" \
  -H "Content-Type: application/json" \
  -d "{\"method\":\"magic-link\",\"email\":\"$PROBE_EMAIL\",\"fullName\":\"Verify Probe\",\"role\":\"family\",\"consent\":{\"granted\":true,\"version\":\"2026-05-09.1\",\"textHash\":\"$PROBE_HASH\"},\"locale\":\"en\"}"
```

Expected: HTTP 200 (or 201) + body `{"ok":true,"mode":"real","method":"magic-link"}`.
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
read**, click the magic-link email, confirm `/en/onboarding` loads (not a
404), complete the 8-step onboarding wizard, and confirm the post-finalize
redirect lands on `/en/dashboard` with a session.

This is the ONLY check that catches the entire signup → email → click →
onboard chain. Curl probes alone are insufficient — the Module 2.A.1.fix.2
incident is the proof. Required at every module CHECKPOINT.

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
