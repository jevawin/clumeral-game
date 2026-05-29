---
phase: 05-timezone-state-persistence-bug-cluster-fix-205-reset-at-midn
plan: "04"
subsystem: storage
tags: [storage, persistence, security, tdd, active-state]
dependency_graph:
  requires: [05-01 (todayKey from src/date.ts)]
  provides: [ActiveState type, saveActive/loadActive/clearActive under dlng_active]
  affects: [Plan 05 (app.ts wiring — calls saveActive on wrong guess, clearActive on solve, loadActive on restore)]
tech_stack:
  added: []
  patterns: [vi.useFakeTimers + vi.setSystemTime for deterministic stale-date tests]
key_files:
  created:
    - tests/storage-active.spec.ts
  modified:
    - src/types.ts
    - src/storage.ts
decisions:
  - "ACTIVE_MAX_LEN = 4096 — generous ceiling for a sub-200-byte payload; rejects forged oversized strings before JSON.parse"
  - "loadActive embeds the stale-date check (date !== todayKey()) rather than delegating to callers — prevents callers from forgetting the D-07 discard (RESEARCH Pitfall 4)"
  - "loadActive validates activeBox as number|null but does NOT validate feedbackKey type — feedbackKey is a display hint only and cannot corrupt game state; validation kept minimal for fields that matter"
  - "ActiveState has no clues field — clues are re-fetched from the API on restore (D-06 contract); a forged payload cannot alter puzzle clues"
metrics:
  duration: "~10 min"
  completed: "2026-05-30T00:02:00Z"
  tasks: 2
  files: 3
---

# Phase 05 Plan 04: Active-State Storage Layer Summary

Versioned mid-game persistence layer (`ActiveState` type + `saveActive` / `loadActive` / `clearActive`) added to `src/storage.ts` under `dlng_active`, with full defensive validation in the loader and 20 green tests.

## What Was Built

**`src/types.ts`** — new `ActiveState` interface:
- `v: 1` — schema version; loadActive discards on mismatch
- `date: string` — local YYYY-MM-DD; loadActive discards when !== todayKey() (D-07)
- `possibles: number[][]` — per-box remaining digits (Set serialized as arrays)
- `guesses: number[]` — wrong guesses this session
- `activeBox: number | null` — open keypad box
- `feedbackKey: string | null` — last feedback state ("incorrect" | "error" | null)
- No `clues` field — clues re-fetched from API on restore (D-06)

**`src/storage.ts`** — three new exports:
- `STORAGE_ACTIVE = "dlng_active"` — key constant, follows dlng_ convention
- `ACTIVE_MAX_LEN = 4096` — oversized-payload guard cap
- `saveActive(state)` — `JSON.stringify` → `setItem` wrapped in try/catch (quota non-critical)
- `loadActive()` — defensive guard chain: missing → null; oversized → null; JSON.parse in try/catch → null; v !== 1 → null; date !== todayKey() → null; shape invalid → null; else return typed object
- `clearActive()` — `removeItem` in try/catch
- Imports `todayKey` from `./date.ts` (depends on Plan 01)

**`tests/storage-active.spec.ts`** — 20 tests across 7 describe blocks:
- Round-trip: possibles, guesses, activeBox, feedbackKey, empty guesses, no-clues assertion
- Missing → null
- Schema version: v:2 → null; no v field → null
- Stale date (D-07): yesterday → null; today → non-null
- Garbage/non-JSON: does not throw, returns null
- Wrong shape: missing possibles, non-array possibles, length≠3, non-array guesses, string activeBox
- Oversized: 5000-byte string → null
- clearActive: removes key; no-throw on empty

## Exact Export Names (Plan 05 Imports These)

```typescript
export interface ActiveState {
  v: 1;
  date: string;
  possibles: number[][];
  guesses: number[];
  activeBox: number | null;
  feedbackKey: string | null;
}

export function saveActive(state: ActiveState): void;
export function loadActive(): ActiveState | null;
export function clearActive(): void;
```

Key: `"dlng_active"`. Max-length cap: `4096` bytes.

Import path from `src/`: `'./storage.ts'`. Import path from `src/`: `'./types.ts'`.

## TDD Gate Compliance

- RED commit: `db24b93` — `test(05-04): add failing tests for saveActive/loadActive/clearActive (RED)` — all 20 tests failed (import resolution error — functions not exported)
- GREEN commit: `3c31659` — `feat(05-04): implement saveActive/loadActive/clearActive in storage.ts (GREEN)` — all 20 tests pass

## Deviations from Plan

None — plan executed exactly as written.

## Test Results

```
PASS  tests/storage-active.spec.ts (20 tests, 0 failed)
```

Full suite: 72 tests passing, 1 pre-existing failure (`tests/router.spec.ts` > "navigate(/archive) calls navigator.sendBeacon") — documented in the plan, not introduced by this work.

## Acceptance Criteria Verification

- `grep -c "export interface ActiveState" src/types.ts` → 1: PASS
- `grep -cE "v: 1|feedbackKey" src/types.ts` → 2: PASS
- `grep -c "dlng_active" src/storage.ts` → 2: PASS
- `grep -cE "export function (saveActive|loadActive|clearActive)" src/storage.ts` → 3: PASS
- `grep -c "todayKey" src/storage.ts` → 2: PASS
- `npx vitest run tests/storage-active.spec.ts` exits 0: PASS
- `npm run build` exits 0: PASS
- loadActive never throws on garbage input (non-JSON and oversized tests pass): PASS

## Threat Model Coverage

All four threats in the plan's STRIDE register are mitigated:

| Threat ID | Status |
|-----------|--------|
| T-05-08 (Tampering — forged payload) | Mitigated — v, date, possibles length, guesses type, activeBox type all validated |
| T-05-09 (DoS — oversized payload) | Mitigated — raw.length > 4096 returns null before JSON.parse |
| T-05-10 (Spoofing — forged clues) | Mitigated — ActiveState has no clues field; clues re-fetched from API |
| T-05-11 (Info disclosure — stale state) | Mitigated — date !== todayKey() returns null |

## Known Stubs

None — all three functions are fully implemented. Plan 05 wires them into app.ts.

## Self-Check: PASSED

- `src/types.ts` modified (ActiveState added): FOUND
- `src/storage.ts` modified (saveActive/loadActive/clearActive added): FOUND
- `tests/storage-active.spec.ts` created: FOUND
- Commit `339b575` exists (Task 1 types): FOUND
- Commit `db24b93` exists (RED): FOUND
- Commit `3c31659` exists (GREEN): FOUND
- All 20 tests green, no new failures in full suite: VERIFIED
