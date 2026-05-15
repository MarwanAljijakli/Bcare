# BlueCare

> A free, bilingual AAC platform for children with autism — in English and Arabic.

## What is BlueCare today

BlueCare is a free, bilingual (English + Arabic, with full right-to-left
Arabic support) Augmentative and Alternative Communication (AAC) web
app for non-verbal and minimally verbal children with autism. A child
taps picture tiles on a board, presses Speak, and hears a natural-
sounding voice say the assembled phrase. Caregivers and therapists get
a separate dashboard showing vocabulary growth, session replay with
notes, weekly Claude-generated progress insights, and AI-suggested
next words. Voice in English routes through OpenAI's Nova voice; voice
in Arabic routes through ElevenLabs' Charlotte voice (a Saudi-dialect-
aware choice after native-speaker acceptance testing). Speech-to-text
runs on OpenAI's gpt-4o-mini-transcribe with Whisper-style biasing
prompts and hallucination filtering. Personalization and progress
reports are powered by Anthropic Claude. The cost per child is capped
at $20/month and the system gracefully degrades when the cap is
reached — never paywalled.

**Free for every family.** No subscriptions, no tiers, no waitlist,
no paywalls — for families, therapists, and educators alike. The
mission is reach and impact, not revenue.

As of 2026-05-12 BlueCare is **live in production** at
[bcare-ten.vercel.app](https://bcare-ten.vercel.app). Sign-up uses
real email-and-password authentication with email verification (no
dev shortcuts remain in production). 159 starter symbols are seeded
across both locales, the dashboard / admin / therapist / help-center
surfaces are wired, 12 bilingual help articles ship, PDF progress
reports export client-side, weekly Claude-driven insights generate on
a cron, and per-child vocabulary levels auto-promote at 80% mastery.

### Try it

| Audience             | Link                                     |
| -------------------- | ---------------------------------------- |
| English landing      | <https://bcare-ten.vercel.app/en>        |
| Arabic landing (RTL) | <https://bcare-ten.vercel.app/ar>        |
| Sign up              | <https://bcare-ten.vercel.app/en/signup> |
| Help center          | <https://bcare-ten.vercel.app/en/help>   |

A 10-step click-path walkthrough is in
[`docs/demo-walkthrough.md`](docs/demo-walkthrough.md). Operator
verification + cron-trigger curls live in
[`docs/runbook.md`](docs/runbook.md).

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

