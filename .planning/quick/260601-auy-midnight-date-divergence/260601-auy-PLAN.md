---
quick_id: 260601-auy
slug: midnight-date-divergence
date: 2026-06-01
status: in-progress
branch: fix/midnight-date-divergence
---

# Quick Task 260601-auy: Fix midnight date divergence + stale archive brand

## Problem

Two independent root causes from a friend's bug report on `new-design`:

**Root cause A (bugs 1, 2, 3 — the midnight ones).** The worker keys the daily
puzzle on UTC (`handleGetPuzzle` → `todayUTC`) while the client keys completion
and streak on LOCAL date (`todayKey`). For a UK user in BST (UTC+1), between
00:00 and 01:00 local the two disagree: the worker still serves yesterday's UTC
puzzle, the solve is recorded under the worker date (`recordGame`), but
`todayEntry()` looks it up under the LOCAL date and finds nothing. Symptoms:
already-solved puzzle shows as not-completed; the Stats link (`/solved`) bounces
to the how-to/welcome screen; a midnight-window solve gets mis-dated, punching a
calendar-day hole that resets the streak.

**Root cause B (bug 4 — the logo).** The SPA brand is a no-nav bounce button
(`<button data-brand>`), but the worker-rendered `/archive` page still ships the
old brand markup `<a href="/" class="brand">` → full nav to `/` → resolves to
the welcome (how-to) screen.

Repro proofs: `e2e/midnight-rollover-repro.spec.ts` (3 tests asserting the BUGGY
behavior). These get rewritten into regression tests asserting the FIXED
behavior.

## Approach

Make the LOCAL date canonical end-to-end. The client tells the worker which
puzzle day it wants; the worker serves it, guarded by the existing +1-day
tolerance in `isFuturePuzzleDate` (designed for exactly this — ahead-of-UTC
local-midnight players, #205). Then puzzle, `recordGame`, `todayEntry`, and
streak all key on the same date.

## Tasks

### Task 1 — Worker: `/api/puzzle` honours a client `?date=` param
- **files:** `src/worker/index.ts`
- **action:**
  - Change `handleGetPuzzle(env)` → `handleGetPuzzle(env, url)`. Read
    `url.searchParams.get('date')`. If it is a well-formed `YYYY-MM-DD` AND
    `isFuturePuzzleDate(date)` is `false`, serve that date. Otherwise fall back
    to `todayUTC()` (back-compat for clients that send no param, and fail-safe
    for malformed/future values — the guard already rejects today+2 and garbage).
  - Update the call site `handleGetPuzzle(env)` → `handleGetPuzzle(env, url)`.
  - `isFuturePuzzleDate` is already imported. No new imports.
- **verify:** `npx tsc --noEmit`; manual: `GET /api/puzzle?date=<yesterday>`
  returns `{date:"<yesterday>", ...}`; `?date=<today+2>` and `?date=garbage`
  fall back to UTC today; no param → UTC today.
- **done:** worker serves the requested in-range date, falls back safely.

### Task 2 — Client: send local date to `/api/puzzle`
- **files:** `src/app.ts`
- **action:** In `loadPuzzle()`, change the daily endpoint from `'/api/puzzle'`
  to `` `/api/puzzle?date=${encodeURIComponent(todayKey())}` ``. `todayKey` is
  already imported. Random path unchanged. Now `data.date === todayKey()`, so
  `gameState.date`, `recordGame`, and `todayEntry` all align on the local day.
- **verify:** `npx tsc --noEmit`; e2e asserts the outgoing request carries
  `?date=<todayKey>` and `gameState.date === todayKey()`.
- **done:** the daily fetch is keyed on the browser-local date.

### Task 3 — Archive SSR brand: bounce, no nav (bug 4)
- **files:** `src/worker/puzzles.ts`
- **action:**
  - Replace `<a href="/" class="brand" aria-label="Clumeral home">…</a>` with
    `<button type="button" class="brand" aria-label="Bounce Clumeral">…</button>`
    (same inner octo SVG + wordmark).
  - Add a button reset to the `.brand` CSS rule (`background:none; border:0;
    cursor:pointer; font:inherit; color:inherit;`) so the button looks identical.
  - Add a small CSS keyframe bounce (transform translateY) on the octo SVG and a
    tiny inline-script click handler on `.brand` that toggles the bounce class
    (re-armable on `animationend`). No navigation — matches the SPA brand.
- **verify:** e2e: clicking `.brand` on `/archive` keeps `location.pathname ===
  '/archive'` (no nav to welcome/how-to); the octo plays a bounce.
- **done:** the archive logo bounces in place like every other screen.

### Task 4 — Rewrite repro spec into a regression spec
- **files:** `e2e/midnight-rollover-repro.spec.ts` → rename to
  `e2e/midnight-rollover.spec.ts`, invert assertions to the FIXED behavior:
  - BUG 1 → a solve recorded under LOCAL today, clock in the BST window:
    `/solved` shows the completion (stats) screen, NOT welcome.
  - BUG 2 → `/play` requests `/api/puzzle?date=<todayKey>` and `data.date`
    (hence `gameState.date`) equals `todayKey()`, so a solved puzzle is
    recognised as completed.
  - BUG 4 → clicking `.brand` on `/archive` does not navigate.
- **verify:** `npx playwright test midnight-rollover` green.
- **done:** the former repro now guards against regression.

## Out of scope / leave as-is
- Archive "Show stats" → `/solved` link: correct once root cause A holds (stats
  live on `/solved`, which requires today's solve — by design).
- `puzzleNumber`/`puzzleDate` epoch math and `/api/puzzle/:num`: unchanged — the
  number↔date mapping is a fixed global mapping, not a "today" computation.
- Cold-load rollover redirect (router.ts): already all-local, not part of root cause A.

## QA / gates (per CLAUDE.md)
- `npm test` (vitest) + `npx playwright test` (full e2e against production build).
- DA review (fresh-context subagent) → self-review before PR.
- Branch `fix/midnight-date-divergence` off `new-design`. PR, do NOT merge.
