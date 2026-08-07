# Brief — widen the AE/D1 comparison to every event, and record the 2026-08-04 delta

Date: 2026-08-06 · Branch: `dev/analytics-compare-all-events`

Short form: sections 1, 2, 3, 6, 11 — **approved by Jamie 2026-08-06**.
Reason: no UI, no state, no copy, no accessibility surface, no puzzle maths. The change is
one developer script plus a paragraph of documentation. §4 maths, §5 state, §7 looks,
§8 copy, §9 accessibility, §10 analytics are all n/a with that reason.

## Origin

Asked for by Jamie on 2026-08-06, off the back of a stats check. Comparing Analytics Engine
against `/api/stats` by hand over 2026-08-03 to 2026-08-06 found:

- Every event on every day matched **exactly**, except one.
- **2026-08-04 `incorrect_guess`: AE 27, D1 18** — a delta of 9, 33%, outside the
  ±1%/±3 gate.
- 2026-08-04 is the dual-write cutover day (`f63f4cf`, "D1 read/write path and chart
  geometry"), so a boundary artefact is the leading explanation — but the doc anticipates
  "a handful of requests", not a third of the day's events.

The existing gate would not have caught this: `scripts/compare-ae-d1.mjs` compares one
event at a time and defaults to `puzzle_start`, which matches exactly on every day.

## 1. What it is

Ledger: **Settled: Jamie 2026-08-06 · Ack: Override: Jamie 2026-08-07 (Dave waived)**

1. Two separable pieces of work, shipped together because they came from the same finding.
   (assumed — one branch, one PR, both small)
2. **Piece A:** `scripts/compare-ae-d1.mjs` compares every event type in one run instead of
   one event per invocation. (assumed — this is the ask)
3. **Piece B:** `docs/ANALYTICS.md` records the 2026-08-04 `incorrect_guess` delta.
   (assumed — this is the ask)
4. The problem it solves: the PR 3 gate is currently satisfiable by a comparison that only
   ever looked at one of ten event types. A per-event defect on any other event passes the
   gate silently. (assumed — demonstrated by the 08-04 finding)
5. Who it is for: Jamie and Dave, as the evidence that retires Analytics Engine. It is not
   user-facing and never runs in CI or the Worker. (assumed)
6. Why now: PR 3 removes AE and revokes the token. After that the comparison is
   impossible — AE is the only copy of the pre-cutover truth, and it self-deletes at ~90
   days regardless. (assumed)
7. **Does the widened script replace the gate, or sit alongside it?**
   **Answer: replace — Jamie 2026-08-06.** The default run covers every event and the
   pass/fail verdict is over all of them; `--event` survives only as an optional filter for
   drilling into one. Why: a gate that passes while nine of ten events go unchecked is not a
   gate. Accepted cost: the gate is expected to go red on 2026-08-04 until item 10 is
   settled.

## 2. Out of scope

Ledger: **Settled: Jamie 2026-08-06 · Ack: Override: Jamie 2026-08-07 (Dave waived)**

8. No `src/` changes. Nothing about what the Worker writes to either sink changes; this is a
   read-only measurement tool. (assumed — the dual write is what is being measured, so
   changing it would invalidate the measurement)
9. Does not run in CI, on a cron, or in the Worker. It stays a thing a human runs on the Pi
   with the `.env` token. (assumed — it needs an Analytics Read token and interactive
   wrangler credentials, neither of which belongs in CI for a tool with ~2 weeks left to
   live)
10. **Does this piece of work explain the 2026-08-04 `incorrect_guess` delta, or only record
    it?**
    My rec: **record only, and let the widened script tell us whether it recurs.** Why: the
    9 missing events are on the cutover day itself, and the D1 rows for that day cannot now
    be distinguished from rows the backfill wrote — so any root-cause claim would be a story,
    not evidence. If no later day diverges, the boundary explanation holds and the gate can
    pass on a stated exception. If a later day diverges, that is a live defect and worth real
    investigation with fresh data. Cost of being wrong: we retire AE with one unexplained
    9-event gap on one day.
11. Does not compare unique or new users. `COUNT(DISTINCT uid)` over the imported window is a
    floor, not a total, so the two sides cannot agree by construction. (assumed — documented
    in ANALYTICS.md "Sampling")
12. Does not compare more than one hostname per run. `--host` keeps its `clumeral.com`
    default. (assumed — production is what gates PR 3; preview hosts are noise, ~240 events
    against 2,742)
13. Does not change `/stats`, `/api/stats`, the chart, or the backfill. (assumed)
14. Does not do PR 3, and does not tick any box on the PR 3 checklist beyond providing the
    evidence for the first one. (assumed)

**Item 10 answered: record only — Jamie 2026-08-06.**

## 3. How it works

Ledger: **Settled: Jamie 2026-08-07 (22 yes, 26 rec, 37 fine, 38 yes) · Ack: Override: Jamie 2026-08-07 (Dave waived)**

### Querying

15. **One AE query and one D1 query per run**, both `GROUP BY day, event`, rather than a pair
    of queries per event. (assumed — ten times the round trips for identical data, against an
    AE SQL API we do not control the rate limits of)
16. **The comparison unit is the (day, event) cell.** (assumed — this is what "compare all
    events" means; a per-day total would let a surplus in one event mask a shortfall in
    another, which is precisely how the 08-04 delta hid inside a passing gate)
17. **The event list is discovered from the data**, as the union of event names appearing on
    either side, never a hardcoded array. (assumed — a hardcoded list means the next new event
    escapes the gate silently, which is the failure this whole piece of work exists to fix)
18. `--event` still filters to one event; it just stops being the default. `--host`, `--days`
    unchanged. (assumed — settled in item 7)
19. AE returns aggregates as strings and D1 as numbers; both go through `Number()`, as today.
    (assumed — already true, documented in ANALYTICS.md)
20. The host is still escaped before interpolation. Event names are no longer interpolated at
    all on the default path. (assumed — strictly less injection surface than today)

### The verdict

21. **The ±1%/±3 tolerance is applied per cell, unchanged.** (assumed — it is the published
    gate in ANALYTICS.md and changing the threshold in the same change that widens the scope
    would make a red result impossible to attribute)
22. **Should a cell where one side is zero and the other is not be a hard failure regardless
    of size?**
    My rec: **yes.** Why: the ±3 floor was sized for `puzzle_start` at ~80/day. Applied to
    `htp_opened` at 1–6/day it passes almost anything — AE 3 vs D1 0 sails through, and that
    is a write path that produced nothing at all, which ANALYTICS.md already calls "a real
    defect". "One side has nothing" is a different signal from "the counts drifted", and only
    the first one looks like a broken sink. Cost: it will fire on genuinely thin days and need
    reading with judgement.
23. Whole-day partial handling is unchanged — today is skipped on both sides, and the skip is
    printed rather than hidden. (assumed — existing behaviour, and the reason the midnight
    boundary class of mismatch does not arise)
24. Exit codes unchanged: 0 pass, 1 gate failure, 2 could not run. (assumed)
25. The existing "oldest day is AE retention, not a defect" note survives, retriggered when
    **every** failing cell is on the oldest day rather than when there is exactly one failure.
    (assumed — retention deletes whole days, so it now hits ten cells at once instead of one;
    leaving the old condition would silently stop showing the note)

### Output

26. **How much does a passing run print?**
    My rec: **a summary line per event** (days compared, worst delta, verdict), **plus a full
    row for every cell that is out of tolerance**, plus `--verbose` for the whole matrix. Why:
    10 events × 30 days is 300 rows, which is not a gate anyone reads — it is a wall that gets
    skimmed. The failures are the point; everything else is one line of reassurance.
27. Days and events with zero on both sides are not printed at all. (assumed — an event that
    did not exist yet would otherwise dominate the output with empty rows)
28. The "differences inside the band — record them in docs/ANALYTICS.md" reminder survives and
    now names the event as well as the day. (assumed)

### Reopened by Jamie 2026-08-06 — the full sweep, and what the delta actually is

Jamie asked whether the 08-04 delta was the only one and whether the missing events could be
inserted by hand. Both answers changed the picture, so items 10 and 22 are reopened.

29. **The full sweep was run before answering.** AE (all events, `clumeral.com`,
    `SUM(_sample_interval)`) against `/api/stats?period=all` (`SUM(sample_interval)`), every
    full UTC day 2026-06-28 to 2026-08-05: **176 non-empty (day, event) cells, exactly one
    out of tolerance, and zero others differing at all** — not one in-band drift in the whole
    window. So the answer to "is it only those 9" is yes, and every other cell is exact.

30. **The delta is not 9 missing events.** Pulling AE's individual rows for that cell:
    **AE holds 18 rows and D1 holds 18.** AE's figure of 27 comes from one row —
    `2026-08-04T17:30:26Z`, uid `ba034600…` — carrying `_sample_interval = 10`. AE counts
    that single stored row as ten events; D1 counts it as one.
31. AE's `_sample_interval` is an exact accounting of writes the sampler stood down from, not
    a statistical guess. Corroborated on 2026-08-05, which AE stored as 819 rows weighted to
    1,053 while D1 independently reports 1,053 across all nine events — an exact match that
    could not happen by chance if the weighting were an estimate.
32. So on 2026-08-04 there were 27 real `incorrect_guess` writes, and **D1's total for that
    day (479) equals AE's raw row count (479), not AE's weighted count (488)** — the shortfall
    is exactly the one sampled row's multiplier, on the only day in the window where a
    multiplier above 4 appears.
33. **Two candidate causes, and they need different fixes.**
    - **(a) The backfill imported that row with `sample_interval = 1` instead of 10.** Fix is
      a one-row `UPDATE`, not an insert. The local rehearsal did preserve interval 10 on this
      exact row (ANALYTICS.md records "intervals 1, 2, 3 and 10" imported), so production
      behaving differently would be the defect.
    - **(b) The row is live-written and 9 D1 writes were genuinely lost** around the cutover —
      the documented fire-and-forget failure mode.
    Sampled rows on 2026-07-09, 2026-07-16 and 2026-08-01 all match exactly, so intervals are
    preserved in general; that favours (b) being narrow or (a) being a one-row slip.
34. **Inserting 9 rows would be wrong under either cause.** Under (a) it double-counts on top
    of a row that is already there. Under (b) the 9 events have no recoverable uid, timestamp
    or source — AE never stored them, by definition — so they could only be invented.
35. **There is no shared key to diff on.** `analytics_events.id` is a D1 rowid alias
    (migration 0005, no AUTOINCREMENT); Analytics Engine has no row id at all. Matching rows
    across the two is only possible on `(event, uid, timestamp-to-the-second)`, and AE
    timestamps are second-precision. That is enough here because the candidate is a single
    known row.
36. **Deciding between (a) and (b) needs one read of production D1**, which Claude cannot run
    (`wrangler d1 --remote` is blocked by the guard hook). SQL handed to Jamie for the
    Cloudflare console 2026-08-06:
    ```sql
    SELECT id, datetime(ts/1000,'unixepoch') AS utc, uid, source, sample_interval, backfilled
    FROM analytics_events
    WHERE hostname = 'clumeral.com' AND event = 'incorrect_guess'
      AND ts >= 1785801600000 AND ts < 1785888000000
    ORDER BY ts;
    ```
    Reading it: 18 rows including one at `17:30:26` → cause (a), and the fix is
    `UPDATE … SET sample_interval = 10` on that `id`. 18 rows with nothing at `17:30:26` →
    cause (b), and nothing can be recovered.

37. **Open — does the answer to item 36 change the plan?** My rec: **the script work is
    unaffected either way and should proceed as briefed**; only the ANALYTICS.md wording
    changes, and item 22 (zero-on-one-side as a hard fail) gets stronger, because this whole
    episode was a magnitude question that a raw-count check would have settled instantly.
38. **Open — should the comparison also check AE row COUNT against D1 row COUNT, alongside
    the weighted sums?** My rec: **yes.** Why: the weighted-vs-weighted check is what made a
    single dropped multiplier look like nine lost events and cost an afternoon. Counting rows
    on both sides separates "we are missing records" from "we are missing a multiplier" in
    the output itself, which is the distinction that actually matters when reading a red gate.

### Resolved 2026-08-06 — cause (a), one row, nothing lost

39. **Jamie ran the query against production `clumeral-analytics`. Cause (a) confirmed.** All
    18 rows are present and all carry `backfilled = 1`. The row AE tagged with
    `_sample_interval = 10` is there as **`id = 7447`, `2026-08-04 17:30:26`, uid
    `ba034600-…`, `sample_interval = 1`**. **No event was lost.** One imported row carries the
    wrong multiplier.
40. **It is a one-off, not a systemic importer fault.** Checked every cell in the window where
    AE's row count differs from its weighted sum — 13 of them, from 2026-07-09 to 2026-08-07.
    **Twelve preserved the interval exactly** (including `2026-08-05 undo_used`, 119 rows
    weighted to 329, and `2026-07-09 tooltip_opened`, 22 → 28). `2026-08-04 incorrect_guess`
    is the only cell that landed on the raw row count. The mapping in `toImportRow`
    (`backfill.ts:300`) is correct and demonstrably works.
41. **Most likely mechanism, stated as a hypothesis rather than a finding.**
    `toImportRow` ends `Number.isFinite(interval) && interval > 0 ? Math.trunc(interval) : 1`.
    If `_sample_interval` were absent or unparseable in that one AE response, `Number(undefined)`
    is `NaN`, the guard fails, and the row silently imports as 1 — which is exactly the
    observed result. This cannot be proven after the fact: AE is not asked twice and the
    original response is gone.
42. **The design lesson, which outlives this bug.** That `: 1` fallback converts a bad read
    into a silent undercount. A row-count check on both sides would have caught it
    immediately and localised it to one row, instead of presenting as "9 missing events".
    This is now the strongest argument for item 38 and it should be quoted in the plan.
43. **The fix, for Jamie to run in the Cloudflare console.** `UPDATE … SET` is permitted by
    CLAUDE.md; Claude cannot run it (`--remote` is blocked) and must not.
    ```sql
    UPDATE analytics_events SET sample_interval = 10 WHERE id = 7447;
    ```
    Verify with:
    ```sql
    SELECT SUM(sample_interval) FROM analytics_events
    WHERE hostname = 'clumeral.com' AND event = 'incorrect_guess'
      AND ts >= 1785801600000 AND ts < 1785888000000;   -- expect 27
    ```
44. **One caveat on the fix.** The backfill's `DELETE` is filtered to `backfilled = 1`, so if
    anyone rewinds `backfill_state` and re-imports 2026-08-04, this correction is deleted and
    re-imported from AE — with whatever interval AE returns that time. `done = 1` makes that
    unlikely, and PR 3 removes the backfill entirely, but the correction is not permanent
    until PR 3 lands.
45. **Item 10's "record only" decision stands and is now cheap to honour** — the record is no
    longer "an unexplained 9-event gap" but "one imported row lost its sample interval,
    corrected on 2026-08-06, cause not reproducible". That is what goes in ANALYTICS.md.

**Items 22, 26, 37, 38 answered — Jamie 2026-08-07.** 22 yes (hard fail). 26 as recommended
(summary per event, full rows for failures, `--verbose` for the matrix) — Jamie will read the
output alongside Claude, so legibility over completeness is the right trade. 37 proceed. 38 yes.

**Fix applied and independently verified.** Jamie ran the `UPDATE` on 2026-08-06 and the
check returned 27. Re-running the full sweep on 2026-08-07: **185 non-empty cells over 40 days
(2026-06-28 to 2026-08-06), zero out of tolerance.**

**In-band differences on 2026-08-06, recorded per the ANALYTICS.md rule rather than passed
silently:** `puzzle_start` AE 91 / D1 90 (−1), `route_change` AE 190 / D1 188 (−2). Both inside
the ±3 floor. These are live dual-write days, so the likely cause is the documented
fire-and-forget D1 write path losing the odd row — the exact class the ±3 floor exists to
tolerate. Worth watching, not worth blocking on; item 38's row-count check will make the next
occurrence unambiguous.

## 6. How it fits

Ledger: **Settled: Jamie 2026-08-07 (accepted all recommendations) · Ack: Override: Jamie 2026-08-07 (Dave waived)**

46. **`scripts/compare-ae-d1.mjs` is the only code file touched.** The AE half stays a plain
    `fetch` to the Analytics Engine SQL API; the D1 half stays `execFileSync` of
    `wrangler d1 execute --remote --json`. Neither mechanism changes — only the query shape,
    the comparison loop and the output. (assumed)
47. **`docs/ANALYTICS.md`** — the "Comparison gate (blocks PR 3)" section, the "differences
    inside the tolerance get recorded here" note, and the PR 3 removal checklist. Plus the
    2026-08-04 record from item 45 and the in-band 2026-08-06 pair above. (assumed)
48. **Nothing else.** No `src/`, no `wrangler.jsonc`, no `migrations/`, no `.env`, no change to
    the API token or its scope. (assumed — follows from §2)
49. No new dependencies. Node built-ins and `fetch` only, as today. (assumed)
50. **Does the comparison logic get unit tests?**
    My rec: **yes, for the pure logic only** — tolerance, the new zero-on-one-side rule, the
    (day, event) cell union, and the pass/fail rollup. Not the network or the wrangler call.
    Why: this logic now decides whether we delete a data source we cannot recover, it is about
    thirty lines of branching, and today none of it is reachable by a test. Precedent exists —
    `tests/lint-migrations.spec.ts` already covers a file in `scripts/`. Test file would be
    `tests/compare-ae-d1.spec.ts`; `vitest.config` includes `tests/**/*.spec.ts`, so it is
    picked up with no config change.
51. **If we do test it, how do we stop `import` running a real comparison?** The script runs
    everything at top level today, so importing it would fire the AE query and shell out to
    wrangler.
    My rec: **keep one file and guard the run behind a main check** —
    `if (import.meta.url === pathToFileURL(process.argv[1]).href) { … }`. Why: a two-line
    idiom, no second file to find, and the CLI behaviour is unchanged. The alternative is
    splitting the pure logic into `scripts/compare-lib.mjs`, which is cleaner in the abstract
    but adds a file to a tool that is deleted at PR 3.

**Items 50 and 51 answered: both as recommended — Jamie 2026-08-07.** Unit tests for the pure
logic only, in `tests/compare-ae-d1.spec.ts`; one file, guarded by a `import.meta.url` main check.

## 11. Done / test plan

Ledger: **Settled: Jamie 2026-08-07 (accepted all recommendations, CI corrected per item 65) · Ack: Override: Jamie 2026-08-07 (Dave waived)**

### QA level, agreed up front

52. **Unit tests plus one manual production run. No Playwright, no e2e, no CI job.** (assumed —
    there is no UI and no deployed surface; the whole thing is a script a human runs. CLAUDE.md
    asks for QA proportional to the change, and a browser matrix on a CLI tool is the
    disproportionate case it warns about)
53. `npm test` (vitest) is the only gate that runs automatically. There is no eslint config in
    the repo, so there is no lint step to satisfy. (assumed — verified in `package.json`)

### Unit tests — `tests/compare-ae-d1.spec.ts`

54. **Tolerance**: inside 1% passes; inside the absolute 3 passes; outside both fails; the
    floor is `max(3, 1%)` so 3 wins at low volume and 1% wins above 300.
55. **The zero rule (item 22)**: AE > 0 with D1 = 0 fails regardless of magnitude; D1 > 0 with
    AE = 0 fails; both zero is not a cell at all and never appears.
56. **Cell union (item 17)**: an event present on only one side still produces a cell; the
    event list is never a hardcoded array.
57. **Partial days**: today is excluded from the verdict on both sides and reported as skipped.
58. **Rollup and exit code**: any failing cell fails the run and exits 1; all-clear exits 0;
    an unreachable source exits 2.
59. **Row count vs weighted sum (item 38)**: when the two sides hold the *same number of rows*
    but different weighted totals, the output says so distinctly — not "N events missing".
60. **The 2026-08-04 case is the regression fixture.** AE 18 rows / 27 weighted against D1
    18 rows / 18 weighted must report *same row count, different sample weighting*. This is
    the single test that justifies the whole change: the old script could not express that
    distinction, and a day was spent on the ambiguity. (assumed — but flagged for `da-brief`
    as the most important item in this section)

### Manual acceptance

61. **One real run against production, compared against a known-good result.** The hand-run
    sweep on 2026-08-07 gives the expected answer: **185 non-empty cells, 40 days
    (2026-06-28 to 2026-08-06), zero out of tolerance, two in-band drifts on 2026-08-06**
    (`puzzle_start` −1, `route_change` −2). The rewritten script must reproduce that, allowing
    for whatever full days have accrued by the time it runs.
62. The run needs `CF_ANALYTICS_TOKEN` in `.env` **and** wrangler credentials for the D1 half.
    Claude cannot perform this step — `wrangler d1 … --remote` is blocked by the guard hook —
    so **Jamie runs it and pastes the output.** (assumed — same constraint that shaped this
    whole task)

### Definition of done

63. Tests in 54–60 pass under `npm test`; the manual run in 61 matches; ANALYTICS.md carries
    the 2026-08-04 record, the 2026-08-06 in-band pair, and the corrected description of what
    the gate now checks; `da-build` has passed; the PR is open against `staging` and **not**
    merged by Claude. (assumed)
64. **Explicit non-goal: this does not tick the PR 3 checklist.** Retiring AE stays a separate
    decision on separate evidence, and needs three consecutive clean days including a weekend
    — which this change makes measurable, not satisfied. (assumed)

### Correction — CI, per Jamie 2026-08-07

65. **Items 52 and 53 were wrong to say "no CI job".** Corrected against
    `.github/workflows/`: CI runs automatically and this change cannot opt out of it.
    - `ci-smoke.yml` — on pull requests to **`main` and `staging`**. Runs `npm test` (vitest)
      then `npm run test:e2e:smoke` (chromium-desktop only).
    - `ci-matrix.yml` — on pull requests to **`main` only**. The remaining engines, plus the
      separate `legacy-chromium` spec set.
66. **What that changes, in practice: nothing about the work, but the QA statement is now
    honest.** The PR into `staging` will run vitest *and* a chromium Playwright smoke pass
    whether or not this change needs one. The correct framing of item 52 is: **this change
    adds unit tests and adds no e2e specs**, and Claude still never runs Playwright locally —
    CI does it, on hardware that can.
67. The new `tests/compare-ae-d1.spec.ts` is picked up by `npm test`, so it runs inside the
    existing smoke gate with no workflow edit. (assumed — `vitest.config` includes
    `tests/**/*.spec.ts`)
68. A green `ci-smoke` on the `staging` PR is therefore part of the definition of done in
    item 63, rather than something separate. (assumed)

## da-brief review — 2026-08-07

Fresh-context review. 3 High, 7 Medium, 3 Low. Resolutions below; numbering continues.

### H1 — the row-count check is wrong on live days (accepted, resolved in 70–72)

70. **The finding, and it is correct.** `toImportRow` maps one AE row to one D1 row and
    preserves the interval, so on **backfilled** days AE `COUNT()` equals D1 `COUNT(*)`. On
    **live** days D1 writes one row per event at `sample_interval = 1` while AE stores sampled
    rows — so on 2026-08-05 a row-count comparison reads **AE 819 against D1 1,053**, a 22%
    gap that is entirely correct behaviour. Every day the PR 3 gate cares about from here is a
    live day, so item 38 as written would fail the gate permanently on correct data. Item 60's
    fixture is a backfilled day, so the tests would have enshrined the wrong semantics.
71. **Resolution: row counts are diagnostic, never a verdict.** The pass/fail verdict stays
    exactly as settled in items 21 and 22 — weighted sum against weighted sum, ±1%/±3, plus the
    zero rule. Row counts are printed on every cell and **can never fail a run on their own.**
    This still delivers what item 38 was for: the 2026-08-04 cell would have printed
    `AE 18 rows / 27 weighted · D1 18 rows / 18 weighted`, which is unambiguous on sight.
72. **The D1 query also returns `SUM(backfilled)` per cell**, so each cell can be labelled
    `backfilled`, `live` or `mixed`. Without it the printed row counts are uninterpretable — an
    AE/D1 row-count difference is a real import defect on a backfilled cell and expected
    behaviour on a live one, and the reader cannot tell which without the label. One extra
    column on a query already being run. (This is the cheap half of what da-brief offered as
    option (b); the expensive half — failing the run on backfilled-cell row mismatches — is
    deliberately not taken, because `backfilled` cells stop existing at PR 3.)

### H2 — verdict semantics undefined (accepted, resolved by 71)

73. Item 71 is the missing statement: the verdict is over weighted sums only. The ±1%/±3
    tolerance and the item-22 zero rule apply to weighted sums and **not** to row counts.
    Item 58's "any failing cell fails the run" now has a definition to test against.

### H3 — the main-guard must cover module-scope `process.exit` (accepted)

74. **`scripts/compare-ae-d1.mjs:45–54` calls `process.exit(1)` at module scope** when no token
    is found. `ci-smoke.yml` runs `npm test` on every PR into `staging` and `main` with no
    `.env` and no `CF_ANALYTICS_TOKEN` — so guarding only the comparison loop would kill the
    vitest process during test collection, turning a required check red. Item 67 asserted the
    opposite without noticing.
75. **The module must be side-effect free on import.** argv parsing, `loadEnv()`, the token
    check, the AE `fetch`, the `execFileSync`, every `console.log` and every `process.exit`
    live inside a guarded `main()`. The pure functions are named exports. The spec imports
    only those. This supersedes the looser wording of item 51.

### Medium

76. **M1 — use the repo's own main-guard idiom, not the naive one.** Item 51 proposed a form
    this repo has already found and fixed bugs in. Copy `scripts/lint-migrations.mjs:116`
    verbatim: `process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href`.
    Three things have to line up and each has silently failed open before, per the comment at
    `lint-migrations.mjs:105–115`: `pathToFileURL` rather than a template string (`import.meta.url`
    is percent-encoded, so a checkout path containing a space made the naive compare false);
    `realpathSync` (Node resolves symlinks in `import.meta.url` but not in `argv[1]`); and the
    `process.argv[1] &&` guard (`argv[1]` is undefined under `node -e`, and without it
    `pathToFileURL` throws and the module cannot be imported at all — which is exactly the
    failure H3 is about). Copy the line, do not re-derive it.
77. **M2 — AE rejects `COUNT(*)`.** It must be `COUNT()` with zero arguments — verified
    2026-08-06, already recorded in ANALYTICS.md. The AE query shape is:
    `SELECT toStartOfDay(timestamp) AS day, blob1 AS event, COUNT() AS rows, SUM(_sample_interval) AS weighted … GROUP BY day, event`.
    Both aggregates come back as **strings** and need `Number()`.
78. **M3 — the zero rule can make item 64's three-clean-day streak unpassable. Needs Jamie.**
    The live path demonstrably loses 1–3 rows a day (2026-08-06: −1 and −2). Four of the ten
    events run at 1–6/day, so one lost row on a 1/day event gives AE 1 / D1 0 → hard fail under
    item 22 → the streak resets, possibly forever.
    My rec: **keep item 22 as Jamie decided — a zero cell is a hard fail — and resolve it at
    the streak instead.** A zero-rule failure is reportable and **Jamie may sign it off without
    resetting the item-64 streak**, provided it is recorded in ANALYTICS.md with the day, event
    and counts. Why this way round: it leaves the detector as sensitive as it was designed to
    be and puts the judgement where a human already is, rather than silently widening the rule
    until it stops firing.
79. **M4 — item 61's acceptance figure needs the right command and a condition, not an
    equality.** `--days` defaults to 30; the baseline is 40 days. Run
    `node scripts/compare-ae-d1.mjs --days 40`. Acceptance is: **zero cells out of tolerance,
    and the two known 2026-08-06 in-band drifts reported rather than swallowed.** The
    185-cells-over-40-days figure is an as-of-2026-08-07 reference, not an assertion — cells
    also disappear off the old end as AE's ~90-day retention deletes them.
80. **M5 — the baseline came through a different read path than the script uses.** Items 29 and
    61 took the D1 side from `/api/stats?period=all`; the script uses
    `wrangler d1 execute --remote`. The queries are equivalent today — `getStats`'s `daily` is
    the same `SUM(sample_interval)` grouped by day and event, filtered on hostname — but
    `/api/stats` carries `Cache-Control: max-age=300` and is bounded by `period`, not `--days`.
    Recorded here so that a first-run disagreement is attributable. **The script's own first
    run is what becomes the real baseline**, not the hand-run figure.
81. **M6 — the row 7447 warning must reach the doc someone will actually be reading.** Item 44's
    warning currently lives only in this work file. ANALYTICS.md's "Restarting a halted import"
    section documents the exact rewind that would destroy the correction. **Add that section to
    item 47's list**, carrying the `id = 7447` warning and the re-fix `UPDATE`.
82. **M7 — specify the output line, because item 60 is asserted against it.** Per cell:
    `day · event · AE rows/weighted · D1 rows/weighted · origin · delta · verdict`, where
    `origin` is the item-72 label. The 2026-08-04 fixture must produce
    `AE 18/27 · D1 18/18 · backfilled` and a verdict naming a **sample-weighting** difference,
    not a missing-events one. This refines item 26, which was settled before item 38 added a
    second per-cell quantity.

### Low — two fixed, one deferred

83. **L1 — fixed.** Item 4's "ten event types" is right and item 31's "nine events" was wrong:
    `VALID_EVENTS` (`src/worker/index.ts`) holds ten. 2026-08-05 happened to record nine of
    them. Ten is the number.
84. **L2 — fixed.** Item 65's CI list was incomplete: `ci-smoke.yml` runs
    `npm run lint:migrations` **before** `npm test`, then the chromium smoke pass. No impact
    here — no migrations are touched — but the list was presented as verified.
85. **L3 — fixed.** Item 54's 1% is **1% of the AE value** (`Math.max(3, ae * 0.01)`, as
    today), and the test asserts that side explicitly.

### Sign-off

69. **Dave's acks waived by Jamie, 2026-08-07.** *"skip dave's acks it's not
    maths/gameplay/feature related."* Recorded as **`Override: Jamie 2026-08-07`** on every
    joint section, not as an ack from Dave — Dave has not seen this brief. The waiver is
    sound on the facts: no maths, no gameplay, no user-facing behaviour, no new feature. If
    any of those change during planning or build, the waiver does not carry over and Dave has
    to be asked from scratch.
