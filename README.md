# BlueCare

> Smart, Personalized Communication for Children with Autism

BlueCare is an AI-powered, bilingual (Arabic + English) Augmentative and Alternative
Communication (AAC) web platform purpose-built for children with Autism Spectrum Disorder.
It combines symbol-based communication, speech recognition, and webcam gesture input
into a single calm, predictable experience, while giving caregivers and therapists rich
progress analytics and personalization controls.

> Status: **early development**. See [`/docs`](./docs/) for architecture, data model,
> deploy, runbook, accessibility report, and the canonical critical-flows checklist.

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
