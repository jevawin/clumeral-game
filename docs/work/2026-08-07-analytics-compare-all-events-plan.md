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
export function withinTolerance(ae, d1)          // Math.max(3, ae * 0.01)
export function judgeCell(cell)                  // -> 'exact' | 'in-band' | 'zero-side' | 'out-of-tolerance'
export function describeDelta(cell)              // -> human string naming rows vs weighting
export function cellOrigin(cell)                 // -> 'backfilled' | 'live' | 'mixed' | 'unknown'
export function buildCells(aeRows, d1Rows)       // union of (day, event); drops both-zero cells
export function summarise(cells, today)          // -> { perEvent, failures, inBand, skipped, exitCode, retentionNote }
export function formatCellLine(cell)             // the item-82 line
export function formatReport(summary, { verbose })

// Impure — not exported, called only from main().
function parseArgs(argv)
function loadEnv()
async function fromAE(opts)
function fromD1(opts)
async function main(argv)
```

**The cell object**, fixed here so the tests and the queries agree:

```js
{ day: '2026-08-04', event: 'incorrect_guess',
  aeRows: 18, aeWeighted: 27,
  d1Rows: 18, d1Weighted: 18, d1Backfilled: 18 }
```

`cellOrigin` reads `d1Backfilled` against `d1Rows`: all backfilled → `backfilled`, none →
`live`, some → `mixed`. **Plan-level decision:** `d1Rows === 0` gives `unknown`, printed as
`—`. The brief (72) named three labels and did not cover the case where D1 has no rows to
label; inventing `live` there would assert something we did not measure.

## Task list

Each task is a commit. Tests are written before the implementation within each task
(CLAUDE.md, test-driven-development).

---

### Task 1 — make the module importable without running anything

**Implements:** brief 51, 74, 75, 76 (M1), 67, 53.

The script currently calls `process.exit(1)` at module scope (`compare-ae-d1.mjs:45–54`) when
no token is found. `ci-smoke.yml` runs `npm test` on every PR into `staging` and `main` with
no `.env`, so an unguarded import kills the vitest process during collection and turns a
required check red. Nothing else in this plan is safe to write until this is done.

1. **Test first** — `tests/compare-ae-d1.spec.ts`, one case: importing the module with
   `CF_ANALYTICS_TOKEN` and `CF_API_TOKEN` deleted from `process.env` resolves, and
   `withinTolerance` is a function. That the suite runs at all is the assertion.
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

**Done when:** `npm test` passes with no `.env` present, and `node scripts/compare-ae-d1.mjs`
still behaves exactly as it does today (single event, per-day) — this task is a refactor with
no behaviour change.

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

- **Tolerance (54, 85).** The 1% is 1% *of the AE value*, asserted explicitly: AE 1000 / D1 990
  passes (allowed 10); AE 1000 / D1 989 fails; AE 80 / D1 77 passes on the floor; AE 80 / D1 76
  fails. AE 200 / D1 203 passes on the floor where 1% would not — the floor wins below 300, the
  percentage above it.
- **The zero rule (55).** AE 3 / D1 0 → `zero-side`. AE 0 / D1 3 → `zero-side`. AE 1 / D1 0 →
  `zero-side` (magnitude is irrelevant). Both zero is asserted never to reach `judgeCell` —
  `buildCells` drops it (Task 3).
- **Asymmetry is deliberate.** AE 0 / D1 5 fails even though the ±3 band around AE 0 is ±3;
  the zero check runs first.

---

### Task 3 — cells, the union, and the origin label

**Implements:** brief 16, 17, 27, 57, 23, 72.

`buildCells(aeRows, d1Rows)` takes two flat arrays of query rows and returns a sorted array of
cells keyed on `(day, event)`.

- The key set is the **union of both sides** (brief 17). An event present only in AE still
  produces a cell — that is the defect class the whole change exists to catch. The event list
  is derived from the data and appears nowhere as a literal in the script; a test asserts an
  AE-only event and a D1-only event each survive (56).
- A cell where both weighted sums are zero is **not produced at all** (27). In practice this
  means an event that did not exist yet contributes no rows rather than a wall of empty ones.
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
→ `live`, 4/18 → `mixed`, `d1Rows` 0 → `unknown`; a cell dated today is `skipped` and does not
appear in the failure count even when it is wildly out of tolerance.

---

### Task 4 — output, the row-count diagnostic, and the rollup

**Implements:** brief 25, 26, 28, 58, 59, 60, 82.

**The per-cell line (82), fixed exactly because item 60 is asserted against it:**

```
day · event · AE rows/weighted · D1 rows/weighted · origin · delta · verdict
```

e.g. `2026-08-04 · incorrect_guess · AE 18/27 · D1 18/18 · backfilled · -9 · sample weighting differs`

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

- One **summary line per event**: days compared, worst delta, verdict.
- A **full line for every cell out of tolerance** (including `zero-side`).
- Skipped partial days, printed.
- `--verbose` prints the whole matrix.
- The in-band reminder now names **the event as well as the day** (28).

**The retention note (25).** Today it fires on `failures === 1 && firstFailure === days[0]`.
Retention deletes a whole day, which is now up to ten cells at once, so the condition becomes
**every failing cell is on the oldest day**. Leaving the old condition would silently stop
showing the note the moment the script started comparing more than one event.

**Exit codes (24, 58).** `summarise` returns `exitCode`: any failing cell → 1; otherwise 0.
Exit 2 is "could not run" and is raised in `main()`, not in pure logic — a test asserts the
rollup returns 1 for one failure among many passes, and 0 for all-clear.

**The 2026-08-04 regression fixture (60).** One test, built from the real numbers, asserting
the full formatted line:

```
AE 18 rows / 27 weighted · D1 18 rows / 18 weighted · backfilled
```

with a verdict naming a **sample-weighting** difference, not a missing-events one. This is the
single test that justifies the change: the old script could not express that distinction and a
day was spent on the ambiguity.

---

### Task 5 — the queries and the CLI

**Implements:** brief 15, 18, 19, 20, 46, 77 (M2), 50.

No unit tests here by design (brief 50): the network and the `execFileSync` are out of test
scope, and this task is proved by the manual run in Task 7.

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

---

### Task 6 — `docs/ANALYTICS.md`

**Implements:** brief 47, 45, 28, 81 (M6), 86, 87, 44, and the in-band record.

Six edits:

1. **"Comparison gate (blocks PR 3)"** — rewritten to describe what the gate now checks: the
   unit is the **(day, event) cell**, over full UTC days; the verdict is **weighted sum against
   weighted sum**, ±1% (of the AE value) or ±3, whichever is larger; a cell where one side is
   zero and the other is not is a **hard failure** whatever its size; **row counts are printed
   and are never a verdict**, because on live days AE stores sampled rows while D1 writes one
   row per event, so an AE/D1 row-count gap on a live cell is correct behaviour (brief 70). The
   flags and the `--verbose` matrix are listed.
2. **The in-band note** now says differences get recorded **with the day, the event and both
   counts** (28).
3. **New record — 2026-08-04 `incorrect_guess`** (45). What it was: AE 27 weighted against D1
   18. What it actually was: 18 rows on both sides; one imported row, `id = 7447`,
   `2026-08-04 17:30:26`, lost its `sample_interval = 10` and imported as 1. **No event was
   lost.** Corrected by Jamie on 2026-08-06 with `UPDATE analytics_events SET sample_interval =
   10 WHERE id = 7447`, verified at 27. One-off, not systemic: of 13 cells in the window where
   AE's row count differs from its weighted sum, twelve preserved the interval exactly (brief
   40). Mechanism recorded **as a hypothesis, not a finding** — `toImportRow`'s
   `… ? Math.trunc(interval) : 1` fallback would turn one unparseable `_sample_interval` into
   exactly this, and it cannot be proven after the fact because AE is not asked twice (41).
4. **New record — in-band drifts, 2026-08-06** (brief, closing note): `puzzle_start` AE 91 /
   D1 90 (−1) and `route_change` AE 190 / D1 188 (−2). Both inside the ±3 floor, both on a live
   dual-write day, likely the documented fire-and-forget D1 write path losing the odd row.
   Recorded per the rule rather than passed silently.
5. **"Restarting a halted import"** gains the row-7447 warning (M6, brief 44 and 81). That
   section documents the exact rewind that would destroy the correction: the backfill's
   `DELETE` is filtered to `backfilled = 1`, so re-importing 2026-08-04 deletes the corrected
   row and re-imports it with whatever interval AE returns that time. The re-fix `UPDATE` goes
   next to the warning. This is the doc someone will actually be reading when they do the
   damage.
6. **PR 3 removal checklist** — the first item's wording updated to make clear the three clean
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

- [ ] Tasks 1–6 committed, each on its own
- [ ] `npm test` green, covering brief items 54–60
- [ ] The 2026-08-04 fixture (60) asserts `AE 18/27 · D1 18/18 · backfilled` and a
      sample-weighting verdict
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
| 24 | Task 4 (exit codes) + Task 5 (exit 2 in `main()`) |
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
| 50 | Tasks 2–4 (pure logic tested), Task 5 (network not tested) |
| 51 | Task 1, superseded in detail by 75 and 76 |
| 52, 53 | Task 7 (QA level), corrected by 65–66 |
| 54 | Task 2 |
| 55 | Task 2 |
| 56 | Task 3 |
| 57 | Task 3 |
| 58 | Task 4 |
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
