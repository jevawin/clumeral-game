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
**Plans:** TBD (run `/gsd:plan-phase 1`)
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

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|---------------:|--------|-----------|
| 1. Refinements wave 1 | v1.1 | 0/0 | Not started | — |
| 2. Clue density | v1.1 | 0/0 | Not started | — |

---
*Last updated: 2026-05-02 — v1.1 milestone roadmap created*
