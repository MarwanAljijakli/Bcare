# BlueCare accessibility test report

**Status as of 2026-05-12**: pre-launch skeleton — automated axe-core
passes are recorded; the human VoiceOver / NVDA pass is the blocker
that turns each surface from PARTIAL to PASS.

Audits in this document follow WCAG 2.2 AA on every surface, with AAA
targets on the child-facing communication board.

---

## Methodology

- **Automated**: axe-core via the Playwright suite + Lighthouse a11y
  on every gated route in CI.
- **Manual keyboard**: every surface walked tab-by-tab. Focus rings
  visible, no traps, escape closes overlays.
- **Manual screen reader**: VoiceOver on macOS Sonoma + Safari, NVDA
  2025.1 on Windows 11 + Chrome. Articulate every interactive
  element's announced name + role + state.

---

## Surface-by-surface checklist

### Marketing (/, /signup, /login, /accessibility, /privacy, /terms)

- [x] axe-core: 0 serious / 0 critical violations (CI).
- [x] Lighthouse a11y: ≥ 95 (CI).
- [x] Color contrast WCAG AA verified on light + dark + high-contrast.
- [x] Keyboard reachable in tab order matching visual order.
- [ ] **Manual VoiceOver pass** — pending Module 9 manual review.
- [ ] **Manual NVDA pass** — pending Module 9 manual review.
- [x] RTL parity verified visually on /ar.

### Communication board (/[locale]/board)

- [x] AAA contrast (7:1+) on every text-on-background pair.
- [x] 44×44px minimum touch targets on every tile + control.
- [x] prefers-reduced-motion respected.
- [x] Keyboard: Tab + arrow keys traverse grid, Space selects tile,
      Enter speaks the assembled phrase.
- [x] axe-core 0 violations.
- [ ] **VoiceOver**: every tile announces with both EN + AR labels
      and the symbol category. Pending.
- [ ] **NVDA**: same. Pending.
- [x] Visible focus ring on every interactive element.

### Caregiver dashboard (/[locale]/dashboard and sub-routes)

- [x] axe-core: 0 violations on /dashboard, /personalization, /themes,
      /therapists, /reports.
- [x] /dashboard/sessions/[id]: replay timeline navigable by keyboard,
      Speak button keyboard-activatable, notes textarea labeled.
- [x] /dashboard/reports: PDFDownloadLink reachable + announced.
- [ ] **VoiceOver on session replay** — pending.
- [ ] **NVDA** — pending.

### Settings (/[locale]/settings/\*)

- [x] Form fields have explicit `<label>` associations.
- [x] PIN entry has live `aria-live=polite` status updates.
- [x] axe-core: 0 violations.
- [ ] **Manual SR pass** — pending.

### Admin (/[locale]/admin and sub-routes)

- [x] axe-core: 0 violations.
- [x] j/k keyboard shortcuts announced via `aria-keyshortcuts`.
- [x] Pagination + filters keyboard-operable.
- [ ] **Manual SR pass on admin tables** — pending.

### Therapist surface (/[locale]/therapist)

- [x] axe-core: 0 violations.
- [x] Caseload grid keyboard-traversable via tab order.
- [ ] **Manual SR pass** — pending.

### Help (/[locale]/help, /[locale]/help/[slug])

- [x] axe-core: 0 violations.
- [x] Article TOC entries are semantic anchor links.
- [x] Copy-link buttons have descriptive aria-label.
- [x] Feedback buttons (👍/👎) are real buttons with text + icon.
- [ ] **Manual SR pass on Fuse-search live region** — verify the
      `aria-live=polite` announcement timing.

---

## Known issues

1. **Pending manual SR pass on Module 6.1 + Module 7 + help surfaces.**
   axe-core passes but human SR may surface improvements. **Blocking
   the launch** — must complete before flipping bypass off.

2. **Symbol audit prompt v1 false-positives on AAC iconography** —
   33 mismatches flagged in the 2026-05-12 audit, mostly correctly-
   stylized pointing-finger/arrows/abstract pictograms. Module 9.1
   refined the prompt and re-ran the audit; the post-refinement count
   is recorded in docs/release-scorecard.md.

3. **Fuse-search `aria-live=polite` may over-chat** on rapid
   keystrokes (untested with NVDA). If announcements stack, debounce
   the live-region update to 250ms.

---

## Sign-off (post-manual-pass)

- [ ] VoiceOver pass recorded by: ****\_\_\_**** on ****\_\_\_****
- [ ] NVDA pass recorded by: ****\_\_\_**** on ****\_\_\_****
- [ ] All "pending" items above cleared or filed as new issues.
- [ ] Launch gate: this section signed off.
