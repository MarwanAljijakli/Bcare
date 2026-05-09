# Backlog

Anything we noticed but did not ship. Each entry has a clear next step.

> Forbidden actions §6: every `TODO` in code must have a row here.

## Module 0 closeouts

- [ ] **Supabase Database type generation in CI.** `web/src/lib/supabase/types.ts`
      is a permissive placeholder. After Module 2 applies the first migration,
      replace it with `supabase gen types typescript --linked` and add a CI
      step that fails on drift.
- [ ] **Symbol seed import.** `db/schema/symbol_libraries.ts` and `symbols.ts`
      describe the model, but the ARASAAC seed import (with attribution and
      Arabic+English label pairs) is built in Module 3.
- [ ] **Therapist sharing grant table.** RLS policies reference
      "therapist with grant", which means the join table `therapist_child_grants`
      is added in Module 6 dashboard work.
- [ ] **AI cost-per-call estimates table.** `aiGuard()` needs per-service
      cost coefficients. Authoring this is part of Module 4 personalization.
- [ ] **Decide pricing strategy.** Module 1 marketing references a
      placeholder pricing page; needs founders' decision before launch.
- [ ] **Replace placeholder app glyph.** `site-header.tsx` uses an inline
      speech-bubble + heart SVG; replace with the final brand mark when art
      is approved.

## Lower priority

- [ ] **Lighthouse CI server.** Currently writes reports to filesystem;
      consider self-hosting a Lighthouse CI server to track trends.
- [ ] **VS Code recommended extensions list.** `.vscode/extensions.json`.
