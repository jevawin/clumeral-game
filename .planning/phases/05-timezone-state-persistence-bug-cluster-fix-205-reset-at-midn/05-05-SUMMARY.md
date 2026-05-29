---
phase: 05-timezone-state-persistence-bug-cluster-fix-205-reset-at-midn
plan: "05"
subsystem: persistence-wiring
tags: [app, persistence, storage, tdd, streak, D-06, D-07, D-08]
dependency_graph:
  requires:
    - 05-02 (app.ts already imports from date.ts; todayKey available)
    - 05-04 (saveActive/loadActive/clearActive + ActiveState in storage.ts/types.ts)
  provides:
    - src/app.ts mid-game save/restore/clear hooks wired (D-06, D-07, D-08)
    - tests/completion-stats.spec.ts streak behaviour proven (#209)
  affects: []
tech_stack:
  added: []
  patterns:
    - "buildActiveState() snapshot helper: possibles Set→number[][], guesses copy, activeBox, feedbackKey"
    - "Idempotent restore-from-state: renderAllBoxes/renderHistory/openBox/renderFeedback called after rebuilding state"
    - "Daily-mode gate: !gameState.isRandom guards all three saveActive call sites"
    - "Indirect computeStats testing via renderCompletion + localStorage seed (no private function export)"
key_files:
  created:
    - tests/completion-stats.spec.ts
  modified:
    - src/app.ts
decisions:
  - "computeStats is confirmed correct — no code change to src/completion.ts — verified by 6 new tests covering alive/run/gap/duplicate/DST/empty cases"
  - "buildActiveState() uses gameState.date ?? todayKey() for the date field — for daily puzzles gameState.date is always set; the fallback is a safeguard"
  - "openBox() calls saveActive during restore path (when draft.activeBox !== null) — harmless re-save of identical state, and consistent with the pattern that every activeBox mutation saves state"
  - "Archive-replay date saves are permitted by the isRandom gate (archive replay is not isRandom) but are harmless: loadActive discards any entry whose date !== todayKey(), so a past-date save can never pollute a fresh daily session"
metrics:
  duration: "~15 min"
  completed: "2026-05-30T00:12:00Z"
  tasks: 2
  files: 2
---

# Phase 05 Plan 05: Mid-Game Persistence Wiring + Streak Verification Summary

`saveActive`/`clearActive`/`loadActive` hooked into the three board-mutating actions, solve, and `startDailyPuzzle` restore path; `computeStats` streak logic confirmed correct (local midnight parse, no UTC shift) and proven by 6 new scenario tests covering alive/run/gap/duplicate/BST/empty cases.

## What Was Built

### `src/app.ts` — persistence hooks

Import extended:
```typescript
import type { GameState, ClueData, ActiveState } from './types.ts';
import { loadPrefs, persistPrefs, loadHistory, recordGame, saveActive, loadActive, clearActive } from './storage.ts';
```

New private helper `buildActiveState(): ActiveState` — snapshots `possibles` (Set→array per box), `gameState.guesses`, `activeBox`, and sets `feedbackKey: null` (overridden to `'incorrect'` in the wrong-guess hook).

**Three saveActive hook sites (daily-only, `!gameState.isRandom` gated):**
1. `toggleDigit` — after possibles mutation, before `renderBox`
2. `openBox` — after `activeBox = i`, before `renderAllBoxes`
3. `handleGuess` incorrect branch — after `gameState.guesses.push(guess)`, with `feedbackKey: 'incorrect'`

**clearActive hook:**
- `handleGuess` correct branch — after `recordGame(...)`, before `renderCompletion`/`replaceRoute`

**loadActive + restore in `startDailyPuzzle`:**
- Called AFTER `renderClues(clues)` (Pitfall 2: boxes in DOM before renderers)
- Called AFTER the already-solved `if (entry) {...return;}` block
- On non-null draft: rebuilds `gameState`, `possibles` (array→Set), calls `renderAllBoxes()`, `renderHistory()`, optionally `openBox(draft.activeBox)`, optionally `renderFeedback('incorrect')`
- Returns early to skip fresh-start path
- On null draft: falls through to unchanged fresh-start path

`startRandomPuzzle` and `startReplayPuzzle` bodies are untouched — no `saveActive`/`loadActive` calls (D-08).

### `src/completion.ts` — no code change

`computeStats` inspected and confirmed correct:
- `new Date(entry.date + 'T00:00:00')` — local midnight parse, no Z suffix (Pitfall 1 avoided)
- `Math.round((prevDate.getTime() - d.getTime()) / 86400000)` — dayDiff
- History is newest-first; streak counts from top of history (alive when today unplayed)
- `formatCountdown` uses `setHours(24, 0, 0, 0)` — local midnight (unchanged)

### `tests/completion-stats.spec.ts` — 6 new tests

Indirect testing via `renderCompletion + localStorage seed`. `computeStats` stays module-private.

Streak box is the 3rd stat box (index 2 in `querySelectorAll('div')`).

**Scenario coverage:**
1. Today unplayed, yesterday+day-before played → streak = 2 (alive)
2. Four consecutive days → streak = 4
3. Real 3-day gap after first entry → streak = 1
4. Same-day duplicate → streak ≤ 1 (no inflation)
5. BST entry at 23:30 local → streak = 2 (local midnight parse, no UTC shift)
6. Empty history → streak = 0

## Task Commits

1. **Task 1: Wire saveActive/clearActive/restore into src/app.ts** — `d3f2203`
2. **Task 2: Add streak scenario tests for computeStats** — `3111465`

## Files Created/Modified

- `src/app.ts` — import extension; `buildActiveState()`; 3× `saveActive`, 1× `clearActive`, 1× `loadActive`
- `tests/completion-stats.spec.ts` — 6 streak behaviour tests (new)

## Deviations from Plan

None — plan executed exactly as written.

`computeStats` inspected and verified correct. SUMMARY states: **no code change to completion.ts — verified correct, covered by new tests**.

## Test Results

```
PASS  tests/completion-stats.spec.ts (6 tests, 0 failed)
```

Full suite: 78 tests passing, 1 pre-existing failure (`tests/router.spec.ts` > "navigate(/archive) calls navigator.sendBeacon") — documented in Plan 01, not introduced by this work.

## Acceptance Criteria Verification

- `grep -c "saveActive(" src/app.ts` → 3: PASS
- `grep -c "clearActive()" src/app.ts` → 1: PASS
- `grep -c "loadActive()" src/app.ts` → 1: PASS
- No `saveActive` in `startRandomPuzzle` or `startReplayPuzzle` bodies: PASS (both functions untouched)
- Restore block appears AFTER `renderClues(clues)` within `startDailyPuzzle`: PASS (lines 544–558, renderClues at line 533)
- `npm run build` exits 0: PASS
- `npx vitest run` — no NEW failures vs pre-existing router beacon failure: PASS
- `npx vitest run tests/completion-stats.spec.ts` exits 0: PASS
- `grep -c "T00:00:00Z" src/completion.ts` → 0: PASS
- `grep -c "setHours(24" src/completion.ts` → 1: PASS
- computeStats not modified — SUMMARY states "no code change — verified correct, covered by new tests": PASS

## Threat Model Coverage

| Threat ID | Status |
|-----------|--------|
| T-05-12 (Tampering — restored board state) | Mitigated — loadActive validates shape/version/date before returning; clues re-fetched from API |
| T-05-13 (Info disclosure — persistence leaking to random/archive) | Mitigated — !gameState.isRandom gate on all saveActive sites; startRandomPuzzle/startReplayPuzzle untouched |
| T-05-14 (Repudiation — streak miscount) | Mitigated — computeStats parses local midnight, covered by 6 scenario tests |

## Known Stubs

None.

## Self-Check: PASSED

- `src/app.ts` modified with hooks: FOUND
- `tests/completion-stats.spec.ts` created: FOUND
- Commit `d3f2203` exists (Task 1): FOUND
- Commit `3111465` exists (Task 2): FOUND
- 6 new streak tests green, no new failures in full suite: VERIFIED
- `grep -c "T00:00:00Z" src/completion.ts` → 0: VERIFIED
- `grep -c "setHours(24" src/completion.ts` → 1: VERIFIED
