---
phase: quick-260608-wyy
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - tests/archive-stats.spec.ts
  - src/types.ts
  - src/storage.ts
  - src/app.ts
  - src/completion.ts
autonomous: true
requirements: [BUGFIX-archive-stats]

must_haves:
  truths:
    - "Solving an archived puzzle (date != today) does not change Played, Avg tries, Streak, or Best streak"
    - "Archived solves are still written to dlng_history (tagged archived: true)"
    - "Archive replay 'already solved' detection still works (reads dlng_history by date)"
    - "Archive list 'Tries' column still works (reads dlng_history by date)"
    - "Old history entries with no archived flag are treated as live daily solves"
  artifacts:
    - path: "tests/archive-stats.spec.ts"
      provides: "Failing-first unit test proving archive solves are excluded from all four daily stats"
    - path: "src/types.ts"
      provides: "HistoryEntry.archived optional flag"
      contains: "archived"
    - path: "src/storage.ts"
      provides: "recordGame archived param; persists archived: true only when true"
      contains: "archived"
    - path: "src/completion.ts"
      provides: "computeStats filters archived entries before computing stats"
      contains: "archived"
    - path: "src/app.ts"
      provides: "isArchiveSolve computed before recordGame and passed as arg"
  key_links:
    - from: "src/app.ts"
      to: "recordGame"
      via: "archive flag argument"
      pattern: "recordGame\\(gameState.date, tries,.*isArchiveSolve"
    - from: "src/completion.ts computeStats"
      to: "history filter"
      via: "exclude archived === true"
      pattern: "archived"
---

<objective>
Fix: solving an ARCHIVED daily puzzle (a puzzle whose date != today) inflates the four daily stats on the completion screen. recordGame writes the archived date into dlng_history exactly like a today solve, and computeStats walks ALL entries — so archive solves fill calendar gaps (inflating Streak / Best streak) and skew Played / Avg tries.

The fix TAGS archive solves with `archived: true` in history and excludes tagged entries from stats — while still recording them, because two features depend on archive entries existing in dlng_history.

Purpose: Daily stats must reflect only live daily play, per the locked user decision (exclude archive solves from ALL FOUR stats).
Output: Tagged history entries; stats filtered; a failing-first unit test that locks the behaviour.

QA scope: Unit tests cover the fix (RED before, GREEN after). A light Playwright check is optional — NOT a full suite. This touches puzzle/stats logic, so DA review + self-review gates are REQUIRED before any PR (per CLAUDE.md). Frontend-only — no worker/API changes.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@./CLAUDE.md

<interfaces>
<!-- Contracts the executor needs. No codebase exploration required. -->

From src/types.ts (current — extend, do not rewrite):
```typescript
export interface HistoryEntry {
  date: string;
  tries: number;
  answer?: number;
}
```

From src/storage.ts (current signature + body — add the param, keep filter/sort):
```typescript
export function recordGame(dateStr: string, tries: number, answer?: number): void {
  const history = loadHistory().filter((h) => h.date !== dateStr);
  history.push({ date: dateStr, tries, ...(answer != null && { answer }) });
  history.sort((a, b) => b.date.localeCompare(a.date));
  localStorage.setItem(STORAGE_HISTORY, JSON.stringify(history));
}
```

From src/completion.ts (computeStats — module-private; first line to change):
```typescript
function computeStats(history: HistoryEntry[]): Stats {
  const played = history.length;         // walks ALL entries — must filter archived FIRST
  // ...avgTries, streak, bestStreak all derive from `history`
}
```

From src/app.ts handleGuess (the write site + the existing isArchiveSolve, which currently sits BELOW recordGame):
```typescript
// line ~678 — current write site (no archive flag):
if (!gameState.isRandom && gameState.date) {
  recordGame(gameState.date, tries, saveScore ? guess : undefined);
}
clearActive();
const isArchiveSolve = !!gameState.date && gameState.date !== todayKey(); // line ~684 — defined AFTER the write
```

CONSTRAINT — these readers depend on archive solves STILL being recorded (do not stop recording, only tag):
- src/app.ts ~line 588 startReplayPuzzle: `loadHistory().find(h => h.date === date)` shows the completed view instead of re-solving.
- src/worker/puzzles.ts ~line 305: client script reads dlng_history to show tries vs a Play button. (Read-only context — NOT modified by this plan.)
</interfaces>

Test harness note: computeStats is module-private. Existing tests (tests/completion-stats.spec.ts) test it INDIRECTLY: seed `dlng_history` in localStorage, call `renderCompletion(num, tries, false)`, then read the rendered stat-box values. Stat box order: index 0 = Played, 1 = Avg tries, 2 = Streak, 3 = Best streak. Match that pattern exactly — do not export the private function.
</context>

<tasks>

<task type="auto">
  <name>Task 1: Write the failing archive-stats test (RED)</name>
  <files>tests/archive-stats.spec.ts</files>
  <action>
Create tests/archive-stats.spec.ts mirroring the harness in tests/completion-stats.spec.ts (same setupDOM, vi.useFakeTimers, vi.resetModules, dynamic `await import('../src/completion.ts')`, and stat-box readers by index).

Add a `describe('archive solves excluded from daily stats')` block with one test seeding a history that mixes live and archived entries across a calendar gap, so all four stats differ depending on whether the archived entry counts:

- Set system time to 2026-06-08T10:00:00.
- Seed dlng_history (newest-first) with:
  - `{ date: '2026-06-08', tries: 2 }`  (live, today)
  - `{ date: '2026-06-07', tries: 10, archived: true }`  (archive solve — fills the gap, high tries)
  - `{ date: '2026-06-06', tries: 4 }`  (live, 2 days ago)
- Call `renderCompletion(42, 2, false)`.
- Assert ALL FOUR stat boxes reflect ONLY the two live entries:
  - Played (box 0) === '2'
  - Avg tries (box 1) === '3.0'   ((2 + 4) / 2)
  - Streak (box 2) === '1'        (today, then a real gap at 06-07 once the archive entry is excluded)
  - Best streak (box 3) === '1'

Rationale to embed as a comment: without the fix the archived 06-07 entry fills the gap and skews every stat — played 3, avg 5.3, streak 3, best 3. This single test pins all four stats at once.

Add a second guard test: seed ONLY live consecutive entries plus one archived entry on a date OUTSIDE the live run; assert Played counts only live entries (proves the filter, not just the gap).

Run the test — it MUST FAIL now (computeStats does not filter archived yet; the `archived` field on HistoryEntry will also be a TS error until Task 2). This is the expected RED state. Do NOT implement the fix in this task.

This is the TDD RED step. Commit message: `test(260608-wyy): add failing test — archive solves must not affect daily stats`.
  </action>
  <verify>
  <automated>npx vitest run tests/archive-stats.spec.ts 2>&1 | grep -Eiq "fail|error" && echo "RED confirmed: test fails as expected" || (echo "UNEXPECTED: test passed before fix — test is not exercising the bug" && exit 1)</automated>
  </verify>
  <done>tests/archive-stats.spec.ts exists, runs, and FAILS (asserts all four stats exclude the archived entry). Failure is the expected RED state.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Tag archive solves and exclude them from stats (GREEN)</name>
  <files>src/types.ts, src/storage.ts, src/app.ts, src/completion.ts</files>
  <behavior>
    - recordGame(date, tries, answer, true) stores `archived: true` on the entry.
    - recordGame(date, tries, answer) (no flag / false) stores NO archived key (entries stay lean; absence === live).
    - computeStats ignores any entry with `archived === true` for Played, Avg tries, Streak, Best streak.
    - Old entries with no archived field count as live (backward compatible).
    - tests/archive-stats.spec.ts passes; tests/completion-stats.spec.ts still passes (no regression).
  </behavior>
  <action>
Apply the four-file fix. Keep each change minimal and surgical.

1. src/types.ts — add `archived?: boolean;` to the HistoryEntry interface (after `answer?`). Comment: backward compatible — absence means a live daily solve.

2. src/storage.ts — change the signature to `recordGame(dateStr: string, tries: number, answer?: number, archived?: boolean): void`. In the pushed entry, conditionally include the flag ONLY when true, matching the existing answer pattern: `...(archived && { archived: true })`. Keep the existing `.filter` (dedupe by date) and `.sort` (date-descending) exactly as-is.

3. src/app.ts — in handleGuess, MOVE the `const isArchiveSolve = !!gameState.date && gameState.date !== todayKey();` line so it is computed BEFORE the recordGame call (currently it sits a few lines below). Then pass it as the new fourth arg: `recordGame(gameState.date, tries, saveScore ? guess : undefined, isArchiveSolve);`. Remove the now-duplicate later declaration (the downstream `if (isArchiveSolve)` branch must still reference the single hoisted const). Do NOT change anything else in the branch — archive solves must still be recorded so startReplayPuzzle and the archive list keep working.

4. src/completion.ts — at the very top of computeStats, before `const played = ...`, filter the input: `const live = history.filter((h) => h.archived !== true);` and compute ALL FOUR stats (played, avgTries, the sorted streak walk, bestStreak, and the recency gate) from `live` instead of `history`. Add a clear comment: archive solves (date != today) are tagged `archived: true` and MUST NOT affect any daily stat — they are recorded only so archive replay and the archive list can detect prior solves. Do not mutate the passed-in array (the existing no-mutation test D must still pass; `filter` already returns a new array).

This is the TDD GREEN step. Commit message: `fix(260608-wyy): exclude archived solves from daily stats; tag archive solves in history`.
  </action>
  <verify>
  <automated>npx vitest run tests/archive-stats.spec.ts tests/completion-stats.spec.ts</automated>
  </verify>
  <done>Both spec files pass. recordGame tags only when archived true; computeStats derives all four stats from live (non-archived) entries; app.ts passes isArchiveSolve hoisted above the call; HistoryEntry has the optional flag.</done>
</task>

</tasks>

<verification>
- `npx vitest run` — full unit suite green (new test + existing completion-stats + no regressions).
- `npx tsc --noEmit` — no type errors from the new HistoryEntry field or the recordGame signature change.
- Manual reasoning check (no code change): startReplayPuzzle (app.ts ~588) and the archive list reader (worker/puzzles.ts ~305) still find archive entries by date — they were never removed, only tagged.
</verification>

<success_criteria>
- Archived solve in dlng_history does not change Played, Avg tries, Streak, or Best streak (proven by Task 1 test going RED→GREEN).
- Archive solves are still recorded (tagged), so replay "already solved" detection and the archive Tries column keep working.
- Old un-tagged entries still count as live daily solves.
- Frontend-only; no worker/API changes.
- DA review + self-review completed before any PR (CLAUDE.md gate — flagged, not optional for puzzle/stats logic).
</success_criteria>

<output>
Create `.planning/quick/260608-wyy-fix-archive-solves-affecting-daily-stats/260608-wyy-SUMMARY.md` when done.
</output>
