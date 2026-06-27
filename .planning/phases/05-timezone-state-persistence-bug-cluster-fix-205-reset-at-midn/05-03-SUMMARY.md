---
phase: 05
plan: 03
subsystem: worker/api
tags: [bug-fix, date-guard, worker, tdd, timezone]
dependency_graph:
  requires: []
  provides: [isFuturePuzzleDate, worker-tolerant-date-guard]
  affects: [src/worker/index.ts]
tech_stack:
  added: [src/worker/date-guard.ts]
  patterns: [pure-function-extraction, UTC-methods-for-testability, TDD-red-green]
key_files:
  created:
    - src/worker/date-guard.ts
    - tests/worker-guard.spec.ts
  modified:
    - src/worker/index.ts
decisions:
  - "Inlined UTC date logic in date-guard.ts (getUTCFullYear/Month/Date) rather than importing todayLocal() from puzzle.ts — todayLocal uses local-time methods which differ from UTC on BST test machines; UTC methods are functionally identical in production (Cloudflare always UTC) but also correct under vi.setSystemTime() in tests"
  - "/solution guard (date >= todayLocal()) left completely unchanged — today's answer stays protected; tolerance applies only to clue-fetch and guess guards"
metrics:
  duration: ~3 minutes
  completed: 2026-05-29
  tasks_completed: 2
  files_modified: 3
---

# Phase 05 Plan 03: Worker Future-Date Guard (+1 Day Tolerance) Summary

Pure, testable `isFuturePuzzleDate` helper extracted to `src/worker/date-guard.ts` with a +1 calendar day tolerance, fixing the #205 server gate that rejected local-midnight players; the `/solution` guard is untouched.

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | Write failing tests for isFuturePuzzleDate (RED) | 962156e | tests/worker-guard.spec.ts |
| 2 | Create src/worker/date-guard.ts and wire it into index.ts guards (GREEN) | 5779646 | src/worker/date-guard.ts, src/worker/index.ts |

## Verification Results

- `npx vitest run tests/worker-guard.spec.ts`: 6/6 pass (today, past, today+1 accepted; today+2 rejected; month-rollover edge correct)
- `grep -c "isFuturePuzzleDate" src/worker/index.ts`: 3 (1 import + 2 call sites)
- `grep -c "date >= todayLocal" src/worker/index.ts`: 1 (/solution guard preserved)
- `grep -cE "Cannot guess future puzzles|Puzzle not available yet|Solution not available" src/worker/index.ts`: 3 (all error strings intact, no API shape change, D-05)
- `npm run build`: exits 0
- Full `npx vitest run`: only 1 failure (pre-existing router.spec.ts POL-02 beacon failure, documented in PATTERNS.md)

## Decisions Made

1. Used UTC methods (`getUTCFullYear`, `getUTCMonth`, `getUTCDate`) in `date-guard.ts` rather than importing `todayLocal` from `puzzle.ts`. `todayLocal` uses local-time methods that differ from UTC on a BST developer machine — `vi.setSystemTime(new Date('2026-05-31T23:00:00Z'))` would return `2026-06-01` locally (BST) but `2026-05-31` UTC, breaking the month-boundary test. UTC methods produce the correct result in both production (Cloudflare always UTC) and tests.

2. `/solution` guard at `date >= todayLocal()` (status 403) was left completely unchanged, as required by T-05-05 and the plan spec.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Used UTC date methods instead of importing todayLocal()**

- **Found during:** Task 2 GREEN (test run after creating date-guard.ts)
- **Issue:** Month-boundary test `2026-06-02 should be rejected` failed because `todayLocal()` from `puzzle.ts` uses `getFullYear/Month/Date` (local time). On a BST machine with system time `2026-05-31T23:00:00Z`, local time is `2026-06-01` — so `todayLocal()` returned `2026-06-01` instead of `2026-05-31`, making tomorrow `2026-06-02` and causing `2026-06-02 > tomorrowStr` to be `false` instead of `true`.
- **Fix:** Inlined `todayUtcStr()` in `date-guard.ts` using `getUTCFullYear/Month/Date`. Production behaviour is identical (Cloudflare Workers always run UTC), but tests are now correct under `vi.setSystemTime()` regardless of developer machine timezone.
- **Files modified:** `src/worker/date-guard.ts`
- **Commit:** 5779646

## Known Stubs

None — `isFuturePuzzleDate` is fully implemented and tested.

## Threat Flags

No new threat surface introduced. The widening is bounded to +1 day (today+2 rejected), and the `/solution` guard (T-05-05) was explicitly left unchanged.

## TDD Gate Compliance

- RED gate (test commit): 962156e — `test(05-03): add failing tests for isFuturePuzzleDate (RED)`
- GREEN gate (feat commit): 5779646 — `feat(05-03): create date-guard.ts and wire tolerant guard into index.ts (GREEN)`
- Both gates satisfied.

## Self-Check: PASSED

- src/worker/date-guard.ts: FOUND
- tests/worker-guard.spec.ts: FOUND
- Commit 962156e: FOUND
- Commit 5779646: FOUND
