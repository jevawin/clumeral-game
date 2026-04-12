---
phase: 03-game-screen-menu
plan: 01
subsystem: ui
tags: [tailwind, html, svg, screen-architecture]

requires:
  - phase: 02-welcome-how-to-play
    provides: Screen state machine, Tailwind tokens, three-screen HTML shell, screens.ts with overlay guard

provides:
  - Complete game screen HTML inside [data-screen="game"] with header, menu, clue list, digit boxes, keypad, submit, save, feedback, history, stats, next, and again elements
  - Hamburger menu icon (icon-menu) in public/sprites.svg
  - Clean screens.ts without transitional empty-game-section guard

affects: [03-game-screen-plan-02, 04-feedback, 05-completion]

tech-stack:
  added: []
  patterns: [Tailwind-only game screen markup — no card wrapper, clues directly on bg-bg, data attributes match existing app.ts dom cache]

key-files:
  created: []
  modified: [index.html, public/sprites.svg, src/screens.ts]

key-decisions:
  - "Removed empty-game overlay guard from screens.ts — game section now has content so guard is obsolete"
  - "Updated skip link from #puzzle to #game-content and added id to scrollable content div"
  - "Old cw-ck checkbox id retained in new save-score row — same label/input pair, just with sr-only on the input"

patterns-established:
  - "Game screen data attributes match existing app.ts dom cache — Plan 02 can wire JS without changing attribute names"
  - "Menu dropdown positioned absolute relative to game section with z-40 — sits above sticky header content"

requirements-completed: [GAM-01, GAM-02, GAM-03, GAM-06, MNU-01, MNU-02, MNU-03, MNU-04, MNU-05]

duration: 10min
completed: 2026-04-12
---

# Phase 03 Plan 01: Game Screen HTML Summary

**Complete game screen HTML markup with sticky header, hamburger menu dropdown, skeleton clue loaders, digit boxes, keypad, submit, and all post-game elements — old puzzle card and footer links removed**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-04-12T10:26:00Z
- **Completed:** 2026-04-12T10:30:54Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Game screen section populated with full HTML structure — header, menu, clue list with 3 skeleton rows, digit boxes, keypad, submit button, save-score row, feedback, history, stats, next puzzle, and random-again
- Hamburger icon added to sprites.svg matching existing icon style
- Old puzzle card (`id="puzzle"`), old footer links (Guide, Feedback, Archive, Theme), feedback header button, and subtitle paragraph all removed
- screens.ts guard that hid the overlay when the game section was empty is removed — no longer needed

## Task Commits

1. **Task 1: Add hamburger icon to sprites.svg and write game screen HTML into index.html** - `7e4405a` (feat)
2. **Task 2: Remove screens.ts overlay guard for empty game section** - `1374d0f` (fix)

## Files Created/Modified
- `index.html` - Old markup removed, game section populated with Tailwind HTML, skip link updated
- `public/sprites.svg` - Added icon-menu symbol (hamburger, three horizontal lines)
- `src/screens.ts` - Removed const overlay, gameEmpty guard, and invisible toggle

## Decisions Made
- Updated skip link target from `#puzzle` (removed) to `#game-content` (new scrollable area) — accessibility correctness after removing old anchor
- Old `cw-ck` checkbox id kept on the new save-score row to avoid unnecessary ID churn; checkbox now uses `sr-only` class rather than visible styling

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Updated skip link target after removing #puzzle anchor**
- **Found during:** Task 1 (removing old puzzle card)
- **Issue:** Skip link at top of body pointed to `#puzzle` which was removed. Skip link would be dead (accessibility regression).
- **Fix:** Updated `href="#puzzle"` to `href="#game-content"` and added `id="game-content"` to the scrollable game content div
- **Files modified:** index.html
- **Verification:** Skip link now resolves to the game content area
- **Committed in:** 7e4405a (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 2 - missing critical accessibility fix)
**Impact on plan:** Necessary accessibility correctness fix. No scope creep.

## Issues Encountered
None beyond the deviation above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All data attributes (`data-game-header`, `data-menu-btn`, `data-menu`, `data-clue-list`, `data-digits`, `data-digit="0|1|2"`, `data-keypad-wrap`, `data-keypad`, `data-submit-wrap`, `data-submit`, `data-save`, `data-save-check`, `data-feedback`, `data-history`, `data-history-list`, `data-stats`, `data-next`, `data-next-number`, `data-again`, `data-game-content`, `data-plabel`) are in place for Plan 02's JS wiring
- screens.ts is clean — no transitional hacks remaining
- Build passes

---
*Phase: 03-game-screen-menu*
*Completed: 2026-04-12*
