# Plan — remove redundant clues from generated puzzles

Date: 2026-08-08 · Branch: `dev/clue-redundancy`
Brief: [2026-08-08-clue-redundancy-brief.md](2026-08-08-clue-redundancy-brief.md)
(closed 2026-08-08; all 11 sections settled, `da-brief` run with 1 High and 9 Medium fixed,
items 60–62 closed by Dave and Jamie). Issue: [#193](https://github.com/jevawin/clumeral-game/issues/193).

Status: **approved by Jamie, 2026-08-08.** `da-plan` run fresh-context before approval —
1 High, 4 Medium, 9 Low, all resolved (see the review log at the end). Next stage: Build,
starting at Task 1.

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
| `CLAUDE.md` | One **Outstanding actions** entry — the post-merge analytics watch (brief 44) |
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

// Exported. Ranks two out-of-range candidates for the fallback. Pure comparison,
// exported so the ranking is testable without inventing an irredundant 7-clue
// puzzle — see plan-level decision 4.
export function betterFallback(
  candidate: { clues: Clue[] },
  incumbent: { clues: Clue[] } | null,
): boolean

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
    trial = kept with the entry identical to c removed
    if survivorsFor(trial).length === 1:
        kept = trial
return kept
```

**Removal is by object identity, not by index.** `kept` shrinks as clues are dropped, so an
index taken from `clues` stops pointing at the same clue in `kept` the moment one goes. The
loop walks `clues` and filters `kept` on `x !== c`. Getting this wrong is the obvious way to
drop the wrong clue and it would still pass a test that only checks the final length.

The input array is never mutated — every step builds a new array.

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

1. Anything beats no incumbent.
2. An under-range candidate (below `MIN_CLUES`) always beats an over-range one. Above 6 is the
   hard bound; below 4 is a taste judgement (brief 15, 62).
3. Among under-range candidates, more clues wins.
4. Among over-range candidates, fewer clues wins.
5. On a tie, the first one seen is kept — `betterFallback` returns false on equal clue counts.

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

### Fixtures, pinned here so no test is invented at build time

Every count below was verified against all 900 candidates on 2026-08-08. `label` is the exact
string from `PROPERTIES[propKey].label` — note it carries **no value**, the number lives in the
clue's `value` field, and a fixture written with the value glued onto the label is wrong.

**Fixture ONE — the redundancy fixture.** Three clues, answer **323**:

| | propKey | operator | value | label |
|---|---|---|---|---|
| **A** | `sumFT` | `=` | `6` | `The sum of the first and third digits is` |
| **B** | `diffFT` | `=` | `0` | `The difference between the first and third digits is` |
| **C** | `prodAll` | `=` | `18` | `The product of all three digits is` |

Survivors: `[A,B,C]` → 1 (323) · `[B,C]` → 1 · `[A,C]` → 1 · `[A,B]` → 10 · `[C]` → **15**,
including both 323 and 921 · `[B]` → 90 · `[A]` → 60.

So A and B are each individually removable, and removing both leaves 15 valid answers. This is
the da-brief H1 counter-example, and 921 is the number the brief names. `[A,B]` → 10 is what
makes test 7's reversed-order assertion meaningful.

**Fixture TWO — irredundant, 3 clues, under range.** Answer **899**, from seed 1:
`diffST = 0`, `sumFS = 17`, `firstIsSquare = false`. Dropping each in turn leaves 10, 60 and 2
survivors — so nothing is removable, and `trimRedundantClues` returns it unchanged.

**Fixture THREE — irredundant, 4 clues, in range.** Answer **323**, from seed 2:
`diffST = 1`, `sumFT = 6`, `prodFT = 9`, `secondIsPrime = true`. Dropping each in turn leaves
4, 2, 5 and 2 survivors.

Fixtures TWO and THREE are what the stubbed `draw` returns in tests 15 to 19. Fixture ONE's
`[A,B]` pair, with its 10 survivors, is the non-unique clue set test 18 needs.

### Tests (written first)

All clue references below are to fixture ONE unless stated.

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
  assertions are on clue contents, not counts, so they hold (brief 34). **One of them changes
  meaning and the change is deliberate**, see below.

**The Fibonacci reachability guard, honestly.** `tests/puzzle-fibonacci.spec.ts:115-124` asserts
a Fibonacci clue appears somewhere across seeds 1 to 200, and its comment says it exists to
catch a property registered but dropped from `PROPERTY_GROUPS`. Pointed at
`generatePuzzleFromRng` it now guards "reachable *and* survives trimming", which is a slightly
weaker statement about `PROPERTY_GROUPS`. Keeping it on the raw draw would mean exporting
`drawClues` for tests, which is exactly the door brief item 31 asks us to shut, so it moves.
Measured over 300 seeds: the raw draw has a Fibonacci clue in 33 seeds, first at seed 8; after
trimming and retries it is **39 seeds, first at seed 4** — the guard gets stronger, not weaker,
because regeneration draws more often. The seed span widens from 200 to 300 for headroom and
the test's comment is updated to say what it now guards.

`tests/daily-puzzle.spec.ts` is not edited. It exercises the generator through
`generatePuzzle(date)` and its one value-sensitive assertion — two different dates give
different answers — still holds (brief 57). Task 2 is not done until it passes unedited.

### Tests (written first)

Seed sweep, `generatePuzzleFromRng(makeRng(seed))` for seeds 1 to 300 — three assertions in
one pass, which is brief item 48's definition of done. **It is one `it()` block generating each
puzzle once**, and it carries an explicit `{ timeout: 30_000 }`: measured on this machine the
sweep takes about 2.4 seconds and `vitest.config.ts` sets no `testTimeout`, so the default
5 seconds is too close for a slower machine. Test 13 gets the same treatment.

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
14. **Nothing reaches the untrimmed generator.** Scan **every** `.ts` file in `src/worker/`
    except `puzzle.ts` and assert none of them names `drawClues` — comments stripped first.
    Lift the `stripComments` helper and the `readdirSync` scan verbatim from
    `tests/daily-puzzle.spec.ts:197-215`, which already makes this exact argument: scoping a
    guard to the file you happened to be editing is how the next one slips through, and a guard
    that fails because someone wrote the rule down in a comment is worse than no guard. This
    pins brief item 31, which Dave called out as a build requirement (brief 60).

Fallback branch, driven by a stub `draw` (brief 15, 59) — no real seed will ever reach it:

15. A stub that always returns fixture TWO (irredundant, 3 clues, answer 899): the result is
    that puzzle, the stub was called exactly `MAX_ATTEMPTS` times, and `console.warn` fired
    once (`vi.spyOn(console, 'warn')`).
16. **The ranking, tested directly on `betterFallback`** with plain `{ clues: Array(n) }`
    objects, no real clues needed: 3 beats null · 3 beats 2 · 2 does not beat 3 · 3 (under)
    beats 7 (over) · 7 (over) does not beat 3 (under) · 7 beats 8 · 8 does not beat 7 · equal
    lengths do not beat (first seen wins). This replaces stubbing an irredundant 7-clue puzzle,
    which occurs in about 0.1% of puzzles and is not worth hand-building.
17. **A non-unique draw is never published.** A stub always returning fixture ONE's `[A,B]`
    pair, which has 10 survivors: the call throws, and `console.warn` did not fire.
18. **The cap is real.** A stub returning fixture THREE (irredundant, 4 clues, in range) on the
    first call: it is called once, not ten times, and the puzzle comes back with answer 323.
19. **Whatever the stub returns is still trimmed**, so the seam cannot smuggle a redundant
    puzzle past. A stub always returning fixture ONE's `[A,B,C]`: what comes back is `[B,C]`,
    two clues, via the fallback — never the three it was handed. This is the assertion that
    plan-level decision 5 does not weaken brief item 31.

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
  simulation the brief was agreed on. **Expect small disagreements**: the brief's simulation
  and the built code are two implementations of the same idea. Brief item 23 is Dave's
  signed-off judgement on the size of that shift, so **if any of the four moves by more than a
  tenth of its value, it goes back to Dave before the pull request**, rather than being pasted
  in silently. The clue-count spread should match closely — measured here on the real code,
  3,000 seeds: 4 clues 60.5%, 5 clues 34.8%, 6 clues 4.7%, mean 1.45 attempts, worst case 7,
  zero puzzles with a removable clue.
- Retry counts: share passing first time, mean extra attempts, worst case seen.
- Timing, **old against new, side by side on the same machine in the same run** — mean, median,
  99th percentile and worst case, milliseconds per generated puzzle. A bare "new" number cannot
  be judged; a ratio can.

### The processor-time question, and what fails it

This is the one da-brief raised as M6: the free Cloudflare plan gives a Worker invocation 10
milliseconds of processor time, and `handleGuess` re-runs the whole generator for every guess
on a random puzzle. Measured here on 2026-08-08, 3,000 seeds on a Raspberry Pi 5:

| | mean | median | p99 | worst |
|---|---|---|---|---|
| today's generator | 3.6–4.4 ms | 2.9 ms | 14.6–21.0 ms | 22.8 ms |
| the new one | 7.0–7.7 ms | 5.4 ms | 26.5–29.7 ms | 57.7 ms |

So it costs **roughly 1.8 times** today's generator. Two things follow, and both go in the pull
request rather than being left implied.

**The cost is the extra draws, not the sweep.** The new generator draws 1.45 times on average,
and drawing is what is expensive. I tried the obvious optimisation — compute each clue's
satisfying set once as a bit mask and intersect, instead of re-filtering all 900 candidates per
trial — and it made the total *slightly worse*, not better, while agreeing with the simple
version on all 1,500 seeds tested. So `trimRedundantClues` stays as specified in Task 1: the
simple exact form, which brief item 24 asked for. **If this ever does need to get cheaper, the
lever is the retry policy, not the sweep** — that is recorded here so the next person does not
repeat the experiment.

**The stop condition, so this measurement can fail.** If `scripts/puzzle-stats.mjs` reports the
new generator at more than **3 times** today's mean or today's p99 on the same run, the change
goes back to Jamie and Dave before the pull request is opened, not into it. Today's ratio is
about 1.8, so there is real headroom, and a regression that eats it would be a build mistake
worth catching.

**What the number is and is not.** It is wall-clock on a Pi 5, not billed Worker processor
time, and nothing on this machine can produce the latter — workerd under miniflare still runs
on the Pi. The Pi is several times slower than a Cloudflare edge core, so treating the Pi
figure as an upper bound is fair but not a substitute. The real figure becomes observable once
the branch builds to pre-prod, where Workers logs report processor time per invocation; the
pull request says so and names it as the check Jamie can make on the preview. The pull request
will not call the Pi number a Worker measurement.

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
   daily generated under the new rules is **the deploy date plus two** (brief 11). Deploy
   happens on the `staging → main` merge, not on this branch's first pull request, so the
   number is computed with `puzzleNumber()` **when the main pull request is opened** and
   written in as a real number, with the assumption stated in the same sentence. Until then the
   paragraph states the rule and not a number. If the main merge slips past the assumed date,
   the line is corrected before it merges.

Two facts also recorded here so they are not lost, both no-code:

- The archive page's "Clues" column will show a visible step down at the merge date. Nothing
  breaks (brief 55).
- A random puzzle held in a backgrounded tab across the deploy can have its correct guess
  marked wrong, because the token carries only the seed and no version. Accepted; a reload
  fixes it; nothing is persisted (brief 19, 56).

### `CLAUDE.md`

One entry under **Outstanding actions** — the post-merge analytics watch from brief items 44
and 45: watch `incorrect_guess` divided by `puzzle_complete` for a fortnight after the merge,
baseline 0.61, and reopen the 4–6 clue range if it holds at 0.85 or above for a week. It goes
in this branch because `main` is protected and nobody can add it afterwards, and that section
exists precisely for things no test or job will ever remind anyone about.

### Verification before the pull request

- `npm test` — both vitest projects, jsdom and workerd (brief 51).
- `npx tsc --noEmit` (brief 51). That is the whole of brief item 51's "linter": the repo has no
  eslint, only a `.prettierrc` and `npm run lint:migrations`, and the latter does not apply
  because this change adds no migration. Nobody should go hunting for a lint script.
- `node scripts/puzzle-stats.mjs 3000` — output pasted into the pull request body (brief 52),
  after checking it against the stop condition above and against brief item 22's four numbers.
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
   `betterFallback`, `generatePuzzleFromRng`, and the exported constants. Brief item 31 asked
   only that the raw loop stop being exported and that its replacement be named for what it now
   does.
2. **A `Clue` type, exported from `puzzle.ts`.** The same four fields are currently declared
   inline in `puzzle.ts` and again in `StoredPuzzle`. This names them once. Types are Jamie's
   call, hence flagging it.
3. **What happens if no attempt ever produced exactly one survivor: throw.** Brief item 15
   defined the fallback for the case it envisaged — everything came out under range. It did not
   define this one. The alternative is publishing a puzzle with more than one valid answer,
   which is the precise failure this change exists to prevent, and it would be invisible. A
   thrown error is loud and a human can act on it. It needs all 10 attempts to fail a check no
   seed in 3,000 failed even once.

   **The blast radius, so approving this is informed.** A throw is not confined to one guess.
   For a random puzzle it fails that one request and a reload mints a new seed, so it is
   harmless. For a daily it is worse: `generatePuzzle(date)` is seeded from the date, so the
   failure is deterministic for that date — the nightly cron errors on it and the daily read
   returns a 500 until someone intervenes. That is the trade being made: a loud, visible,
   fixable outage on a date, instead of a silent puzzle that tells correct players they are
   wrong. It is unreachable, and if it is ever reached it should be reached loudly.
4. **Ranking over-range candidates by fewest clues** when no under-range candidate was seen,
   and **`betterFallback` exported** so that ranking can be tested on plain objects. Also
   undefined in the brief, also unreachable in practice, and it keeps "never above 6" as the
   strong preference while leaving the function total. Exporting it is what avoids hand-building
   an irredundant 7-clue puzzle, which is 0.1% of the population, purely to drive a test.
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
| 4, 5, 14, 15, 16, 18, 26, 30, 31, 32, 34, 48, 49, 50, 54, 57, 58, 59, 62 | Task 2 |
| 11, 19, 22, 29, 44, 45, 51, 52, 53, 55, 59 | Task 3 |
| 1, 2, 3, 6, 7, 8, 9, 10, 17, 23, 25, 27, 28, 33, 36, 37, 38, 39, 40, 41, 42, 43, 46, 56, 60, 61 | No code — see below |

Item 59 appears twice on purpose: its stubbed fallback test is Task 2, its measured
processor-time figure is Task 3. Items 44 and 45 are the post-merge watch — no product code,
but Task 3 writes the `CLAUDE.md` entry, so they are not "no code".

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
   measurement script and the `CLAUDE.md` entry.

After Task 3: run the verification list, show Jamie the diff, then `da-build` fresh-context,
then push and open the pull request against `staging`.

## Build notes (2026-08-08)

Written during the build so they survive the context clear. Tasks 1–3 are committed;
`da-build` has not run yet.

**One deviation from the plan, and why.** The plan said `scripts/puzzle-stats.mjs` would have
"no side effects beyond printing". It has one: it writes a copy of the baseline `puzzle.ts` to
a temp directory, imports it, and removes it again. The plan asked for old-against-new timing
in the same run, but Task 2 made the old generator private, so there is nothing left to import.
The script therefore reads `puzzle.ts` as it stands on `main` via `git show`. No repo file is
touched and nothing is left behind. This also bought a free correctness check: the baseline
draw is injected into the new generator as `draw`, so the script asserts on every seed that
`drawClues` really is `runFilterLoop` renamed. Zero disagreements over 3,000 seeds.

**Measured, 3,000 seeds, this Pi, 2026-08-08** — `node scripts/puzzle-stats.mjs 3000`:

- Clue counts: 4 clues 60.5%, 5 clues 34.8%, 6 clues 4.7%. Matches the plan exactly.
- Zero puzzles with a removable clue. Zero baseline disagreements.
- Retries: 68.9% accepted first draw, mean 1.45 draws, worst case 7.
- Timing: old mean 4.6 ms / p99 21.6 ms; new mean 8.2 ms / p99 31.3 ms. **1.77× on the mean,
  1.45× on the p99** — well inside the 3× stop condition, which the script now enforces itself
  and exits non-zero on.

**The brief item 22 check: all four numbers are inside the one-tenth tolerance, so this does
not go back to Dave.** Measured against the brief's simulation: distinct answers 812 against
753 predicted (7.8%, the largest of the four); mean answer 511.5 against 514 (0.5%); repeated
digit 27.6% against 30% (8.0%); containing a zero 22.0% against 23% (4.3%). Worth saying out
loud because it runs the reassuring way: the brief predicted the change would *narrow* the
answer pool from 796 to 753, and the built code gives 812 — more variety than today, not less.

**Dave's clue-mix question (asked 2026-08-08, after the build).** He wanted to know whether
dropping redundant clues leans the puzzles towards `=` and "is a prime / square", away from
the `<` and `>` clues that make you reason. `scripts/puzzle-stats.mjs` now reports it, old
against new, over 3,000 puzzles — share of every clue a player sees:

| Clue kind | old | new |
|---|---|---|
| `=` (numeric) | 25.2% | 26.4% |
| `>` | 28.2% | 24.7% |
| `<` | 24.3% | 21.5% |
| "is a prime / square / …" | 15.9% | 20.2% |
| "is not a …" | 5.0% | 5.1% |
| `!=` (numeric) | 1.4% | 2.0% |

So `<` and `>` together fall from 52.5% to 46.2%, and the boolean Specials rise from 20.9% to
25.3%. The lean Dave was worried about is real but small — about six points — and it comes
from the retries, not the sweep: a puzzle that trims below 4 clues is redrawn, and the draws
that survive tend to carry the narrower boolean clues. `=` itself barely moved.

**Dave accepted the six-point shift, 2026-08-08**, after Jamie confirmed the change is cheap to
undo later. Two facts settled that: the clue range and the retry cap are three constants in one
file, so re-widening the range is a one-line change rather than an unpick; and puzzles already
frozen in KV keep whatever generator made them, so the archive will carry a permanent band of
4–6 clue puzzles either way. Nothing breaks. The `CLAUDE.md` watch on the wrong-guess rate is
what would trigger that conversation.

**Still owed before the pull request to `main`:** the first affected puzzle number in
`docs/ARCHITECTURE.md`, which currently reads `TO BE FILLED IN WHEN THE PULL REQUEST TO main IS
OPENED`. It is `puzzleNumber(deploy date + 2)` and cannot be computed until the merge date is
known.

## da-build review — findings and what was done (2026-08-08)

Fresh-context review of the built code against the brief and this plan. It re-derived every
pinned fixture rather than trusting the comments, and swept 45,000 seeds — 20,000 sequential
and 25,004 random 32-bit including 0 and 0xFFFFFFFF. Zero out of range, zero non-unique, zero
with a removable clue, zero fallbacks, zero throws. Brief item 31 confirmed closed: `drawClues`
is unexported, so the compiler enforces it rather than the guard test, and the injectable
`draw` is not a way round it. `PROPERTIES`, `PROPERTY_GROUPS`, the 15–40% band, `EPOCH_DATE`
and `makeRng` are untouched. Nothing from the brief's out-of-scope section was built.

**Medium — fixed**

- **M1 — the test guarding the highest-risk failure could not fail independently, and nothing
  tested the wiring.** "The two answer paths agree" called the generator twice and compared
  answers, which is strictly weaker than the determinism test above it and never touched
  `index.ts` at all. The real risk is not that the generator is non-deterministic; it is that
  the two ROUTES stop pointing at the same generator, and every correct guess on a random
  puzzle then comes back wrong with the suite still green. Replaced with a round trip through
  the actual worker handlers: fetch `GET /api/puzzle/random`, solve the clues the way a player
  must by finding the numbers that satisfy all of them, then `POST /api/guess` with the
  returned token and assert it is accepted — 25 times, plus a wrong-guess check so an endpoint
  that always said "correct" could not pass, plus a contract check on the served clues. The
  handlers need no storage, so a two-field env drives them in the existing test project.
  **Verified by mutation**: pointing `handleGetRandomPuzzle` at a different seed fails the new
  test and leaves all 18 others green. The shipped code was correct; this was coverage.

**Low — all fixed**

- L1 — the fallback can publish a 7-clue puzzle, which the comment read as forbidding. This is
  plan-level decision 4, approved, and needs ten consecutive irredundant draws of 7+ clues
  (~1 in 1e30) — but the comment now says plainly that `MAX_CLUES` is a strong preference on
  that path and not a guarantee, and why throwing was rejected.
- L2, L3 — `scripts/puzzle-stats.mjs` had a shelf life of exactly one merge: its baseline was
  `git merge-base HEAD origin/main`, which stops containing `runFilterLoop` the moment this
  lands. That defeats the stated reason for committing it. The baseline is now pinned to
  `9b4a1ae`, overridable with `CLUMERAL_BASELINE`, with a readable message instead of a stack
  trace when the history is missing, and the temp directory is removed even if the write fails.
- L4 — `docs/notes/restore-early-puzzles.md` told the next person to recompute early puzzles
  with `runFilterLoop`, which is now private AND gives a different answer than the pre-merge
  code — the exact comparison that note exists to make. It now says to use the pinned pre-#193
  generator.
- L5 — the ARCHITECTURE cutover paragraph said "deploy date plus two" without the caveat that a
  generator change also affects any past date never frozen (#235). Caveat added.
- Nits — the unreachable `Math.random` default on `drawClues` removed; the fallback test now
  asserts the warning fired rather than only silencing it.

## da-plan review — findings and what was done (2026-08-08)

Fresh-context review of this file against the brief. It prototyped the proposed algorithm
against the real `src/worker/puzzle.ts` rather than only reading the plan, and confirmed the
clue-count spread (4 clues 60.5% / 5 clues 34.8% / 6 clues 4.7%), zero removable clues, worst
case 7 attempts, the pinned 323 fixture, both drop-order assertions, the one-pass argument, the
four call sites, every line reference, and that Node 22 imports the `.ts` module directly. I
re-measured the timing and the fixtures myself before acting on the findings.

**High — fixed**

- **H1 — the processor-time measurement had no baseline, no threshold and no contingency, and
  the real numbers are worse than the plan implied.** Confirmed: about 1.8× today's generator,
  mean 7.0–7.7 ms and p99 26.5–29.7 ms on this Pi, on the path `handleGuess` re-runs for every
  random-puzzle guess. Fixed four ways: the script now prints old against new in the same run;
  a stop condition sends the change back to Jamie and Dave above 3×; the pre-prod Workers log
  is named as where the real figure appears; and the pull request is barred from calling a Pi
  number a Worker measurement. **The review's suggested lever did not work** — I built the
  mask-and-intersect sweep it proposed and it was slightly *slower*, because the cost is the
  1.45 average draws, not the sweep. That result is recorded in the plan so it is not retried.

**Medium — all fixed**

- M1 — five fallback fixtures were unpinned in a plan that pins fixtures on principle, and the
  irredundant 7-clue one is genuinely hard to build. Fixed: fixtures TWO and THREE pinned and
  verified, the non-unique set reuses fixture ONE's `[A,B]`, and the 7-clue case is replaced by
  testing `betterFallback` directly on plain objects.
- M2 — the stated reason for moving the Fibonacci test was wrong; the guard changes meaning.
  Fixed: the change is now stated plainly with the measured margin, which runs the *right* way
  — 39 seeds in 300 after trimming against 33 before, first hit at seed 4 against seed 8.
- M3 — the invariant scan hardcoded two filenames and matched raw text, regressing a pattern
  `tests/daily-puzzle.spec.ts` already got right. Fixed: it now lifts that file's
  `stripComments` and directory scan and covers every worker module.
- M4 — brief items 44 and 45 were booked as "no code" but need a `CLAUDE.md` edit that no task
  owned, and `main` is protected so it could not be done afterwards. Fixed: Task 3 owns it and
  the file is in the table.

**Low — all fixed**

L1 `[A,B]` → 10 added to the fixture table · L2 fixture labels corrected to the real
`PROPERTIES` strings, which carry no value · L3 traceability table now lists items 7, 8 and 59
· L4 explicit 30-second timeouts on the two slow tests, since the config sets none and the
default is 5 seconds · L5 removal by object identity spelled out · L6 the throw's blast radius
on the daily path written down · L7 the first affected puzzle number is computed at the **main**
pull request, not the staging one, because that is when the deploy happens · L8 the repo has no
JavaScript linter, so brief item 51's "linter" is the type check and the plan says so · L9 a
disposition if the answer-distribution numbers disagree with brief item 22 — more than a tenth
on any of the four goes back to Dave, since item 23 is his signed-off judgement.
