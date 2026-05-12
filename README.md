# BlueCare

> Smart, Personalized Communication for Children with Autism — **free for everyone.**

## What is BlueCare today

BlueCare is a free, bilingual (English + Arabic, with full right-to-left
Arabic support) Augmentative and Alternative Communication (AAC) web
app for non-verbal and minimally verbal children with autism. A child
taps picture tiles on a board, presses Speak, and hears a natural-
sounding voice say the assembled phrase. Caregivers and therapists get
a separate dashboard showing vocabulary growth, session replay with
notes, and AI-suggested next words. Voice in English routes through
OpenAI's Nova voice; voice in Arabic routes through ElevenLabs'
Charlotte voice (a Saudi-dialect-aware choice after native-speaker
acceptance testing). Speech-to-text is OpenAI Whisper. Personalization
suggestions are powered by Anthropic Claude. The cost per child is
capped at $20/month and the system gracefully degrades when the cap
is reached — never paywalled.

As of 2026-05-12 the entire product is **code-complete and live on
Vercel** in development bypass mode. You can click around every shipped
surface without filling in a signup form (one click takes you in as
"Test Caregiver"). 159 starter symbols are seeded, the dashboard +
admin + therapist + help center are all wired, 12 bilingual help
articles ship, PDF progress reports export client-side, and the
symbol-image audit run found only 2 mismatches out of 159 (down from
33 after prompt refinement). Four operator-gated items remain before
flipping auth on for public users — see "Before public launch" below.

### Try it now (live demo)

| Audience          | Link                                         |
| ----------------- | -------------------------------------------- |
| English demo      | <https://bcare-ten.vercel.app/en>            |
| Arabic demo (RTL) | <https://bcare-ten.vercel.app/ar>            |
| Admin surface     | <https://bcare-ten.vercel.app/en/admin>      |
| Voice A/B test    | <https://bcare-ten.vercel.app/en/voice-test> |
| Help center       | <https://bcare-ten.vercel.app/en/help>       |

A 10-step click-path walkthrough designed for first-time visitors
is in [`docs/demo-walkthrough.md`](docs/demo-walkthrough.md).

### Before public launch

Four operator-gated items in [`docs/release-scorecard.md`](docs/release-scorecard.md):

1. **Manual VoiceOver + NVDA screen-reader pass** on every shipped
   surface ([`docs/a11y-test-report.md`](docs/a11y-test-report.md)).
2. **Sentry + PostHog + Upstash Redis** credentials provisioned
   (code is wired; ~15 min of setup —
   [`docs/pre-release-credentials.md`](docs/pre-release-credentials.md)).
3. **Supabase Auth Hooks custom-mailer** deployed for the bilingual
   email templates (same doc, section 4).
4. **Playwright critical-flow E2E** suite wired against a
   throwaway test-Supabase project (optional, but pre-launch
   regression net).

Once those land, run the pre-launch flip-back checklist in
[`docs/runbook.md`](docs/runbook.md) — step 0 demotes the dev
caregiver from admin **before** the bypass env vars come out.

> Status: **open beta — free for everyone**, building in public. See [`/docs`](./docs/)
> for architecture, data model, deploy, runbook, accessibility report, and the
> canonical critical-flows checklist.

---

## Architecture at a glance

```
bluecare/
├── web/        Next.js 14 App Router + React 18 + TypeScript (strict)
├── db/         Drizzle ORM schema + Supabase migrations + RLS policies
├── shared/     Brand tokens, zod schemas, shared types
├── docs/       Architecture, data model, runbook, a11y report, deploy
└── scripts/    Repo-wide scripts (i18n direction lint, etc.)
```

See [`docs/architecture.md`](./docs/architecture.md) for the deeper view.

## Getting started

```bash
# Prereqs: Node 22, pnpm 10
pnpm install
cp web/.env.example web/.env.local   # fill in values per docs/deploy.md
pnpm dev
```

Then open http://localhost:3000 (English) or http://localhost:3000/ar (Arabic, RTL).

## Quality gates

| Gate          | Command           | Bar                                     |
| ------------- | ----------------- | --------------------------------------- |
| Typecheck     | `pnpm typecheck`  | zero errors, strict on                  |
| Lint          | `pnpm lint`       | zero warnings                           |
| Unit tests    | `pnpm test`       | ≥ 80% coverage on `shared`, `web/lib`   |
| E2E           | `pnpm test:e2e`   | 12 critical flows on Chromium/FF/WebKit |
| Accessibility | `pnpm test:a11y`  | zero serious/critical axe violations    |
| Lighthouse    | `pnpm lighthouse` | ≥ 95 on Perf / A11y / BP / SEO          |

The `/board` route ships ≤ 180 KB gzipped initial JS.

## Branding

Brand tokens live in [`shared/tokens.ts`](./shared/tokens.ts) and are exposed as CSS
variables and a Tailwind theme. Do not introduce raw color values in components — always
reference tokens.

## License

Source code: UNLICENSED — copyright Jeddah International College / BlueCare team.
Pictograms: ARASAAC, CC BY-NC-SA, attributed in `docs/attributions.md`.

## Authors

Senior Project — Jeddah International College, Computer Science Department.

- Somaya Nather Dayan
- Masa Malik Alalawi
- Alaa Khalid Al-Ghamdi
- Fadwa Ibrahim Abushanab

Supervisor: Dr. Hasanin Barhamtoshy.
