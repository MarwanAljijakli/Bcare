# Phase 2.A — Closeout

## Shipped

Phase 2.A.0 landed on `1917ee7` (2026-05-14): Claude report truncation fix.

| Change                       | Before | After |
| ---------------------------- | ------ | ----- |
| `max_tokens` (Sonnet call)   | 1800   | 8192  |
| `bilingualLineSchema.en/.ar` | 280    | 500   |
| `summary_paragraph_en/ar`    | 2000   | 2500  |

Temporary `claude_report_parse_fail` audit_log diagnostic added on `1917ee7`,
removed in this PR.

## Caps — current locations

`web/src/server/reports/claude-analyzer.ts`:

- L53 — `en: z.string().min(1).max(500)`
- L54 — `ar: z.string().min(1).max(500)`
- L67 — `summary_paragraph_english: z.string().min(1).max(2500)`
- L68 — `summary_paragraph_arabic: z.string().min(1).max(2500)`
- L494 — `max_tokens: 8192`

## Evidence

Two clean Claude runs on `1917ee7`:

- reportId `0c47493d-7c53-4ac2-8778-8167bc7f096e` — output_tokens 4433
- reportId `a5804fa4-62db-4e84-b521-ed03a5e45c62` — output_tokens 4764

Both exceed the abandoned 4096 cap on `fix/claude-report-parse`. Total Claude
spend across the verification pass: $0.143. Longest individual bilingual line
observed: 317 chars (63% of the 500 cap).

Real-browser render verified on `/en/dashboard/insights` and
`/ar/dashboard/insights` — all five sections (strengths, areas for growth,
parent suggestions, therapist suggestions, summary paragraph) populate with
real bilingual Claude content for both reportIds.

## Manual cleanup (operator runs after merge)

```sql
delete from audit_log
where target_type in ('claude_payload_debug', 'claude_report_parse_fail')
  and created_at < now();
```

## Outstanding follow-ups

### Phase 2.A.1 — `claude_report` ledger anomaly (P2)

The success path is proven to book costs correctly: 5266 + 5597 ledger units
booked at $0.069 + $0.074 across the two verification runs. Downgraded from
P1 to P2. Re-investigate only if a future failure-path run again skips the
charge.

### Phase 2.A.2 — UI placeholder-as-real-report rendering (P2)

Defense in depth. The truncation fix makes the placeholder fallback path
practically unreachable, but the UI still has no error banner when a
fallback row is rendered. Track for a future hardening pass.

### Phase 2.A.3 — auth-surface `nested-interactive` a11y violation (P1)

`<MockChildBoard>` decorative component on the auth shell trips axe's
`nested-interactive` rule. Blocks main CI a11y check from going green.
Next session.
