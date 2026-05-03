---
phase: 03-url-routing
plan: 04
subsystem: client-router
tags: [routing, app-boot, analytics-bridge]
requires:
  - src/router.ts (Plan 03)
  - src/route-resolver.ts (Plan 02)
provides:
  - router-driven app boot
  - analytics:track CustomEvent bridge
  - replaceRoute('/solved') on correct guess
  - onArchiveDate handler that fetches dated puzzle
  - completion:show-puzzle → navigate skipResolve
affects:
  - src/app.ts
  - src/welcome.ts
  - src/completion.ts (signature only)
tech-stack:
  added: []
  patterns:
    - "CustomEvent bridge: router emits analytics:track, app forwards to track()"
    - "skipResolve escape hatch: bypass resolver redirect while keeping title + analytics"
key-files:
  created: []
  modified:
    - src/app.ts
    - src/welcome.ts
    - src/completion.ts
decisions:
  - "Router boot replaces hand-rolled SLV-02 initial-screen branch — single source of truth"
  - "Legacy /random and /puzzles/<n> still bypass the router; Worker owns those"
  - "completion:show-puzzle uses navigate('/play', { skipResolve: true }) — applyRoute owns the showScreen call (Pitfall 3)"
  - "renderCompletion signature gained an optional opts param early so Plan 04 type-checks before Plan 06 ships"
metrics:
  duration: ~10m
  completed: 2026-05-03
---

# Phase 03 Plan 04: Wire router into app + welcome Summary

Boot src/app.ts through the router and replace screen-flip call sites with `navigate()` / `replaceRoute()`. The URL bar now reflects state and back/forward behaves naturally. Solving uses `replaceRoute('/solved')` so back skips the finished puzzle. The `analytics:track` CustomEvent bridge forwards router events to the existing `track()` helper.

## What changed

### src/app.ts

- New imports from `./router.ts`: `navigate`, `replaceRoute`, `initRouter`.
- Correct-guess branch in `handleGuess()` swaps `showScreen('completion')` for `replaceRoute('/solved')` (both reduced-motion and celebrateOcto callback paths).
- Boot block (formerly the SLV-02 hand-rolled branch) replaced with:
  - `initWelcome()` always pre-renders welcome content
  - Pre-render completion if today is already solved (SLV-02 parity preserved)
  - `initScreens('welcome')` initialises the screen state machine; the router immediately calls `showScreen()` with the resolved screen
  - `analytics:track` listener bridges to `track()`
  - Legacy `/random` and `/puzzles/<n>` paths bypass the router (Worker still owns them); other paths boot the router with `hasData / todayLocal / todayEntry / midInteraction / onArchiveDate` deps
- `midInteraction` returns `activeBox !== null || submitting`.
- `onArchiveDate(date)` converts date → puzzleNumber, fetches `/api/puzzle/:num`, and calls `startReplayPuzzle`.
- `completion:show-puzzle` listener now calls `navigate('/play', { skipResolve: true })` — the router owns the title set, analytics emit, and the screen flip. The previous manual `history.pushState` and `document.title` writes are gone.
- `startReplayPuzzle` pre-renders the completion view with `{ activeDate: date, todayLocal: todayLocal() }` so archived dated routes get the right back-link shape (ARC-02).

### src/welcome.ts

- Drops the `./screens.ts` import; imports `navigate` from `./router.ts`.
- Play button handler: `navigate('/play')` instead of `showScreen('game')`. The resolver applies any redirect.

### src/completion.ts

- `renderCompletion` gained an optional `opts?: RenderCompletionOpts` parameter (`{ activeDate?, todayLocal? }`). Plan 04 depends on Plan 06's signature change but Plan 06 has not shipped — adding the optional param early unblocks tsc. Plan 06 will wire `opts` into the rendered links.

## Verification

- `npx tsc --noEmit` clean (the only errors are pre-existing `vite.config.ts` Node-types issues, out of scope).
- `npm run build` exits 0; client bundle 53.39 kB.
- `npx vitest run` — 25 passed, 3 todo (existing completion-links spec — Plan 06 wires it up).
- All Task 1 grep acceptance checks pass: `from './router.ts'` = 1, `initRouter(` = 1, `replaceRoute('/solved')` = 2, `analytics:track` = 1, `midInteraction:` = 1, `activeBox !== null || submitting` = 1, `skipResolve: true` = 1, `renderCompletion(.*activeDate: date` = 1, no manual `history.pushState` or `document.title = 'Clumeral · Play'` left.
- All Task 2 grep acceptance checks pass: welcome.ts has 1 router import, 1 `navigate('/play')` call, 0 `showScreen('game')` calls, 0 `from './screens.ts'` imports.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added optional `opts` param to `renderCompletion` ahead of Plan 06**
- Found during: Task 1 typecheck.
- Issue: Plan 04 depends on Plan 06 (per the dependency-direction swap), but Plan 06 has not run yet. The plan body explicitly calls `renderCompletion(num, entry.tries, false, { activeDate, todayLocal })` with a 4-arg signature; the live signature is 3-arg.
- Fix: Add an optional `_opts?: RenderCompletionOpts` parameter to `renderCompletion` so the new call site type-checks. Body unchanged — Plan 06 will wire opts into the rendered links.
- Files modified: `src/completion.ts`.
- Commit: `bb65e5b fix(03-04): add optional opts param to renderCompletion signature`.

### Boot ordering note

The plan's Edit 3 example placed `loadPuzzle()` before the SLV-02 block, but the original file already called `loadPuzzle()` immediately after `initFeedbackModal` (line 912). To preserve behaviour while routing the router boot through the new branch, `loadPuzzle()` is now called at the end of each branch (legacy and router) rather than before the branch. This keeps the daily fetch firing exactly once on every boot path.

## Commits

- `bb65e5b` fix(03-04): add optional opts param to renderCompletion signature
- `1f9efb9` feat(03-04): wire src/router.ts into app boot
- `a82bd17` feat(03-04): welcome Play button calls navigate('/play')

## Self-Check

- File `src/app.ts`: FOUND
- File `src/welcome.ts`: FOUND
- File `src/completion.ts`: FOUND
- Commit `bb65e5b`: FOUND
- Commit `1f9efb9`: FOUND
- Commit `a82bd17`: FOUND

## Self-Check: PASSED
