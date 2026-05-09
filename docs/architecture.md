# Architecture

> Module 0 baseline. Diagrams and per-module deep-dives are added as features land.

## Top-down view

```
                ┌────────────────────────────────────────────────┐
                │                  Browser / PWA                 │
                │   • Child board (offline-tolerant, ≤180KB JS)  │
                │   • Caregiver / therapist dashboard            │
                │   • Marketing site (statically rendered)       │
                └─────────────────┬──────────────────────────────┘
                                  │  HTTPS + JWT cookies
                                  ▼
                ┌────────────────────────────────────────────────┐
                │            Next.js 14 App Router               │
                │  ┌──────────────┐ ┌──────────────────────────┐ │
                │  │ Route        │ │ Server Components +      │ │
                │  │ Handlers     │ │ Server Actions           │ │
                │  └──────┬───────┘ └────────────┬─────────────┘ │
                │         │  service-role / RLS  │               │
                └─────────┼──────────────────────┼───────────────┘
                          │                      │
            ┌─────────────▼────────┐   ┌─────────▼──────────────┐
            │   Supabase           │   │  AI services (paid)    │
            │   • Postgres + RLS   │   │  • OpenAI Whisper STT  │
            │   • Auth             │   │  • OpenAI GPT-4o-mini  │
            │   • Storage          │   │  • ElevenLabs TTS (en) │
            │   • Realtime         │   │  • Azure Neural TTS    │
            └──────────────────────┘   └────────────────────────┘
                                                 ▲
                                  Cost-guard ────┘
                                  (ai_usage_ledger atomic insert)
```

## Process / data flow

1. **Child input** lands on the device (tap, mic, webcam). Speech and video
   are processed in the browser (Web Speech API offline fallback,
   MediaPipe Hands client-side) for the path that doesn't need cloud STT.
2. **Sentence-strip events** are forwarded as anonymous-event-id'd writes
   to `input_events` via a route handler that authenticates via Supabase
   cookies and triggers RLS at the row level.
3. **TTS audio** is generated cloud-side, cached in Supabase Storage,
   keyed on `(symbol_id, voice_id, locale)`, and the `output_events`
   row points at the cached audio. Caregivers may override with custom
   voice clips that take precedence.
4. **AI personalization** is a server cron + on-demand call. It always
   passes through the `aiGuard()` wrapper which inserts a row into
   `ai_usage_ledger` and aborts if the per-child monthly cap is reached.
5. **Telemetry** for the dashboard is computed nightly by a worker that
   aggregates events into `progress_metrics`. No third-party analytics
   service ever sees a child's input content.

## Package boundaries

| Package            | Owns                                                     | Imports            |
| ------------------ | -------------------------------------------------------- | ------------------ |
| `@bluecare/shared` | Tokens, zod schemas, shared types, locale mapping        | nothing            |
| `@bluecare/db`     | Drizzle schema, Drizzle client, RLS policy SQL           | `@bluecare/shared` |
| `@bluecare/web`    | UI, Next.js routes, Supabase client, AI service wrappers | both               |

## Boundaries enforced by code

- `shared` cannot import anything (no Next, no Supabase, no Node-only APIs).
- `db` cannot import `web`.
- `web/src/lib/supabase/server.ts` imports `next/headers` so it must never be
  imported from a client component (the `'use client'` boundary catches this).
- `useReducedMotion` and CSS `prefers-reduced-motion` together cover
  every animation path; component PRs that add motion without one of these
  fail review.

## Decisions

- **`next-intl`** for translation + routing because it's the cleanest App
  Router-native option that supports our `dir` flip and message
  pluralization needs.
- **`next-themes`** with `data-theme` attribute (not `class`) so the HC
  theme can be a peer of dark, not a "harder dark."
- **`drizzle-orm`** instead of Prisma because raw-SQL RLS policy authoring
  is dominant on this codebase and Drizzle stays out of the way.
- **`@supabase/ssr`** for cookie-based auth so server components, route
  handlers, middleware, and the browser client all see the same session.
