# Requirements: Clumeral v1.1 Design Refinements

**Defined:** 2026-05-02
**Milestone Goal:** Tighten the v1.0 design — layout structure, color contrast, copy clarity, solved-screen flow, menu polish.

## v1.1 Requirements

### Layout

- [x] **LAY-01**: Footer is part of the natural document flow (not `position: fixed`); page uses a header / content / footer flex column that pins footer to the bottom of the viewport when content is short, and pushes it down naturally when content is long. Use `min-h-screen` (or 100dvh) and `flex flex-col` with footer as the last child.
- [ ] **LAY-02**: Logo + octopus on the solved (completion) screen sit in the same relative position as the welcome screen (same vertical offset, same sizing), so transitioning between welcome → game → solved feels like a single anchored layout.

### Color

- [x] **CLR-01**: All text uses only the foreground colors — pure white in dark mode, pure black in light mode. No grey or muted text remains anywhere in the app (clues, stats, metadata, footer, helper copy, modals).

### Header

- [x] **HDR-01**: Game-screen header no longer shows the puzzle number (`Puzzle #N · <date>` removed); header is reduced to title + menu only.

### Burger menu

- [x] **MNU-01**: Burger menu no longer contains the "Archive" item.
- [x] **MNU-02**: Burger menu items have no hover background (hover state is text-only).
- [x] **MNU-03**: Burger menu items change text color to the accent green on hover (light + dark mode).

### Copy

- [x] **CPY-01**: Submit-guess button label reads "Submit answer" (was: "Check my guess").
- [x] **CPY-02**: Solved-screen copy reads "Solved in N try" (singular when N=1) / "Solved in N tries" (plural otherwise), keeping the existing tick icon. Was: "You already solved today's puzzle in 1 try!"

### Solved screen

- [ ] **SLV-01**: Below the existing "Leave feedback" link, render a "Show puzzle" link (when applicable) and an "Archive" link, in that order. Both follow the project's standard link style (defined in `LNK-01`).
- [ ] **SLV-02**: When a returning user opens the app and today's puzzle is already solved, route them directly to the solved screen on init (skip welcome screen for that session). First visit and unsolved state behaviour unchanged.
- [ ] **SLV-03**: When the user navigates from the solved screen back to the puzzle (via "Show puzzle"), the "YOUR STATS" section is not rendered on the puzzle view.

### Link style (cross-cutting)

- [x] **LNK-01**: Standard link style: text in accent green, 1px solid green bottom border, 2px bottom padding, `text-decoration: none`. Applies to "Leave feedback", "Show puzzle", "Archive", and any future inline links.

## Future Requirements

### Phase 2 — Clue density

- **DEN-01**: Reduce clue card margin / line spacing so more clues fit on a single mobile viewport without scrolling. Exact target deferred — review after Phase 1 ships.

## Out of Scope (still in force from v1.0)

| Feature | Reason |
|---------|--------|
| Multiple colour themes | Deliberately removed to simplify UI |
| Toast notification system (beyond existing feedback toast) | How-to-play is inline, no toast surface needed |
| Worker / API changes | Backend stays untouched |
| Component library | Render-function pattern works at this scale |

## Traceability

Filled in during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| LAY-01 | Phase 1 | Complete |
| LAY-02 | Phase 1 | Pending |
| CLR-01 | Phase 1 | Complete |
| HDR-01 | Phase 1 | Complete |
| MNU-01 | Phase 1 | Complete |
| MNU-02 | Phase 1 | Complete |
| MNU-03 | Phase 1 | Complete |
| CPY-01 | Phase 1 | Complete |
| CPY-02 | Phase 1 | Complete |
| SLV-01 | Phase 1 | Pending |
| SLV-02 | Phase 1 | Pending |
| SLV-03 | Phase 1 | Pending |
| LNK-01 | Phase 1 | Complete |
| DEN-01 | Phase 2 | Pending |

**Coverage:**
- v1.1 requirements: 13 total
- Mapped to phases: 13
- Unmapped: 0

---
*Requirements defined: 2026-05-02*
