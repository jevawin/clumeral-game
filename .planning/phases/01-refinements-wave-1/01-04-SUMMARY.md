---
phase: 01-refinements-wave-1
plan: 04
subsystem: ui

tags: [tailwind, completion-screen, screens, routing, stats]

# Dependency graph
requires:
  - phase: 01-refinements-wave-1
    provides: ".link utility, footer-flow layout, header simplification, Solved-in-N copy"
provides:
  - "Solved screen with welcome-parity logo+octo header"
  - "Show puzzle + Archive links beneath Leave feedback button"
  - "Init-time auto-routing of returning solvers to the completion screen"
  - "suppressStats flag that hides YOUR STATS after Show puzzle navigation"
affects: [v1.1, future-completion-screen-changes, future-screen-routing]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Custom DOM event for cross-module loose coupling (completion:show-puzzle)"
    - "Pre-render destination screen before initScreens to avoid layout flash"

key-files:
  created: []
  modified:
    - "index.html"
    - "src/completion.ts"
    - "src/app.ts"

key-decisions:
  - "Dispatch completion:show-puzzle as a document-level CustomEvent rather than calling showScreen from completion.ts — keeps suppressStats ownership inside app.ts and avoids a circular import."
  - "Inject COMPLETION_OCTO_SVG via JS rather than duplicating the SVG in index.html — single source per screen, mask id renamed to completion-octo-mask to avoid duplicate ids."
  - "Pre-render the completion screen during init when todayEntry() exists so the SLV-02 auto-route lands on a populated screen with no flash."
  - "suppressStats stays true for the rest of the session per spec — no flag-resetting logic added."

patterns-established:
  - "Pattern: cross-screen communication via document CustomEvent dispatch — completion.ts emits, app.ts listens. Lets completion.ts stay free of game-state mutation."
  - "Pattern: per-screen mask id renaming — when copying decorative SVGs across screens that may co-exist in the DOM, the mask id MUST be renamed to avoid duplicate ids."

requirements-completed: [LAY-02, SLV-01, SLV-02, SLV-03]

# Metrics
duration: 4 min
completed: 2026-05-02
---

# Phase 01 Plan 04: Solved Screen Layout, Show puzzle / Archive links, returning-solver auto-route, stats suppression Summary

**Solved screen mirrors welcome's logo+octo header, exposes Show puzzle + Archive links, auto-routes returning solvers to completion on `/`, and suppresses YOUR STATS when navigating back from solved to game.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-05-02T20:15:31Z (immediately after Plan 03 completed)
- **Completed:** 2026-05-02T20:19:13Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Welcome-parity layout on the completion screen — same `max-w-[390px]` wrapper, `gap-6 px-6 py-8`, and 96×96 octopus at the same vertical offset.
- `Show puzzle` (daily only) + `Archive` links rendered beneath `Leave feedback` using the `.link` utility (LNK-01 compliant).
- Returning solvers on `/` land directly on the completion screen — welcome screen is never shown for that session.
- Clicking `Show puzzle` flips `suppressStats=true`, hides the stats DOM, and routes to the game screen — YOUR STATS no longer appears after back-navigation.

## Task Commits

Each task was committed atomically:

1. **Task 1: Solved screen layout parity + Show puzzle / Archive links** — `0094d48` (feat)
2. **Task 2: Auto-route returning solvers + suppress YOUR STATS on back-navigation** — `9ab7636` (feat)

## Files Created/Modified

- `index.html` — Replaced `<section data-screen="completion">` markup. Outer flex changed from `flex items-center justify-center` to `flex flex-col` so the inner wrapper anchors at the top (matches welcome). Inner div uses welcome's wrapper class set. Added `[data-completion-octo]` (octo slot) and `[data-completion-links]` (link slot). Added `overflow-y-auto` to the section so the longer content cannot clip on small viewports.
- `src/completion.ts` — Added `COMPLETION_OCTO_SVG` constant (mask id renamed to `completion-octo-mask`). Added `octo` and `links` entries to the `dom` cache. `renderCompletion` now (1) injects the octo SVG idempotently into the slot and (2) renders the `Show puzzle` (daily only) + `Archive` link block at the end. The Show puzzle handler dispatches a `completion:show-puzzle` CustomEvent on the document. Archive is a hard-link to `/puzzles`.
- `src/app.ts` — Added `let suppressStats = false;` to module state with comment. Added an early-return guard at the top of both `renderStats` and `renderStatsUpTo` that hides and clears the stats DOM when `suppressStats` is true. Replaced the init block: it now reads `todayEntry()` synchronously (localStorage), pre-renders completion when an entry exists, and calls `initScreens(initialScreen)` with the chosen target. Added a document-level listener for `completion:show-puzzle` that flips the flag, clears the stats DOM, and runs `showScreen('game')`.

## Decisions Made

- **Custom event over direct showScreen call from completion.ts** — Keeps `suppressStats` ownership inside `app.ts` and avoids a circular import or a leaky cross-module reference. completion.ts only knows about DOM and the event name.
- **Pre-render completion before `initScreens`** — Avoids a flash of empty completion content when the auto-route fires. `todayEntry()` is synchronous (localStorage), so no race with the puzzle fetch.
- **suppressStats one-way flag** — Spec says stats should remain hidden after Show puzzle for the rest of the session. We flip once and never reset, matching the spec exactly.
- **Mask id renamed to `completion-octo-mask`** — Welcome and completion sections both live in the DOM simultaneously (toggled via opacity/pointer-events, not removed). Two identical `<mask id="welcome-octo-mask">` would be a duplicate-id violation; the rename avoids that without altering the visual rendering.

## Deviations from Plan

None — plan executed exactly as written.

The acceptance-criteria grep counts had two minor mismatches that were not code defects:
- `flex flex-col items-center gap-6 px-6 py-8` returned 1 in `index.html` (plan expected ≥2). Welcome injects its wrapper via a JS template literal (`src/welcome.ts`), so the static `index.html` only contains the new completion wrapper. The class set is present in the welcome runtime DOM as expected.
- `completion-octo-mask` returned 2 in `src/completion.ts` (plan expected 1). The two occurrences are the `<mask id="...">` declaration and the `mask="url(#...)"` reference — both are intentional and match the welcome pattern.

Both are plan-spec inaccuracies, not implementation issues.

## Issues Encountered

None. Build passed on the first attempt for both tasks.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Phase 01 (refinements-wave-1) is now complete: 4 plans, 4 SUMMARYs, 13 design refinements landed.
- Manual verification of the four scenarios is the user's job before opening the PR — see "Manual Verification" below.
- v1.1 Phase 02 (clue density / spacing review) is the next planned phase, intentionally deferred until Phase 01 ships.

## Manual Verification

The four manual scenarios in the plan (executor cannot run a browser):

1. **SLV-02 positive:** Solve today's puzzle → refresh → app loads directly into the completion screen, no welcome flash.
2. **SLV-02 negative:** `localStorage.clear()` → refresh `/` → welcome screen still shows.
3. **SLV-03 positive:** From completion, click Show puzzle → game screen renders the clue list and digit boxes, YOUR STATS panel is NOT visible.
4. **SLV-03 negative:** Solve a puzzle within a single session, BEFORE clicking Show puzzle — stats panel still appears on the game screen.

Run `npm run dev`, exercise the four scenarios in a browser, then open the staging PR per docs/GIT-WORKFLOW.md.

## Self-Check: PASSED

- `index.html` — modified, contains `data-completion-octo` (1), `data-completion-links` (1), section uses `flex flex-col`.
- `src/completion.ts` — modified, contains `COMPLETION_OCTO_SVG` (2 occurrences), `completion-octo-mask` (2), `completion:show-puzzle` (1), `completionShowPuzzle` (1), `completionArchive` (1), 2× `className = 'link'`.
- `src/app.ts` — modified, contains `let suppressStats` (1), `if (suppressStats)` (2), `completion:show-puzzle` (1), `initScreens(initialScreen)` (1), `renderCompletion(num, todayHistory.tries, false)` (1).
- Commits `0094d48` and `9ab7636` both present in `git log`.
- `npm run build` exits 0 (verified after each task).

---
*Phase: 01-refinements-wave-1*
*Completed: 2026-05-02*
