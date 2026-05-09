# API

> Internal HTTP surface. Backed by Next.js Route Handlers under
> `web/app/api/**` and tRPC procedures under `web/src/server/trpc`.

Route handlers are added per-module. This page is the index. As of Module 0,
no auth-gated routes are mounted yet; the smoke test only exercises the
locale-prefixed marketing pages.

## Conventions

- Every handler authenticates via the cookie-bound Supabase client
  (`web/src/lib/supabase/server.ts`). RLS does the row-level enforcement.
- Request and response bodies are validated against zod schemas mirrored
  from `@bluecare/shared/schemas/*`.
- AI-bound handlers wrap their outbound call in `aiGuard()`. The guard's
  unit test is the canonical reference for the contract.
- Error format (RFC 9457 problem+json):
  ```json
  {
    "type": "https://bluecare.app/errors/{code}",
    "title": "...",
    "status": 400,
    "detail": "...",
    "instance": "/api/{route}"
  }
  ```
- Audit-relevant calls write a row to `audit_log` before returning.

## Surfaces (filled per module)

| Path                              | Method | Module | Auth      | Notes                                     |
| --------------------------------- | ------ | ------ | --------- | ----------------------------------------- |
| `/api/health`                     | GET    | 0      | none      | Process / DB health probe (added in 0.1)  |
| `/api/auth/signup`                | POST   | 2      | none      |                                           |
| `/api/auth/verify`                | POST   | 2      | none      |                                           |
| `/api/sessions`                   | POST   | 3      | caregiver | Open a board session                      |
| `/api/sessions/:id/events`        | POST   | 3      | caregiver | Append input/output events (batched)      |
| `/api/tts`                        | POST   | 3      | caregiver | Resolve cached TTS audio for a symbol     |
| `/api/ai/suggestions`             | POST   | 4      | caregiver | GPT-4o-mini suggestions, gated by aiGuard |
| `/api/dashboard/progress`         | GET    | 6      | caregiver | Aggregated progress metrics               |
| `/api/admin/symbols/:id/moderate` | POST   | 7      | admin     | Approve / reject custom symbol            |
