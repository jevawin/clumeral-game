---
phase: 03-url-routing
plan: 06
subsystem: completion-screen
tags: [arc-01, arc-02, lnk-01, completion, links]
requires: ['03-01', '03-03']
provides:
  - "renderCompletion(puzzleNum, tries, isRandom, opts?) with RenderCompletionOpts { activeDate?, todayLocal? }"
  - "ARC-02 link-target rules: today/daily/random keep Show puzzle + /archive; archived past dates show only /archive"
  - "Archive anchor href = /archive (renamed from /puzzles)"
affects:
  - src/completion.ts
  - tests/completion-links.spec.ts
tech_stack_added: []
patterns:
  - "Optional opts param with safe default ({}) preserves existing call sites"
  - "vi.resetModules() per test to refresh DOM-cache module state"
key_files_created: []
key_files_modified:
  - src/completion.ts
  - tests/completion-links.spec.ts
decisions:
  - "Extend renderCompletion via opts object rather than overloads — keeps Plan 04's new call site type-safe without forcing every existing caller to pass dates"
  - "Use vi.resetModules() instead of query-string cache-buster for module isolation — Vitest's documented pattern, avoids flaky resolution"
metrics:
  duration_minutes: 8
  tasks_completed: 2
  completed_date: 2026-05-03
---

# Phase 03 Plan 06: Completion screen ARC-02 link rules Summary

renderCompletion is now date-aware: archived past dates hide the Show puzzle link, and the Archive anchor points at /archive everywhere.

## What changed

- `src/completion.ts`
  - New exported `RenderCompletionOpts { activeDate?, todayLocal? }` interface.
  - `renderCompletion` signature gains an optional 4th param `opts: RenderCompletionOpts = {}` — existing 3-arg callers untouched.
  - Inside the `dom.links` block: derive `isArchivedOtherDate = !isRandom && activeDate && todayLocal && activeDate !== todayLocal`. Show puzzle renders only when `!isRandom && !isArchivedOtherDate`. Archive anchor `href = '/archive'` (was `/puzzles`).
- `tests/completion-links.spec.ts`
  - Replaced 3 `it.todo` placeholders with 4 real specs (added the random-puzzle case).
  - Each test sets up the data-completion-* DOM, calls `vi.resetModules()` then dynamic-imports `../src/completion.ts` to pick up the freshly-rendered DOM.

## Verification

| Check | Result |
| --- | --- |
| `npx vitest run` (full suite) | 29/29 passed (resolve-route 11, router 14, completion-links 4) |
| `npm run build` | exits 0 |
| `npx tsc --noEmit` | only pre-existing vite.config.ts node-types errors; no completion.ts/app.ts errors |
| `grep -c "RenderCompletionOpts" src/completion.ts` | 2 (≥ 1) |
| `grep -c "activeDate" src/completion.ts` | 3 (≥ 2) |
| `grep -c "isArchivedOtherDate" src/completion.ts` | 2 (≥ 1) |
| `grep "archive.href = '/archive'" src/completion.ts` | match (≥ 1) |
| `grep -E "href = '/puzzles'" src/completion.ts` | none |
| `grep -c "/puzzles" src/app.ts` | 2 (regex in loadPuzzle + boot-time replayMatch) — bounded |
| `git diff --name-only HEAD~2 HEAD -- src/app.ts` | empty (clean wave-2 file ownership) |
| `! grep "it.todo" tests/completion-links.spec.ts` | none |
| `grep -c "ARC-02:" tests/completion-links.spec.ts` | 4 (≥ 3) |
| `grep -c "vi.resetModules" tests/completion-links.spec.ts` | 1 |

## Commits

| Task | Type | Hash | Message |
| --- | --- | --- | --- |
| 1 | feat | ca86a44 | make renderCompletion date-aware and rename /puzzles → /archive |
| 2 | test | fe5ba1c | replace ARC-02 it.todo placeholders with real assertions |

## Deviations from Plan

**[Rule 3 - Blocking] Installed missing test deps**

- **Found during:** Task 2 verification
- **Issue:** `npx vitest` failed with `Cannot find package 'vitest'` — neither the worktree nor the parent had `node_modules/` populated.
- **Fix:** Ran `npm install` in the parent repo `/Users/jamiepersonal/Developer/clumeral-game` so `vitest`, `jsdom`, and the rest of the dev deps resolved.
- **Files modified:** none (repo's `package.json` and `package-lock.json` unchanged; only the local `node_modules` directory hydrated).
- **Commit:** none — install only.

No other deviations. Plan executed as written.

## File ownership note

This plan touched ONLY `src/completion.ts` and `tests/completion-links.spec.ts`. No edits to `src/app.ts` — Plan 04 owns the `startReplayPuzzle` call-site change that will pass `{ activeDate, todayLocal }` to `renderCompletion`.

## Self-Check: PASSED

- `src/completion.ts` modified — verified via `git show ca86a44 --stat`.
- `tests/completion-links.spec.ts` modified — verified via `git show fe5ba1c --stat`.
- Commit ca86a44 present in `git log`.
- Commit fe5ba1c present in `git log`.
