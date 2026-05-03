# Roadmap: Clumeral

## Milestones

- ✅ **v1.0 Clumeral Redesign** — Phases 1-9 (shipped 2026-05-02) — see [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)
- 🚧 **v1.1 Design Refinements** — Phases 1-2 (in progress, started 2026-05-02)

## Phases

<details>
<summary>✅ v1.0 Clumeral Redesign (Phases 1-9) — SHIPPED 2026-05-02</summary>

- [x] Phase 1: Foundation (1/1 plans) — completed 2026-04-11
- [x] Phase 2: Welcome + How-to-Play (1/1 plans) — completed 2026-04-12
- [x] Phase 3: Game Screen + Menu (2/2 plans) — completed 2026-04-12
- [x] Phase 4: Feedback Modal (1/1 plans) — completed 2026-04-12
- [x] Phase 5: Celebration + Completion (2/2 plans) — completed 2026-04-12
- [x] Phase 6: Polish (2/2 plans) — completed 2026-04-15
- [x] Phase 7: Simplify (1/1 plans) — completed 2026-04-21 (artifacts retrofitted via Phase 9)
- [x] Phase 8: Audit Fixes (1/1 plans) — completed 2026-05-01
- [x] Phase 9: Phase 7 Retrofit (1/1 plans) — completed 2026-05-02

</details>

### 🚧 v1.1 Design Refinements (In Progress)

- [ ] **Phase 1: Refinements wave 1** — Layout, color, header, menu, copy, solved-screen behaviour and links (13 requirements)
- [ ] **Phase 2: Clue density** — Reduce clue margin/spacing for more clues per viewport (deferred — review after Phase 1 ships)
- [ ] **Phase 3: URL routing** — Semantic client routes (/welcome, /play, /solved, /archive, /archive/<date>), worker fallback, redirect rules, dated puzzle replay (10 requirements)

## Phase Details

### Phase 1: Refinements wave 1
**Goal:** Ship a cohesive batch of design refinements: footer in document flow, pure foreground colors, simplified header, polished menu, clearer copy, and a richer solved screen with auto-routing for returning solvers.
**Depends on:** Nothing (v1.0 shipped)
**Requirements:** LAY-01, LAY-02, CLR-01, HDR-01, MNU-01, MNU-02, MNU-03, CPY-01, CPY-02, SLV-01, SLV-02, SLV-03, LNK-01
**Success Criteria** (what must be TRUE):
  1. Footer is in document flow — visible at the bottom of short pages and pushed down naturally on long ones; no `position: fixed` on the footer
  2. No grey or muted text appears anywhere — all text is pure white in dark mode and pure black in light mode
  3. Game header no longer shows the puzzle number
  4. Burger menu omits Archive, has no hover background, and changes text to accent green on hover
  5. Submit button reads "Submit answer"; solved-screen copy reads "Solved in N try/ies" with the tick icon retained
  6. Solved screen positions logo + octopus identically to the welcome screen, shows "Show puzzle" + "Archive" links below feedback in the standard green-underline link style, auto-routes returning solvers, and hides the YOUR STATS section when the user navigates back to the puzzle
**Plans:** 4 plans
- [x] 01-01-PLAN.md — Footer in document flow, no muted text anywhere, standard `.link` utility (LAY-01, CLR-01, LNK-01)
- [x] 01-02-PLAN.md — Drop puzzle # from game header; remove Archive item; menu hover is accent text only (HDR-01, MNU-01, MNU-02, MNU-03)
- [x] 01-03-PLAN.md — Submit button reads "Submit answer"; solved subheading reads "Solved in N try/tries" (CPY-01, CPY-02)
- [x] 01-04-PLAN.md — Solved-screen logo+octo parity; Show puzzle + Archive links; auto-route returning solvers; hide YOUR STATS on back-navigation (LAY-02, SLV-01, SLV-02, SLV-03)
**UI hint:** yes

### Phase 2: Clue density
**Goal:** Tighten clue list margin and line spacing so more clues are visible on a single mobile viewport without scrolling, with no loss of legibility or tap-target size.
**Depends on:** Phase 1
**Requirements:** DEN-01
**Success Criteria** (what must be TRUE):
  1. On a 375px-wide mobile viewport, more clues are visible above the fold than in the v1.0 baseline
  2. Tap targets for digit elimination remain at or above the v1.0 size
  3. No visual regression in the typography hierarchy (clue label vs body)
**Plans:** TBD (run `/gsd:plan-phase 2`)
**UI hint:** yes

### Phase 3: URL routing
**Goal:** Replace the single-route SPA shell with semantic client routes so the address bar reflects state (welcome / play / solved / archive / dated puzzle), share links land users in the right place, and browser back/forward feels natural — without changing the underlying screens architecture.
**Depends on:** Phase 1
**Requirements:** RTE-01, RTE-02, RTE-03, ARC-01, ARC-02, ARC-03, POL-01, POL-02, POL-03, POL-04
**Success Criteria** (what must be TRUE):
  1. The address bar shows `/welcome`, `/play`, `/solved`, `/archive`, or `/archive/<YYYY-MM-DD>` matching the active screen — never just `/`.
  2. Refreshing or sharing any of those URLs lands the user on the correct screen (subject to redirect rules below); deep links never 404.
  3. Redirects: `/play` for a user with no onboarding → `/welcome`; `/play` for today already solved → `/solved`; `/solved` with no/stale history → `/welcome`; invalid or future `/archive/<date>` → `/archive`. Stale-day check fires on focus/visibility, not while the user is mid-interaction.
  4. Solving a puzzle uses `replaceState` (not `pushState`) so browser back from `/solved` skips the finished puzzle and lands on `/welcome`.
  5. `/archive/<YYYY-MM-DD>` for today links its solved view back to `/solved`; for any other date it links back to `/archive`.
  6. Each route sets a route-specific `<title>`; route changes emit a `route_change` analytics event with the path; `history.scrollRestoration` is set to `manual` once at boot.
  7. The existing `/puzzles` archive list is renamed to `/archive` (one redirect kept for back-compat) and `/random` is unchanged.
**Plans:** 6 plans
- [ ] 03-01-PLAN.md — Wave 0: install vitest+jsdom, scaffold red specs (infra)
- [ ] 03-02-PLAN.md — Wave 1: pure resolveRoute() + tests (RTE-03, ARC-03)
- [ ] 03-03-PLAN.md — Wave 1: src/router.ts navigate/replaceRoute/initRouter + popstate + stale-day (RTE-01, POL-01..04)
- [ ] 03-04-PLAN.md — Wave 2: wire router into src/app.ts + welcome.ts; replaceRoute on solve (RTE-01, RTE-03, POL-04)
- [ ] 03-05-PLAN.md — Wave 2: worker rename /puzzles → /archive, 302s, SPA fallback, route_change allowlist (RTE-02, ARC-01, POL-02)
- [ ] 03-06-PLAN.md — Wave 2: completion-screen back-links date-aware; replace /puzzles with /archive (ARC-02)
**UI hint:** no (no new visuals — pure routing/structure change)

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|---------------:|--------|-----------|
| 1. Refinements wave 1 | v1.1 | 4/4 | Complete | 2026-05-02 |
| 2. Clue density | v1.1 | 0/0 | Not started | — |
| 3. URL routing | v1.1 | 0/6 | Planned | — |

---
*Last updated: 2026-05-03 — Phase 3 plans created (6 plans, 3 waves)*
