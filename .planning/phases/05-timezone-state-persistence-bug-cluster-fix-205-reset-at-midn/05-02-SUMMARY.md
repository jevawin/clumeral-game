---
phase: 05-timezone-state-persistence-bug-cluster-fix-205-reset-at-midn
plan: "02"
subsystem: date-helpers
tags: [date, timezone, deduplication, refactor]
dependency_graph:
  requires:
    - phase: 05-01
      provides: src/date.ts with EPOCH_DATE, localDateKey, todayKey, puzzleNumberFor, formatDate
  provides:
    - app.ts and welcome.ts import from src/date.ts — no duplicate helpers remain on the client
  affects: [Plans 03-05 — client date logic is now a single source of truth]
tech_stack:
  added: []
  patterns:
    - "Consumer rewiring: remove local helper, add import, rename call sites (todayLocal→todayKey, puzzleNumber→puzzleNumberFor)"
    - "Router interface adapter: shorthand property todayLocal renamed to todayLocal: todayKey at call site (property key must match RouterDeps, value is the new import)"
key-files:
  created: []
  modified:
    - src/app.ts
    - src/welcome.ts
key-decisions:
  - "EPOCH_DATE omitted from app.ts import — it was only used by the now-deleted local puzzleNumber(); the imported puzzleNumberFor() encapsulates epoch arithmetic, so no direct EPOCH_DATE usage survives in app.ts"
  - "initRouter shorthand todayLocal becomes todayLocal: todayKey — RouterDeps interface requires a property named todayLocal; shorthand cannot be used after the local function is deleted"
  - "welcome.ts toLocaleDateString replaced with formatDate(today) — resolves Open Question 1 from RESEARCH.md; both files now share one display path through date.ts"
patterns-established:
  - "No client file outside src/date.ts should define its own date-keying helpers — any new consumer imports from './date.ts'"
requirements-completed: []
duration: "4 min"
completed: "2026-05-29T23:02:06Z"
---

# Phase 05 Plan 02: De-duplicate Client Date Helpers Summary

Deleted local `todayLocal`, `puzzleNumber`, `formatDate`, and `EPOCH_DATE` duplicates from `app.ts` and `welcome.ts`; both files now import from the canonical `src/date.ts` (D-03 complete, #205/#209 client-side root cause closed).

## Performance

- **Duration:** ~4 min
- **Started:** 2026-05-29T22:58:00Z
- **Completed:** 2026-05-29T23:02:06Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- All duplicate local date helpers deleted from app.ts (20 fewer lines) and welcome.ts (16 fewer lines)
- Both files import `todayKey`, `puzzleNumberFor`, `formatDate` from `src/date.ts`
- welcome.ts inline `toLocaleDateString` replaced with `formatDate(today)` — shared display path
- Build green; 52 tests pass; pre-existing router.spec.ts beacon failure unchanged

## Task Commits

1. **Task 1: Rewire src/app.ts to date.ts and delete duplicate helpers** - `51b77b1` (refactor)
2. **Task 2: Rewire src/welcome.ts to date.ts and replace inline date format** - `c7dd833` (refactor)

## Files Created/Modified

- `src/app.ts` — import from `./date.ts`; deleted EPOCH_DATE, todayLocal(), puzzleNumber(), formatDate(); renamed all call sites; fixed initRouter/initFeedbackModal args
- `src/welcome.ts` — import from `./date.ts`; deleted EPOCH_DATE, todayLocal(), puzzleNumber(); renamed call sites; replaced inline toLocaleDateString with formatDate()

## Decisions Made

- Omitted `EPOCH_DATE` from app.ts import — not used after local helpers deleted; the imported `puzzleNumberFor()` encapsulates it internally
- `initRouter` shorthand `todayLocal` had to become `todayLocal: todayKey` because `RouterDeps` interface specifies `todayLocal: () => string` and shorthand relies on the local variable name matching the property key

## Deviations from Plan

None — plan executed exactly as written. One minor note: EPOCH_DATE was imported initially then found unused and dropped from the import (the plan says "only the names actually used — if EPOCH_DATE is unused after edits, omit it"), which is the correct behaviour per the plan's own instruction.

## Issues Encountered

None.

## Acceptance Criteria Verification

For app.ts:
- `grep -nE "function todayLocal|function puzzleNumber\b|function formatDate" src/app.ts` → 0 matches: PASS
- `grep -c "EPOCH_DATE = " src/app.ts` → 0: PASS
- `grep -c "from './date.ts'" src/app.ts` → 1: PASS
- `grep -cE "\btodayLocal\(|\bpuzzleNumber\(" src/app.ts` → 0: PASS
- `npm run build` exits 0: PASS

For welcome.ts:
- `grep -nE "function todayLocal|function puzzleNumber\b" src/welcome.ts` → 0 matches: PASS
- `grep -c "EPOCH_DATE = " src/welcome.ts` → 0: PASS
- `grep -c "from './date.ts'" src/welcome.ts` → 1: PASS
- `grep -c "toLocaleDateString" src/welcome.ts` → 0: PASS
- `grep -cE "\btodayLocal\(|\bpuzzleNumber\(" src/welcome.ts` → 0: PASS
- `npm run build` exits 0: PASS

vitest: 52 pass, 1 pre-existing failure (router.spec.ts beacon — documented in 05-01): PASS

## Self-Check: PASSED

- `src/app.ts` exists: FOUND
- `src/welcome.ts` exists: FOUND
- `src/date.ts` exists: FOUND
- `05-02-SUMMARY.md` exists: FOUND
- Commit `51b77b1` exists (Task 1 refactor): FOUND
- Commit `c7dd833` exists (Task 2 refactor): FOUND
- `from './date.ts'` in app.ts: 1 — PASS
- `from './date.ts'` in welcome.ts: 1 — PASS
- No old call sites in either file: PASS

## Threat Flags

None. T-05-03 (shadowed-import regression) is closed: grep acceptance gates prove no local duplicate functions or constants remain in either file.

## Next Phase Readiness

D-03 is complete across all client files. Plan 03 (midnightReset guard) and Plan 05 (worker-side guard) can proceed — the single-source date module is wired end-to-end on the client.

---
*Phase: 05-timezone-state-persistence-bug-cluster-fix-205-reset-at-midn*
*Completed: 2026-05-29*
