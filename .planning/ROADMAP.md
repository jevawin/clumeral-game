# Roadmap: Clumeral Redesign

## Overview

This roadmap rebuilds Clumeral's UI from scratch in Tailwind CSS across six phases. The project starts by laying a solid foundation — screen architecture and design tokens — then builds each screen in dependency order (welcome, game, completion), with the feedback modal and celebration animation integrated before a final polish pass that removes all legacy CSS.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation** - Tailwind setup, semantic colour tokens, screen state machine, footer
- [ ] **Phase 2: Welcome + How-to-Play** - Complete welcome screen with first/return visit how-to-play logic
- [ ] **Phase 3: Game Screen + Menu** - Full game screen layout, gameplay wiring, compact menu
- [ ] **Phase 4: Feedback Modal** - Restyled modal accessible from game menu and completion screen
- [x] **Phase 5: Celebration + Completion** - Octopus animation then stats/feedback completion screen (completed 2026-04-12)
- [ ] **Phase 6: Polish** - Old CSS removal and final regression check
- [ ] **Phase 7: Simplify** - Remove dead code, consolidate duplicated markup, prune unused CSS, prep for design iteration

## Phase Details

### Phase 1: Foundation
**Goal**: The Tailwind design system and screen architecture are in place — no visible features yet, but all screens can render and transition
**Depends on**: Nothing (first phase)
**Requirements**: STY-01, STY-02, STY-03, STY-04, STY-05, SCR-01, SCR-02, SCR-03, FTR-01, FTR-02
**Success Criteria** (what must be TRUE):
  1. Tailwind v4 is installed and builds without errors
  2. Semantic colour tokens (≤7) are defined in CSS @theme with correct light/dark values (#FAFAFA / #121213 backgrounds, green accent)
  3. Dark mode toggling via Tailwind `dark:` variants works — no `color-mix()` or `light-dark()` in the output
  4. Three screens (welcome, game, completion) render via state-driven transitions with a cross-fade, not URL changes
  5. A simplified footer ("Made with heart by Jamie & Dave. (c) 2026.") appears on all three screens
**Plans:** 1 plan
Plans:
- [x] 01-01-PLAN.md — Tailwind tokens, screen state machine, footer
**UI hint**: yes

### Phase 2: Welcome + How-to-Play
**Goal**: Players land on a complete, correct welcome screen on every visit
**Depends on**: Phase 1
**Requirements**: WEL-01, WEL-02, WEL-03, WEL-04, HTP-01, HTP-02, HTP-03, HTP-04
**Success Criteria** (what must be TRUE):
  1. The welcome screen shows the logo, octopus mascot, subtitle, and today's puzzle number
  2. Tapping the play button transitions to the game screen
  3. On a first visit (no Clumeral localStorage keys), how-to-play content appears above the play button
  4. On a return visit (any Clumeral localStorage key present), how-to-play content appears below the play button
  5. The welcome screen appears on every visit, not just the first
**Plans:** 1 plan
Plans:
- [x] 02-01-PLAN.md — Welcome screen content, HTP placement logic, play button
**UI hint**: yes

### Phase 3: Game Screen + Menu
**Goal**: The complete game screen works — layout, gameplay, and menu — with no regressions against current behaviour
**Depends on**: Phase 2
**Requirements**: GAM-01, GAM-02, GAM-03, GAM-04, GAM-05, GAM-06, MNU-01, MNU-02, MNU-03, MNU-04, MNU-05
**Success Criteria** (what must be TRUE):
  1. Clues render directly on the background with no card wrapper
  2. The digit boxes and number pad accept input and the submit button submits a guess
  3. Tapping a digit in a clue eliminates it exactly as the current implementation does
  4. Guess submission reaches the worker and server-side validation returns a correct/incorrect result with no regression
  5. Random puzzle and archive/replay modes work through the new screen flow
  6. A compact menu in the game header gives access to light/dark toggle, archive link, feedback trigger, and how-to-play
**Plans:** 1/2 plans executed
Plans:
- [x] 03-01-PLAN.md — Game screen HTML markup, remove old markup, hamburger icon, screens.ts guard
- [x] 03-02-PLAN.md — JS wiring: DOM cache, render functions, initMenu, toggleTheme export
**UI hint**: yes

### Phase 4: Feedback Modal
**Goal**: The feedback modal is fully functional and accessible from both the game menu and the completion screen
**Depends on**: Phase 3
**Requirements**: FBK-01, FBK-02, FBK-03, FBK-04, FBK-05
**Success Criteria** (what must be TRUE):
  1. Opening the feedback trigger from the game menu shows the modal
  2. The modal has four category pills (General, Bug, Idea, Praise) and a textarea that warns at 400 characters and blocks at 500
  3. The metadata line shows the correct puzzle number, date, device, and browser
  4. Submitting sends to the existing Google Apps Script endpoint with retry logic intact
**Plans:** 1 plan
Plans:
- [x] 04-01-PLAN.md — Tailwind modal markup, dialog/toast CSS rules, modals.ts toast class update
**UI hint**: yes

### Phase 5: Celebration + Completion
**Goal**: Solving the puzzle triggers the octopus celebration, then the completion screen shows correct stats
**Depends on**: Phase 4
**Requirements**: CEL-01, CEL-02, CEL-03, CMP-01, CMP-02, CMP-03
**Success Criteria** (what must be TRUE):
  1. On a correct answer, the octopus swims up from the bottom with bubbles for approximately 3 seconds
  2. After the animation finishes, the completion screen appears automatically
  3. On a device with `prefers-reduced-motion`, the animation is skipped or reduced
  4. The completion screen shows games played, avg tries, current streak, and max streak read from localStorage
  5. A feedback prompt on the completion screen opens the feedback modal
**Plans:** 2/2 plans complete
Plans:
- [x] 05-01-PLAN.md — Celebration animation: compress timing, add callback + skip support
- [x] 05-02-PLAN.md — Completion screen markup, stats rendering, correct-answer handler wiring
**UI hint**: yes

### Phase 6: Polish
**Goal**: All legacy CSS is gone and the redesigned UI has no visual regressions
**Depends on**: Phase 5
**Requirements**: STY-06
**Success Criteria** (what must be TRUE):
  1. No old CSS files are imported or referenced anywhere in the build
  2. The built CSS output contains only Tailwind-generated styles
  3. All five screens (welcome, game, completion — plus modal and menu states) look correct in both light and dark mode on mobile and desktop
**Plans:** 1/2 plans executed
Plans:
- [x] 06-01-PLAN.md — Migrate CSS rules to tailwind.css, remove canvas/colours.ts, fix JS token refs
- [x] 06-02-PLAN.md — Convert legacy wrapper HTML, remove style.css, visual regression check

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 1/1 | Complete | - |
| 2. Welcome + How-to-Play | 1/1 | Complete | - |
| 3. Game Screen + Menu | 2/2 | Complete | - |
| 4. Feedback Modal | 1/1 | Complete | - |
| 5. Celebration + Completion | 2/2 | Complete   | 2026-04-12 |
| 6. Polish | 1/2 | In Progress|  |


## Backlog (post-milestone fixes)

Items deferred from Phase 6 visual review. Not blocking v1.0 launch.

- [ ] **Tooltip positioning** — Clue tooltips render above the clue, causing the topmost tooltip to clip off-screen. Originates from old layout where logo/intro provided more top padding. Reposition tooltips or add viewport-aware flip logic.
- [ ] **Letter reveal animation** — Title SVG letter reveal doesn't fire on refresh. User plans to replace logo/lettering, so may become moot. Check for dead `data-tlt` animation code after logo change.
- [ ] **Recurring overdot** — Unable to verify `.recurring::after` styling (no recurring values in current puzzle set). Verify next time a recurring decimal appears.
- [ ] **Animation replay from stats** — Clarify whether clicking stats/completion screen should replay octo celebration. Currently doesn't.

### Phase 7: Simplify

**Goal:** Remove dead code, consolidate duplicated markup, prune unused CSS rules, document remaining component classes. Prep for design iteration so follow-up tweaks are easier and safer.
**Requirements**: TBD
**Depends on:** Phase 6
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd:plan-phase 7 to break down)
