# Plan — widen the AE/D1 comparison to every event, and record the 2026-08-04 delta

Date: 2026-08-07 · Branch: `dev/analytics-compare-all-events`
Brief: [2026-08-06-analytics-compare-all-events-brief.md](2026-08-06-analytics-compare-all-events-brief.md)
(closed 2026-08-07; all five short-form sections settled by Jamie, Dave's acks waived by
dev-lead override, `da-brief` findings 70–88 all resolved).

Status: **awaiting Jamie's approval.** No build work starts until he approves.

---

## What this plan settles

The brief settled *what* and *which observable behaviour*. This settles *how*: the exported
function names, the query shapes, the order of work, and which test proves each behaviour.

No product decision is reopened here. Where the brief left a value implicit — a function
name, an origin label for a cell D1 has no rows in — it is fixed below and flagged as a
**plan-level decision**, not a brief change.

## Files touched

| File | Change |
|---|---|
| `scripts/compare-ae-d1.mjs` | Rewritten: side-effect free on import, per-(day, event) cells, row counts, new output |
| `tests/compare-ae-d1.spec.ts` | New — pure logic only, no network, no wrangler |
| `docs/ANALYTICS.md` | Gate description, the 2026-08-04 record, the in-band pair, the rewind warning, the PR 3 checklist |
| `docs/work/2026-08-07-…-plan.md` | This file |

Nothing else. No `src/`, no `wrangler.jsonc`, no `migrations/`, no `.env`, no new dependency
(brief 8, 48, 49).

## Module shape

`scripts/compare-ae-d1.mjs` becomes: **named exports of pure functions, plus a `main()` that
does every side effect, behind the repo's main-guard.** The spec imports only the pure
functions (brief 74, 75).

```js
// Pure — exported, unit tested, no I/O.
export function parseArgs(argv)                  // -> { days, host, event, verbose }
export function withinTolerance(ae, d1)          // Math.max(3, ae * 0.01) — SOLE home of the arithmetic
export function judgeCell(cell)                  // -> 'exact' | 'in-band' | 'zero-side' | 'out-of-tolerance'
export function describeDelta(cell)              // -> human string naming rows vs weighting
export function cellOrigin(cell)                 // -> 'backfilled' | 'live' | 'mixed' | 'unknown'
export function buildCells(aeRows, d1Rows)       // union of (day, event); drops both-zero cells
export function summarise(cells, today)          // -> the object literal below; enriches each cell
export function formatCellLine(cell)             // the item-82 line; takes an ENRICHED cell
export function formatReport(summary, { verbose })

// Impure — not exported, called only from main().
function loadEnv()
async function fromAE(opts)
function fromD1(opts)
async function main(argv)
```

**`judgeCell` calls `withinTolerance`.** `Math.max(3, ae * 0.01)` appears in exactly one place
in the file. Two copies is how the ±3 floor ends up applied on one path and not the other.

**The cell object**, fixed here so the tests and the queries agree:

```js
// As built by buildCells:
{ day: '2026-08-04', event: 'incorrect_guess',
  aeRows: 18, aeWeighted: 27,
  d1Rows: 18, d1Weighted: 18, d1Backfilled: 18,
  origin: 'backfilled', delta: -9 }          // delta = d1Weighted - aeWeighted, as today

// summarise() ENRICHES each cell in place with two more fields, and
// formatCellLine requires an enriched cell:
{ …, skipped: false, verdict: 'out-of-tolerance' }
```

`delta` is `d1Weighted - aeWeighted`, keeping today's sign convention
(`compare-ae-d1.mjs:143`) — D1 short of AE is negative.

`cellOrigin` reads `d1Backfilled` against `d1Rows`: all backfilled → `backfilled`, none →
`live`, some → `mixed`. **Plan-level decision:** `d1Rows === 0` gives `unknown`, printed as
`—`. The brief (72) named three labels and did not cover the case where D1 has no rows to
label; inventing `live` there would assert something we did not measure.

**`summarise(cells, today)` returns exactly this:**

```js
{
  cells,                        // the same array, each cell enriched with skipped + verdict
  perEvent: [                   // one entry per event, sorted by name
    { event: 'incorrect_guess', days: 38, worstDelta: -9, verdict: 'FAIL' },
  ],
  failures: [ …cells… ],        // every non-skipped cell with verdict zero-side | out-of-tolerance
  inBand:   [ …cells… ],        // every non-skipped cell with verdict in-band
  skipped:  [ …cells… ],        // every cell with day >= today
  oldestDay: '2026-06-28',      // cells[0].day — the retention-note condition reads this
  exitCode: 0,                  // 1 if failures.length > 0, else 0
}
```

`failures`, `inBand` and `skipped` are **lists of cells, not counters** — brief 28 requires the
in-band reminder to name the event as well as the day, which a count cannot do. Today's script
uses integer counters (`compare-ae-d1.mjs:132–133`); they go.

`worstDelta` is the delta with the **largest absolute value**, printed with its sign. Across a
mix of +2 and −5, −5 is the worst.

## Task list

Each task is a commit. Tests are written before the implementation within each task
(CLAUDE.md, test-driven-development).

**Where `main()` moves, stated once so no task has to infer it.** Task 1 lifts today's
module-scope loop (`compare-ae-d1.mjs:127–179`) into `main()` **unchanged** — same single
event, same per-day output. **Tasks 2, 3 and 4 add exported pure functions and their tests
only; they do not touch `main()`, which stays on the old path and keeps working.** Task 5 is
the rewire: it replaces the body of `main()` with `fromAE`/`fromD1` → `buildCells` →
`summarise` → `formatReport`, and the old loop is deleted there. Every commit therefore leaves
a script that runs; the exported functions are simply unreferenced by `main()` until Task 5.

---

### Task 1 — make the module importable without running anything

**Implements:** brief 51, 74, 75, 76 (M1), 67, 53.

The script currently calls `process.exit(1)` at module scope (`compare-ae-d1.mjs:45–54`) when
no token is found. `ci-smoke.yml` runs `npm test` on every PR into `staging` and `main` with
no `.env`, so an unguarded import kills the vitest process during collection and turns a
required check red. Nothing else in this plan is safe to write until this is done.

1. **Test first** — `tests/compare-ae-d1.spec.ts`, one case: a static
   `import { withinTolerance } from '../scripts/compare-ae-d1.mjs'` at the top of the spec,
   asserting it is a function. That vitest collects the file at all is the assertion. Note
   that deleting `process.env` keys inside a test body would be decorative — ESM imports are
   hoisted, so module evaluation has already happened by then.
2. Move argv parsing into `parseArgs(argv)`, and `loadEnv()`, the token check, both queries,
   every `console.log` and every `process.exit` into `async function main(argv)`.
3. `main()` returns an exit code; the guard sets `process.exitCode`. No `process.exit` on a
   path an import can reach.
4. The guard is **copied verbatim** from `scripts/lint-migrations.mjs:116` — not re-derived:

   ```js
   if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
   ```

   with `import { realpathSync } from 'node:fs'` and `import { pathToFileURL } from 'node:url'`.
   The three-part comment at `lint-migrations.mjs:104–115` explains why each part is load-bearing;
   this file gets a one-line comment pointing at it rather than a copy of the essay.

**Done when:** this command prints `function` —

```bash
node -e "import('./scripts/compare-ae-d1.mjs').then(m => console.log(typeof m.withinTolerance))"
```

**Do not test this by moving `.env`.** It holds the only copy of Jamie's Analytics Read token,
and `loadEnv` reads it off disk (`compare-ae-d1.mjs:32–43`) before the token check — so on the
Pi the token is always found and the module-scope `process.exit(1)` never fires. A spec that
merely deletes the env vars would therefore pass against the *un-refactored* module locally and
only fail in CI, which is the exact regression it exists to pre-empt. The `node -e` form proves
side-effect-free import without touching `.env`, and it exercises the `process.argv[1] &&` limb
of the copied guard for free: `argv[1]` is undefined under `node -e`, which brief item 76
records as having failed open before.

Also done when `node scripts/compare-ae-d1.mjs` still behaves exactly as it does today (single
event, per-day) — this task is a refactor with no behaviour change.

---

### Task 2 — the verdict, over weighted sums only

**Implements:** brief 21, 22, 71, 73, 54, 55, 85 (L3), 86.

`judgeCell` is the whole gate. It reads **only** `aeWeighted` and `d1Weighted`. Row counts are
diagnostic and can never fail a run (brief 71) — this is the single most important line in the
plan, because item 38 as originally written would have failed the gate permanently on correct
live-day data (brief 70).

```
zero-side          one of aeWeighted/d1Weighted is 0 and the other is not   -> FAIL
exact              aeWeighted === d1Weighted                                -> pass
in-band            |ae - d1| <= Math.max(3, aeWeighted * 0.01)              -> pass, reportable
out-of-tolerance   otherwise                                                -> FAIL
```

`zero-side` is checked **before** tolerance, so AE 1 / D1 0 fails rather than sliding under the
±3 floor (brief 22, 86).

**Tests, written first:**

- **Tolerance (54, 85) — asserted against `withinTolerance` directly**, since that is where the
  arithmetic lives. The 1% is 1% *of the AE value*, asserted explicitly: AE 1000 / D1 990
  passes (allowed 10); AE 1000 / D1 989 fails; AE 80 / D1 77 passes on the floor; AE 80 / D1 76
  fails. AE 200 / D1 203 passes on the floor where 1% would not — the floor wins below 300, the
  percentage above it.
- **The zero rule and the verdict names (55) — asserted against `judgeCell(cell)`**, built from
  whole cell objects. AE 3 / D1 0 → `zero-side`. AE 0 / D1 3 → `zero-side`. AE 1 / D1 0 →
  `zero-side` (magnitude is irrelevant). AE 27 / D1 18 → `out-of-tolerance`. AE 91 / D1 90 →
  `in-band`. AE 90 / D1 90 → `exact`.
- **Asymmetry is deliberate.** AE 0 / D1 5 fails even though the ±3 band around AE 0 is ±3;
  the zero check runs first.
- **Both-zero is asserted never to reach `judgeCell`** — `buildCells` drops it (Task 3). This is
  belt-and-braces, not a live safeguard: see the note in Task 3.

**Done when:** the tolerance and verdict tests pass, and `node scripts/compare-ae-d1.mjs` still
runs on the old path — `main()` is not touched by this task.

---

### Task 3 — cells, the union, and the origin label

**Implements:** brief 16, 17, 27, 57, 23, 72.

`buildCells(aeRows, d1Rows)` takes two flat arrays of query rows and returns a sorted array of
cells keyed on `(day, event)`.

- The key set is the **union of both sides** (brief 17). An event present only in AE still
  produces a cell — that is the defect class the whole change exists to catch. The event list
  is derived from the data and appears nowhere as a literal in the script; a test asserts an
  AE-only event and a D1-only event each survive (56).
- A cell where both weighted sums are zero is **not produced at all** (27). **This state cannot
  actually arise from the real queries** — both sides `GROUP BY day, event` and return only
  groups that exist, and `sample_interval` is at minimum 1, so a key is in the union only if one
  side had at least one row. Brief 27's "wall of empty rows" is a hazard of a day × event
  cartesian, which this plan deliberately does not build. The rule and its test stay as a
  cheap invariant, but **the union logic is not load-bearing here** and a later reader should
  not think it is.
- Missing side defaults to `{ rows: 0, weighted: 0 }`, so a one-sided cell is expressible.
- `cellOrigin` labels each cell from `d1Backfilled` vs `d1Rows` (72). Without the label the
  printed row counts are uninterpretable: an AE/D1 row-count difference is a real import
  defect on a `backfilled` cell and *expected* on a `live` one, and the reader cannot tell
  which without it.

**Partial days (23, 57).** `summarise` marks any cell with `day >= today` as `skipped`,
excludes it from the verdict, and keeps it in the output so the skip is visible rather than
hidden. `today` is passed in as a string, never read from the clock inside a pure function —
that is what makes it testable.

**Tests:** union both directions; both-zero absent; `d1Backfilled` 18/18 → `backfilled`, 0/18
→ `live`, 4/18 → `mixed`, `d1Rows` 0 → `unknown`; a cell dated today is `skipped` and appears
in `summary.skipped` rather than `summary.failures`, even when it is wildly out of tolerance.

**Done when:** those tests pass; `main()` still untouched.

---

### Task 4 — output, the row-count diagnostic, and the rollup

**Implements:** brief 25, 26, 28, 58, 59, 60, 82.

**The per-cell line (82).** Item 60 asserts a literal string, so the line is written **once**,
here, and every other mention in this plan quotes it rather than paraphrasing it.

Shape:

```
day · event · AE <rows>/<weighted> · D1 <rows>/<weighted> · origin · delta · verdict
```

**The canonical example — this exact string is what the Task 4 fixture asserts:**

```
2026-08-04 · incorrect_guess · AE 18/27 · D1 18/18 · backfilled · -9 · same row count, sample weighting differs
```

`formatCellLine(cell)` takes an **enriched** cell (one that has been through `summarise`), so
`verdict` and `skipped` are on the object and the function needs no second argument. A skipped
partial day renders `partial, skipped` in the verdict position, as today
(`compare-ae-d1.mjs:147`). The verdict position carries `describeDelta(cell)` where the cell
differs, and the bare verdict name (`exact`, `partial, skipped`) where it does not.

**`describeDelta` is the point of item 38** (brief 42): it separates "we are missing records"
from "we are missing a multiplier".

- `aeRows === d1Rows && aeWeighted !== d1Weighted` → **"same row count, sample weighting differs"**
- `aeRows !== d1Rows` → **"row counts differ (AE n, D1 m)"**
- equal on both → `exact`

The brief's own words, worth keeping in front of whoever reads the next red gate: *"That `: 1`
fallback converts a bad read into a silent undercount. A row-count check on both sides would
have caught it immediately and localised it to one row, instead of presenting as '9 missing
events'."* (brief 42)

**What a run prints (26, settled as recommended):**

- One **summary line per event**: days compared, worst delta (largest absolute, printed
  signed), verdict.
- A **full line for every cell out of tolerance** (including `zero-side`).
- Skipped partial days, printed.
- `--verbose` prints **every built cell** — i.e. the whole `summary.cells` array, not a
  day × event cartesian. On a 40-day window that is ~185 lines, not 400.
- The in-band reminder now names **the event as well as the day** (28), which is why
  `summary.inBand` is a list of cells rather than a counter.

**The retention note (25).** Today it fires on `failures === 1 && firstFailure === days[0]`.
Retention deletes a whole day, which is now up to ten cells at once, so the condition becomes
**every failing cell is on `summary.oldestDay`**. Leaving the old condition would silently stop
showing the note the moment the script started comparing more than one event.

The note's **text** also needs one addition (L5). Today it reads "If D1 is higher than AE there,
that is AE retention deleting it, not a write defect" (`compare-ae-d1.mjs:169`). Under the new
zero rule, a *fully* retention-deleted oldest day gives AE 0 / D1 n → `zero-side`, a hard
failure. The note must say so and point at the brief-86 sign-off route, or the reader is left
to deduce it: **"A fully deleted day reads as AE 0 / D1 n — a `zero-side` failure, not a write
defect. Re-run with a shorter `--days` to confirm."**

**Exit codes (24, 58).** `summarise` returns `exitCode`: any failing cell → 1; otherwise 0.
Exit 2 is "could not run" and is raised in `main()`, not in pure logic — a test asserts the
rollup returns 1 for one failure among many passes, and 0 for all-clear.

**The 2026-08-04 regression fixture (60).** One test, built from the real numbers, asserting
`formatCellLine` returns **exactly the canonical string given above** — character for
character, including the `-9` and the words `same row count, sample weighting differs`. This is
the single test that justifies the change: the old script could not express that distinction
and a day was spent on the ambiguity.

**Done when:** the fixture matches the canonical string exactly, the rollup tests pass, and
`main()` is still on the old path — this is the last task before the rewire.

---

### Task 5 — the queries and the CLI

**Implements:** brief 15, 18, 19, 20, 46, 77 (M2), 50.

**One test here, not none.** Brief 50 excluded "the network or the wrangler call" — it did not
exclude `parseArgs`, which is pure. And what `parseArgs` now decides is brief item 7, the
settled decision that made this work *replace* rather than *sit alongside*: a bare
`node scripts/compare-ae-d1.mjs` covers every event instead of only `puzzle_start`
(`compare-ae-d1.mjs:30` today). That is the defect class the entire change exists to close, and
without a test the only thing catching a regression is Jamie noticing a header line.

So: **`parseArgs` is exported (Task 1) and its defaults are asserted here** —
`days === 30`, `host === 'clumeral.com'`, `event === undefined`, `verbose === false` — plus
`--event puzzle_start` and `--verbose` being picked up. The `event === undefined` assertion is
the one that matters.

The network and the `execFileSync` remain untested and are proved by the manual run in Task 7.

**One AE query per run** (15), not one per event:

```sql
SELECT toStartOfDay(timestamp) AS day, blob1 AS event,
       COUNT() AS row_count, SUM(_sample_interval) AS weighted
FROM clumeral
WHERE timestamp >= toStartOfDay(NOW()) - INTERVAL '<DAYS>' DAY
  AND blob4 = '<HOST escaped>'
GROUP BY day, event ORDER BY day ASC, event ASC
```

`COUNT()` with **zero arguments** — `COUNT(*)` is rejected by AE, verified 2026-08-06 and
already recorded in ANALYTICS.md (77). Both aggregates come back as **strings** and go through
`Number()` (19, 77). The `row_count` alias avoids betting on `rows` being safe in AE's dialect.

**Grouping and ordering by the `day` / `event` aliases is the idiom already proven against this
API** — today's script does `toStartOfDay(timestamp) AS day … GROUP BY day ORDER BY day ASC`
and works (`compare-ae-d1.mjs:63–68`), and ANALYTICS.md:211 records that the alias is the
*safe* side of that particular trap. `blob1 AS event` is a plain rename, not an expression, so
it is the easier case. **Flagged for Task 7's first run all the same**: if AE rejects
`GROUP BY … event`, group and order by `blob1` directly and keep the alias in the projection
only. That is a one-line change and not a plan revision.

**One D1 query per run**, gaining `event` in the grouping and two new columns:

```sql
SELECT strftime('%Y-%m-%d', ts / 1000, 'unixepoch') AS day, event,
       COUNT(*) AS row_count, SUM(sample_interval) AS weighted, SUM(backfilled) AS backfilled
FROM analytics_events
WHERE hostname = '<HOST escaped>'
  AND ts >= (unixepoch(date('now', '-<DAYS> days')) * 1000)
GROUP BY day, event ORDER BY day, event
```

`SUM(backfilled)` is the item-72 label, one extra column on a query already being run.

**Injection surface (20).** The host is still escaped before interpolation. Event names are
**not interpolated at all** on the default path — strictly less surface than today. `--event`,
when passed, appends an escaped `AND blob1 = …` / `AND event = …` to both queries (18).

**Flags:** `--days` (default 30), `--host` (default `clumeral.com`), `--event` (optional
filter, no longer a default — brief 7), `--verbose` (new). The header line names the event set:
"every event" or the single filtered one.

Neither mechanism changes (46): AE stays a plain `fetch`, D1 stays `execFileSync` of
`wrangler d1 execute --remote --json`. The existing wrangler error handling — the
`CLOUDFLARE_API_TOKEN` message, the "database does not exist" message, exit 2 — moves into
`main()` unchanged.

**Done when:** `parseArgs` defaults are asserted, the old module-scope loop
(`compare-ae-d1.mjs:127–179`) is gone, `npm test` is green, and `node -e` import check from
Task 1 still prints `function`. The script's real behaviour is proved by Jamie's run in Task 7,
not here.

---

### Task 6 — `docs/ANALYTICS.md`

**Implements:** brief 47, 45, 28, 81 (M6), 86, 87, 44, and the in-band record.

Six edits. Anchors in the current file: **"Restarting a halted import"** at
`docs/ANALYTICS.md:157`, **"Comparison gate (blocks PR 3)"** at `:244`, **"PR 3 removal
checklist"** at `:261`.

1. **"Comparison gate (blocks PR 3)"** (`:244`) — rewritten to describe what the gate now checks: the
   unit is the **(day, event) cell**, over full UTC days; the verdict is **weighted sum against
   weighted sum**, ±1% (of the AE value) or ±3, whichever is larger; a cell where one side is
   zero and the other is not is a **hard failure** whatever its size; **row counts are printed
   and are never a verdict**, because on live days AE stores sampled rows while D1 writes one
   row per event, so an AE/D1 row-count gap on a live cell is correct behaviour (brief 70). The
   flags and the `--verbose` matrix are listed.
2. **The in-band note** now says differences get recorded **with the day, the event and both
   counts** (28).
3. **New record — 2026-08-04 `incorrect_guess`** (45), a new subsection placed immediately
   **after** the rewritten "Comparison gate" section and before "PR 3 removal checklist", so
   the gate description and the one thing that ever failed it read together.
   What it was: AE 27 weighted against D1
   18. What it actually was: 18 rows on both sides; one imported row, `id = 7447`,
   `2026-08-04 17:30:26`, lost its `sample_interval = 10` and imported as 1. **No event was
   lost.** Corrected by Jamie on 2026-08-06 with `UPDATE analytics_events SET sample_interval =
   10 WHERE id = 7447`, verified at 27. One-off, not systemic: of 13 cells in the window where
   AE's row count differs from its weighted sum, twelve preserved the interval exactly (brief
   40). Mechanism recorded **as a hypothesis, not a finding** — `toImportRow`'s
   `… ? Math.trunc(interval) : 1` fallback would turn one unparseable `_sample_interval` into
   exactly this, and it cannot be proven after the fact because AE is not asked twice (41).
4. **New record — in-band drifts, 2026-08-06** (brief, closing note), appended to the same new
   subsection as edit 3, under its own bold lead-in — the in-band log is a running list that
   will gain entries, and it belongs next to the record of the one out-of-band case rather
   than scattered. `puzzle_start` AE 91 /
   D1 90 (−1) and `route_change` AE 190 / D1 188 (−2). Both inside the ±3 floor, both on a live
   dual-write day, likely the documented fire-and-forget D1 write path losing the odd row.
   Recorded per the rule rather than passed silently.
5. **"Restarting a halted import"** (`:157`) gains the row-7447 warning (M6, brief 44 and 81). That
   section documents the exact rewind that would destroy the correction: the backfill's
   `DELETE` is filtered to `backfilled = 1`, so re-importing 2026-08-04 deletes the corrected
   row and re-imports it with whatever interval AE returns that time. The re-fix `UPDATE` goes
   next to the warning. This is the doc someone will actually be reading when they do the
   damage.
6. **PR 3 removal checklist** (`:261`) — the first item's wording updated to make clear the three clean
   days are now over **every event**, plus the item-86 sign-off route stated next to it:
   *a `zero-side` failure may be signed off by Jamie without resetting the three-consecutive-
   clean-day streak, provided it is recorded here with the day, the event and both counts. No
   other failure class may be signed off this way — an out-of-tolerance weighted cell resets
   the streak, full stop.* Without this next to the checklist, the next person to read a red
   gate will not know the option exists (87).

**Not ticked:** no PR 3 checklist box is ticked by this work (brief 64).

---

### Task 7 — QA, review, PR

**Implements:** brief 52, 61, 62, 63, 65, 66, 68, 79 (M4), 80 (M5).

**Automated.** `npm test` (vitest) — the new spec is picked up by `tests/**/*.spec.ts` with no
config change (67). On the PR into `staging`, `ci-smoke.yml` runs `npm run lint:migrations`,
then `npm test`, then a chromium-desktop Playwright smoke pass (65, 84). **This change adds
unit tests and adds no e2e specs**; Claude never runs Playwright locally — CI does, on hardware
that can (66). A green `ci-smoke` is part of done (68).

**Manual acceptance — Jamie runs it, Claude cannot.** `wrangler d1 … --remote` is blocked by
the guard hook (62). The command is:

```bash
node scripts/compare-ae-d1.mjs --days 40
```

`--days` defaults to 30 and the baseline window is 40 days, so the flag is required (M4, 79).

**Acceptance is a condition, not an equality** (79): **zero cells out of tolerance, and the two
known 2026-08-06 in-band drifts reported rather than swallowed.** The "185 non-empty cells over
40 days" figure is an as-of-2026-08-07 reference — cells also disappear off the old end as AE's
~90-day retention deletes them, and new full days accrue at the near end.

**If the first run disagrees with the hand-run baseline, that is attributable and not
automatically a defect** (M5, 80): the baseline took the D1 side through `/api/stats?period=all`,
which carries `Cache-Control: max-age=300` and is bounded by `period` rather than `--days`. The
queries are equivalent today — `getStats`'s `daily` is the same `SUM(sample_interval)` grouped
by day and event, filtered on hostname — but they are different read paths. **The script's own
first run becomes the real baseline.**

**Then:** self-review, `da-build` fresh-context, push, open the PR **against `staging`**, and
**do not merge it** — Jamie merges.

## Definition of done

Brief 63, restated against the tasks above:

- [ ] Tasks 1–6 committed, each on its own, each meeting its **Done when**
- [ ] `npm test` green, covering brief items 54–60
- [ ] The 2026-08-04 fixture (60) asserts the canonical line from Task 4 **verbatim**:
      `2026-08-04 · incorrect_guess · AE 18/27 · D1 18/18 · backfilled · -9 · same row count, sample weighting differs`
- [ ] `docs/ANALYTICS.md` carries all six edits in Task 6
- [ ] Jamie's manual run meets the Task 7 condition
- [ ] `da-build` passed
- [ ] `ci-smoke` green on the PR
- [ ] PR open against `staging`, not merged by Claude

**Explicit non-goal** (brief 64): this does not tick the PR 3 checklist. Retiring AE stays a
separate decision on separate evidence needing three consecutive clean days including a
weekend — which this change makes *measurable*, not *satisfied*.

## Brief traceability

Every numbered brief item, mapped to a task or marked as needing no code.

| Items | Where |
|---|---|
| 1–6 | Scope and framing — no code |
| 7 | Task 5 (`--event` demoted to an optional filter) |
| 8, 9, 11–14 | Out of scope — no code; 12 is Task 5 (`--host` default unchanged) |
| 10 | Answered "record only" — Task 6 edit 3 |
| 15 | Task 5 (one query per side) |
| 16, 17 | Task 3 (cell union) |
| 18 | Task 5 (`--event` filter) |
| 19 | Task 5 (`Number()` on both sides) |
| 20 | Task 5 (host escaped, events not interpolated) |
| 21, 22 | Task 2 (tolerance, zero rule) |
| 23 | Task 3 (partial days) |
| 24 | Task 4 (exit 0/1) + Task 5 (exit 2 in `main()`, untested — see 58) |
| 25 | Task 4 (retention note condition widened) |
| 26 | Task 4 (summary per event, failures in full, `--verbose`) |
| 27 | Task 3 (both-zero cells dropped) |
| 28 | Task 4 + Task 6 edit 2 (reminder names the event) |
| 29–36 | Investigation record — no code; feeds Task 6 edit 3 |
| 37 | Answered "proceed" — no code |
| 38 | Task 4 (`describeDelta`), scoped by 71 to diagnostic only |
| 39–43 | Findings and the applied fix — Task 6 edit 3 |
| 44 | Task 6 edit 5 (rewind warning) |
| 45 | Task 6 edit 3 |
| 46 | Task 5 (mechanisms unchanged) |
| 47 | Task 6 (all six edits) |
| 48, 49 | No code — asserted by the files-touched table |
| 50 | Tasks 2–4 (pure logic tested), Task 5 (`parseArgs` tested; network not) |
| 51 | Task 1, superseded in detail by 75 and 76 |
| 52, 53 | Task 7 (QA level), corrected by 65–66 |
| 54 | Task 2 |
| 55 | Task 2 |
| 56 | Task 3 |
| 57 | Task 3 |
| 58 | Task 4 — **partially.** Exit 0 and exit 1 are tested through `summarise`. **Exit 2 ("an unreachable source") is a deliberate deferral:** it lives in `main()`, whose only trigger is a real wrangler failure, and faking that means mocking `execFileSync` — which is the network/shell boundary brief 50 put out of scope. Proved instead by Task 7's manual run, which fails this way whenever credentials are absent. |
| 59, 60 | Task 4 (`describeDelta`, the 08-04 fixture) |
| 61, 62 | Task 7 (manual run), refined by 79 and 80 |
| 63 | Definition of done |
| 64 | Definition of done (non-goal) |
| 65–68 | Task 7 (CI, honestly stated) |
| 69 | Sign-off — no code |
| 70–73 | Task 2 (verdict over weighted sums only) + Task 3 (origin label) |
| 74, 75 | Task 1 (module side-effect free on import) |
| 76 (M1) | Task 1 (guard copied verbatim) |
| 77 (M2) | Task 5 (`COUNT()`, strings) |
| 78 (M3) | Answered by 86 — Task 6 edit 6 (sign-off route in the doc) |
| 79 (M4) | Task 7 (`--days 40`, condition not equality) |
| 80 (M5) | Task 7 (read-path caveat recorded) |
| 81 (M6) | Task 6 edit 5 |
| 82 (M7) | Task 4 (the per-cell line) |
| 83 (L1) | No code — "ten events" is the number |
| 84 (L2) | Task 7 (CI list includes `lint:migrations`) |
| 85 (L3) | Task 2 (1% is of the AE value, asserted) |
| 86, 87 | Task 6 edit 6 |
| 88 | No code — adoption statement |

## Plan-level decisions, for the record

Three things the brief did not fix, decided here rather than during the build:

1. **`cellOrigin` returns `unknown` (printed `—`) when `d1Rows === 0`.** The brief named three
   labels and did not cover a cell D1 has no rows in.
2. **The `row_count` alias**, not `rows`, on both queries. No reason to bet on `rows` being
   unreserved in AE's dialect when the alias is free to change.
3. **`today` is a parameter of `summarise`, never read from the clock inside pure logic.**
   That is what makes the partial-day rule testable at all.

None of these changes an observable behaviour the brief settled. If Jamie disagrees with any,
it is a plan edit, not a brief reopen.

Two more were added answering `da-plan` (below): `delta` is `d1Weighted - aeWeighted`, keeping
today's sign convention; and `worstDelta` is the largest **absolute** delta, printed signed.

## `da-plan` review — 2026-08-07

Fresh-context review of the first draft. **2 High, 6 Medium, 5 Low. All thirteen fixed above;
none deferred, none disputed.** The review also verified seven load-bearing facts against the
code — the `lint-migrations.mjs:116` guard line and its `:104–115` comment, the module-scope
`process.exit` calls at `compare-ae-d1.mjs:51–54`/`:115`/`:173` and the top-level `await` at
`:129`, `vitest.config.ts:8`, `ci-smoke.yml:58–62`, the absence of a typecheck script,
`migrations/analytics/0005:40`'s `backfilled` CHECK constraint, and `backfill.ts:313`'s
`: 1` fallback — all confirmed as this plan states them.

**H1 — the item-60 fixture string was specified three incompatible ways.** The line the plan
calls "the single test that justifies the change" appeared as `AE 18/27 · D1 18/18` in one
place and `AE 18 rows / 27 weighted · D1 18 rows / 18 weighted` in another, and the verdict
text disagreed with `describeDelta`'s own return value. A zero-context agent writing that test
first had to guess, and either guess broke a definition-of-done checkbox.
**Fixed:** the canonical line is written **once**, in Task 4, and Task 4's fixture and the
definition of done both quote it verbatim.

**H2 — no task owned the `main()` rewire.** Task 1's *Done when* pinned behaviour to today's;
Task 4 specified "what a run prints", which needs Task 5's queries; and Task 5 never mentioned
replacing the old loop — and is the task with no tests. So Task 4 either shipped a broken
script or Task 5 silently absorbed an untested rewrite.
**Fixed:** a "Where `main()` moves" paragraph now states it once — Task 1 lifts the loop
unchanged, **Tasks 2–4 add exported pure functions and tests only and do not touch `main()`**,
Task 5 replaces the body and deletes `compare-ae-d1.mjs:127–179`. Every task gained a
*Done when*.

**M1 — the cell object could not express what `formatCellLine` printed.** `skipped` is decided
by `summarise`, not present on the cell, so a skipped partial day was unrenderable with the
specified signature — which blocked H1's fixture.
**Fixed:** `summarise` enriches each cell with `skipped` and `verdict`; `formatCellLine` takes
an enriched cell.

**M2 — `summarise`'s return shape was named but never defined**, and brief 28's "name the event
as well as the day" forces `inBand` to be a list of cells, not the integer counter it is today
(`compare-ae-d1.mjs:133`). An agent reading `inBand` beside `failures` would have reached for a
count. **Fixed:** the object literal is written out, with the list-not-counter point called out.

**M3 — Task 1's test could not fail on the machine it runs on.** `.env` exists on the Pi and
`loadEnv` reads it off disk before the token check, so the "delete the env vars" spec passed
against the *un-refactored* module locally and would only have failed in CI — the exact
regression it exists to pre-empt. (Also: ESM imports are hoisted, so deleting keys in a test
body is decorative.) **Fixed:** the check is now a `node -e` dynamic import, which needs no
`.env` handling — and which exercises the `process.argv[1] &&` limb of the copied guard for
free, since `argv[1]` is undefined under `node -e`. **`.env` is never moved**; it holds the only
copy of Jamie's token.

**M4 — `withinTolerance` and `judgeCell` both owned the tolerance rule.** Two copies of
`Math.max(3, ae * 0.01)` is how the ±3 floor gets applied on one path and not the other.
**Fixed:** `judgeCell` calls `withinTolerance`, which is the sole home of the arithmetic, and
each test now says which function it asserts against.

**M5 — the headline behavioural change had no test.** Brief item 7 — `--event` stops being the
default — landed in Task 5, which declared itself untested. But brief 50 excluded the network
and the wrangler call, not `parseArgs`, which is pure. **Fixed:** `parseArgs` is exported and
its defaults asserted, `event === undefined` being the one that matters.

**M6 — "the whole matrix" was ambiguous**, and the both-zero rule guards a state the real
queries cannot produce (both sides `GROUP BY`, so a key exists only if a row does).
**Fixed:** `--verbose` is defined as every built cell, ~185 lines not 400; and the both-zero
rule is now labelled a cheap invariant rather than a live safeguard, so nobody later mistakes
the union logic for load-bearing there.

**L1** — the `event` alias in `GROUP BY` was as unverified as `rows` was. Fixed: noted that
aliasing is the idiom already proven for `day` (`compare-ae-d1.mjs:63–68`) and is the *safe*
side of the ANALYTICS.md:211 trap, with a stated one-line fallback flagged for Task 7's first
run. **L2** — exit 2 had no test; fixed by marking it a deliberate deferral in the traceability
table with the reason. **L3** — Task 6 edits 3 and 4 had no anchors; fixed, all six now cite a
line number. **L4** — "worst delta" was undefined as signed or absolute; fixed. **L5** — the
retention note's text needed to connect a fully deleted oldest day to the new `zero-side` hard
fail; fixed, with the replacement wording written out.

**The review found nothing on** scope creep, reopened product decisions, architecture,
dependencies, the `--remote` guard-hook constraint, or the PR-3-checklist non-goal.
