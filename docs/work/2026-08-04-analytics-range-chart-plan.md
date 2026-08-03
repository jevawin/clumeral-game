# Plan — Analytics: D1 migration, all-time range, labelled daily plays chart

From `docs/work/2026-08-03-analytics-range-chart-brief.md` (settled, `da-brief` closed).
Branch: `dev/analytics-range-chart`. Written 2026-08-04.

**Status: awaiting `da-plan`, then Jamie's approval.**

Item numbers in `[brackets]` refer to brief items. Every numbered brief item is traced in
§9. New numbering here starts at P1 and is append-only.

---

## 1. Research results — the brief handed Plan 23 unverified assumptions

The assumption audit [96–118] and the reopened backfill strategy [91–94] required research
before any task could be written. Results first, because three of them change the design.

### 1.1 Verified, brief was right

- **P1. Free-plan cron CPU is 10 ms.** [93] Confirmed on the Workers limits page: cron
  triggers get 10 ms CPU on Free, 30 s on Paid; wall clock is 15 min on both plans.
  Source: https://developers.cloudflare.com/workers/platform/limits/
- **P2. `ctx.waitUntil` gets up to 30 s** after the response. [83] Confirmed, same page.
- **P3. D1 free-tier daily row limits are real** — **100,000 rows written/day** and
  **5,000,000 rows read/day**. [96] These are on the *pricing* page, not the limits page,
  which is why the earlier fetch missed them. The figures quoted from memory were correct.
  Source: https://developers.cloudflare.com/d1/platform/pricing/
- **P4. AE SQL returns raw rows.** [100] Confirmed — the documented example selects
  `timestamp, blob1, double1` per row. Item 16's no-granularity-seam argument holds.
- **P5. `_sample_interval` is selectable per row.** [101] Confirmed: "The rate at which the
  data is sampled is exposed via the `_sample_interval` column." Item 63's schema fix works
  as written. Source: https://developers.cloudflare.com/analytics/analytics-engine/sql-api/

### 1.2 Verified, brief was WRONG — in our favour

- **P6. AE SQL supports `OFFSET`.** [102, L1/79] The brief twice asserted "AE SQL has row
  limits and no `OFFSET`" and built the day-paged backfill around that. The SQL reference
  documents `LIMIT`, `OFFSET` and `ORDER BY` as supported.
  Source: https://developers.cloudflare.com/analytics/analytics-engine/sql-reference/statements/
  Consequence: paging is a plain `ORDER BY timestamp LIMIT n OFFSET m`, so the backfill
  cursor can be a row offset. **We still use a day-window cursor** — not because paging
  forces it, but because a day window is what makes re-running a batch idempotent (§3.3).
  The `OFFSET` finding removes a constraint rather than changing the design.

### 1.3 NOT verified — brief never considered these, and they resize the backfill

- **P7. D1 allows 50 queries per Worker invocation on the Free plan** (1,000 on Paid).
  This is the binding constraint on backfill batch size, and **the brief does not mention
  it anywhere**. The whole backfill discussion [86, 91–94] argued about the 10 ms CPU
  budget; the query cap bites first and is a hard error rather than a soft one.
  Source: https://developers.cloudflare.com/d1/platform/limits/
- **P8. Maximum 100 bound parameters per query.** Same page. With the 9-column schema in
  [64] that is **11 rows per bound multi-row `INSERT`**. Finding M3 [71] requires `.bind()`
  throughout, so this cap applies to the backfill inserts and cannot be dodged with string
  interpolation.
- **P9. Whether statements inside `db.batch()` count individually against P7 is
  undocumented.** The `batch()` API page says only that statements "execute and commit,
  sequentially, non-concurrently". Secondary sources say they count individually. **Task 6
  measures this before the batch size is fixed**, and the design is safe either way because
  it is sized for the pessimistic reading.
- **P10. Indexes multiply rows written.** "Indexes will add an additional written row when
  writes include the indexed column." Item 64 specifies two indexes, so **each event costs
  3 rows written**, not 1. Item 12's "0.08% of the daily write budget" is out by 3× — the
  real figure is ~0.24%, still negligible. It matters for the backfill: ~7,300 AE rows is
  ~22,000 rows written against the 100k/day ceiling, so **the whole backfill must not be
  attempted more than ~4 times in one day**. Not a constraint in practice; recorded because
  a retry loop that ignored it could exhaust the daily budget.
- **P11. AE's default and maximum result-row `LIMIT` are undocumented.** Measured in
  Task 6 against the real API rather than assumed.

### 1.4 BLOCKED — cannot be resolved without Jamie

- **P12. The scoped Analytics Read token cannot be tested. `.env` does not exist.**
  Item 95 records Jamie creating `.env` with the token on 2026-08-03 and verifying it
  untracked. **The file is not in the working tree today.** `.gitignore:46` is `.env` as
  recorded, so the ignore fix [90] landed correctly, but the file itself is gone.
  This blocks item 97 — the audit's own highest-priority test, flagged precisely because
  Jamie had already created the token on an unverified claim that
  **Account · Account Analytics · Read** is the permission the AE SQL API checks.
  Also missing: `CF_ACCOUNT_ID`, which is a Worker secret and not available locally, so
  even with the token the query needs the account id supplying.
  **Question for Jamie — see §8.** Everything else in this plan is written and independent;
  only Task 6's measurements and the Task 12 comparison script depend on it.
- **P13. Item 114's type sign-off has not happened.** The audit flagged that [64] picked
  `ts INTEGER`, `value REAL`, `new_user INTEGER`, `sample_interval INTEGER` on my judgement
  inside a section signed before the schema existed, and that **Jamie owns types**. It is
  still unsigned. §8 puts the column list in front of him with a recommendation on the one
  questionable column.

### 1.5 Deferred to Build, with measurement attached

P14. CPU per insert [105], row size [104], `EXPLAIN QUERY PLAN` on the two indexes [107],
bar legibility at 365 days [108] and screen-reader behaviour [112, 113] all need running
code or rendered output. Each is attached to a specific task below rather than left open.

---

## 2. Sequencing — this is three PRs, not one

The brief's item 24 cutoff makes a single PR impossible, and it is worth being explicit
about why rather than discovering it during Build.

The backfill must import everything **before the instant D1 writes went live**. That
instant is not knowable while writing the code — it is when Jamie merges. So:

- **PR 1 — schema, dual write, D1 reads, chart, docs.** Everything except the backfill.
  After merge, D1 begins collecting. `/stats` reads D1 and shows only post-merge data.
- **PR 2 — backfill.** Uses the earliest real D1 row as the cutoff (§3.3), which only
  exists once PR 1 is live. Runs over ~30 minutes (§3.4), then `/stats` shows full history.
- **PR 3 — AE removal.** Gated on the item 60 comparison passing. Not written here beyond
  the checklist in `docs/ANALYTICS.md`.

**P15.** This ordering means Jamie reviews a chart in PR 1 that is drawing a handful of
days. That is expected, not a defect — the preview URL will look sparse until PR 2 runs.

---

## 3. Design decisions Plan is settling

### 3.1 Reads: the six queries ported to D1

[106] said "draft all six against D1 in full rather than assuming the shape survives".
Done, in Task 4. Two ClickHouse-isms have no SQLite equivalent [L2/79]:

- `toStartOfDay(timestamp)` → `strftime('%Y-%m-%d', ts/1000, 'unixepoch')`. UTC by
  definition, matching [M6/74].
- `NOW() - INTERVAL '<n>' DAY` → a JS-computed epoch-ms cutoff passed as a **bound
  parameter** [M3/71]. `all` passes no cutoff and the clause is omitted entirely — not
  `1=1`, which is what produces today's accidental all-time query [M4/72].
- Every `COUNT()` → `SUM(sample_interval)` [63], **except** the two
  `COUNT(DISTINCT blob2)` unique-user queries.

**P16. Sampling and distinct counts are irreconcilable, and this needs stating rather than
quietly ignoring.** `SUM(sample_interval)` cannot be applied to a distinct-uid count — if
one stored row stands for 8 real events, it still names exactly one uid, and the other 7
users are unknowable. So unique/new user figures over the backfilled window are a **floor**
wherever AE sampled. For live rows `sample_interval` is 1 and the count is exact.
Recommendation: accept it, and record it in `docs/ANALYTICS.md`. Task 6 records the real
`_sample_interval` values observed [63] — if they are all 1, as [9] expects at 81
events/day, this is moot in practice and we will know rather than assume.

### 3.2 Writes: dual write

Per [83]: `ctx: ExecutionContext` added to the `fetch` signature (`index.ts:221`),
`writeDataPoint` stays exactly as it is, and the D1 insert goes in
`ctx.waitUntil(insert.catch(err => console.error(...)))`. Response stays 202, unchanged.

### 3.3 The backfill: idempotent by construction

[92] fixes resumable + idempotent + hard cutoff as the one thing Build may not compromise.
The mechanism:

**P17. A `backfill_state` table, one row, holding the cutoff, the cursor and a lock.**

```sql
CREATE TABLE backfill_state (
  id          INTEGER PRIMARY KEY CHECK (id = 1),
  cutoff_ms   INTEGER,           -- frozen on first run; the item 24 hard cutoff
  next_day    TEXT,              -- 'YYYY-MM-DD' UTC, the next day to import
  done        INTEGER NOT NULL DEFAULT 0,
  lock_until  INTEGER NOT NULL DEFAULT 0,
  rows_seen   INTEGER NOT NULL DEFAULT 0
);
```

**P18. The cutoff is discovered, not written by hand.** On the first invocation, before any
insert, the backfill reads `SELECT MIN(ts) FROM analytics_events` — the earliest live
dual-written row — and freezes it into `cutoff_ms`. Every AE query then filters
`timestamp < cutoff_ms`. Thereafter `cutoff_ms` is read from the row and never recomputed,
so it cannot drift once backfilled rows exist. If the table is empty (PR 1 not yet live, or
no traffic since), the run **aborts and logs**, rather than backfilling into a void.
This is exactly [24]'s hard cutoff with no manual timestamp to get wrong.

**P19. Idempotency comes from a delete-then-insert day window, not from the cursor.**
Advancing a cursor after a commit is not enough: a run killed mid-batch leaves rows written
and the cursor unmoved, so the retry duplicates them. Instead each day window is made
re-runnable:

1. `DELETE FROM analytics_events WHERE backfilled = 1 AND ts >= ? AND ts < ?`
2. insert that day's AE rows with `backfilled = 1`
3. advance `next_day`

A `backfilled INTEGER NOT NULL DEFAULT 0` column is added to the schema in [64] for this —
**the DELETE can never touch a live dual-written row**, because those carry `backfilled = 0`.
Re-running any day, at any point, converges on the same result. This holds whether or not
`db.batch()` is transactional (P9), which is why the design does not depend on resolving it.

**P20. Overlapping invocations are prevented by a compare-and-set lock.** [115] asked for a
stated position. `UPDATE backfill_state SET lock_until = ?now+120s? WHERE id = 1 AND
lock_until < ?now?` — a single-statement CAS. The run proceeds only if
`meta.changes === 1`; otherwise another invocation holds the lock and this one exits
immediately. The lock self-expires, so a killed run cannot wedge the backfill permanently.
This matters more than it did in the brief because §3.4 runs the cron every minute.

### 3.4 Backfill batch size and drive mechanism — [93]'s open question

**Sizing, from P7/P8 rather than from a guess:**

- 50 D1 queries per invocation (P7), of which reserve 3 for the CAS, the cursor read and
  the cursor write → **47 available**.
- 11 rows per bound multi-row `INSERT` (P8).
- 1 `DELETE` per day window (P19).
- At ~81 rows/day: one day = 1 DELETE + 8 INSERTs = 9 queries. **Five days = 45 queries**,
  fitting inside 47 with headroom for a heavier-than-average day.

**P21. Recommendation: 3 days per invocation, not 5.** The query maths permits 5; the 10 ms
CPU budget (P1) is the unmeasured half, and `JSON.parse` of ~400 AE rows plus building 37
statements is exactly the cost [91] warned against guessing at. Three days is ~243 rows and
27 queries — comfortable on both axes, and the constant is one line to raise once Task 6
has real `wrangler tail` numbers. A CPU kill is harmless here (P19 makes the retry safe),
so this is tuning, not risk.

**P22. Drive mechanism: a second cron expression, dispatched on `event.cron`.**
[93] listed three options. Recommendation:

```jsonc
"crons": ["0 0 * * *", "* * * * *"]   // second entry temporary, removed in PR 3
```

`scheduled()` switches on `event.cron`: the daily entry runs `runDailyCron` exactly as
today, the per-minute entry runs the backfill and nothing else. At 3 days per run, ~90 days
completes in **~30 minutes**, unattended, the night PR 2 merges.

Why this over the alternatives:
- **vs. the nightly cron alone** — 30 invocations is 30 nights. [94] says explicitly not to
  accept that when a measured batch can do better.
- **vs. a secret-guarded fetch route driven from the Pi** — that introduces a *mutating*
  internet-reachable endpoint, which [93] itself flags as not covered by item 19's
  won't-fix, plus a guard secret to build and a loop to babysit. The cron needs neither.
- **vs. Queues / Durable Object alarms** — more moving parts, and free-plan availability
  would itself need verifying. [94] prefers fewer moving parts where they conflict.

Once `done = 1` the handler returns immediately, so leaving the per-minute cron in place
costs one trivial invocation a minute until PR 3 removes it. **P23.** Those invocations
count against the free 100k requests/day; at 1,440/day for a few days that is ~1.4%, and
PR 3 removes the entry. Recorded so it is a known cost rather than a surprise.

### 3.5 Chart arithmetic — [108–111]

**P24. Fit-to-width stands [39], with gaps that collapse.** The container is
`max-width: 40rem` (~640 px), so rendered bar pitch is ~`640/days` regardless of the
viewBox. At 365 days that is 1.75 px. Rule: `gap = pitch >= 6 ? 2 : 0`, and
`barWidth = min(24, pitch - gap)`, bars **centred in their slot**. Past ~100 days the bars
butt together and the chart reads as a filled silhouette — which is the correct read for a
trend at that range, and better than [39]'s rejected horizontal scroll, which hides the y
axis. [111]'s concern at 7 days is real and the centring is the answer: 24 px bars in 91 px
slots, evenly spaced rather than left-packed. **Build looks at the rendered output at 7,
30, 90 and All before this is called done** [108].

**P25. X-label step derived from text width, not guessed [109].** "5 Jul" in Inconsolata at
0.6875 rem is ~40 px, plus 8 px minimum separation → 48 px per label → ~12 labels in 600 px.
Rule: `step = max(1, ceil(days / 12))`, and **the last day is always labelled** whatever the
step lands on. Gives 7 labels at 7d, every 3rd day at 30d, every 8th at 90d, ~12 at 365d.
Replaces [33]'s daily/weekly/monthly guess with something testable.

**P26. The two direct labels get a collision rule [110].** [32] labels the highest bar and
the most recent bar and never said what happens when they interact. Stated rule:
1. **Same bar** → one label only.
2. **Label boxes would overlap** (centres < 48 px apart) → render the **max** label only.
   The most recent bar is already anchored by the x axis's always-labelled last day (P25),
   so it is the one that can be dropped without losing the reader's bearings.
3. **At the plot edges** → `text-anchor: end` when the label centre is within 24 px of the
   right edge, `start` within 24 px of the left, `middle` otherwise. Without this the max
   label overflows the viewBox at "All", where the newest bar is often the highest.

### 3.6 The item 116 tolerance question

**P27. The AE↔D1 comparison gate gets a stated tolerance.** [116] flagged that "match
exactly" [23, 59, 60] may never go green. Recommendation: compare **per-day
`SUM(_sample_interval)` on the AE side against `SUM(sample_interval)` on the D1 side**
[63], over **full UTC days only** — never a partial day, which removes the midnight-boundary
class of mismatch outright. Gate: **every full day within ±1%, and no day off by more than
2 events.** A larger gap means a real defect and blocks PR 3. Rationale: the residual causes
are requests landing on one write path but not the other around a deploy, which is a handful
of events at most; a genuine breakage looks like a whole day at zero or half, not a 1% drift.

---

## 4. Files

**Created**
- `migrations/0005_create_analytics_events.sql` — [64] schema + `backfilled` (P19) + the two
  indexes. **0005, not 0002** [65] — `0002_import_legacy_feedback.sql` is gitignored.
- `migrations/0006_create_backfill_state.sql` — P17.
- `src/worker/analytics-db.ts` — write path + the six ported read queries.
- `src/worker/chart.ts` — pure chart maths, no DOM, no SQL.
- `src/worker/backfill.ts` — PR 2 only.
- `scripts/compare-ae-d1.mjs` — [M8/76], run from the Pi.
- `tests/analytics-db.spec.ts`, `tests/chart.spec.ts`, `tests/backfill.spec.ts`
- `tests/fixtures/analytics-seed.sql` — [M7/75].
- `docs/ANALYTICS.md` — [28].

**Modified**
- `src/worker/index.ts` — `ctx` on `fetch` [83]; dual write; both period parsers [30, M4/72];
  the 503 secrets guard removed [M7/75]; `scheduled()` cron dispatch (PR 2).
- `src/worker/stats.ts` — `getStats` re-pointed at D1; `renderDashboard` chart rebuilt.
- `wrangler.jsonc` — `ANALYTICS_DB` binding [82]; second cron (PR 2).
- `package.json` — `e2e:db` [M7/75].
- `tests/stats-dashboard.spec.ts` — `fakeStats()` reshaped off AE `QueryResult` [M10/78].
- `CLAUDE.md` — outstanding-actions line [28].
- `.gitignore` — already done [90], no further change.

---

## 5. Tasks — PR 1

Tests first in every task [test-driven-development].

**Task 1 — schema and binding.** [64, 82, P13, P19]
Write both migrations. Add the `ANALYTICS_DB` binding to `wrangler.jsonc`. Apply locally via
`wrangler d1 execute clumeral-analytics --local --file=...`.
*Blocked on:* Jamie creating the `clumeral-analytics` D1 database (§8) and signing the
column types (P13).
*Proves it:* `EXPLAIN QUERY PLAN` on the daily-counts query against a seeded table shows
both indexes used [107]; committed as a comment in the migration.

**Task 2 — the write path.** [83, H5/68]
`recordEvent(db, {event, uid, source, hostname, value, newUser})` in `analytics-db.ts`,
bound parameters throughout.
*Tests:* the H5 integration test — POST each of the **10** valid events [M1/69] and assert
the resulting row column by column: `uid`, `new_user` as 0/1, `source` non-null on
`undo_used`/`reset_used` and null elsewhere, `hostname`, `value`, `sample_interval` = 1,
`backfilled` = 0. Plus [58] as reframed: a D1 outage leaves the response 202 **and raises no
unhandled rejection**.

**Task 3 — dual write wired in.** [20, 83]
`ctx: ExecutionContext` on `fetch`; `ctx.waitUntil(recordEvent(...).catch(log))` alongside
the untouched `writeDataPoint`.
*Tests:* `/api/event` returns 202; both writes are invoked; a rejected D1 promise does not
reject the handler.

**Task 4 — the six read queries.** [106, 63, M3/71, P16]
`getStats(db, range, hostname)` in `analytics-db.ts`, all six ported per §3.1, every value
bound. `range` is `{days: number} | {all: true}`.
*Tests:* against a seeded local D1 — each query returns the known fixture figures;
`SUM(sample_interval)` on a fixture row with `sample_interval = 4` counts 4, not 1;
`all` omits the cutoff clause entirely; a `hostname` containing `' OR 1=1 --` returns zero
rows rather than everything (the M3 regression).

**Task 5 — routes read D1.** [30, 35, M4/72, M7/75]
One `parsePeriod(raw): {days} | {all}` used by **both** `/stats` and `/api/stats`: `7`,
`30`, `90`, `all`; anything else — junk, `NaN`, negative, `120` — falls back to 30. Delete
the `CF_ACCOUNT_ID`/`CF_API_TOKEN` 503 guards from both routes.
*Tests:* `parsePeriod` table test over `7|30|90|all|60|junk|''|-1|999|null`;
`/api/stats?period=all` returns all-time rather than today's `NaN → 1=1` accident;
`/stats` renders with no CF secrets present.

**Task 6 — measurement, and the answers get written into this file.** [P9, P11, P12, 63, 105]
*Blocked on:* Jamie's token and account id (§8).
Query the AE SQL API from the Pi and record, in a new §10 appended here:
(a) the true all-hostname row count [103] — the ~7,300 figure is a hostname-filtered
extrapolation and is a floor; (b) the actual `_sample_interval` values present [63];
(c) AE's default and maximum result `LIMIT` (P11); (d) whether `db.batch()` statements count
individually against the 50-query cap (P9), measured locally against `wrangler dev`;
(e) real CPU per batch from `wrangler tail` once PR 1 is deployed [105].
**If the token scope fails, say so and stop — do not widen the scope.** [97]

**Task 7 — chart maths, pure functions.** [31, 32, 33, M5/73, P24, P25, P26]
`chart.ts`, no rendering: `fillDaySeries(rows, from, to)` zero-filling every absent UTC day
[31]; `xLabelStep(days)` per P25; `pickDirectLabels(series)` returning 0–2 labels with the
P26 collision and edge rules; `barGeometry(days, width)` per P24.
*Tests [56]:* zero-fill across a range with a gap in the middle, at the start, at the end,
and an entirely empty range; step at 1/7/30/90/120/365 days; direct labels when max **is**
the most recent bar, when adjacent, when the max is the last bar, and on an all-zero series;
bar geometry at 7 and 365 days including the 24 px cap and the gap collapse.

**Task 8 — chart rendered.** [34, 38, 39, 40, 41, 42, 46, 47, 48, 49, M5/73]
SVG `viewBox="0 0 600 240"`, `width: 100%`, 200 px plot, 32 px left gutter, 24 px bottom
band. Drop `.chart-wrap { overflow-x: auto }`. Y axis with 3 gridlines (0, mid, max), solid
1 px hairlines, never dashed [40]. Bars `var(--acc)`, top corners rounded 4 px, square
baseline [41]. **A zero day renders a 1 px baseline stub** [M5/73], not nothing. Every bar
carries `<title>` "5 Jul 2026: 13 plays", singular "1 play" [34, 48]. Axis text uses the
muted ink tokens, never `var(--acc)` [42]. Period label states the real span [46]. Empty
range renders axes plus "No plays in this range" [35, 49].
*Tests:* bar count matches the zero-filled day count; a zero day emits a 1 px rect; `<title>`
text and the singular case; the empty state; no `var(--acc)` on any `<text>`.

**Task 9 — accessibility.** [50, 51, 52, 53, L5/80, 112, 113]
Visually-hidden `<table>` carrying every date and count, plus the summary `aria-label`
[51 a+c]. Bars are **not** focusable [52].
*Build gate, not a paper decision [L5/80]:* compute the contrast ratio of every text token
the chart uses against both surfaces and record the numbers here; anything under AA gets
lifted. `.domain-label` at `rgba(38,38,36,0.5)` is the known suspect [53]. Note for Jamie:
`/stats` hardcodes its colours at `stats.ts:184` and does not use `src/palette.ts`, so
`tests/palette-contrast.spec.ts` does not cover this page [M2/70] — pre-existing, not
created here. Jamie owns the call; [113] suggests a real screen-reader pass, and Dave has
TalkBack if either wants one.

**Task 10 — range nav.** [29, 44, 45]
`7d · 30d · 90d · All`, existing pill styling untouched.
*Tests:* four pills; the right one carries `active` for each `?period=`.

**Task 11 — test plumbing.** [M7/75, M10/78, 57, 118]
Extend `e2e:db` to apply the analytics migration to a local `clumeral-analytics` and load
`tests/fixtures/analytics-seed.sql`. Reshape `fakeStats()` off the AE `QueryResult` shape.
Playwright smoke [57]: `/stats` renders at all four ranges, expected bar count from the
fixture, correct pill active. **CI only, never run locally** [55, and the hard rule].
*Risk [118]:* a second local D1 under `wrangler --local` in CI is unverified — if it does not
work, the smoke test falls back to asserting the empty state, and that is reported, not
papered over.

**Task 12 — docs.** [28, 60, M8/76, P16, P27]
`docs/ANALYTICS.md`: the cutover instant as an exact UTC value [M6/74], the P27 comparison
gate, the exact query for each side [63], the PR 3 removal checklist, the P16 distinct-count
caveat, and the token's expiry date. `scripts/compare-ae-d1.mjs` prints both side by side
[M8/76]. One dated line in `CLAUDE.md` under "Outstanding actions" pointing at it — with
[28]'s honest limit stated: it surfaces on conversation, not on a date, and **I cannot send
an unprompted reminder.**

## 6. Tasks — PR 2 (after PR 1 is merged and live)

**Task 13 — backfill.** [66, 92, 93, 94, 115, P17–P22]
`backfill.ts`: CAS lock (P20), cutoff discovery and freeze (P18), delete-then-insert day
window (P19), cursor advance, `done` flag. Cron dispatch on `event.cron` in `scheduled()`
and the second cron expression (P22). Batch constant at 3 days (P21).
*Tests:* cutoff frozen once and never recomputed; an empty `analytics_events` aborts rather
than backfilling into a void; **re-running the same day window twice leaves the row count
unchanged** (the idempotency test that matters); a live `backfilled = 0` row is never
deleted; the CAS lock rejects a second concurrent run; the cursor does not advance when the
insert throws; `done = 1` makes the handler a no-op.

**Task 14 — migration verification.** [59, 61, P27]
Run `compare-ae-d1.mjs` across the whole backfilled window: per-day sums within the P27
tolerance, no day doubled [24]. Recorded in `docs/ANALYTICS.md`.

## 7. PR 3 — not built here

`writeDataPoint` and the `ANALYTICS` binding removed, the per-minute cron removed, the token
revoked. Gated on [60]: three consecutive full days including a weekend day inside the P27
tolerance. Checklist lives in `docs/ANALYTICS.md` [61].

---

## 8. Open questions for Jamie — these block Build

1. **`.env` is gone (P12).** Item 95 records you creating it with the scoped token on
   2026-08-03; it is not in the working tree now. Can you recreate it? I also need
   `CF_ACCOUNT_ID` in it — it is a Worker secret, so I have no local copy. Until then Task 6
   cannot run, and item 97's warning stands: nobody has yet confirmed that
   **Account · Account Analytics · Read** is the permission the AE SQL API actually checks.
   If it turns out to be the wrong scope I will report that rather than widening it.
2. **Schema column types — yours to sign (P13, item 114).** The columns are in [64] plus
   `backfilled INTEGER NOT NULL DEFAULT 0` (P19). One is questionable: **`value REAL`**. It
   holds guess counts, which are integers; it is `REAL` only because AE's `double1` is.
   My rec: **`value INTEGER NOT NULL DEFAULT 0`**, converting on insert. Nothing reads it as
   a fraction, and `REAL` invites a `4.0` turning up in the guess distribution. Your call.
3. **You need to create the `clumeral-analytics` D1 database** [82] and give me the
   `database_id` for `wrangler.jsonc`. It needs your Cloudflare account; I have no access.
4. **The per-minute cron (P22)** runs for the duration of the backfill and is removed in
   PR 3. It is the fastest mechanism that adds no new endpoint — ~30 minutes rather than
   ~30 nights. Confirm you are happy with a temporary second cron entry.

Nothing above is a product decision I have taken on your behalf; items 2 and 4 are
recommendations awaiting your call, and 1 and 3 are actions only you can do.

## 9. Brief item traceability

- **Implemented:** 9, 12(P10), 16, 17, 18, 20–24, 26, 29–35, 38–42, 44–49, 50–54, 56–61,
  62–68, 69–78, 79(L2, L3), 82–84, 86, 90, 92–94, 96, 100–111, 114–116, 118.
- **Needs no code:** 1–8, 10, 11, 13–15, 19, 25, 27, 28(doc only), 36, 43, 55, 85, 87–89,
  91, 95, 97(research), 98, 99, 112, 113, 117.
- **Explicitly dropped:** `htp_dismissed` and `colour_change` are rendered by
  `renderDashboard` but are not in `VALID_EVENTS`, so they are permanently zero — dropped
  rather than ported [L3/79]. Item 23's side-by-side row on `/stats` was rejected by Jamie;
  item 27's `/stats/compare` route was superseded by [36]; item 17's `uid` prune was
  rejected [186–189]. Item 37 (custom date range) is GitHub issue #297, out of scope.
- **Deferred with justification:** [L5/80] contrast check is a Task 9 build gate; [L6/81]
  the hidden table's row growth needs revisiting past a few hundred days, not a launch
  blocker.
