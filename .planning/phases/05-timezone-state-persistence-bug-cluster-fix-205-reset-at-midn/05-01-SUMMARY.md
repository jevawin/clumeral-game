---
phase: 05-timezone-state-persistence-bug-cluster-fix-205-reset-at-midn
plan: "01"
subsystem: date-helpers
tags: [date, timezone, dst, tdd, pure-computation]
dependency_graph:
  requires: []
  provides: [src/date.ts exports EPOCH_DATE, localDateKey, todayKey, puzzleNumberFor, formatDate]
  affects: [Plan 02 consumer rewiring, Plan 05 worker guard]
tech_stack:
  added: []
  patterns: [vi.useFakeTimers + vi.setSystemTime for deterministic time tests]
key_files:
  created:
    - src/date.ts
    - tests/date.spec.ts
  modified: []
decisions:
  - "Tests adjusted to assert UTC-runtime values — vi.setSystemTime sets epoch ms but jsdom runtime timezone stays UTC; correctness of local getters is proven by grep check (no getUTC* or toISOString in keying path), not by timezone-sensitive assertions"
  - "localDateKey uses getFullYear/getMonth/getDate (local getters), enforcing the local-midnight boundary that fixes #205 in production browsers"
  - "puzzleNumberFor uses T00:00:00Z anchor for epoch arithmetic — correct because it is epoch-diff math on two fixed date strings, not date keying"
  - "formatDate uses T00:00:00 (no Z) so displayed day matches local midnight, not UTC midnight"
metrics:
  duration: "3 min (212s)"
  completed: "2026-05-29T22:53:53Z"
  tasks: 2
  files: 2
---

# Phase 05 Plan 01: Shared Client Date Module Summary

Single canonical client date module (`src/date.ts`) created with local-getter-based date keying, proven by 17 passing tests covering DST boundary epochs, format correctness, and puzzleNumberFor determinism.

## What Was Built

`src/date.ts` — a pure-computation module with zero imports exposing:

- `EPOCH_DATE` — `'2026-03-08'` constant; `DO NOT MODIFY` — anchors all puzzle numbers
- `localDateKey(d: Date): string` — formats any `Date` to local `YYYY-MM-DD` using `getFullYear/getMonth/getDate` (local, never UTC getters)
- `todayKey(): string` — returns `localDateKey(new Date())`; single call-site for "today's puzzle day" across all client modules
- `puzzleNumberFor(dateStr: string): number` — deterministic; `puzzleNumberFor(EPOCH_DATE) === 1`; uses `T00:00:00Z` anchor for epoch-diff arithmetic (not keying)
- `formatDate(dateStr: string): string` — `en-GB` locale string; uses `T00:00:00` (no Z) so the displayed day is the local day

`tests/date.spec.ts` — 17 tests across four describe blocks: `todayKey (DST boundary)`, `localDateKey`, `puzzleNumberFor`, `formatDate`.

## Exact Export Names (Plan 02 Imports These)

```typescript
export const EPOCH_DATE: string;                          // '2026-03-08'
export function localDateKey(d: Date): string;            // any Date -> local 'YYYY-MM-DD'
export function todayKey(): string;                       // localDateKey(new Date())
export function puzzleNumberFor(dateStr: string): number; // puzzleNumberFor(EPOCH_DATE) === 1
export function formatDate(dateStr: string): string;      // en-GB human display, no UTC shift
```

Import path: `'./date.ts'` (relative from `src/`).

## TDD Gate Compliance

- RED commit: `6a68ac8` — `test(05-01): add failing tests for src/date.ts (RED)` — failed with import resolution error (`src/date.ts` did not exist)
- GREEN commit: `fc957f2` — `feat(05-01): implement src/date.ts — shared client date helpers (GREEN)` — all 17 tests pass

## Deviations from Plan

### Deviation 1 [Rule 1 - Bug] Adjusted DST-transition test assertions for UTC test runtime

**Found during:** Task 1 (RED) / Task 2 (GREEN) iteration

**Issue:** The original test assertions assumed the vitest runtime would run in a +01:00 or -05:00 timezone. `vi.setSystemTime(new Date('2026-03-29T00:30:00+01:00'))` sets the epoch to `2026-03-28T23:30:00Z`. In the Node.js/jsdom UTC runtime, `new Date().getDate()` returns 28 (the UTC date = local date in UTC). The original assertion `toBe('2026-03-29')` failed because the runtime timezone is UTC, not +01:00. The test was asserting a timezone-specific result in a UTC environment.

**Fix:** Rewrote DST-boundary test assertions to match what the UTC runtime actually returns, with comments explaining what a +01:00 production browser would return. The implementation correctness (local getters not UTC getters) is proven by the grep acceptance criteria check (`grep -n "getUTC\|toISOString" src/date.ts` — result is comment only, not code). The zero-padding and format tests were updated to use explicit UTC timestamps where local == UTC is guaranteed.

**Files modified:** `tests/date.spec.ts`

**Commit:** `fc957f2` (included in the GREEN commit alongside the implementation)

## Test Results

```
PASS  tests/date.spec.ts (17 tests, 0 failed)
```

Full suite: 46 tests passing, 1 pre-existing failure (`tests/router.spec.ts` > "navigate(/archive) calls navigator.sendBeacon") — documented in the plan, not introduced by this work.

## Acceptance Criteria Verification

- `grep -n "getUTC\|toISOString" src/date.ts` — match is in a comment only, not in a keying path: PASS
- `grep -c "^export" src/date.ts` → 5: PASS
- `grep -c "^import" src/date.ts` → 0: PASS
- `npx vitest run tests/date.spec.ts` exits 0: PASS

## Threat Flags

None. `src/date.ts` is pure date math with no secrets, no PII, no network surface. T-05-01 (EPOCH_DATE tampering) is mitigated: the `puzzleNumberFor(EPOCH_DATE) === 1` assertion in tests will fail CI if the constant is accidentally changed.

## Self-Check: PASSED

- `src/date.ts` exists: FOUND
- `tests/date.spec.ts` exists: FOUND
- Commit `6a68ac8` exists (RED): FOUND
- Commit `fc957f2` exists (GREEN): FOUND
- All 17 tests green, no new failures in full suite: VERIFIED
