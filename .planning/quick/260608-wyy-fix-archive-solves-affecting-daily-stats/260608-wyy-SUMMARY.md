---
phase: quick-260608-wyy
plan: 01
subsystem: stats / storage
tags: [bugfix, stats, archive, tdd]
requires:
  - dlng_history (localStorage)
provides:
  - HistoryEntry.archived optional flag
  - archive solves excluded from all four daily stats
affects:
  - src/completion.ts (computeStats)
  - src/storage.ts (recordGame)
  - src/app.ts (handleGuess)
  - src/types.ts (HistoryEntry)
tech-stack:
  added: []
  patterns:
    - "Tag-and-filter: record archive solves with archived: true, exclude by tag in stats"
key-files:
  created:
    - tests/archive-stats.spec.ts
  modified:
    - src/types.ts
    - src/storage.ts
    - src/app.ts
    - src/completion.ts
decisions:
  - "Tag archive solves (archived: true) rather than skip recording — replay 'already solved' detection and the archive Tries column both read dlng_history by date."
  - "Include the archived key only when true; absence === live daily solve (backward compatible with old entries)."
metrics:
  duration: ~6 min
  completed: 2026-06-08
---

# Quick Task 260608-wyy: Fix archive solves affecting daily stats Summary

Archived puzzle solves no longer inflate the four daily stats (Played, Avg tries, Streak, Best streak); they are tagged `archived: true` in dlng_history and excluded from stats while still recorded for archive replay and the archive list.

## What changed

- `src/types.ts` — added optional `archived?: boolean` to `HistoryEntry` (backward compatible; absence means a live daily solve).
- `src/storage.ts` — `recordGame` gained a fourth `archived?` param; the entry gets `archived: true` only when the flag is true, matching the existing conditional-`answer` pattern. The dedupe `.filter` and date-descending `.sort` are unchanged.
- `src/app.ts` — in `handleGuess`, hoisted `const isArchiveSolve = ...` to BEFORE the `recordGame` call and passed it as the new fourth arg. The single hoisted const still drives the downstream `if (isArchiveSolve)` branch (no duplicate declaration).
- `src/completion.ts` — `computeStats` now filters `history` to `live = history.filter(h => h.archived !== true)` at the top, and derives all four stats (played, avgTries, the sorted streak walk, bestStreak, and the recency gate) from `live`. `filter` returns a new array, so the no-mutation guarantee (completion-stats test D) holds.

## TDD: RED → GREEN

RED (before fix) — `npx vitest run tests/archive-stats.spec.ts`, both new tests failed because the archived entry was counted:

```
AssertionError: expected '3' to be '2' // Object.is equality
Expected: "2"
Received: "3"
 ❯ tests/archive-stats.spec.ts:63:25  expect(getPlayed()).toBe('2');
...
 Test Files  1 failed (1)
      Tests  2 failed (2)
```

GREEN (after fix) — targeted specs:

```
 ✓ tests/archive-stats.spec.ts (2 tests) 28ms
 ✓ tests/completion-stats.spec.ts (12 tests) 61ms
 Test Files  2 passed (2)
      Tests  14 passed (14)
```

## Verification

Full unit suite — `npx vitest run`:

```
 Test Files  12 passed (12)
      Tests  120 passed (120)
```

Type check — `npx tsc --noEmit`:

```
tsc exit: 0
```

Manual reasoning check (no code change): `startReplayPuzzle` (app.ts ~588) and the archive list reader (worker/puzzles.ts ~305) still find archive entries by date — those entries were never removed, only tagged.

## Commits

- `51f3455` test(260608-wyy): add failing test — archive solves must not affect daily stats (RED)
- `0c033c0` fix(260608-wyy): exclude archived solves from daily stats; tag archive solves in history (GREEN)

## Deviations from Plan

None — plan executed exactly as written.

## Review gate reminder

CLAUDE.md gate: this touches puzzle/stats logic, so DA review + self-review are REQUIRED before any PR. Not run as part of this execution.

## Self-Check: PASSED

- tests/archive-stats.spec.ts — FOUND
- Commit 51f3455 — FOUND
- Commit 0c033c0 — FOUND
