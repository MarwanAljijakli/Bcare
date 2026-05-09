# Accessibility test report

> Acceptance criterion #8 requires a manual screen-reader pass for child
> board and dashboard. This file is the artifact.
>
> Module 0 baseline below; per-module results appended as features ship.

## Targets

- Child surface: WCAG 2.2 **AAA** for color contrast, focus, motion.
- Caregiver surface: WCAG 2.2 **AA** minimum.
- Automated: zero serious / critical axe violations on every public route.
- Manual: NVDA (Windows) and VoiceOver (macOS) pass for the 12 critical flows.

## Methodology

1. **Automated** — `pnpm test:a11y` (vitest + axe rules) and the Playwright
   smoke suite both run axe-core. Storybook's a11y addon flags issues during
   component development.
2. **Manual** — once per module, run NVDA + VoiceOver against the new flow.
   Record findings in the table below; defer non-blocking items to
   `backlog.md`.
3. **Lighthouse** — CI gates on Lighthouse Accessibility ≥ 95 on `/en` and `/ar`.
4. **Contrast** — `shared/tokens.test.ts` programmatically verifies AAA contrast
   for the high-contrast theme on every text-on-background pair.

## Module 0 baseline

| Surface       | Tool                 | Result               | Notes                                    |
| ------------- | -------------------- | -------------------- | ---------------------------------------- |
| Landing `/en` | axe (Playwright)     | 0 serious / critical | Smoke spec passes.                       |
| Landing `/ar` | axe (Playwright)     | 0 serious / critical | RTL layout verified.                     |
| Theme tokens  | Vitest contrast test | AAA on light + HC    | `tokens.test.ts`.                        |
| NVDA          | (deferred)           | —                    | Run after Module 1 marketing pages land. |
| VoiceOver     | (deferred)           | —                    | Run after Module 1.                      |

## Per-module entries

_(populated as modules ship)_

## Known issues

_(empty — populated as discovered)_
