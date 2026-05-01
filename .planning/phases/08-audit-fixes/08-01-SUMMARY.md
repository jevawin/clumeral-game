---
phase: 08-audit-fixes
plan: 01
subsystem: ui
tags: [audit-fixes, game-header, replay-routing, dead-code]

requires:
  - phase: 03-game-screen-menu
    provides: dom.plabel cache + start* writers + game header markup
  - phase: 04-feedback-modal
    provides: feedback modal init wiring with footerBtn trigger
  - phase: 05-celebration-completion
    provides: completion screen feedback delegate
provides:
  - "[data-plabel] span rendering puzzle identity for daily, random, and replay flows"
  - "Replay path /puzzles/:n initialises directly on game screen"
  - "Feedback modal init free of dead [data-fb-header-btn] reference"
affects: [v1.0-milestone, audit, gap-closure]

tech-stack:
  added: []
  patterns:
    - "Module-scope path detection at init: regex shared with loadPuzzle()"
    - "Empty-content data-attribute span populated at runtime by start* functions"

key-files:
  created: []
  modified:
    - index.html
    - src/app.ts
    - src/modals.ts

key-decisions:
  - "Reused exact /^\\/puzzles\\/(\\d+)$/ regex at module scope rather than refactoring loadPuzzle() — minimal-diff fix per plan"
  - "Empty span populated at runtime by existing start* writers — no JS code changes for label rendering"

patterns-established:
  - "Init-block path detection: regex computed once at module scope, consumed by initScreens + initWelcome gate"

requirements-completed: [GAM-01, GAM-06, FBK-01]

duration: 1min
completed: 2026-05-01
---

# Phase 08 Plan 01: Audit Fixes Summary

**Game header label, replay routing, and modals dead-query removal — closes v1.0 audit gaps GAM-01, GAM-06, FBK-01.**

## Performance

- **Duration:** 1 min
- **Started:** 2026-05-01T21:34:36Z
- **Completed:** 2026-05-01T21:35:49Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- Game header now renders puzzle identity for all three flows (daily, random, replay) via the new `[data-plabel]` span
- `/puzzles/:n` archive links land directly on the game screen — no welcome flash
- Stale `[data-fb-header-btn]` query and its dead click listener removed from `src/modals.ts`
- All three closures verified by `npm run build` exiting 0 after each task

## Task Commits

1. **Task 1: Add [data-plabel] span to game header (GAM-01, GAM-06)** — `4694d33` (feat)
2. **Task 2: Route /puzzles/:n replay path to game screen (GAM-06)** — `ebf07c4` (feat)
3. **Task 3: Remove stale [data-fb-header-btn] query and listener (FBK-01)** — `75fafe7` (fix)

## Files Created/Modified

- `index.html` — Added `<span data-plabel class="ml-2 text-sm text-muted font-[Quicksand]"></span>` as last child of the game-header left flex container (line 153)
- `src/app.ts` — Init block (lines 889–892) now computes module-scope `replayMatch` regex and routes `/puzzles/:n` to game screen; gates `initWelcome()` on `!isRandomPath && !replayMatch`
- `src/modals.ts` — Removed `headerBtn` const at line 39 and its click-listener wiring at line 138; `footerBtn` query and other modal init untouched

## Decisions Made

- Reused the exact replay regex `/^\/puzzles\/(\d+)$/` at module scope — same pattern already used inside `loadPuzzle()` at line 705. Two locations is fine; refactoring into a shared helper would have been scope creep.
- Kept the new span empty at build time — `startDailyPuzzle`, `startRandomPuzzle`, `startReplayPuzzle` already write to `dom.plabel` at runtime; no JS changes needed beyond making the element exist.

## Deviations from Plan

None - plan executed exactly as written.

## Authentication Gates

None.

## Issues Encountered

None.

## Requirements Closed

- **GAM-01** — Game screen shows clues directly on background. The missing `[data-plabel]` element now exists; the three pre-existing `dom.plabel` writers in `app.ts` (lines 546, 558, 580–585) populate it.
- **GAM-06** — Random and replay modes work through new screen flow. Replay path now routes to `'game'` at init alongside `/random`; archived-puzzle sibling label inserts correctly via `dom.plabel.parentElement?.insertBefore`.
- **FBK-01** — Feedback modal accessible from menu and completion. Dead selector removed; `footerBtn` (`[data-fb-btn]`) remains the live opener alongside the completion-screen delegate.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Phase 08 plan complete. v1.0 milestone audit gaps GAM-01, GAM-06, FBK-01 are closed.
- Ready for Phase 09 (Phase 7 Retrofit — define SIMP-01 and generate retroactive Phase 7 GSD artifacts).
- The seven E2E flows from the audit are unblocked at the source-code level. A live verification pass against the running preview (Vite at http://localhost:5173/) is recommended before milestone sign-off, focusing on:
  - Daily flow: header shows `Puzzle #N · <date>` after Play
  - Replay flow `/puzzles/3`: lands on game screen, shows `Archived puzzle` sibling + `Puzzle #3 · <date>`
  - Random flow `/random`: header shows `Random puzzle`
  - Feedback open from game menu and completion screen still works (footerBtn untouched)

## Self-Check: PASSED

- Files: index.html, src/app.ts, src/modals.ts, .planning/phases/08-audit-fixes/08-01-SUMMARY.md all present
- Commits: 4694d33, ebf07c4, 75fafe7 all present in git log
- Build: `npm run build` exits 0

---
*Phase: 08-audit-fixes*
*Completed: 2026-05-01*
