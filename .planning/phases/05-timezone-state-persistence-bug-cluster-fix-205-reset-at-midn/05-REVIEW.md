---
phase: 05-timezone-state-persistence-bug-cluster-fix-205-reset-at-midn
reviewed: 2026-05-30T00:00:00Z
depth: standard
files_reviewed: 11
files_reviewed_list:
  - src/date.ts
  - src/worker/date-guard.ts
  - src/worker/index.ts
  - src/app.ts
  - src/welcome.ts
  - src/storage.ts
  - src/types.ts
  - tests/date.spec.ts
  - tests/worker-guard.spec.ts
  - tests/storage-active.spec.ts
  - tests/completion-stats.spec.ts
findings:
  critical: 1
  warning: 6
  info: 4
  total: 11
status: fixed
---

# Phase 5: Code Review Report

**Reviewed:** 2026-05-30
**Depth:** standard
**Files Reviewed:** 11
**Status:** issues_found

## Summary

This phase fixes a timezone/state-persistence bug cluster: #205 (reset-at-midnight),
#206 (mid-game persistence), #209 (streak counting). I reviewed date keying, the
`dlng_active` localStorage loader, the widened worker future-puzzle guard, and the
streak logic.

The date helpers are correct and well-tested. The worker guard widening is sound and
does not leak future answers. The `loadActive` validator is solid against the cases its
tests cover, but has a real validation gap that lets forged data reach the game board.
The streak logic has a correctness defect for the "current streak" semantic that the
tests do not exercise. One stranding edge in `handleGuess` can leave a solved daily
puzzle with no persisted history entry.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: `loadActive` does not validate `possibles` cell contents — forged digits reach the game board

**File:** `src/storage.ts:73` and consumer `src/app.ts:548`
**Issue:** `loadActive` checks that `possibles` is a length-3 array of arrays, but never
validates the contents of each inner array. A crafted `dlng_active` value passes every
guard and is returned to the app:

```json
{"v":1,"date":"<today>","possibles":[[],[5,5,5],["x",999]],"guesses":[1,2],"activeBox":0,"feedbackKey":null}
```

`startDailyPuzzle` then does `possibles = draft.possibles.map((arr) => new Set(arr))`
(app.ts:548) with zero further validation. Concrete failure modes:

- **Empty inner array** → `new Set([])` has `size === 0`. `renderBox` reads `[...s][0]`
  as `undefined`; `checkSubmit` (`s.size === 1`) is false forever, so the box can never
  resolve and the puzzle becomes unsubmittable until a hard reset. This is a self-inflicted
  soft-lock, but it is driven by attacker-controllable storage and bypasses the stated
  "validates every field before returning anything to the app" contract (storage.ts:44-45).
- **Non-digit / out-of-range values** (`"x"`, `999`, `-1`, floats) flow straight into the
  rendered keypad and into the submitted guess string. `handleGuess` builds the guess via
  `possibles.map((s) => [...s][0]).join("")` (app.ts:620) with no client validation; a
  forged single-element set of `42` yields a 5-char guess string. The worker rejects it
  (range check at index.ts:83), so this is not a server exploit, but it defeats the
  validator's documented purpose and produces broken UI/feedback paths.
- **Hundreds box containing 0** violates the "no zero in hundreds" invariant
  (app.ts:87) that every other code path enforces.

The module comment and tests (T-05-08/09/11) claim full field validation, but content
validation was omitted. The guard is shallow.

**Fix:** Validate every cell after the shape check, before returning:
```typescript
// Each box must be a non-empty array of integer digits 0–9; box 0 forbids 0.
const digitsOk = d.possibles.every((arr, i) =>
  Array.isArray(arr) &&
  arr.length >= 1 &&
  arr.every((n) => Number.isInteger(n) && n >= 0 && n <= 9 && !(i === 0 && n === 0))
);
if (!digitsOk) return null;

// guesses must be integers in the valid puzzle range.
if (!d.guesses.every((g) => Number.isInteger(g) && g >= 100 && g <= 999)) return null;

// feedbackKey is part of the schema — validate it too.
if (d.feedbackKey !== null && d.feedbackKey !== 'incorrect' && d.feedbackKey !== 'error') return null;
```

## Warnings

### WR-01: Streak counts a stale leading run as the "current streak" (#209 regression risk)

**File:** `src/completion.ts:45-78`
**Issue:** `computeStats` derives `streak` as the leading consecutive run from the top of
`history`, and never compares the most recent entry to today (or yesterday). The
intentional #209 fix keeps the streak alive when today is unplayed but yesterday was
played. But the same logic also reports a live streak for a run that ended long ago.

Example: today is 2026-05-30, history is `[2026-05-20, 2026-05-19, 2026-05-18]`. The
player has not played in 10 days, yet `streak` returns 3. The "current streak" stat is
then wrong on the completion screen. The test suite only covers today- or
yesterday-anchored histories (completion-stats.spec.ts), so this gap is untested.

**Fix:** Gate the current streak on recency. Only treat the leading run as current when
its first entry is today or yesterday:
```typescript
const todayKeyStr = todayKey(); // import from date.ts
const mostRecent = history[0]?.date;
const recent = mostRecent === todayKeyStr || mostRecent === yesterdayKey(todayKeyStr);
return { played, avgTries, streak: recent ? streak : 0, bestStreak };
```

### WR-02: `recordGame` write is skipped on a solved daily puzzle when `saveScore` is off, but `clearActive` still runs — solved state lost on reload

**File:** `src/app.ts:667-671`
**Issue:** On a correct daily guess, `recordGame` only runs when
`!gameState.isRandom && saveScore && gameState.date` (app.ts:667). Immediately after,
`clearActive()` runs unconditionally (app.ts:671). If the player has `saveScore` off,
no history entry is written and the mid-game draft is cleared. On reload, `todayEntry()`
returns null and `loadActive()` returns null, so the solved puzzle restarts from scratch
— the player can re-solve and the "already solved today" state is gone. This is a
data-loss-of-progress bug driven by a normal user setting, not an attack.

**Fix:** Persist a minimal solved marker even when `saveScore` is off, or keep the
active draft (with a solved flag) until a history entry exists. At minimum, document
that "don't save my score" intentionally discards completion state, and confirm the
product owner wants reload to re-offer the puzzle.

### WR-03: `feedbackKey` declared in schema but never validated by `loadActive`

**File:** `src/storage.ts:55-81`, `src/types.ts:35`
**Issue:** `ActiveState.feedbackKey` is `string | null` with documented values
`"incorrect" | "error" | null`. `loadActive` validates `v`, `date`, `possibles`,
`guesses`, and `activeBox`, but never `feedbackKey`. A forged value (`feedbackKey: 123`
or an arbitrary string) is returned. The consumer only checks `=== 'incorrect'`
(app.ts:553), so impact is low today, but the validator's stated contract ("validates
every field") is not met, and a future consumer that trusts the field inherits the gap.

**Fix:** Add the `feedbackKey` check shown in CR-01.

### WR-04: `loadActive` accepts `activeBox` outside 0–2

**File:** `src/storage.ts:79`, consumer `src/app.ts:552`
**Issue:** The guard accepts any `number` for `activeBox` (`typeof d.activeBox !== 'number'`).
A forged `activeBox: 5` passes. `startDailyPuzzle` then calls `openBox(5)` (app.ts:552),
which sets `activeBox = 5` and calls `buildKeypad`, which dereferences
`possibles[activeBox]` (app.ts:369) → `possibles[5]` is `undefined` →
`undefined.has(d)` throws. The surrounding code has no try/catch on this path, so the
restore throws and the board renders incompletely.

**Fix:** Tighten the guard:
```typescript
if (d.activeBox !== null && !(Number.isInteger(d.activeBox) && d.activeBox >= 0 && d.activeBox <= 2)) return null;
```

### WR-05: `puzzleDate` round-trip can drift in negative-UTC contexts — affects archive replay keying

**File:** `src/worker/puzzle.ts:200-204`, consumer `src/app.ts:942`
**Issue:** `puzzleDate(num)` builds the date from epoch + `(num-1)*86400000` ms and then
reads it back with `getUTCFullYear/Month/Date`. The client computes the puzzle number
from a LOCAL date key (`puzzleNumberFor`, app.ts:942) but the worker maps numbers back to
dates using UTC. The comment in date-guard.ts notes Workers always run UTC in production,
so this is benign in prod. But `puzzleNumberFor` (date.ts:35) and `puzzleNumber`
(puzzle.ts:195) anchor at `T00:00:00Z` while `todayKey`/`todayLocal` use local getters.
A player in UTC+14 at local-midnight has a local date one day ahead of UTC; their
`puzzleNumberFor(localToday)` can exceed the worker's `puzzleNumber(todayLocal())` by 1,
and `/api/puzzle/:num` for that number maps (via `puzzleDate`) to a date the worker now
allows only because of the +1 tolerance (WR adjacent). The number↔date mapping is
consistent (both UTC-anchored), so this does not corrupt data, but the local/UTC mix
across `puzzleNumberFor` (Z-anchored math) and `todayKey` (local) is fragile and
undocumented at the call site. Confirm the +1 worker tolerance fully covers this.

**Fix:** Add a code comment at app.ts:942 explaining that `num` is computed from a local
date but resolved against UTC-anchored worker mapping, and that the worker's +1 tolerance
is what makes the UTC+14 case work. No logic change required if the tolerance is verified
sufficient.

### WR-06: `isFuturePuzzleDate` accepts malformed date strings via string comparison

**File:** `src/worker/date-guard.ts:27-34`
**Issue:** The guard compares `date <= todayUtc` and `date > tomorrowStr` as plain string
comparisons. It assumes a well-formed `YYYY-MM-DD`. In `handleGuess` the format is
validated by regex first (index.ts:99), so guess is safe. But `/api/puzzle/:num` and the
`/puzzles/<num>` redirect call `puzzleDate(num)` then `isFuturePuzzleDate(date)`
(index.ts:137-138) without re-validating the produced string — fine, since `puzzleDate`
always returns a valid shape. The risk is future callers that pass an unvalidated string;
a value like `"2026-5-9"` or `"2026-05-30X"` would compare lexically and could pass or
fail unpredictably. The guard trusts its input shape implicitly.

**Fix:** Either document the precondition ("`date` MUST be a regex-validated YYYY-MM-DD")
in the function header, or add a cheap shape assertion that returns `true` (reject) on
malformed input:
```typescript
if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return true;
```

## Info

### IN-01: `loadActive` validation is duplicated logic that belongs to a shared validator

**File:** `src/storage.ts:55-85`, `src/app.ts:548`
**Issue:** The board invariants (3 boxes, digits 0–9, no 0 in hundreds, guesses 100–999)
are defined in `initPossibles` (app.ts:85) and re-implied across renderers, but the
loader hand-rolls a partial subset. Centralising the invariant would prevent the CR-01
gap from recurring.
**Fix:** Extract an `isValidActiveState(d): d is ActiveState` predicate shared by tests
and loader.

### IN-02: `as any` on the fetched puzzle response defeats type checking

**File:** `src/app.ts:729`
**Issue:** `const data = await res.json() as any;` drops all type safety on the API
contract boundary. `data.clues`, `data.token`, `data.date`, `data.puzzleNumber` are then
read untyped.
**Fix:** Type the response shape: `as { date?: string; puzzleNumber?: number; clues: ClueData[]; token?: string; isRandom?: boolean }`.

### IN-03: `(popover as any)._cleanup` stores a function on a DOM node via `any`

**File:** `src/app.ts:212, 221`
**Issue:** Attaching `_cleanup` through an `any` cast bypasses the type system and is a
fragile pattern. A `WeakMap<Element, () => void>` is type-safe and avoids leaking a
property onto the element.
**Fix:** Replace the `any` cast with a module-scoped `WeakMap` keyed by the popover.

### IN-04: `localDateKey` and worker `todayLocal` duplicate identical date-formatting logic

**File:** `src/date.ts:17-19`, `src/worker/puzzle.ts:184-187`
**Issue:** Both format `YYYY-MM-DD` from local getters with the same padStart logic. The
strict client/worker boundary (no cross-import, date.ts:1) justifies the duplication, but
the two must stay byte-identical or keying diverges. There is no test asserting they
agree.
**Fix:** Add a comment in each pointing at the other as the mirror, or a cross-boundary
contract test that asserts identical output for a fixed input.

---

_Reviewed: 2026-05-30_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
