# Analytics

Where event data lives, how `/stats` reads it, and what is still owed before Analytics
Engine can be switched off.

Plan: [`docs/work/2026-08-04-analytics-range-chart-plan.md`](work/2026-08-04-analytics-range-chart-plan.md).
Brief: [`docs/work/2026-08-03-analytics-range-chart-brief.md`](work/2026-08-03-analytics-range-chart-brief.md).

---

## Why we moved off Analytics Engine

AE retains roughly 90 days and then deletes. Measured against the live dataset on
2026-08-04, the oldest surviving row was **2026-05-04** — so an "all time" range was
already impossible, and history was being lost every single day. D1 keeps rows
indefinitely.

## Storage

| | |
|---|---|
| Database | `clumeral-analytics` (D1) |
| Binding | `ANALYTICS_DB` |
| Schema | `migrations/analytics/0005_create_analytics_events.sql` |
| Backfill cursor | `migrations/analytics/0006_create_backfill_state.sql` |
| Write path | `POST /api/event` → `recordEvent()` in `src/worker/analytics-db.ts` |
| Read path | `GET /stats`, `GET /api/stats` → `getStats()` |

**Prod and pre-prod are separate databases** — `clumeral-analytics` and
`clumeral-analytics-preprod`, selected by the `env.preprod` block in `wrangler.jsonc` at
build time. Branch previews cannot read or write production analytics at all.

This supersedes the earlier decision to share one database across hostnames. That call was
made to avoid maintaining a second migration target by hand; adopting wrangler's own
`d1 migrations apply` removed the cost, so the split is now free. See
[the pre-prod split spec](superpowers/specs/2026-08-05-clumeral-preprod-split-design.md).

**The `hostname` column stays regardless.** `/stats` is locked to the host it is called
from, so `clumeral.com/stats` shows production and a preview's `/stats` shows that preview.
That is now belt-and-braces rather than the isolation mechanism, and it costs nothing.

**Writes are fire-and-forget.** The D1 insert goes through `ctx.waitUntil` with its own
`.catch`, so the event POST always answers 202. A D1 outage costs rows, never responses —
and, deliberately, raises nothing visible. See "Known limitations" below.

## Sampling — read this before trusting any number

Analytics Engine sampled our data. Measured 2026-08-04 across all hostnames:

| `_sample_interval` | rows |
|---|---|
| 1 | 7,240 |
| 2 | 96 |
| 3 | 11 |
| 10 | 1 |

`COUNT()` = 7,348. `SUM(_sample_interval)` = 7,475. **Every figure the old dashboard
showed undercounted by 127 events, 1.70%.**

So: **every count is `SUM(sample_interval)`, never `COUNT()`.** Rows we write ourselves
carry interval 1, so the sum is exact for them and correctly weighted for imported ones.

### The one place this cannot be fixed

Unique users and new users are `COUNT(DISTINCT uid)`. A sampled row stands for several
events but names exactly **one** uid — the other users are unrecoverable, not merely
unrecorded. **Unique/new-user figures over the imported window are a floor, not a total.**
For rows written after the cutover they are exact. This is a property of the source data
and cannot be corrected after the fact.

## Ranges

`?period=` accepts `7`, `30`, `90` and `all`. Anything else — junk, a negative, `60`,
empty — is 30 days. Ranges cover **whole UTC days including today**, not a rolling multiple
of 24 hours, so "7d" is seven day-columns rather than 168 hours ending now.

## The chart

Geometry lives in `src/worker/chart.ts` as pure functions; `stats.ts` renders. Two things
worth knowing before editing it:

- **All geometry is in viewBox units**, and the SVG scales. The container is 592px on
  desktop and 327px on a 375px phone, so the scale factor is ~0.99 and ~0.55. Thresholds
  are sized for the narrow case; a rule tuned on desktop under-thins text by ~1.8× on a
  phone. This applies to font sizes too, which is why `.axis` and `.direct` carry
  breakpoints.
- **A zero day renders a stub below the baseline**, not a sliver above it. Above the line
  it disappears once bars touch — which happens past ~95 days, i.e. at exactly the range
  "All time" exists for — and a zero day would then be indistinguishable from a rendering
  bug.

Bars are not focusable. The full figures are in a visually-hidden table, and a test
compares that table to the bar titles cell for cell.

### Contrast, measured 2026-08-04

`/stats` hardcodes its colours and does **not** use `src/palette.ts`, so
`tests/palette-contrast.spec.ts` never covered it. `tests/stats-contrast.spec.ts` does now.

| Token | light page | light card | dark page | dark card |
|---|---|---|---|---|
| `--ink` | 12.99:1 | 14.90:1 | 13.39:1 | 12.02:1 |
| `--ink-muted` | 5.58:1 | 5.99:1 | 6.98:1 | 6.44:1 |
| `--acc` (bars, graphic, needs 3:1) | 4.71:1 | — | 6.19:1 | — |
| `--grid` (supplementary) | 1.75:1 | — | 2.36:1 | — |

The token that shipped for `.domain-label` was `rgba(38,38,36,0.5)` — **2.97:1**, below AA
and below even the 3:1 graphics threshold. That is what `--ink-muted` replaced.

## Migration status

**PR 1 — merged 2026-08-05.** Schema, dual write, D1 reads, the rebuilt chart, test harness,
docs. D1 has collected every event since; `/stats` shows post-merge data only until PR 2 runs.

**Expect production `/stats` to look wrong for a few days, and it will not be an outage.**
Until PR 2 backfills, every pre-cutover day in the 7/30/90 ranges renders as a zero-day stub
— indistinguishable from a genuine no-plays day — and "Avg daily plays" divides real plays by
the full window, so it reads far too low. "All time" is the honest view during this period,
because it starts at the first row we actually hold.

**PR 2 (this one).** The backfill: imports everything from before the dual-write cutover out
of AE, all hostnames, idempotent per window, driven by a temporary per-minute cron. See
**The backfill** below.

**PR 3.** AE removal — `writeDataPoint`, the `ANALYTICS` binding, the second cron entry,
and the API token revoked. Gated on the comparison below.

## The backfill

`src/worker/backfill.ts`, run from `scheduled()` on a temporary `* * * * *` cron entry and
deleted whole in PR 3. It walks UTC days forward from AE's earliest surviving row up to the
instant the dual write went live, and stops.

**It runs in production only**, gated on `env.ENVIRONMENT === 'production'` — an unset value
means no. Pre-prod versions are uploaded and never deployed, so they should never fire a
cron at all, but "should never" is not a check, and pre-prod importing real history would
quietly make its own numbers useless for testing.

**What makes it safe to interrupt.** Every window is delete-then-insert, and the `DELETE` is
filtered to `backfilled = 1`, so it can never reach a live dual-written row. The window
imported is exactly the window deleted, and windows close on whole seconds. A run killed
anywhere — between the delete and the insert, mid-batch, or after inserting but before the
cursor moves — is simply re-run, and converges on the same rows. None of this depends on
whether `db.batch()` is transactional, which is still undocumented.

**It is bounded by D1's free-tier limits, not by a guessed batch size.** 50 queries per
invocation and 100 bound parameters per query (= 10 rows per `INSERT`). The batch is sized at
run time from AE's own per-day counts: whole days while they fit, otherwise one day split
into sub-windows. This is not belt and braces — the busiest recorded day is 677 rows against
a mean of ~80, so a day too big for one invocation already exists in the data.

**When it is stuck, it says so.** A compare-and-set lock (`lock_until`) stops overlapping
invocations and is released on every exit; five consecutive failures halt the import with a
`console.error` rather than retrying once a minute forever. Every invocation logs its result
object, so `npx wrangler tail --format pretty` is the window onto all of it.

**Restarting a halted import.** For most failures — an AE hiccup, a D1 error — clearing the
counter is enough:

```sql
UPDATE backfill_state SET consecutive_failures = 0 WHERE id = 1;
```

> **Rewinding past 2026-08-04 destroys a hand-correction.** Row `id = 7447` had its
> `sample_interval` restored to 10 by hand on 2026-08-06 (see the 2026-08-04 record under
> "Comparison gate" below). The backfill's `DELETE` is filtered to `backfilled = 1`, and that
> row is a backfilled row — so re-importing 2026-08-04 deletes the corrected row and rewrites
> it with whatever interval AE returns that time, which may be the same `1` that made it
> wrong. **After any rewind that crosses 2026-08-04, re-check and, if needed, re-apply:**
>
> ```sql
> SELECT id, sample_interval FROM analytics_events WHERE id = 7447;
> UPDATE analytics_events SET sample_interval = 10 WHERE id = 7447;
> ```
>
> The `id` is not stable across a re-import. Find the row by its identity instead:
> `WHERE hostname = 'clumeral.com' AND event = 'incorrect_guess'
> AND ts = (unixepoch('2026-08-04 17:30:26') * 1000)`.

**That alone does not clear a shortfall halt** ("refusing to finish: … rows missing"). The
cursor is already past the end, so every retry re-checks the same total and re-fails. Work out
which is true first:

1. Compare per day — `SELECT strftime('%Y-%m-%d', ts/1000, 'unixepoch') AS day, COUNT(*) FROM
   analytics_events WHERE backfilled = 1 GROUP BY day` against the same query on AE — and find
   the days that are short.
2. **If AE still holds those rows**, this is a real import defect: rewind the cursor to the
   first short day and let the cron re-import from there —
   `UPDATE backfill_state SET next_day = '<day>', sub_offset = 0, consecutive_failures = 0,
   done = 0 WHERE id = 1;`. Re-running a day is safe by design: each window deletes exactly
   what it rewrites, and a window where D1 already holds **more** than AE can still supply is
   kept rather than replaced — and if what it holds stops short of AE's last row, the import
   resumes from there rather than stepping over the remainder.
3. **If AE no longer holds them**, they are gone and no import can recover them. The code
   already checks this itself — it re-asks AE for its current total before halting, and
   finishes if what remains matches what D1 holds — so reaching this state by hand means
   something else is going on. Record the shortfall here before setting `done = 1`.

**It will not call itself finished on one query's say-so.** `done = 1` is terminal — every
later invocation returns before touching AE — so a single empty response would otherwise end
the import part-way, permanently, and an empty response is not an error anywhere. When the
cursor stops because the day-count query is empty, three things have to agree before it
finishes: that query returns no days, a differently
shaped `COUNT()` over the same window returns a row reading zero, and the rows in D1 match
`expected_rows`, the total AE reported at discovery (migration 0007). A shortfall past 1% (or
3 rows) refuses to finish, logs, and counts as a failure — unless AE's *current* total explains
it, which it may only do within a bounded drop (5%) and never from zero. Symmetrically, a row
query that disagrees with the sizing query **aborts before its `DELETE`**, and a window where
D1 already holds more rows than AE can still supply is **kept and skipped** rather than
replaced with fewer.

**Worker secrets.** The backfill queries the AE SQL API over HTTPS and needs `CF_ACCOUNT_ID`
and `CF_API_TOKEN` set on the Worker — the same pair `/stats` used before PR 1 moved reads to
D1. If either is missing it logs and does nothing; it never sends an undefined token.

### Analytics Engine SQL, as it actually behaves

Verified against the live API on 2026-08-06. Each of these was assumed otherwise in the plan
and would have failed at run time in production:

- `COUNT(*)` is rejected — *"COUNT() function must have 0 arguments"*. It must be `COUNT()`.
- Absolute time bounds must be `toDateTime(<epoch seconds>)`. A string literal is refused:
  *"cannot combine the DateTime and String types with the >= operator"*.
- `timestamp` comes back as a second-precision string, so imported rows lose sub-second
  precision. Day bucketing, which is all `/stats` reads, is unaffected.
- Aggregates are returned as **strings** (`COUNT()` → `"677"`); doubles as numbers.
- Projecting `toUnixTimestamp(timestamp) AS ts` makes the underlying column unaddressable in
  `ORDER BY` — order by the alias instead.
- `LIMIT`/`OFFSET` paging is stable given a deterministic `ORDER BY`, and results are
  **unordered by default**, so every query carries one.

### Verified before merge, against the real dataset

The importer was run end-to-end against live Analytics Engine into a local D1 on 2026-08-06,
with a fixed cutoff of 2026-08-05T00:00Z:

- **6,838 rows over 92 days**, which is exactly what AE itself reported held below the cutoff
  — imported and expected agree to the row, with no failures.
- **Every one of the 92 days matched AE exactly** — both `COUNT()` and
  `SUM(_sample_interval)`. Zero mismatches, so the ±1% tolerance was not needed.
- The sub-day path was exercised for real: days over the per-invocation cap, including
  2026-08-03 at 677 rows, imported across several windows.
- Sampling survived: intervals 1 (6,768), 2 (62), 3 (7) and 10 (1), matching AE's own
  distribution.
- 11 hostnames imported, `clumeral.com` 4,690 of 6,838.

This is a local rehearsal, not the production run. It proves the query shapes, the mapping
and the windowing; it cannot prove CPU per invocation, which needs `wrangler tail` against
the deployed cron (Task 15).

### Cutover instant

Recorded here as an exact UTC value once PR 1 is deployed:

> **Cutover: _to be filled in from the first live D1 row after PR 1 merges._**
> `SELECT MIN(ts), datetime(MIN(ts)/1000, 'unixepoch') FROM analytics_events WHERE backfilled = 0;`

The backfill discovers this value itself and freezes it — it is never typed in by hand.

### Comparison gate (blocks PR 3)

Run `node scripts/compare-ae-d1.mjs` from the Pi. A bare run compares **every event** — until
2026-08-07 it silently compared `puzzle_start` alone, which is one event out of ten and could
not have caught an event missing from D1 entirely.

**The unit is the (day, event) cell**, over **full UTC days only** — never a partial day,
which removes the midnight-boundary class of mismatch outright. Cells are built from the
**union** of both sides' keys, so an event present in AE and absent from D1 still produces a
cell rather than vanishing.

**The verdict is weighted sum against weighted sum** — `SUM(_sample_interval)` on the AE side
against `SUM(sample_interval)` on the D1 side. Four outcomes:

- **exact** — the two weighted sums agree.
- **in-band** — they differ by no more than **±1% of the AE value, or ±3 events, whichever is
  larger**. Passes, and gets recorded below.
- **zero-side** — one side is zero and the other is not. **A hard failure whatever its size**,
  checked before the tolerance so AE 1 / D1 0 cannot slide under the ±3 floor.
- **out-of-tolerance** — anything else. A hard failure.

Not "match exactly": at ~80 events/day a ±1% band is ±0.8 events, i.e. a gate that could
never realistically go green. The absolute floor tolerates the real cause — a handful of
requests landing on one write path but not the other around a deploy.

**Row counts are printed and are never a verdict.** They are there to separate "records are
missing" from "a multiplier is missing", which is exactly the ambiguity that cost a day on
2026-08-04. They cannot fail a run, because on a live day AE stores one *sampled* row per
sample interval while D1 writes one row per event — so an AE/D1 row-count gap on a live cell
is correct behaviour, and gating on it would fail forever on good data. Each cell is labelled
`backfilled`, `live`, `mixed` or `—` (D1 has no rows to label) so the reader can tell which
case they are looking at: a row-count difference is a real import defect on a `backfilled`
cell and expected on a `live` one.

Flags: `--days` (default 30), `--host` (default `clumeral.com`), `--event NAME` (narrow to one
event — no longer a default), `--verbose` (print **every built cell**, not just the failures,
the partial days and the in-band ones; ~185 lines on a 40-day window).

Exit codes: **0** all clear, **1** the comparison ran and at least one cell failed, **2** it
could not run — no token, an Analytics Engine error, wrangler unable to reach D1, **or nothing
compared at all**. That last one is deliberate (Jamie, 2026-08-07): a window, host or event
matching no full days is a red gate, and it belongs with "never ran" rather than with "D1
disagrees", because a gate that checks nothing must never read green.

Failing cells are printed under a heading naming their class, because the two are
procedurally different: **out of tolerance** resets the three-clean-day streak, **zero on one
side** is the only class Jamie may sign off. Reading the sign-off rule off the output is the
point of the split.

**Differences inside the tolerance get recorded here with the day, the event and both
counts**, not silently passed.

### The one cell that ever failed this gate — 2026-08-04 `incorrect_guess`

**What it looked like:** AE 27 weighted against D1 18 — apparently nine lost events.

**What it actually was:** **18 rows on both sides. No event was lost.** One imported row —
`id = 7447`, `2026-08-04 17:30:26` — lost its `sample_interval = 10` and imported as 1.

Corrected by Jamie on 2026-08-06 with
`UPDATE analytics_events SET sample_interval = 10 WHERE id = 7447`, verified back at 27.

**One-off, not systemic.** Of the 13 cells in the window where AE's row count differs from its
weighted sum, twelve preserved the interval exactly.

**Mechanism: a hypothesis, not a finding.** `toImportRow`'s `… ? Math.trunc(interval) : 1`
fallback (`src/worker/backfill.ts:313`) would turn a single unparseable `_sample_interval` into
exactly this. It cannot be proven after the fact, because AE is not asked twice.

This cell is now a regression fixture in `tests/compare-ae-d1.spec.ts`, asserting the line the
script prints for it character for character:

```
2026-08-04 · incorrect_guess · AE 18/27 · D1 18/18 · backfilled · -9 · same row count, sample weighting differs
```

**In-band differences, 2026-08-06.** Recorded per the rule above rather than passed silently:

- `puzzle_start` — AE 91 / D1 90 (−1)
- `route_change` — AE 190 / D1 188 (−2)

Both inside the ±3 floor, both on a live dual-write day. Most likely the documented
fire-and-forget D1 write path losing the odd row. This list gains an entry every time a run
reports an in-band cell.

### PR 3 removal checklist

- [ ] Three consecutive full days, including a weekend day, in which **every (day, event) cell
      is inside the tolerance** — not just `puzzle_start`, and not just the days as a whole.

      **The one sign-off route:** a `zero-side` failure may be signed off by Jamie without
      resetting the three-consecutive-clean-day streak, **provided it is recorded here with the
      day, the event and both counts**. No other failure class may be signed off this way — an
      out-of-tolerance weighted cell resets the streak, full stop.
- [ ] The backfill reported `done = 1`. Check the total with
      `SELECT COUNT(*) FROM analytics_events WHERE backfilled = 1` against
      `backfill_state.expected_rows` — **not** `rows_written`, which counts rows inserted per
      invocation and so double-counts any window that was legitimately re-run.
- [ ] Storage measured and recorded here. **Not** via `pragma_page_count()` — D1 refuses it
      over the API with `not authorized: SQLITE_AUTH`, confirmed 2026-08-06. Read it from
      `npx wrangler d1 info clumeral-analytics` or the Cloudflare dashboard instead.
- [ ] `env.ANALYTICS.writeDataPoint` removed from `POST /api/event`
- [ ] `analytics_engine_datasets` removed from `wrangler.jsonc`
- [ ] The per-minute cron entry removed from `triggers.crons`
- [ ] `backfill.ts` and its cron dispatch removed
- [ ] The Analytics Read API token revoked in the Cloudflare dashboard
- [ ] `CF_ACCOUNT_ID` / `CF_API_TOKEN` Worker secrets deleted
- [ ] This file updated to drop the dual-write language

## The API token

A scoped **Account · Account Analytics · Read** token, created by Jamie on 2026-08-03 and
confirmed 2026-08-04 to be sufficient for the AE SQL API — no wider scope is needed.

It is used in **two** places:

- On the Pi, from `.env` at the repo root (gitignored) as **`CF_ANALYTICS_TOKEN`**, by
  `scripts/compare-ae-d1.mjs`.
- **On the Worker, as the secrets `CF_API_TOKEN` and `CF_ACCOUNT_ID`**, by the PR 2 backfill.
  These predate PR 1 — `/stats` queried AE with them until PR 1 moved reads to D1 — so they
  should still be set; PR 1 removed the code, not the secrets. Confirm in the dashboard under
  Workers → clumeral-game → Settings → Variables and Secrets before the backfill is expected
  to run. Missing secrets are a logged no-op, not a crash: the cron fires, the import never
  starts, and only `wrangler tail` says why. Secrets are per-Worker, so they are visible to
  pre-prod versions too — the production gate, not the secret, is what keeps pre-prod out.

Account id: `06ff16a35fdefa6cae9e3463116086aa` — the script defaults to this, so `.env`
needs the token alone.

The D1 half of the comparison goes through `wrangler --remote`, which needs its own
credentials: run `npx wrangler login` interactively, or export `CLOUDFLARE_API_TOKEN`. The
script names both failures rather than dumping a stack trace.

**Expiry: unconfirmed.** Jamie to check whether the dashboard offered a TTL and record it
here. Revoked as part of the PR 3 checklist regardless.

## Known limitations

- **A D1 write failure is silent.** It logs to `console.error` and nothing else. This is
  the pre-existing "analytics failure is silent" problem, unchanged by this work — the
  event POST must not fail because analytics did. If `/stats` ever reads zero after a
  deploy, check `wrangler tail` before assuming there was no traffic. The most likely cause
  is migrations not applied to the remote database.
- **Unique-user counts over the imported window are a floor.** See Sampling above.
- **The hidden table grows with the range.** At "all time" it is one row per day since
  collection began. Fine at a few hundred days; worth revisiting past that.
- **`uid` is retained indefinitely.** A prune step was considered and rejected.
- **`uid` is truncated to 64 characters and `source` to 128, silently.** `POST /api/event` is
  public and unauthenticated, and these rows are permanent with no prune step, so an
  unbounded string would be permanent storage handed to anyone. Real values are nowhere near
  the caps — `uid` is a 36-character UUID and `source` is a short path or one of two literals
  — so nothing legitimate is affected. Truncating rather than rejecting is deliberate: an
  over-long value is far more likely a client bug than an attack, and dropping the event
  would lose a real play.

## Outstanding actions

- **Compare D1 against Analytics Engine before retiring AE** — the gate above. Raised by
  Jamie 2026-08-04: "we'll look at d1, ask you to compare vs ae in a few days."
- **Custom and comparison date ranges** — pick start/end, and compare against the previous
  period / previous year. GitHub issue #297, out of scope here.
