---
phase: 05-timezone-state-persistence-bug-cluster-fix-205-reset-at-midn
verified: 2026-05-30T00:30:00Z
status: human_needed
score: 5/5 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Confirm saveScore=off still writes {date,tries} to dlng_history on daily solve (WR-02 semantic change)"
    expected: "Product owner accepts that 'don't save my score' now means 'save date+tries but omit the answer'; or decides the preference should suppress even the minimal entry (requiring a different solved-detection mechanism)"
    why_human: "This is a deliberate product contract change — a player opting out of score saving now gets a minimal history entry written. Whether that is acceptable depends on the product owner's intent for the saveScore preference. Code is correct for the chosen semantic; only the semantic itself needs sign-off."
  - test: "Archive replay in progress — toggle a digit, reload page, confirm daily puzzle starts fresh (not restored to the archive replay board state)"
    expected: "dlng_active gets a past-dated entry written during archive replay (because !gameState.isRandom is true for replays), but loadActive discards it (date != todayKey()). The daily puzzle starts fresh, not from archive board state. Verify this causes no observable side effect."
    why_human: "Plan D-08 says archive replays never save; code does save (past-dated) then loadActive discards silently. Functionally harmless per analysis, but the D-08 contract is literally not met. Needs human eye to confirm the discard path works correctly across a real reload in browser."
---

# Phase 05: Timezone + State Persistence Bug Cluster Fix — Verification Report

**Phase Goal:** Establish one canonical client-side "puzzle day" (each user's local midnight, Wordle-style) so all date keying is consistent, then heal three downstream symptoms: the daily puzzle resets at the player's local midnight; mid-game progress survives reload; streak counts consecutive local days without phantom gaps.

**Verified:** 2026-05-30T00:30:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Single client date module `src/date.ts` is sole source of today/puzzle-number; app.ts and welcome.ts import it with no duplicate helpers | VERIFIED | `grep -n "from './date.ts'" src/app.ts` → line 15; welcome.ts → line 7. Zero matches for `function todayLocal`, `function puzzleNumber`, `EPOCH_DATE =` in either file. No `todayLocal(` or `puzzleNumber(` call sites remain. |
| 2 | Worker accepts a local-midnight player's date up to +1 day ahead of UTC, rejects +2; /solution guard untouched; no API shape change | VERIFIED | `isFuturePuzzleDate` in date-guard.ts uses setUTCDate+1 arithmetic; returns false for today+1, true for today+2. index.ts: 3 uses of `isFuturePuzzleDate` (1 import + 2 guard sites). `/solution` guard is `date >= todayLocal()` (line 151) — unchanged. All 3 error strings intact. |
| 3 | Daily puzzle in progress restores on reload — digits, guesses, active box, feedback; clues re-fetched; state clears on solve and day rollover; random/archive never persists | VERIFIED | `loadActive()` at line 544 of app.ts, after `renderClues(clues)` (Pitfall 2 correct). `clearActive()` at line 675 on correct guess. `saveActive` gated by `!gameState.isRandom` at lines 411, 420, 707. `startRandomPuzzle` and `startReplayPuzzle` verified empty of active-state calls. `loadActive` returns null on stale date (tested). |
| 4 | Streak counts consecutive local days; stays alive today-unplayed; breaks on real gap; ignores same-day duplicates | VERIFIED | completion.ts `computeStats`: parses `T00:00:00` (no Z); recency gate at lines 81-88 (WR-01 fix). 8 passing tests in completion-stats.spec.ts cover: alive, consecutive run, real gap, same-day dup, BST entry, empty history, stale run (WR-01 recency = 0), bestStreak. |
| 5 | Restored localStorage state is validated (version, date, shape, size, cell contents) and fails safe — never crashes, never trusts persisted clues | VERIFIED | storage.ts `loadActive`: oversized guard (4096 bytes), v!==1 discard, stale-date discard, possibles shape + cell-content validation (CR-01), guesses range check (100-999), activeBox range 0-2, feedbackKey enum. 36 passing tests in storage-active.spec.ts cover all rejection paths. No clues field in ActiveState. |

**Score:** 5/5 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/date.ts` | Single client date module — EPOCH_DATE, localDateKey, todayKey, puzzleNumberFor, formatDate | VERIFIED | Exists, 52 lines, 5 exports, 0 imports. Uses only local getters (getFullYear/getMonth/getDate). |
| `tests/date.spec.ts` | Unit tests across timezones + DST | VERIFIED | 17 tests, all pass. Covers BST spring-forward, GMT fall-back, UTC, UTC-05, zero-padding, EPOCH_DATE anchor, determinism, formatDate no-Z. |
| `src/worker/date-guard.ts` | Pure worker guard with +1 tolerance | VERIFIED | Exports `isFuturePuzzleDate`, uses UTC methods (getUTCDate), malformed-input fail-safe added (WR-06 fix). |
| `tests/worker-guard.spec.ts` | Accept today/past/+1; reject +2; month-rollover | VERIFIED | 6 tests, all pass. |
| `src/types.ts` | ActiveState interface | VERIFIED | Interface present with all 6 fields: v, date, possibles, guesses, activeBox, feedbackKey. |
| `src/storage.ts` | saveActive / loadActive / clearActive under dlng_active | VERIFIED | 3 exports, todayKey imported, STORAGE_ACTIVE constant, ACTIVE_MAX_LEN = 4096. Full validation chain. |
| `tests/storage-active.spec.ts` | Round-trip, fail-safe, forged-payload tests | VERIFIED | 36 tests, all pass. Covers CR-01/WR-03/WR-04 paths added by review fixer. |
| `src/app.ts` | saveActive hooks + clearActive on solve + restore in startDailyPuzzle | VERIFIED | 3× saveActive (lines 411, 420, 707); 1× clearActive (line 675); 1× loadActive (line 544). Restore after renderClues. daily-only gates in place. |
| `src/completion.ts` | Streak walk correct; countdown local-midnight | VERIFIED | T00:00:00 (no Z) at line 60. setHours(24,0,0,0) at line 98. WR-01 recency gate at lines 81-88. No code change was needed post-inspection. |
| `tests/completion-stats.spec.ts` | Streak scenario tests (#209) | VERIFIED | 8 tests, all pass. Includes WR-01 stale-run recency test. |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/app.ts` | `src/date.ts` | `import { todayKey, puzzleNumberFor, formatDate }` | VERIFIED | Line 15 |
| `src/welcome.ts` | `src/date.ts` | `import { todayKey, puzzleNumberFor, formatDate }` | VERIFIED | Line 7 |
| `src/storage.ts` | `src/date.ts` | `import { todayKey }` — stale-date discard | VERIFIED | Line 5 |
| `src/worker/index.ts` | `src/worker/date-guard.ts` | `import { isFuturePuzzleDate }` — 2 guard sites | VERIFIED | Lines 6, 102, 138 |
| `src/app.ts startDailyPuzzle` | `src/storage.ts loadActive` | restore after renderClues | VERIFIED | Line 544; renderClues at line 533 |
| `src/app.ts handleGuess (correct)` | `src/storage.ts clearActive` | after recordGame | VERIFIED | Line 675 |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|-------------------|--------|
| `src/app.ts startDailyPuzzle` | `draft` from `loadActive()` | `dlng_active` localStorage | Yes — rebuilt from persisted Set arrays | FLOWING |
| `src/completion.ts computeStats` | `history` from `loadHistory()` | `dlng_history` localStorage | Yes — real HistoryEntry array | FLOWING |
| `src/worker/date-guard.ts isFuturePuzzleDate` | `todayUtc` | `new Date()` UTC getters | Yes — real UTC wall clock | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All phase-5 tests pass | `npm test` | 96 passed, 1 pre-existing failure (router.spec.ts POL-02) | PASS |
| Build clean | `npm run build` | Exit 0, no TypeScript errors | PASS |
| No UTC getters in keying path | `grep -n "getUTC\|toISOString" src/date.ts` (non-comment) | Only comment line (line 14) | PASS |
| No duplicate helpers in app.ts | `grep -nE "function todayLocal|function puzzleNumber\b|EPOCH_DATE = " src/app.ts` | No matches | PASS |
| No duplicate helpers in welcome.ts | same pattern on welcome.ts | No matches | PASS |
| /solution guard unchanged | `grep -n "date >= todayLocal" src/worker/index.ts` | Line 151 present | PASS |

---

### Requirements Coverage

No formal REQ-IDs mapped to this phase. Coverage is tracked via CONTEXT decisions D-01..D-08 and issue numbers #205, #206, #209.

| Decision | Description | Status | Evidence |
|----------|-------------|--------|----------|
| D-01 | Client uses local midnight for puzzle-day keying | SATISFIED | `todayKey()` uses `getFullYear/getMonth/getDate` (local getters) |
| D-02 | Single date source on client | SATISFIED | `src/date.ts` — no duplicates remain in app.ts or welcome.ts |
| D-03 | Both app.ts and welcome.ts import from date.ts | SATISFIED | Verified by grep |
| D-04 | Worker tolerates +1 calendar day | SATISFIED | `isFuturePuzzleDate` logic + 6 tests |
| D-05 | No API shape change | SATISFIED | Error strings, routes, puzzle generation all unchanged |
| D-06 | Mid-game state persists across reload | SATISFIED | saveActive/loadActive wired; restore path in startDailyPuzzle |
| D-07 | State clears on solve; stale state discarded on day rollover | SATISFIED | clearActive on solve; date check in loadActive |
| D-08 | Random/archive replays never persist | PARTIAL | random: fully gated via `!gameState.isRandom`. archive replay: `!gameState.isRandom` is true for replays so saveActive IS called, but loadActive discards (past-dated). Literal D-08 contract not met; functionally harmless. |
| #205 | Daily puzzle no longer resets at UTC midnight | SATISFIED | D-01+D-02+D-04 together |
| #206 | Mid-game progress survives reload | SATISFIED | D-06 implemented |
| #209 | Streak counts consecutive local days correctly | SATISFIED | recency gate + local-midnight parse + 8 tests |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/app.ts` | 112 | `buildActiveState()` always sets `feedbackKey: null`; incorrect branch manually overrides to `'incorrect'` | Info | Works correctly — toggleDigit clears feedback before save; only the wrong-guess branch needs 'incorrect'. No functional issue. |

No TBD/FIXME/XXX/TODO markers found in any phase-modified file.

---

### Human Verification Required

#### 1. saveScore=off semantic change (WR-02)

**Test:** With saveScore turned off, solve a daily puzzle. Check localStorage `dlng_history`. Confirm a `{date, tries}` entry is present (no `answer` field). Reload the page. Confirm the puzzle shows as "already solved today."

**Expected:** The reload shows the solved state, not a fresh puzzle. The history entry has `tries` but no `answer`. The completion screen functions correctly.

**Why human:** This is a deliberate product contract change. The `saveScore=false` preference previously meant "write nothing to history." Now it means "write date+tries but omit the answer." Writing `tries` (a performance metric) when the player opted out of score saving may or may not align with the product intent for that preference. The code is correct for the chosen semantic — only the product owner can decide if this new behaviour is acceptable. If it is not, the fix would need a separate solved-detection key instead of reusing the history entry.

#### 2. Archive replay save behaviour (D-08 partial)

**Test:** Start an archive replay puzzle (e.g. via /archive). Eliminate some digits. Open browser devtools → Application → localStorage. Check `dlng_active`.

**Expected (acceptable):** `dlng_active` is either absent or contains a past-dated entry that will be discarded on next daily-puzzle load. Navigating to today's daily puzzle starts fresh (not restored to the archive board).

**Why human:** Plan D-08 says "archive-replay starts never save." In the code, archive replays do trigger `saveActive` because the `!gameState.isRandom` gate does not distinguish archive mode from daily mode. The stale-date guard in `loadActive` discards the entry on restore. A human needs to confirm: (a) the past-dated entry is correctly discarded in a real browser session, and (b) no edge case exists where an archive entry dated "today" (a puzzle the player has already solved before) could interfere with the daily restore.

---

### Gaps Summary

No blocking gaps. All five success criteria are verified in the codebase.

Two items require human confirmation:

1. **WR-02 saveScore semantic** — a daily solve now always writes `{date, tries}` to history even when `saveScore=false`. This prevents the "re-solve bug" (#206) but changes the preference's contract. Product sign-off needed.

2. **D-08 archive replay partial** — archive replays do write to `dlng_active` (past-dated); `loadActive` safely discards them. The D-08 "never save" contract is not literally met, but no functional harm occurs. Needs human validation that the discard path holds in a real browser session.

---

_Verified: 2026-05-30T00:30:00Z_
_Verifier: Claude (gsd-verifier)_
