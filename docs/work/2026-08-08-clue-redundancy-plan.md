# Plan — remove redundant clues from generated puzzles

Date: 2026-08-08 · Branch: `dev/clue-redundancy`
Brief: [2026-08-08-clue-redundancy-brief.md](2026-08-08-clue-redundancy-brief.md)
(closed 2026-08-08; all 11 sections settled, `da-brief` run with 1 High and 9 Medium fixed,
items 60–62 closed by Dave and Jamie). Issue: [#193](https://github.com/jevawin/clumeral-game/issues/193).

Status: **awaiting Jamie's approval.** `da-plan` not yet run.

---

## What this plan settles

The brief settled *what* and *which observable behaviour*. This settles *how*: the function
names, the module shape, the order of work, and which test proves each behaviour.

No product decision is reopened. Where the brief left a value implicit — a function name, the
behaviour of a corner it did not envisage — it is fixed below and flagged under **Plan-level
decisions**, not treated as a brief change.

## Files touched

| File | Change |
|---|---|
| `src/worker/puzzle.ts` | The whole change: sweep, retry loop, `runFilterLoop` made private |
| `src/worker/index.ts` | 3 call sites renamed (random puzzle, guess, dev answer) |
| `src/worker/daily-puzzle.ts` | 1 call site renamed; `StoredPuzzle.clues` uses the shared `Clue` type |
| `tests/puzzle-redundancy.spec.ts` | New — the sweep, the range, the retry loop, the fallback |
| `tests/puzzle-fibonacci.spec.ts` | Import switched to the new exported name |
| `scripts/puzzle-stats.mjs` | New — the measurement run for brief items 52 and 59 |
| `docs/ARCHITECTURE.md` | Generator contract, first affected puzzle number, `#193` past tense |
| `docs/work/2026-08-08-clue-redundancy-plan.md` | This file |

Nothing else. No `src/app.ts`, no `src/tailwind.css`, no `index.html`, no `migrations/`, no
`wrangler.jsonc`, no new dependency (brief 25, 33, 36, 39).

## Module shape — `src/worker/puzzle.ts`

Everything above `runFilterLoop` is untouched: `PROPERTIES`, `PROPERTY_GROUPS`, `KEEP_MIN`,
`KEEP_MAX`, `applyFilter`, `findGoodClues` (brief 7, 8). The RNG and date helpers below it are
untouched too.

```ts
export interface Clue {
  propKey: string;
  label: string;
  operator: string;
  value: number | boolean;
}

export const MIN_CLUES = 4;      // soft bound — brief 62
export const MAX_CLUES = 6;      // hard bound, the screen cannot lay out more — brief 1.2, 15
export const MAX_ATTEMPTS = 10;  // brief 15, 54

// PRIVATE. Today's runFilterLoop, renamed and no longer exported. Body unchanged.
function drawClues(rng: () => number): { answer: number; clues: Clue[] }

// Exported. Which of the 900 candidates satisfy every clue in the list. Exact, never
// sampled — brief 24. An empty list returns all 900.
export function survivorsFor(clues: Clue[]): number[]

// Exported so tests can drive it directly — brief 35. One clue at a time, earliest
// first, against the clues still remaining — brief 12, 13.
export function trimRedundantClues(clues: Clue[]): Clue[]

// Exported. The generator every caller now uses — brief 30, 31.
export function generatePuzzleFromRng(
  rng: () => number = Math.random,
  draw: (rng: () => number) => { answer: number; clues: Clue[] } = drawClues,
): { answer: number; clues: Clue[] }
```

`runFilterLoop` stops being exported. That is the invariant of brief item 31 — no caller can
reach the untrimmed generator — expressed in the module rather than in a comment.

### `trimRedundantClues`, written out

```
kept = a copy of clues, in the order given
for each clue c in clues, in index order:          // earliest-first, brief 13
    trial = kept without c
    if survivorsFor(trial).length === 1:
        kept = trial
return kept
```

One pass only. Removing a clue can only widen the surviving set, so a clue that was not
removable cannot become removable later (brief 12, and da-brief L2 measured no change over
3,000 puzzles).

It tests against `kept`, not against the original list. That is the correctness rule from
da-brief H1, not a style choice — see the fixture below, where testing against the original
would drop two clues and leave 15 valid answers.

### `generatePuzzleFromRng`, written out

```
fallback = null
repeat MAX_ATTEMPTS times:
    { clues } = draw(rng)                          // continues the same RNG stream, brief 14, 32
    trimmed   = trimRedundantClues(clues)
    survivors = survivorsFor(trimmed)
    if survivors.length !== 1: continue             // brief 58 — the tiebreaker has no post-condition
    if MIN_CLUES <= trimmed.length <= MAX_CLUES:
        return { answer: survivors[0], clues: trimmed }
    if betterFallback(trimmed, fallback): fallback = { answer: survivors[0], clues: trimmed }

if fallback === null: throw new Error(...)          // plan-level decision 3
console.warn(...)                                   // brief 15
return fallback
```

`betterFallback` preference order, so the result is deterministic:

1. An under-range candidate (below `MIN_CLUES`) always beats an over-range one. Above 6 is the
   hard bound; below 4 is a taste judgement (brief 15, 62).
2. Among under-range candidates, more clues wins.
3. Among over-range candidates, fewer clues wins.
4. On a tie, the first one seen is kept.

The warning text names the attempt cap and the clue count published, so a tail log says what
happened without needing the seed:
`clumeral: generator hit the 10-attempt cap, publishing a 3-clue puzzle`.

**Determinism holds** (brief 18, 49). `rng` is threaded through every attempt and holds its
position, so the same seed replays the same draws, the same rejections and the same result.
This is what makes `handleGuess` agree with the puzzle the player was shown.

**No caller changes shape.** `generatePuzzleFromRng` returns `{ answer, clues }`, exactly what
`runFilterLoop` returned, so the four call sites change only the imported name (brief 30, 33).

## Task 1 — the sweep

Brief items: 12, 13, 20, 21, 24, 35, 47.

**Files:** `src/worker/puzzle.ts`, `tests/puzzle-redundancy.spec.ts` (new).

Nothing calls the new code yet, so behaviour is unchanged and every existing test still passes
untouched. That is the point of splitting it out: the sweep is provable on its own.

### The fixture, pinned here so the test is not invented at build time

Three real clues for the answer **323**, verified 2026-08-08 against all 900 candidates:

- **A** — `sumFT` `=` `6` ("The sum of the first and third digits is 6")
- **B** — `diffFT` `=` `0` ("The difference between the first and third digits is 0")
- **C** — `prodAll` `=` `18` ("The product of all three digits is 18")

Survivor counts: `[A,B,C]` → 1 (323) · `[B,C]` → 1 · `[A,C]` → 1 · `[C]` → **15**, including
both 323 and 921 · `[B]` → 90 · `[A]` → 60.

So A and B are each individually removable, and removing both leaves 15 valid answers. This is
the da-brief H1 counter-example, and 921 is the number the brief names.

### Tests (written first)

1. `survivorsFor([])` returns all 900 numbers, 100 to 999.
2. `survivorsFor([A,B,C])` is `[323]`; `survivorsFor([C])` has 15 entries and contains 323
   and 921.
3. **A spare clue goes, and only it.** `trimRedundantClues([A,B,C])` returns `[B,C]`.
4. **The answer is unchanged.** `survivorsFor(trimRedundantClues([A,B,C]))` is `[323]` — same
   single answer as before the trim (brief 20).
5. **Every clue needed means nothing moves.** `trimRedundantClues([B,C])` returns `[B,C]`,
   deep-equal to its input (brief 47).
6. **One at a time, never a batch.** The result of `trimRedundantClues([A,B,C])` has exactly
   one surviving number. A batch implementation returns `[C]` and 15 survivors. The test
   comment names da-brief H1 so nobody "simplifies" it back (brief 12, 21).
7. **The drop order is fixed and it is earliest-first.** `trimRedundantClues([A,B,C])` is
   `[B,C]`; `trimRedundantClues([C,B,A])` is `[C,A]`. Both are correct puzzles, and they are
   different puzzles — which is exactly why the order is pinned, since daily puzzles are frozen
   forever (brief 13).
8. The input array is not mutated: `[A,B,C]` still has three entries afterwards.

## Task 2 — accept, retry, and close the invariant

Brief items: 4, 5, 14, 15, 16, 18, 26, 30, 31, 32, 34, 48, 49, 50, 54, 57, 58, 59, 62.

**Files:** `src/worker/puzzle.ts`, `src/worker/index.ts`, `src/worker/daily-puzzle.ts`,
`tests/puzzle-redundancy.spec.ts`, `tests/puzzle-fibonacci.spec.ts`.

### The edits

- `puzzle.ts`: rename `runFilterLoop` to `drawClues` and drop its `export`; add `MIN_CLUES`,
  `MAX_CLUES`, `MAX_ATTEMPTS`, `Clue`, `generatePuzzleFromRng` and the private
  `betterFallback`. The drawing logic itself is not edited — the main loop, the 15–40% band and
  the tiebreaker pass all keep their current bodies (brief 8).
- `daily-puzzle.ts:29,55`: import and call `generatePuzzleFromRng`. `StoredPuzzle.clues` becomes
  `Clue[]`, imported from `puzzle.ts` — the same shape it already declares inline, named once.
  The stored JSON is byte-for-byte the same shape (brief 26).
- `index.ts:4,96,120,284`: import and call `generatePuzzleFromRng` at all three sites —
  `handleGetRandomPuzzle`, `handleGuess`, and `/api/dev/answer` (brief 30, incl. da-brief M9).
- `tests/puzzle-fibonacci.spec.ts:2,99,120`: import and call `generatePuzzleFromRng`. Its
  assertions are on clue contents, not counts, so they hold (brief 34).

`tests/daily-puzzle.spec.ts` is not edited. It exercises the generator through
`generatePuzzle(date)` and its one value-sensitive assertion — two different dates give
different answers — still holds (brief 57). Task 2 is not done until it passes unedited.

### Tests (written first)

Seed sweep, `generatePuzzleFromRng(makeRng(seed))` for seeds 1 to 300 — three assertions in
one pass, which is brief item 48's definition of done:

9. Every puzzle has between `MIN_CLUES` and `MAX_CLUES` clues (brief 5, 16, 62).
10. Every puzzle has exactly one surviving number, and it equals the returned `answer`
    (brief 21, 58).
11. No single clue can be removed while still leaving one survivor —
    `trimRedundantClues(clues)` returns the same list it was given (brief 48).

Then:

12. **Determinism.** For 50 seeds, two calls with fresh `makeRng(seed)` give deep-equal answers
    and clues (brief 18, 49).
13. **The two answer paths agree.** For 100 seeds, the answer from generation equals the answer
    from re-running the generator on a fresh `makeRng(seed)` — literally what `handleGuess`
    does with a random puzzle's token. This is the brief item 31 failure mode, the one that
    would mark correct guesses wrong, so it gets its own named test (brief 50).
14. **Nothing reaches the untrimmed generator.** Read `src/worker/index.ts` and
    `src/worker/daily-puzzle.ts` from disk and assert neither mentions `runFilterLoop` or
    `drawClues`. Same technique as `tests/token-parity.spec.ts`. This pins brief item 31, which
    Dave called out as a build requirement (brief 60).

Fallback branch, driven by a stub `draw` (brief 15, 59) — no real seed will ever reach it:

15. A stub that always returns an irredundant 3-clue puzzle: the result is that puzzle, the
    stub was called exactly `MAX_ATTEMPTS` times, and `console.warn` fired once
    (`vi.spyOn(console, 'warn')`).
16. **Under-range beats over-range.** A stub returning a 7-clue puzzle first and a 3-clue
    puzzle second, then repeating: the 3-clue one is returned.
17. **More clues wins among under-range.** A stub returning 2-clue then 3-clue puzzles: the
    3-clue one is returned.
18. **A non-unique draw is never published.** A stub always returning a clue set with two
    survivors: the call throws, and `console.warn` did not fire.
19. **The cap is real.** A stub returning an in-range puzzle on the first call: it is called
    once, not ten times.

## Task 3 — measure it, then write it down

Brief items: 11, 19, 22, 29, 51, 52, 53, 55, 59.

**Files:** `scripts/puzzle-stats.mjs` (new), `docs/ARCHITECTURE.md`.

### `scripts/puzzle-stats.mjs`

A standalone Node script, no dependencies, no network, no side effects beyond printing. Node
22 imports `../src/worker/puzzle.ts` directly — verified on this machine 2026-08-08, so no
build step and no new dev dependency.

`node scripts/puzzle-stats.mjs [seeds]`, default 3,000, prints:

- The clue-count spread, as a count and a percentage per length.
- The redundancy check: how many puzzles have any removable clue. Expected zero — a non-zero
  number here is a bug, and the script exits non-zero if it finds one.
- Distinct answers, mean answer, share with a repeated digit, share containing a zero — the
  four numbers brief item 22 measured, so the built thing can be compared against the
  simulation the brief was agreed on.
- Retry counts: share passing first time, mean extra attempts, worst case seen.
- Timing: mean and 99th-percentile milliseconds per generated puzzle.

**On the timing figure, so the pull request does not overclaim it.** This is wall-clock on a
Raspberry Pi 5, not billed Worker processor time. It is a conservative upper bound — the Pi is
slower than a Cloudflare edge machine — and that is what makes it useful against the 10ms free
plan limit da-brief M6 raised. The pull request will say exactly that rather than calling it a
Worker measurement.

### `docs/ARCHITECTURE.md`

Three edits, in the "Puzzle storage & archive integrity" area:

1. A short **generator contract** paragraph: every generated puzzle has 4 to 6 clues, no clue
   in it can be removed while still leaving one answer, and the generator retries up to 10
   times to get there. Names `generatePuzzleFromRng` as the only entry point and says why —
   the guess checker re-runs it from the seed, so a caller reaching a different generator would
   mark correct guesses wrong (brief 31).
2. Line 100: `#193 will add a redundant-clue pass` becomes past tense, naming this change.
3. **The first affected puzzle number** (brief 29 — instead of a marker field in KV, which
   write-once storage could never correct). The cron freezes today and tomorrow, so the first
   daily generated under the new rules is merge date + 2 (brief 11). The concrete number is
   computed with `puzzleNumber()` on the day the pull request is opened and written in as a
   real number, with the merge-date assumption stated in the same sentence. If the merge slips
   past it, the line is corrected before merge.

Two facts also recorded here so they are not lost, both no-code:

- The archive page's "Clues" column will show a visible step down at the merge date. Nothing
  breaks (brief 55).
- A random puzzle held in a backgrounded tab across the deploy can have its correct guess
  marked wrong, because the token carries only the seed and no version. Accepted; a reload
  fixes it; nothing is persisted (brief 19, 56).

### Verification before the pull request

- `npm test` — both vitest projects, jsdom and workerd (brief 51).
- `npx tsc --noEmit` (brief 51).
- `node scripts/puzzle-stats.mjs 3000` — output pasted into the pull request body (brief 52).
- The pull request body also states the consequence Dave and Jamie accepted knowingly: puzzles
  get shorter and therefore harder, 4 clues becoming the commonest case at about 60% where
  today it is 1.3% (brief 17).

**QA level: nothing beyond CI** (brief 53). Chromium smoke on the staging pull request, the
full set on the main pull request. Server-only change, no interface change, and the risk lives
in generation, which the unit tests above cover far better than a browser can. No local
Playwright run — CI runs it across engines this machine cannot.

## Plan-level decisions

Values the brief left implicit. None changes an agreed behaviour; all are named here so
approving the plan approves them.

1. **The names.** `drawClues` (private), `survivorsFor`, `trimRedundantClues`,
   `generatePuzzleFromRng`, and the exported constants. Brief item 31 asked only that the raw
   loop stop being exported and that its replacement be named for what it now does.
2. **A `Clue` type, exported from `puzzle.ts`.** The same four fields are currently declared
   inline in `puzzle.ts` and again in `StoredPuzzle`. This names them once. Types are Jamie's
   call, hence flagging it.
3. **What happens if no attempt ever produced exactly one survivor: throw.** Brief item 15
   defined the fallback for the case it envisaged — everything came out under range. It did not
   define this one. The alternative is publishing a puzzle with more than one valid answer,
   which is the precise failure this change exists to prevent, and it would be invisible. A
   thrown error is loud and a human can act on it. It needs all 10 attempts to fail a check no
   seed in 3,000 failed even once.
4. **Ranking over-range candidates by fewest clues** when no under-range candidate was seen.
   Also undefined in the brief, also unreachable in practice, and it keeps "never above 6" as
   the strong preference while leaving the function total.
5. **An injectable `draw` parameter** on `generatePuzzleFromRng`, defaulting to the private
   `drawClues`. It is the seam that lets the fallback branch be tested at all. It does not
   weaken brief item 31: whatever `draw` returns is still trimmed, still range-checked and
   still uniqueness-checked, so there is no path to an untrimmed puzzle through it.
6. **`scripts/puzzle-stats.mjs` is committed**, not thrown away after the pull request. Brief
   items 52 and 59 both want measurements, and a committed script means the numbers can be
   re-checked later rather than trusted from a pull request body.

## Brief traceability

Every numbered item in the brief, against the task that implements it.

| Brief items | Where |
|---|---|
| 12, 13, 20, 21, 24, 35, 47 | Task 1 |
| 4, 5, 14, 15, 16, 18, 26, 30, 31, 32, 34, 48, 49, 50, 54, 57, 58, 62 | Task 2 |
| 11, 19, 22, 29, 51, 52, 53, 55, 59 | Task 3 |
| 1, 2, 3, 6, 9, 10, 17, 23, 25, 27, 28, 33, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 56, 60, 61 | No code — see below |

**No code needed, and why:**

- **1, 2, 3, 17, 23, 60, 61** — background, rationale and sign-offs. 17 and 23 are consequences
  accepted knowingly; 17 goes in the pull request body.
- **6, 27** — KV is write-once and nothing in this change writes to it differently. Guaranteed
  by not touching the write path.
- **7, 8, 9, 10, 25, 33, 36, 39** — constraints on what must *not* change. Enforced by the
  "Files touched" list: no clue wording, no new clue types, no change to the 15–40% band, no
  layout work, no difficulty tuning, nothing stored in the browser, no API or database change,
  no copy.
- **28, 37** — the client already renders clue rows from the list whatever its length, verified
  in the brief. Fewer rows needs no client change.
- **38** — closed by brief item 61: Jamie confirmed 4-clue puzzles look right.
- **40, 41, 42, 43** — accessibility unchanged. No element is added or removed; only the number
  of rows in an already variable-length labelled list. Brief item 43 settled that no special
  screen-reader pass is needed. Separately, da-brief L7 (`display: contents` on clue rows may
  drop them from the accessibility tree) stays deferred — pre-existing, untouched by this work,
  and worth a spot-check whenever accessibility is next opened.
- **44, 45** — the post-merge watch. `incorrect_guess` divided by `puzzle_complete`, baseline
  0.61, reopen the 4–6 range if it holds at 0.85 or above for a week. Nobody can be reminded of
  this automatically, so it goes in the pull request body and belongs in **Outstanding actions**
  in `CLAUDE.md` at merge time.
- **46** — the `puzzle_start` source label is out of scope and already filed as
  [#306](https://github.com/jevawin/clumeral-game/issues/306).
- **56** — a correction to the brief's sizing of the deploy window, not a change of decision.
  Recorded in `docs/ARCHITECTURE.md` by Task 3.

## Order and commits

One commit per task, tests first inside each.

1. `feat(puzzle): add the redundant-clue sweep` — Task 1. No caller change, no behaviour change.
2. `feat(puzzle): generate 4-6 clue puzzles with no redundant clue` — Task 2. This is the
   commit that changes what players see.
3. `docs(architecture): record the generator contract and the cutover` — Task 3, plus the
   measurement script.

After Task 3: run the verification list, show Jamie the diff, then `da-build` fresh-context,
then push and open the pull request against `staging`.
