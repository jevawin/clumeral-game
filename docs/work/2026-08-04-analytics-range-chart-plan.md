# Plan — Analytics: D1 migration, all-time range, labelled daily plays chart

From `docs/work/2026-08-03-analytics-range-chart-brief.md` (settled, `da-brief` closed).
Branch: `dev/analytics-range-chart`. Written 2026-08-04.

**Status: `da-plan` run and every High and Medium finding fixed (§10). Awaiting Jamie's
approval.**

Item numbers in `[brackets]` refer to brief items. Every numbered brief item is traced in
§9. Plan-local numbering starts at P1 and is append-only.

---

## 1. Research results — the brief handed Plan 23 unverified assumptions

The assumption audit [96–118] and the reopened backfill strategy [91–94] required research
before any task could be written. Results first, because several change the design.

### 1.1 Verified, brief was right

- **P1. Free-plan cron CPU is 10 ms.** [93] Confirmed: cron triggers get 10 ms CPU on Free,
  30 s on Paid; wall clock is 15 min on both.
  Source: https://developers.cloudflare.com/workers/platform/limits/
- **P2. `ctx.waitUntil` gets up to 30 s** after the response. [83] Confirmed, same page.
- **P3. D1 free-tier daily row limits are real** — **100,000 rows written/day**,
  **5,000,000 rows read/day**. [96] They are on the *pricing* page, not the limits page,
  which is why the earlier fetch missed them. The figures quoted from memory were correct.
  Source: https://developers.cloudflare.com/d1/platform/pricing/
- **P4. AE SQL returns raw rows.** [100] Confirmed — the documented example selects
  `timestamp, blob1, double1` per row. Item 16's no-granularity-seam argument holds.
- **P5. `_sample_interval` is selectable per row.** [101] Confirmed: "The rate at which the
  data is sampled is exposed via the `_sample_interval` column." Item 63's fix works as written.
  Source: https://developers.cloudflare.com/analytics/analytics-engine/sql-api/

### 1.2 Verified, brief was WRONG — in our favour

- **P6. AE SQL supports `OFFSET`.** [102, L1/79] The brief twice asserted "AE SQL has row
  limits and no `OFFSET`" and built the day-paged backfill around that. The SQL reference
  documents `LIMIT`, `OFFSET` and `ORDER BY` as supported.
  Source: https://developers.cloudflare.com/analytics/analytics-engine/sql-reference/statements/
  Consequence: paging is a plain `ORDER BY timestamp LIMIT n OFFSET m`. We still use a
  day-window cursor — not because paging forces it, but because a day window is what makes
  a batch idempotent (§3.3) — and P6 is what makes the P32 sub-day fallback possible.

### 1.3 NOT verified — brief never considered these, and they resize the backfill

- **P7. D1 allows 50 queries per Worker invocation on Free** (1,000 on Paid). This is the
  binding constraint on backfill batch size and **the brief does not mention it anywhere**.
  The whole backfill argument [86, 91–94] was about the 10 ms CPU budget; the query cap
  bites first and is a hard error rather than a soft one.
  Source: https://developers.cloudflare.com/d1/platform/limits/
- **P8. Maximum 100 bound parameters per query.** Same page. With the 10-column schema
  (§3.3) that is **10 rows per bound multi-row `INSERT`**. Finding M3 [71] requires
  `.bind()` throughout, so this cap applies and cannot be dodged with interpolation.
- **P9. Whether statements inside `db.batch()` count individually against P7 is
  undocumented.** The `batch()` page says only that statements "execute and commit,
  sequentially, non-concurrently". Secondary sources say they count individually. The design
  is sized for that pessimistic reading and P32 makes it self-correcting, so **this never
  needs resolving** — see §10 H-5.
- **P10. Indexes multiply rows written.** "Indexes will add an additional written row when
  writes include the indexed column." Item 64 specifies two indexes, so **each event costs
  3 rows written**, not 1. Item 12's "0.08% of the daily write budget" is out by 3× — really
  ~0.24%, still negligible. It matters for the backfill: ~7,300 AE rows is ~22,000 rows
  written against the 100k/day ceiling, so the backfill must not be restarted from scratch
  more than ~4 times in one day. Not a practical constraint; recorded so a retry loop cannot
  quietly exhaust the daily budget.
- **P11. AE's default and maximum result-row `LIMIT` are undocumented.** Measured in Task 6.
- **P28. Free plan allows 5 cron triggers per account** (250 on Paid). We use 1 today and 2
  during the backfill, so P22 is comfortably inside it. **`ScheduledController.cron` exists**
  — confirmed in the installed `@cloudflare/workers-types` (`index.d.ts:2491`,
  `readonly cron: string`) — so the P22 dispatch is real, and `* * * * *` is a documented
  supported expression. Closes the last unverified platform claim.

### 1.4 BLOCKED — cannot be resolved without Jamie

- **P12. The scoped Analytics Read token cannot be tested. `.env` does not exist.**
  Item 95 records Jamie creating it with the token on 2026-08-03 and verifying it untracked.
  **The file is not in the working tree today.** `.gitignore:46` is `.env` as recorded, so
  the ignore fix [90] landed correctly, but the file itself is gone. This blocks item 97 —
  the audit's own highest-priority test, flagged precisely because Jamie had already created
  the token on an unverified claim that **Account · Account Analytics · Read** is the
  permission the AE SQL API checks. Also missing: `CF_ACCOUNT_ID`, a Worker secret with no
  local copy. **§8 question 1.** Only Task 6 and the Task 12 comparison script depend on it.
- **P13. Item 114's type sign-off has not happened.** [64] picked `ts INTEGER`, `value REAL`,
  `new_user INTEGER`, `sample_interval INTEGER` on my judgement inside a section signed
  before the schema existed, and **Jamie owns types**. **§8 question 2.**

### 1.5 Deferred to Build, with measurement attached

P14. CPU per batch [105] → Task 15. Row size and storage growth [104] → Task 14.
`EXPLAIN QUERY PLAN` [107] → Task 1. Bar legibility at long ranges [108] → Task 8.
Screen-reader behaviour [112, 113] → Task 9. Nothing in the audit is left floating.

---

## 2. Sequencing — three PRs, and one step that is not a PR at all

The item 24 cutoff makes a single PR impossible: the backfill must import everything from
**before the instant D1 writes went live**, and that instant is when Jamie merges.

- **Step 0 — Jamie creates the D1 database and applies migrations 0005 and 0006 to it
  remotely (§8 questions 3 and 4). This happens BEFORE PR 1 merges, not after.**
- **PR 1 — schema, dual write, D1 reads, chart, docs, test harness.**
  After merge, D1 collects. `/stats` reads D1 and shows post-merge data only.
- **PR 2 — backfill.** Uses the earliest real D1 row as the cutoff (P18), which only exists
  once PR 1 is live. Completes in ~30–60 minutes (§3.4).
- **PR 3 — AE removal.** Gated on the item 60 comparison. Only the checklist is written here.

**P29. Step 0 is not optional and its absence would have been silent.** A `wrangler.jsonc`
binding pointing at a database whose schema was never applied deploys perfectly happily.
Every `ctx.waitUntil(recordEvent().catch(log))` would then fail into `console.error` — which
§3.2 deliberately swallows — and `/stats` would show zero. That is exactly brief item 21's
"analytics failure is silent", caused by us. §8 makes the remote migration an explicit,
verified step.

**P15.** This ordering means Jamie reviews a chart in PR 1 drawing a handful of days. That
is expected, not a defect — the preview URL looks sparse until PR 2 runs.

---

## 3. Design decisions Plan is settling

### 3.1 Reads: the six queries ported to D1

[106] said "draft all six against D1 in full rather than assuming the shape survives". Done,
in Task 4. Two ClickHouse-isms have no SQLite equivalent [L2/79]:

- `toStartOfDay(timestamp)` → `strftime('%Y-%m-%d', ts/1000, 'unixepoch')`. UTC by
  definition, matching [M6/74].
- `NOW() - INTERVAL '<n>' DAY` → a JS-computed epoch-ms cutoff passed as a **bound
  parameter** [M3/71]. `all` omits the clause entirely — not `1=1`, which is what produces
  today's accidental all-time query [M4/72].
- Every `COUNT()` → `SUM(sample_interval)` [63], **except** the two `COUNT(DISTINCT blob2)`
  unique-user queries.

**P30. There is a seventh query.** Item 46's period label ("All time · 5 Apr – 3 Aug 2026 ·
120 days") and `fillDaySeries`'s lower bound both need the earliest row's date when the range
is `all`. Deriving it from the `daily` result's first row is wrong — `daily` is filtered to
`puzzle_start` in the renderer, so a day with only `route_change` events would move the
apparent start. `getStats` runs `SELECT MIN(ts) AS first_ts FROM analytics_events WHERE
hostname = ?` as a seventh query and returns `firstTs`. Seven queries per page load is well
inside P7's 50.

**P16. Sampling and distinct counts are irreconcilable, and this needs stating rather than
quietly ignoring.** `SUM(sample_interval)` cannot be applied to a distinct-uid count — if one
stored row stands for 8 real events it still names exactly one uid, and the other 7 users are
unknowable. So unique/new user figures over the backfilled window are a **floor** wherever AE
sampled. For live rows `sample_interval` is 1 and the count is exact. Recommendation: accept,
and record in `docs/ANALYTICS.md`. Task 6(b) records the real `_sample_interval` values [63]
— if they are all 1, as [9] expects at 81 events/day, this is moot in practice and we will
know rather than assume.

### 3.2 Writes: dual write

Per [83]: `ctx: ExecutionContext` added to the `fetch` signature (`index.ts:221`),
`writeDataPoint` unchanged, and the D1 insert in
`ctx.waitUntil(insert.catch(err => console.error(...)))`. Response stays 202.

### 3.3 The backfill: idempotent by construction

[92] fixes resumable + idempotent + hard cutoff as the one thing Build may not compromise.

**Schema.** [64] plus two columns this plan adds:

**P41. Types signed off by Jamie, 2026-08-04** — closing item 114, which the brief flagged
should never have passed as settled. `AUTOINCREMENT` dropped on his call: plain
`INTEGER PRIMARY KEY` is the rowid alias, and we never need ids that are never reused.
`value` is `INTEGER`, and the two 0/1 columns carry `CHECK` constraints so a bad insert
fails at the source rather than quietly skewing the new-user count.

```sql
CREATE TABLE analytics_events (
  id              INTEGER PRIMARY KEY,                  -- rowid alias; no AUTOINCREMENT [P41]
  ts              INTEGER NOT NULL,                     -- UTC epoch ms
  event           TEXT    NOT NULL,                     -- blob1
  uid             TEXT    NOT NULL,                     -- blob2, retained indefinitely [17]
  source          TEXT,                                 -- blob3, NULL when not undo/reset
  hostname        TEXT    NOT NULL,                     -- blob4
  value           INTEGER NOT NULL DEFAULT 0,           -- double1; INTEGER, not REAL [P41]
  new_user        INTEGER NOT NULL DEFAULT 0 CHECK (new_user   IN (0, 1)),  -- double2
  sample_interval INTEGER NOT NULL DEFAULT 1,           -- [63]
  backfilled      INTEGER NOT NULL DEFAULT 0 CHECK (backfilled IN (0, 1))   -- P19
);
CREATE INDEX idx_analytics_host_ts    ON analytics_events (hostname, ts);
CREATE INDEX idx_analytics_host_ev_ts ON analytics_events (hostname, event, ts);
```

**P31. `source` must be normalised on import, or the cutover leaves a permanent seam.**
`index.ts:414` writes `blobs: [event, uid, source ?? '', url.hostname]` — in AE every
non-undo/reset event carries `blob3 = ''`, never null. The schema says `NULL otherwise`. Left
alone, live rows would hold `NULL` and backfilled rows `''` for the same meaning, and the
sixth query — the undo/reset `GROUP BY source` split, the whole reason those events exist —
would behave differently either side of the cutoff, forever. The backfill applies
`NULLIF(blob3, '')` on import. Tested in Task 13.

**P17. A `backfill_state` table, one row, holding the bounds, the cursor and a lock.**

```sql
CREATE TABLE backfill_state (
  id                   INTEGER PRIMARY KEY CHECK (id = 1),
  cutoff_ms            INTEGER,                    -- frozen on first run; item 24 cutoff
  start_day            TEXT,                       -- frozen on first run; P33
  next_day             TEXT,                       -- 'YYYY-MM-DD' UTC, next day to import
  done                 INTEGER NOT NULL DEFAULT 0,
  lock_until           INTEGER NOT NULL DEFAULT 0,
  rows_written         INTEGER NOT NULL DEFAULT 0,
  consecutive_failures INTEGER NOT NULL DEFAULT 0  -- P32
);
INSERT INTO backfill_state (id) VALUES (1);        -- P34: the singleton row
```

**P34. The seed row is part of the migration.** P20's guard is a conditional `UPDATE ...
WHERE id = 1`. With no row, `meta.changes` is always 0, every invocation exits, and the
backfill runs 1,440 times a day importing nothing, with no error. The `INSERT` above is not
optional and Task 13 tests that a fresh database yields exactly one state row.

**P18. The cutoff is discovered, not written by hand.** On the first invocation, before any
insert, the backfill reads `SELECT MIN(ts) FROM analytics_events WHERE backfilled = 0` — the
earliest live dual-written row — and freezes it as `cutoff_ms`. Every AE query then filters
`timestamp < cutoff_ms`. Thereafter it is read from the row and never recomputed, so it
cannot drift once backfilled rows exist. If there are no live rows (PR 1 not yet live, or no
traffic), the run **aborts and logs** rather than backfilling into a void. This is [24]'s
hard cutoff with no manual timestamp to get wrong.

**P33. The lower bound is discovered the same way, and the brief asked for this.**
[L7/79] said "the Plan takes the true start from the earliest AE row" — an item the first
draft dropped. On the same first invocation the backfill queries AE for
`SELECT MIN(timestamp) FROM clumeral` (all hostnames, per P35) and freezes it as
`start_day`; `next_day` initialises to it. **`done = 1` when `next_day` passes the UTC day
containing `cutoff_ms`.** Without both bounds a cleared-context builder must invent them,
and walking forward from a wrong start either imports nothing or runs against AE's retention
edge indefinitely. Both boundaries are tested in Task 13.

**P19. Idempotency comes from a delete-then-insert day window, not from the cursor.**
Advancing a cursor after a commit is not enough: a run killed mid-batch leaves rows written
and the cursor unmoved, so the retry duplicates them. Instead each day window is re-runnable:

1. `DELETE FROM analytics_events WHERE backfilled = 1 AND ts >= ? AND ts < ?`
2. insert that day's AE rows with `backfilled = 1`
3. advance `next_day`

**The DELETE can never touch a live dual-written row**, because those carry `backfilled = 0`.
Re-running any day, at any point, converges on the same result. This holds whether or not
`db.batch()` is transactional (P9), which is why the design does not depend on resolving it.

**P35. The backfill imports all hostnames.** [64] makes `hostname` load-bearing — "drop that
column and staging and preview traffic silently merges into production numbers". Filtering
the import to `clumeral.com` would throw away the preview/staging history that the column
exists to keep separable, and `/stats` filters by hostname at read time anyway. So `blob4` is
preserved verbatim and every hostname is imported. This is also why the row count is a floor
[103] and why P32 exists.

**P20. Overlapping invocations are prevented by a compare-and-set lock, and the lock is
released.** [115] asked for a stated position. Acquire:
`UPDATE backfill_state SET lock_until = :now+180000 WHERE id = 1 AND lock_until < :now`,
proceeding only if `meta.changes === 1`; otherwise another invocation holds it and this one
exits. **On success or handled failure the run ends with
`UPDATE backfill_state SET lock_until = 0 WHERE id = 1`.** Without the release, a 180 s lock
against a per-minute cron would idle two invocations in every three and turn ~30 minutes into
~90. The TTL is a backstop for a killed run, not the normal path; Task 15 sets it from
measured run duration.

### 3.4 Backfill batch size and drive mechanism — [93]'s open question

**P32. The batch is adaptive, because the row count is a floor and a fixed batch wedges.**
Sizing from a fixed "~81 rows/day" would be sizing from [12]'s **hostname-filtered** figure,
which [103] and Task 6(a) both say is lower than reality — preview and staging write to the
same `clumeral` dataset. At only 3× that rate, a fixed 3-day batch needs ~70 queries against
P7's cap of 50: a hard error, on the same day, on every invocation, once a minute, forever
and silently. So the batch is computed at run time:

1. Query AE for per-day row counts from `next_day` forward (1 subrequest).
2. Take as many whole days as fit the query budget: `1 DELETE + ceil(rows/10) INSERTs` per
   day (P8), plus 1 AE fetch per day, against **44** — 50 less the CAS, the state read, the
   cursor write, the lock release, the count query and one spare.
3. **Always process at least one day**, even if it alone exceeds the budget.
4. **Sub-day fallback:** a day too large for one invocation is imported in
   `LIMIT/OFFSET` sub-windows (P6), with `sub_offset` tracked alongside `next_day`. The
   day's `DELETE` runs only on the first sub-window. Without this, a single busy day over
   ~440 rows could never be imported at all.
5. `consecutive_failures` increments on a failed run and resets on success. **Above 5, the
   backfill stops and logs loudly** rather than retrying once a minute forever. A wedged
   backfill must be visible; that is the whole lesson of brief item 21.

**P21. Recommendation: cap the adaptive batch at 3 days per invocation initially.** The query
maths permits more; the 10 ms CPU budget (P1) is the unmeasured half, and `JSON.parse` of a
few hundred AE rows plus statement building is exactly the cost [91] warned against guessing
at. The cap is one constant, raised once Task 15 has real `wrangler tail` numbers. A CPU kill
is harmless (P19 makes the retry safe), so this is tuning, not risk.

**P22. Drive mechanism: a second cron expression, dispatched on `event.cron`.**

```jsonc
"crons": ["0 0 * * *", "* * * * *"]   // second entry temporary, removed in PR 3
```

`scheduled()` switches on `controller.cron`: the daily entry runs `runDailyCron` exactly as
today, the per-minute entry runs the backfill and nothing else. At up to 3 days per run,
~90 days completes in **~30–60 minutes**, unattended, the night PR 2 merges. Verified
available: P28.

Why this over [93]'s alternatives:
- **vs. the nightly cron alone** — 30+ nights. [94] says explicitly not to accept that when
  a measured batch can do better.
- **vs. a secret-guarded fetch route driven from the Pi** — introduces a *mutating*
  internet-reachable endpoint, which [93] itself flags as outside item 19's won't-fix, plus a
  guard secret and a loop to babysit. The cron needs neither.
- **vs. Queues / Durable Object alarms** — more moving parts and free-plan availability to
  verify. [94] prefers fewer moving parts where they conflict.

Once `done = 1` the handler returns immediately. **P23.** Those invocations count against the
free 100k requests/day; at 1,440/day for a few days that is ~1.4%, and PR 3 removes the entry.

### 3.5 Chart arithmetic — [108–111]

**P36. Coordinate space, stated once, because the first draft mixed two.** The SVG is
`viewBox="0 0 600 240"` with `width: 100%`. All geometry in `chart.ts` is in **viewBox
units**; 568 of the 600 are plot area after the 32-unit gutter. The rendered scale factor is
`containerPx / 600`. `stats.ts` body is `max-width: 40rem; padding: 1.5rem`, so the container
is **592 px on desktop — not 640** — and **327 px on a 375 px phone**. Scale is therefore
~0.99 desktop and **~0.55 mobile**. Every px-denominated rule below is stated in viewBox
units with the mobile case checked, because a rule tuned to desktop under-thins labels by
~1.8× on a phone — producing exactly the collisions [109] warned about.

**P24. Fit-to-width stands [39], with gaps that collapse.** Rendered bar pitch is
`containerPx / days`: at 365 days that is **1.62 px desktop and 0.9 px mobile**, not the 1.75
the first draft claimed off a wrong container width. Rule, in viewBox units:
`pitch = 568 / days`, `gap = pitch >= 6 ? 2 : 0`, `barWidth = min(24, pitch - gap)`, bars
**centred in their slot**. Past ~95 days the bars butt together and the chart reads as a
filled silhouette — the correct read for a trend at that range, and better than [39]'s
rejected horizontal scroll, which hides the y axis. [111]'s concern at 7 days is real and
centring is the answer: 24-unit bars in 81-unit slots, evenly spaced rather than left-packed.
**Task 8 looks at the rendered output at 7, 30, 90 and All, at both 592 px and 327 px, before
this is called done** [108].

**P25. X-label step derived from text width, not guessed [109].** "5 Jul" in Inconsolata at
0.6875 rem is ~40 px, plus 8 px separation → 48 px per label. At mobile scale that is
**~87 viewBox units**, so the plot fits `floor(568 / 87)` = **6 labels**, not the 12 a
desktop-only reading gives. Rule: `step = max(1, ceil(days / 6))`, and **the last day is
always labelled** whatever the step lands on. Gives every day at 7d, every 5th at 30d, every
15th at 90d, every 61st at 365d. Sized for the narrowest viewport so one rule serves both.

**P26. The two direct labels get a collision rule [110].** [32] labels the highest bar and the
most recent bar and never said what happens when they interact. Stated rule:
1. **Same bar** → one label only.
2. **Label boxes would overlap** (centres < 87 viewBox units apart, per P36) → render the
   **max** label only. The most recent bar is already anchored by the always-labelled last
   day (P25), so it is the one that can be dropped without losing the reader's bearings.
3. **At the plot edges** → `text-anchor: end` within 44 units of the right edge, `start`
   within 44 of the left, `middle` otherwise. Without this the max label overflows the
   viewBox at "All", where the newest bar is often the highest.

**P37. The zero-day stub needs a treatment that survives gap collapse [M5/73].** M5's purpose
was that a zero day and a rendering bug must not look the same. A 1 px baseline stub achieves
that while bars have gaps — but past ~95 days (P24) gaps collapse to 0 and a 1.6-unit-wide,
1-unit-tall stub between two touching bars is invisible, so the guarantee silently lapses at
exactly the range "All" is for. Rule: a zero day renders a **1-unit stub below the baseline**
(y from baseline to baseline+1) in the muted ink token rather than `var(--acc)`. It reads as
a tick on the axis at every range, stays distinguishable when neighbours touch, and is
assertable. Tested at 7 and 365 days.

### 3.6 The item 116 tolerance question

**P27. The AE↔D1 comparison gate gets a tolerance that is actually looser than "exact".**
[116] flagged that "match exactly" [23, 59, 60] may never go green. Compare **per-day
`SUM(_sample_interval)` on the AE side against `SUM(sample_interval)` on the D1 side** [63],
over **full UTC days only** — never a partial day, which removes the midnight-boundary class
of mismatch outright.

Gate: **every full day within ±1% or ±3 events, whichever is larger.** The first draft said
"±1% **and** no day off by more than 2", which at ~81 events/day is ±0.81 events — i.e.
exactly the unrealistic gate [116] objected to, with an extra clause that never binds. As a
disjunction with an absolute floor it tolerates the real causes: a handful of requests
landing on one write path but not the other around a deploy. A day outside it, or any day at
zero or half, is a real defect and blocks PR 3. Differences inside the tolerance are recorded
in `docs/ANALYTICS.md` with the day and delta, not silently passed.

---

## 4. Files

**Created**
- `migrations/0005_create_analytics_events.sql` — §3.3 schema + both indexes. **0005, not
  0002** [65] — `0002_import_legacy_feedback.sql` is gitignored.
- `migrations/0006_create_backfill_state.sql` — P17, including the P34 seed row.
- `src/worker/analytics-db.ts` — write path + the seven read queries (P30).
- `src/worker/chart.ts` — pure chart maths, no DOM, no SQL.
- `src/worker/backfill.ts` — PR 2 only.
- `scripts/compare-ae-d1.mjs` — [M8/76], run from the Pi.
- `tests/chart.spec.ts` — jsdom, pure functions.
- `tests/worker/analytics-db.spec.ts`, `tests/worker/backfill.spec.ts` — the new
  workers-pool project (P38).
- `tests/fixtures/analytics-seed.sql` — [M7/75].
- `e2e/specs/stats-chart.spec.ts` — the Playwright smoke [57].
- `docs/ANALYTICS.md` — [28].

**Modified**
- `src/worker/index.ts` — `ctx` on `fetch` [83]; dual write; both period parsers [30, M4/72];
  the 503 secrets guards removed [M7/75]; `scheduled()` cron dispatch (PR 2).
- `src/worker/stats.ts` — `getStats` **moves out** to `analytics-db.ts` (P39); `stats.ts`
  keeps `renderDashboard` and the rebuilt chart.
- `wrangler.jsonc` — `ANALYTICS_DB` binding [82]; second cron (PR 2).
- `package.json` — `e2e:db` [M7/75]; new `analytics:migrate:remote` (P29); `@cloudflare/
  vitest-pool-workers` devDependency (P38).
- `vitest.config.ts` — second project for worker tests (P38).
- `.github/workflows/ci-smoke.yml` — run `npm test` (P40).
- `tests/stats-dashboard.spec.ts` — `fakeStats()` reshaped off the AE `QueryResult` shape and
  its `getStats` import repointed [M10/78, P39].
- `e2e/specs/ssr-pages.spec.ts`, `e2e/specs/smoke.spec.ts` — both assert "200 **or** the
  documented 503"; Task 5 deletes the 503 path, so both tighten to require 200.
- `docs/ARCHITECTURE.md` (lines 23 and 49) and `README.md` (line 30) — all three describe
  `stats.ts` as Analytics Engine queries and D1 as feedback-only. CLAUDE.md requires the doc
  be updated when the work makes it outdated.
- `CLAUDE.md` — outstanding-actions line [28].
- `.gitignore` — already done [90], no further change.

---

## 5. Tasks — PR 1

Tests first in every task [test-driven-development].

**Task 0 — the test harness, because three essential tests have no mechanism today.** [P38]
`vitest.config.ts` is `environment: 'jsdom'` with no `@cloudflare/vitest-pool-workers`, and
no test in the repo reads a D1 row. The brief's own H5 fix [68] — assert the resulting row
column by column — cannot be written against that. Add `@cloudflare/vitest-pool-workers` and
split `vitest.config.ts` into two projects: the existing jsdom one over `tests/**/*.spec.ts`
excluding `tests/worker/`, and a workers-pool project over `tests/worker/**/*.spec.ts` with
the D1 binding taken from `wrangler.jsonc` and migrations applied to an isolated per-test
database.
*Risk:* pool-workers pins a vitest range; the repo is on vitest 2.1.9 / wrangler 4.80.0. If
they cannot be reconciled, **the fallback is `execSync('wrangler d1 execute … --json')` from
`e2e/specs/`, not dropping the assertions** — the row-shape test is why the brief reopened
item 58.
*Proves it:* a throwaway test inserting and reading back one row passes in CI.

**Task 1 — schema and binding.** [64, 82, P13, P19, P31, P34]
Both migrations, including the P34 seed row. `ANALYTICS_DB` binding in `wrangler.jsonc`.
Add `analytics:migrate:remote` to `package.json` (P29).
*Blocked on:* §8 questions 2, 3 and 4.
*Proves it:* `EXPLAIN QUERY PLAN` on the daily-counts and unique-users queries against a
seeded table shows both indexes used [107], recorded as a comment in the migration; a fresh
database yields exactly one `backfill_state` row.

**Task 2 — the write path.** [83, H5/68]
`recordEvent(db, {event, uid, source, hostname, value, newUser})` in `analytics-db.ts`, bound
parameters throughout.
*Tests (`tests/worker/analytics-db.spec.ts`):* the H5 test — POST each of the **10** valid
events [M1/69] and assert the resulting row column by column: `uid`, `new_user` as 0/1,
`source` non-null on `undo_used`/`reset_used` and **null** elsewhere (P31), `hostname`,
`value`, `sample_interval` = 1, `backfilled` = 0. Plus [58] reframed: a D1 outage leaves the
response 202 **and raises no unhandled rejection**.

**Task 3 — dual write wired in.** [20, 83]
`ctx: ExecutionContext` on `fetch`; `ctx.waitUntil(recordEvent(...).catch(log))` alongside
the untouched `writeDataPoint`.
*Tests:* 202; both writes invoked; a rejected D1 promise does not reject the handler.

**Task 4 — the seven read queries.** [106, 63, M3/71, P16, P30]
`getStats(db, range, hostname)` in `analytics-db.ts` (P39), ported per §3.1, every value
bound. `range` is `{days: number} | {all: true}`.
*Tests:* against a seeded D1 — each query returns the known fixture figures;
`SUM(sample_interval)` on a fixture row with `sample_interval = 4` counts 4, not 1; `all`
omits the cutoff clause; `firstTs` comes from the earliest row of **any** event type, not the
earliest `puzzle_start` (P30); a `hostname` of `' OR 1=1 --` returns zero rows rather than
everything (the M3 regression).

**Task 5 — routes read D1.** [30, 35, M4/72, M7/75]
One `parsePeriod(raw): {days} | {all}` used by **both** `/stats` and `/api/stats`: `7`, `30`,
`90`, `all`; anything else — junk, `NaN`, negative, `120` — falls back to 30. Delete the
`CF_ACCOUNT_ID`/`CF_API_TOKEN` 503 guards from both routes and tighten the two e2e specs that
accept 503 to require 200.
*Tests:* `parsePeriod` table test over `7|30|90|all|60|junk|''|-1|999|null`;
`/api/stats?period=all` returns all-time rather than today's `NaN → 1=1` accident; `/stats`
renders with no CF secrets present.

**Task 6 — DONE, 2026-08-04. Results in §11 (P43–P49).** [P11, P12, 63, 103, L7/79]
Token scope confirmed [97]; sampling found to be real, not theoretical [63]; true row count,
window and per-day peak measured. The peak-day finding (P48) forced the sizing rule in P49.
Query the AE SQL API from the Pi and record, in a new §11 appended here: (a) the true
all-hostname row count [103] — the ~7,300 figure is a hostname-filtered extrapolation and a
floor; (b) the actual `_sample_interval` values present [63], which decides whether P16 is
theoretical or real; (c) AE's default and maximum result `LIMIT` (P11), which sizes P32's
sub-day windows; (d) `MIN(timestamp)` across all hostnames — the true collection start
[L7/79], which [3] only ever inferred from a git log.
**If the token scope fails, say so and stop — do not widen the scope.** [97]

**Task 7 — chart maths, pure functions.** [31, 32, 33, M5/73, P24, P25, P26, P36, P37]
`chart.ts`, no rendering: `fillDaySeries(rows, from, to)` zero-filling every absent UTC day
[31]; `xLabelStep(days)` per P25; `pickDirectLabels(series)` returning 0–2 labels with the P26
collision and edge rules; `barGeometry(days)` per P24, in viewBox units (P36).
*Tests [56]:* zero-fill across a range with a gap in the middle, at the start, at the end, and
an entirely empty range; step at 1/7/30/90/120/365 days; direct labels when max **is** the
most recent bar, when adjacent, when the max is the last bar, and on an all-zero series; bar
geometry at 7 and 365 days including the 24-unit cap and the gap collapse at ~95 days.

**Task 8 — chart rendered.** [34, 38, 39, 40, 41, 42, 46, 47, 48, 49, M5/73, L3/79]
`viewBox="0 0 600 240"`, `width: 100%`, 200-unit plot, 32-unit gutter, 24-unit bottom band.
Drop `.chart-wrap { overflow-x: auto }`. Y axis with 3 gridlines (0, mid, max), solid 1 px
hairlines, never dashed [40]. Bars `var(--acc)`, top corners rounded 4, square baseline [41].
Zero days per P37. Every bar carries `<title>` "5 Jul 2026: 13 plays", singular "1 play"
[34, 48]. Axis text uses muted ink tokens, never `var(--acc)` [42]. Period label states the
real span [46]. Empty range renders axes plus "No plays in this range" [35, 49].
**Also drop the `htp_dismissed` and `colour_change` rows** from the interactions table
(`stats.ts:145-149`) — neither is in `VALID_EVENTS`, so both are permanently zero [L3/79].
*Tests:* bar count matches the zero-filled day count; a zero day emits the P37 stub; `<title>`
text and the singular case; the empty state; no `var(--acc)` on any `<text>`; neither dropped
event label appears.
*Visual check [108]:* rendered at 7/30/90/All, at 592 px and 327 px.

**Task 9 — accessibility.** [50, 51, 52, 53, 61, L5/80, 112, 113]
Visually-hidden `<table>` carrying every date and count, plus the summary `aria-label`
[51 a+c]. Bars are **not** focusable [52]. `aria-label` template: "Daily plays, {first} to
{last}. Average {avg} per day, highest {max} on {maxDate}."
*Tests (M-7 fix — this task had none):* hidden table row count equals the zero-filled day
count; each row's value equals the corresponding bar's `<title>` value — this is item 61's
"**the hidden table matches the chart**", and nothing else catches the accessible route
drifting from the visual one; `aria-label` matches the template with correct average and max.
*Build gate [L5/80]:* compute the contrast ratio of every text token the chart uses against
both surfaces and record the numbers here; anything under AA gets lifted. `.domain-label` at
`rgba(38,38,36,0.5)` is the known suspect [53]. Note for Jamie: `/stats` hardcodes its colours
at `stats.ts:184` and does not use `src/palette.ts`, so `tests/palette-contrast.spec.ts` does
not cover this page [M2/70] — pre-existing, not created here. Jamie owns the call; [113]
suggests a real screen-reader pass, and Dave has TalkBack if either wants one.

**Task 10 — range nav.** [29, 44, 45]
`7d · 30d · 90d · All`, existing pill styling untouched.
*Tests:* four pills; the right one carries `active` for each `?period=`.

**Task 11 — test plumbing and the CI gate.** [M7/75, M10/78, 57, 118, P40]
Extend `e2e:db` to apply migration 0005 to a local `clumeral-analytics` and load
`tests/fixtures/analytics-seed.sql`. Reshape `fakeStats()` [M10/78]. Playwright smoke in
`e2e/specs/stats-chart.spec.ts` [57]: `/stats` renders at all four ranges, expected bar count
from the fixture, correct pill active. **CI only, never run locally** [55, and the hard rule].
**P40. Add `npm test` to `ci-smoke.yml`.** Neither CI workflow runs vitest today — Playwright
is the entire gate. This plan puts the chart maths, `parsePeriod` and the row-shape assertions
in vitest, so without this they gate nothing.
*Risk [118]:* a second local D1 under `wrangler --local` in CI is unverified. **If it does not
work that is a blocker to resolve** — seed through a loop of real `POST /api/event` calls, the
pattern `e2e/specs/feedback-triage.spec.ts` already uses — **not a fallback to asserting the
empty state**, which passes whether the chart is correct, empty or broken.

**Task 12 — docs.** [28, 60, M8/76, P16, P27]
`docs/ANALYTICS.md`: the cutover instant as an exact UTC value [M6/74], the P27 gate, the
exact query for each side [63], the PR 3 removal checklist, the P16 distinct-count caveat, and
the token's expiry. `scripts/compare-ae-d1.mjs` prints both sides [M8/76]. Update
`docs/ARCHITECTURE.md` and `README.md` (§4). One dated line in `CLAUDE.md` under "Outstanding
actions" — with [28]'s honest limit stated: it surfaces on conversation, not on a date, and
**I cannot send an unprompted reminder.**

## 6. Tasks — PR 2 (after PR 1 is merged and live)

**Task 13 — backfill.** [66, 92, 93, 94, 115, P17–P22, P31–P35]
`backfill.ts`: CAS lock and release (P20), cutoff and start-day discovery and freeze
(P18, P33), adaptive batch with sub-day fallback (P32), delete-then-insert day window (P19),
`NULLIF` source normalisation (P31), all-hostname import (P35), cursor advance, `done` and
`consecutive_failures`. Cron dispatch on `controller.cron` and the second cron expression
(P22).
*Tests (`tests/worker/backfill.spec.ts`):* cutoff and start day frozen once and never
recomputed; an empty `analytics_events` aborts rather than backfilling into a void;
**re-running the same day window twice leaves the row count unchanged** — the idempotency
test that matters on an irreversible import; a live `backfilled = 0` row is never deleted; a
backfilled non-undo row has `source IS NULL` (P31); the CAS lock rejects a second concurrent
run and is released on success; a day exceeding the query budget imports via sub-windows and
its `DELETE` runs only once; the cursor does not advance when the insert throws;
`consecutive_failures` halts at 5; `done = 1` makes the handler a no-op.

**Task 14 — migration verification.** [59, 61, 104, P27]
Run `compare-ae-d1.mjs` across the whole backfilled window: per-day sums inside the P27
tolerance, no day doubled [24]. Record actual storage used (`page_count × page_size`) against
[104]'s unmeasured "~3 MB/year". Written into `docs/ANALYTICS.md`.

**Task 15 — measure what only a deployed backfill can show.** [105, P9, P21]
From `wrangler tail` on the real per-minute cron: CPU per batch, wall-clock per run, and rows
per invocation. Raise the P21 cap if there is clear headroom; lower the P20 lock TTL to match
observed duration. **This is deliberately in PR 2, not PR 1** — the first draft put it in
PR 1, where there is no batch to measure and the constant it feeds does not exist yet.
Note on P9: `wrangler dev --local` does not enforce the free-plan query cap, so a local
measurement would "succeed" regardless of the truth. P32 makes the batch adaptive and
self-correcting, so P9 never needs a definitive answer.

## 7. PR 3 — not built here

`writeDataPoint` and the `ANALYTICS` binding removed, the per-minute cron removed, the token
revoked. Gated on [60]: three consecutive full days including a weekend day inside the P27
tolerance. Checklist in `docs/ANALYTICS.md` [61].

---

## 8. Open questions for Jamie — these block Build

1. **`.env` exists, but in the wrong user's home (P12, P42).**
   **P42, diagnosed 2026-08-04.** Jamie SSH'd into the Pi, `cd developer/clumeral-game` and
   created `.env` there — and it is genuinely not visible to this agent. The Pi has **two
   user accounts, `clumeral-bot` and `jevawin`**. This agent runs as `clumeral-bot` and works
   in `/home/clumeral-bot/developer/clumeral-game`. Jamie's session was almost certainly
   `jevawin`, so the same relative path resolved to `/home/jevawin/developer/clumeral-game` —
   a separate checkout. The guard hook blocks this agent from so much as listing
   `/home/jevawin`, by design, so it cannot be confirmed from here or read if found.
   **Resolution: the file must exist at
   `/home/clumeral-bot/developer/clumeral-game/.env`.** That exact path is readable — the
   guard permits it; the first attempt failed with "no such file", not with a refusal.
   Needs `CF_ACCOUNT_ID` as well as the token: it is a Worker secret with no local copy.
   Until then Task 6 cannot run, and item 97's warning stands — nobody has yet confirmed that
   **Account · Account Analytics · Read** is the permission the AE SQL API actually checks.
   If it turns out to be the wrong scope I report that rather than widening it. Item 98
   (token TTLs applying to this token type) is still unverified and closes when Jamie
   confirms the dashboard offered an expiry.
2. **Schema column types — SIGNED OFF by Jamie 2026-08-04. See P41.** `value` is `INTEGER`
   not `REAL`; `AUTOINCREMENT` dropped; `CHECK (x IN (0,1))` on both flag columns; `source`
   nullable with `NULLIF` normalisation on import (P31). Closes item 114 and P13.
3. **You need to create the `clumeral-analytics` D1 database** [82] and give me the
   `database_id` for `wrangler.jsonc`. Needs your Cloudflare account; I have no access.
4. **You need to apply migrations 0005 and 0006 to it remotely, before PR 1 merges** (P29) —
   `npm run analytics:migrate:remote -- migrations/0005_create_analytics_events.sql`, which
   Task 1 adds. This is the step whose absence would be silent: the deploy succeeds, every
   insert fails into a swallowed `console.error`, and `/stats` shows zero. I will give you the
   exact commands in the PR description, and we verify with a row count after the first live
   traffic.
5. **The per-minute cron (P22)** runs for the duration of the backfill and is removed in PR 3.
   It is the fastest mechanism that adds no new endpoint — ~30–60 minutes rather than 30+
   nights — and Free allows 5 triggers per account against the 2 we would use (P28). Confirm
   you are happy with a temporary second cron entry.
6. **Heads-up, not a question: Task 0 and P40 are scope this plan adds.** The repo has no
   way to test a D1 write today, and CI does not run vitest at all, so the brief's own
   essential tests [68] would have had nowhere to live and the unit tests would have gated
   nothing. Both are small but they are real additions beyond the brief.

Nothing above is a product decision taken on your behalf; 2 and 5 are recommendations awaiting
your call, 1, 3 and 4 are actions only you can do, and 6 is disclosure.

## 9. Brief item traceability

- **Implemented:** 9, 12(P10), 16, 18, 20–24, 26, 29–35, 38–42, 44–54, 56–61, 62–68, 69–78,
  79(L1, L2, L3, L7), 82–84, 86, 90, 92–94, 96, 100–111, 114–116, 118.
- **Needs no code:** 1–8, 10, 11, 13–15, 19, 25, 27, 28(doc only), 36, 43, 55, 85, 87–89, 91,
  95, 97(research, Task 6), 98(§8 q1), 99, 112, 113, 117.
- **Explicitly dropped, with the decision that dropped it:** item 17's `uid` prune —
  **rejected by Jamie** in §6's decisions, so `uid` is retained indefinitely and there is no
  prune step. Item 23's side-by-side row on `/stats` — rejected by Jamie. Item 27's
  `/stats/compare` route — superseded by [36]'s scoped token. `htp_dismissed` and
  `colour_change` — rendered today but absent from `VALID_EVENTS`, so permanently zero;
  dropped in Task 8 [L3/79]. Item 37 (custom date range) is GitHub issue #297, out of scope.
- **Deferred with justification:** [L5/80] the contrast check is a Task 9 build gate, because
  it needs rendered output. [L6/81] the hidden table's row growth needs revisiting past a few
  hundred days; not a launch blocker.

---

## 10. `da-plan` review — findings and fixes, 2026-08-04

Fresh-context review of the first draft. Returned **5 High, 10 Medium, 10 Low** and judged it
not ready for Build. Every High and Medium is fixed above; the two deferred Lows are noted.
The verdict worth recording: *"The chart half is largely sound and well-researched. The
data-migration half has five defects that either cannot be built as written or lose data
silently — which is the exact failure mode the brief was written to prevent."*

All findings were verified against the tree before acting, not taken on trust.

**High**
- **H-1 → Task 0.** Three essential tests had no mechanism: `vitest.config.ts` is jsdom-only,
  there is no `@cloudflare/vitest-pool-workers`, and no test in the repo reads a D1 row.
  Confirmed. Task 0 adds the harness, with a stated fallback that keeps the assertions.
- **H-2 → P29, §8 q4, Task 1.** Nothing applied the migrations to production D1, and
  `db:migrate:remote` is hardcoded to `clumeral-feedback`. PR 1 would have deployed into a
  schema-less database and lost every event silently. Now an explicit, verified Step 0.
- **H-3 → P33.** The backfill had no lower bound and no completion condition, silently
  dropping brief item [L7/79]. Both are now discovered and frozen on the first run.
- **H-4 → P32.** The batch was sized from [12]'s hostname-filtered ~81 rows/day, which [103]
  says is a floor. A fixed batch would have exceeded P7's 50-query cap and wedged, once a
  minute, silently. Now adaptive, with a sub-day fallback and a failure counter.
- **H-5 → Task 15, split from Task 6.** Task 6 was circular — it needed a deployed backfill
  that does not exist in PR 1 — and its P9 measurement could not be made locally, because
  `wrangler dev` does not enforce the cap. Deployment-dependent measurement moved to PR 2;
  P9 downgraded to something the design no longer needs.

**Medium** — M-1 → P34 (the missing seed row would have made every run a silent no-op).
M-2 → P20 (lock never released; ~30 min was really ~90). M-3 → P31 (`''` vs `NULL` seam
across the cutover). M-4 → P35 (hostname scope unstated). M-5 → P27 (the "tolerance" was
±0.81 events — arithmetically no looser than the exact match [116] objected to). M-6 → P40
and Task 11 (the empty-state fallback would have passed with a completely broken chart; and
CI never ran vitest). M-7 → Task 9 tests (the only task with none, and it owned item 61's
"hidden table matches the chart"). M-8 → P36 (viewBox units mixed with rendered px; container
is 592 px, not 640, and 327 px on mobile). M-9 → P39 (`getStats` was placed in two files).
M-10 → §4 (`docs/ARCHITECTURE.md` and `README.md` both describe `stats.ts` as Analytics
Engine).

**Low** — L-1 (spec filename), L-2 (two e2e specs accept the 503 being deleted), L-3
(item 17 traced twice), L-4 ([104] attached to nothing), L-5 (item 98), L-7 (the seventh
query, → P30), L-8 (dropped events owned by no task), L-9 (AE fetches in the subrequest
budget, → P32 step 2), L-10 (cron limits, → P28) are all fixed above. **L-6 → P37**, which
was a Low worth treating as more: the 1 px stub became invisible at exactly the range "All"
exists for.

**Not adopted:** none. Every finding was either fixed or, in P9's case, made irrelevant by a
design change rather than argued away.

**P38 / P39 / P40** are the three plan-local decisions the review forced: the test harness,
`getStats` living in `analytics-db.ts` with `stats.ts` keeping `renderDashboard`, and vitest
joining the CI gate.

---

## 11. Task 6 results — measured against the live Analytics Engine, 2026-08-04

Run from the Pi with the scoped token once `.env` reached
`/home/clumeral-bot/developer/clumeral-game/.env` (P42). **Account id
`06ff16a35fdefa6cae9e3463116086aa`**, discovered via `GET /client/v4/accounts` with the same
token rather than asked for.

**P43. Item 97 CONFIRMED — the token scope is correct and sufficient.**
**Account · Account Analytics · Read** reaches the Analytics Engine SQL API. `POST
/accounts/{id}/analytics_engine/sql` returns HTTP 200 with data. Jamie created that token on
an unverified claim; the claim was right. No widening needed, and P12 is closed.

**P44. Sampling is REAL, not theoretical — and this is the finding that justifies the whole
of [63].** The brief assumed the sample interval "is almost certainly 1 today" [9]. It is not:

- `_sample_interval = 1` → 7,240 rows
- `= 2` → 96 rows
- `= 3` → 11 rows
- `= 10` → 1 row

`COUNT()` = **7,348**. `SUM(_sample_interval)` = **7,475**. So **every figure on `/stats`
today undercounts by 127 events, 1.70%**, and had we imported with `COUNT(*)` semantics that
error would have been baked into the archive permanently, with the source deleted behind it.
Consequences: the `sample_interval` column and the `SUM(sample_interval)` rule are load-bearing,
not precautionary; **P16 is a live limitation, not a hypothetical** — unique-user counts over
the backfilled window really are a floor; and item 12's "2,440 events in 30 days" was itself a
`COUNT()` undercount.

**P45. P11 resolved — there is no default row-limit problem.** A raw-row `SELECT` of all eight
columns with no `LIMIT` returned **all 7,348 rows in one response**, with
`rows_before_limit_at_least` equal to the row count. `OFFSET` paging is confirmed working
against a deterministic `ORDER BY timestamp ASC`. **Note: results are unordered by default** —
the first row of an unordered query came back as the most recent — so every backfill query must
carry an explicit `ORDER BY` or paging silently repeats and skips rows.

**P46. The true all-hostname row count is 7,348 across 12 hostnames** — [103] feared the
hostname-filtered ~7,300 estimate was a floor that could be "possibly much higher"; it is
1.56× the `clumeral.com`-only figure, not the 3×+ P32 defended against. `clumeral.com` is
4,717 (64%), the old `new-design` preview 2,108, `staging` 272, and nine other preview
deployments under 60 each. P35's decision to import every hostname stands and costs little.

**P47. The surviving window is 2026-05-04 00:09:18 → now** — closing [L7/79]. Item 3's
"collecting since 2026-04-05" was inferred from a git log; the true first *surviving* row is
2026-05-04, which is ~92 days back and confirms AE's three-month retention [5] empirically.
Anything earlier is already deleted. **This does not become a constant** — the window rolls
forward daily, so by the time PR 2 runs the earliest row will be later. P33's runtime discovery
is what the code uses; 2026-05-04 is a sanity check, never a hardcoded value.

**P48. The per-day distribution is severely skewed, and the da-plan H-4 finding was right in a
way even it understated.** Busiest days, all hostnames:

- 2026-08-03 → **677 rows**
- 2026-05-04 → 523
- 2026-08-04 → 466
- 2026-05-10 → 369
- 2026-05-31 → 204

Mean is ~80/day, so the brief's "~81 events/day" [12] was a *correct average* — and sizing on
it would still have broken the backfill, because **the peak is 8× the mean**. At P8's 10 rows
per bound `INSERT`, 2026-08-03 alone needs 68 statements against P7's cap of 50. **A day that
cannot be imported in a single invocation already exists in the data.** So P32's sub-day
fallback is not a safeguard against a hypothetical, it is required on day one, and the fixed
3-day batch of the first draft would have wedged permanently on the first run that reached
2026-08-03.

**P49. Consequent sizing rule, replacing P21's day-count cap.** The batch is measured in
**rows, not days**: target **≤ 450 rows per invocation** (45 `INSERT` statements at 10 rows
each, leaving 5 of the 50 for the CAS, state read, cursor write, lock release and the AE
fetch). Whole days are taken while they fit; a day exceeding 450 rows on its own is imported in
`LIMIT/OFFSET` sub-windows of 450 with an explicit `ORDER BY timestamp ASC` (P45), its `DELETE`
running only on the first sub-window. At 7,348 rows that is **~17 invocations, so ~17 minutes**
on the P22 per-minute cron. CPU per invocation remains the one unmeasured quantity and is
Task 15's job; if 450 rows will not parse inside 10 ms, the constant drops and the run takes
proportionally longer, which P19 makes safe.

**Still open after this run:** P9 (whether `db.batch()` statements count individually against
the 50-query cap) and CPU per batch — both need a deployed Worker, both are Task 15, and P32's
adaptive sizing means neither blocks Build.

---

## 12. Prod / pre-prod separation — Jamie's challenge, 2026-08-04

> "Prod should be separate from all preprod, is that factored in?"

**P50. Partly, and the gap is real.** Reads are already separated; writes and the archive are
not, and the plan as written would have left 36% of the permanent archive as pre-prod traffic
that the dashboard can never display.

**What is already separate — reads.** `whereClause` filters `blob4 = '<hostname>'`
(`stats.ts:34`) against the *requesting* host, and §3.1 ports that to `WHERE hostname = ?`.
So `clumeral.com/stats` shows only `clumeral.com`, and a preview's `/stats` shows only that
preview. Item 64 already called `hostname` the column that "would have bitten us". That much
was factored in.

**What is not separate — the write path and the archive.** Every deployment shares one
`ANALYTICS_DB` binding, so preview and staging rows land in the production analytics database.
That is exactly today's behaviour with the shared AE dataset, so it is not a regression — but
D1 keeps rows indefinitely where AE aged them out, so the consequence compounds instead of
expiring. Measured (P46): of 7,348 rows, **4,717 are `clumeral.com` and 2,631 — 36% — are
pre-prod**, mostly the retired `new-design` preview (2,108).

**P51. The codebase already answers this, and analytics should match it.** `feedback.ts:108`
sets `REAL_HOST = "clumeral.com"` and treats every other host as test traffic; the dashboard
defaults to real rows and takes `?all=1` to include the rest (`index.ts:304`), and preview
deploys bounce to the canonical dashboard rather than serving their own (`index.ts:294`).
That is a settled prod/pre-prod split for D1 data in this repo, and analytics inventing a
second convention would be worse than adopting it.

**P52. Measured: production is exactly one hostname.** All 12 hostnames in AE are
`clumeral.com` plus eleven `*.workers.dev` deploys — **no `www.`, no apex/subdomain split**,
so prod stats cannot be silently divided across two names. Worth stating because a
`www` variant appearing later would split the production figures with no error.

**P53. Recommendation — import everything, default the dashboard to prod.** Three parts:

1. **Backfill imports all hostnames** (P35 unchanged). AE deletes this data within days and
   it can never be re-imported; a row imported and later ignored is reversible, a row not
   imported is gone. The `hostname` column makes it separable forever.
2. **`/stats` defaults to production only**, matching `feedback.ts` — not "whatever host you
   happen to be viewing from". On `clumeral.com` this is identical to today. The change is
   that the default becomes an explicit prod filter rather than an incidental one.
3. **`?all=1` includes pre-prod**, exactly as the feedback dashboard does. Without it the
   2,631 archived pre-prod rows are unreachable dead weight; with it they are a debugging
   tool, and the preview `/stats` still shows a preview's own writes — which PR 1 needs, since
   demonstrating the D1 write path on a preview URL is how it gets reviewed.

The alternative — refusing to write from non-prod hosts at all — is rejected: it would make
the analytics change untestable on a preview deploy, which is the only place Jamie can review
it before merge.

**Open for Jamie:** P53 part 2 is a behaviour change to `/stats` (a preview's dashboard would
default to prod figures, needing `?all=1` to see its own). Say if you would rather keep the
current per-host default, which is also defensible and is strictly less work.

### Decision — Jamie, 2026-08-04

**P54. Settled: import all hostnames; `/stats` stays locked to the hostname it is called
from.** P53 part 1 accepted. **P53 parts 2 and 3 are REJECTED** — no prod-default, no
`?all=1`. A preview's `/stats` shows that preview's own data and nothing else, which is what
it is for; staging shows staging, for testing. The per-host lock *is* the separation, and it
needs no new UI. This is also strictly less code than my recommendation, and the `?all=1`
toggle I argued for would have existed only to display rows nobody asked to see.
Consequence for §4/§5: no `all` parameter on `/stats`, and Task 5's `parsePeriod` is the only
query-string change. The imported pre-prod rows are reachable by direct SQL if ever needed.

## 13. Two databases, prod and pre-prod? — Jamie, 2026-08-04

**P55. Recommendation: no, one database. But the reasoning that makes it safe is not the
reasoning I would have given before checking.**

**It is buildable.** The obvious route — a Wrangler environment per branch — does not fit:
Workers Builds deploys non-production branches with `npx wrangler versions upload`, one build
command for every branch, so there is no per-branch binding override without reconfiguring
the build. The route that *does* work is binding both databases in the one config and choosing
at runtime by hostname (`ANALYTICS_DB` / `ANALYTICS_DB_PREPROD`). So this is a real option,
not a blocked one.

**Why one database anyway, in order of weight:**

1. **The migration surface doubles, permanently, and that is the failure this plan already
   identified as silent.** P29 exists because an unapplied migration deploys perfectly happily
   and loses every event into a swallowed `console.error`. Two databases means every future
   schema change must be applied twice, remotely, by hand — and the second one is the easy one
   to forget, on the environment nobody watches. That risk outlives this project.
2. **The blast-radius argument is much weaker than it looks, because the destructive code
   cannot run on pre-prod.** The only dangerous statement here is the backfill's
   `DELETE FROM analytics_events WHERE backfilled = 1 AND ...`. It runs from `scheduled()`, and
   non-production branches are uploaded as **preview versions rather than deployments**, so
   they serve no cron traffic — the backfill only ever runs on the live production deployment.
   A preview can insert its own rows; it cannot delete anything.
   *(Confirmed from the Workers Builds docs for `versions upload`; the cron-triggers page does
   not state the preview case explicitly, so Task 13 asserts it rather than assuming it — if a
   preview version ever did fire the cron, P20's CAS lock already makes it safe, just wasteful.)*
3. **Volume makes isolation pointless.** Pre-prod is 2,631 rows over 92 days — **~29/day**
   against a 100k/day write ceiling. There is no capacity, cost or performance case.
4. **Separation is already achieved by the column plus P54's per-host lock.** A second database
   would enforce the same property twice.
5. **It stays reversible, cheaply.** Because `hostname` tags every row, splitting later is one
   `INSERT ... SELECT` plus one `DELETE`. Choosing one database now does not lock the decision;
   choosing two now imposes the duplicated migration path immediately and forever.

**The honest case for two, so it is on the record:** if pre-prod analytics ever want wiping
wholesale, a separate database makes it a drop rather than a targeted delete. With one database
that is `DELETE FROM analytics_events WHERE hostname != 'clumeral.com'` — a single statement,
already precise because of the column. Not enough to carry the migration cost.

**P56.** If Jamie prefers two regardless, the change is small and additive: a second binding, a
one-line chooser in `recordEvent`, both migrations applied to both databases, `e2e:db` seeding
both, and the backfill writing pre-prod rows to the pre-prod database. Say the word and it goes
in before Build starts, not after.

---

## 14. Build notes — PR 1, 2026-08-04

Built from this plan. Tasks 0–5 and 7–12 are done; Tasks 13–15 are PR 2 and are not
started. What follows is every place Build departed from, or resolved, what the plan said.
Nothing here is a product decision.

### Risks the plan flagged that turned out fine

- **P38 / Task 0 pool-workers version clash — no fallback needed.**
  `@cloudflare/vitest-pool-workers` 0.12.x peers `vitest 2.0.x - 3.2.x`, which covers the
  repo's 2.1.9. The `execSync('wrangler d1 execute')` fallback was not used.
- **Task 11 / item 118, a second local D1 under `wrangler --local` — works.** `npm run e2e:db`
  applies 0005 and 0006 to a local `clumeral-analytics` and loads the fixture. Verified by
  reading the rows back. The POST-loop fallback was not needed.
- **Item 107, both indexes are used.** `EXPLAIN QUERY PLAN` measured against a seeded table;
  the four plans are recorded in `migrations/0005_...sql` and asserted in
  `tests/worker/schema.spec.ts`. No full scan on any read.

### Departures from the plan, with reasons

- **P38: the D1 binding is declared in `vitest.workers.config.ts`, not read from
  `wrangler.jsonc`.** Task 0 said to take it from `wrangler.jsonc`; pool-workers cannot parse
  that file — it throws "the `assets` property is missing the required `directory`
  property", and `@cloudflare/vite-plugin` forbids setting `directory` in source. The binding
  name therefore exists twice, so `tests/wrangler-bindings.spec.ts` guards against drift.
- **P37: the zero-day stub is 3 viewBox units tall, not 1.** At the mobile scale of ~0.55 a
  1-unit stub renders at half a pixel — invisible at exactly the range "All time" exists for,
  which is the failure P37 was written to prevent. 3 units renders ~1.7px on a phone and 3px
  on desktop.
- **P36 did not cover font size, and it needed to.** SVG text is drawn in viewBox units and
  scales with the container, so the plan's 11px axis text would render at ~6px on a 375px
  phone. `.axis` and `.direct` now carry breakpoints at 640/480/380px that hold axis text at
  roughly 10–14 real pixels across the range. This is the same mistake M-8 caught in the
  geometry, one level down.
- **P25's label rule was not sufficient on its own.** Stepping by `ceil(days / 6)` and always
  labelling the last day puts a label 4 slots from the end at 30 days — **76 viewBox units**,
  inside the 87 a label occupies on a phone. `xLabelIndexes` now drops any stepped label
  within `LABEL_W` units of the last one, measured in units rather than days.
- **P25's "6 labels" is an off-by-one.** `floor(568 / 87) = 6` counts gaps, not labels: seven
  labels need six gaps, 522 units, which fits. 90 days legitimately renders 7. The separation
  rule above is the real guarantee; the count is not.
- **Ranges cover whole UTC days including today.** §3.1 said "a JS-computed epoch-ms cutoff"
  without fixing the boundary. A rolling 168-hour window would render an eighth, partial bar
  that always reads as a slump, so `rangeCutoff` snaps to `startOfUTCDay`.

### Additions beyond the plan

- **`tests/stats-contrast.spec.ts`.** M2/70 recorded that `/stats` hardcodes its colours and
  is not covered by `tests/palette-contrast.spec.ts`, and left it as a note. It is cheap to
  close, so it is closed: the test reads the tokens out of the rendered stylesheet and
  checks them against all four surfaces.
- **HTML escaping on the interpolated hostname.** Pre-existing, unrelated to this work, but
  the file was being rewritten and the fix is one function.

### Task 9 contrast gate — measured, not asserted

Full table in `docs/ANALYTICS.md`. The headline: item 53's suspicion was right —
`.domain-label` at `rgba(38,38,36,0.5)` measured **2.97:1** against the light page, below AA
and below even the 3:1 graphics threshold. Replaced by `--ink-muted`, 5.58:1 light and
6.98:1 dark, 5.99/6.44 against the card surfaces. Bars are 4.71:1 / 6.19:1 against a 3:1
requirement. Gridlines are supplementary and sit at 1.75:1, lifted from 1.41:1 for
legibility rather than compliance.

### Task 8 visual check — outstanding

[108] asks for rendered output at 7/30/90/All at 592px and 327px. Verified numerically
against the running preview — mark counts are 7/30/90/101, label sets are collision-free at
every range, and the sampled fixture row is summed rather than counted. **The eyes-on pass
at both widths is Jamie's, on the preview URL**; this agent has no browser and may not run
Playwright locally.

### Still blocked on Jamie

`wrangler.jsonc` carries `"database_id": "REPLACE_WITH_CLUMERAL_ANALYTICS_DATABASE_ID"`.
§8 questions 3 and 4 are unchanged and both must happen before PR 1 merges: create the
`clumeral-analytics` database, and apply 0005 and 0006 to it remotely with
`npm run analytics:migrate:remote -- migrations/0005_create_analytics_events.sql` (and 0006).
The placeholder is deliberate — an invalid uuid fails the deploy loudly, where a missing
binding would fail silently into a swallowed `console.error` and show zero on `/stats`.

### `da-build` review — findings and fixes, 2026-08-05

Fresh-context review of the PR 1 diff. Returned **1 High, 5 Medium, 8 Low** and judged it
not ready to push. Every High and Medium is fixed; the Lows are fixed or recorded below.
All findings were verified against the tree before acting — including by live probes
against a running preview, which is how three of them were found.

**High**

- **B-1. The new Playwright gate would have gone red in CI, non-deterministically.**
  `stats-chart.spec.ts` asserted `Unique users` was exactly 10. The dual write this PR adds
  means every other e2e spec now writes real `puzzle_start` rows into the same local D1 —
  a fresh browser context per test is a fresh `uid` — and the suite is `fullyParallel`. The
  count was a race against 40-odd other tests. Fixed by dropping the exact figure and moving
  the hostname-leak check somewhere a race cannot reach it: the fixture's other-host row now
  sits **200 days back**, so a broken hostname filter changes the already-asserted "All"
  mark count from 101 to 201. Dating that row today, as the first version did, made the leak
  invisible to every count the suite checks.

**Medium**

- **B-2. `compare-ae-d1.mjs` could not run at all.** It demanded `CF_ACCOUNT_ID` and
  `CF_API_TOKEN`; the `.env` that exists holds `CF_ANALYTICS_TOKEN` and no account id. The
  script is the only artefact gating PR 3, and `docs/ANALYTICS.md` asserted it worked. Now
  accepts either token name and defaults the account id. **Verified against the live AE API:
  HTTP 200 with real per-day data.** The D1 half still needs `wrangler login` and a database
  that does not exist yet, which it now says in one clean sentence instead of a stack trace.
- **B-3. The comparison's two windows did not align.** AE used a rolling
  `NOW() - INTERVAL n DAY` against D1's UTC midnight, so the oldest day compared a partial
  AE window to a whole D1 one and would have failed on every run — the exact
  midnight-boundary artefact P27 claims to remove outright. AE now uses
  `toStartOfDay(NOW()) - INTERVAL n DAY`. A note also distinguishes AE retention clipping the
  oldest day from a real dual-write defect, because they look identical.
- **B-4. P31 is wrong about `source`, and so was the schema comment.** `source` is not
  undo/reset-only: `router.ts:79` sends `route_change` with the **path**, and `app.ts:1489`
  sends `htp_opened` with `'manual'` — and `route_change` was 53% of all events in the
  brief's own measurement, so **most rows carry a source**. Nothing breaks today (the
  `sourceSplit` query filters to undo/reset, and AE stored the same value, so there is no
  cutover seam) but the comment would have misled PR 2, which builds `NULLIF` on it.
  Corrected in migration 0005 and `analytics-db.ts`, with tests asserting the real
  production shapes. The H5 test drives `recordEvent` with hand-made inputs, so on its own it
  was happily confirming an invariant production does not hold — that is now said in the test.
- **B-5. No length cap on `uid` or `source`.** `POST /api/event` is public and
  unauthenticated, and D1 rows are permanent with no prune step. Confirmed live: a 5,000-char
  uid stored in full. Item 19's "no auth needed" was decided when writes went to a free,
  self-expiring system; that reasoning does not survive the move to D1. Capped at 64 and 128,
  truncating rather than rejecting — an over-long uid is far more likely a bug than an attack,
  and dropping the event would lose a real play.
- **B-6. A malformed `value` silently dropped the row.** The request body is cast, never
  validated, so `{"value":{}}` became `NaN`, bound as NULL, and tripped `NOT NULL` — a
  swallowed `console.error` while `writeDataPoint` kept the event. Confirmed live. That is a
  new divergence planted directly in the comparison that gates AE removal. Now
  `Number.isFinite(v) ? Math.trunc(v) : 0`.

**Low** — B-7 stale "1-unit stub" comments (fixed). B-8 `xLabelIndexes` test named "every
day at 7 days" while asserting every second day — **the behaviour is right and brief item 33
and P25 are both wrong**, since `ceil(7 / 6) = 2` never could be 1; test renamed and the
error recorded. B-10 dead `extra` parameter (removed). B-11 a busiest day of 1 play rendered
the y axis as "0 / 1 / 1" (mid gridline now dropped when it would duplicate). B-12 stale
`.planning/codebase/STACK.md` and `INTEGRATIONS.md` (updated). B-13 `recordEvent` was not
`async`, so a synchronous throw would escape the caller's `.catch()` and turn every event
POST into a 400 (now `async`). B-14 a single-day range pinned its only x label to the right
edge while the bar sat centred (only pinned when there is more than one label).

**B-9, accepted rather than fixed:** brief item 35 says the empty range renders "axes plus
the message"; it renders the message alone. It is reachable only at `?period=all` with zero
rows — 7/30/90 render a full axis of zero stubs — and axes with no days have no scale to
draw. Recorded rather than silently dropped.

### `da-build` re-review — 2026-08-05

Fresh context, second pass. Confirmed all 14 earlier fixes hold and found **1 Medium, 4 Low**
the first round missed. Verdict READY TO PUSH with the Medium fixed. All five are fixed.

Explicitly re-verified as clean, and worth recording because each was a plausible failure:
the `db.batch()` binding is correct for all 7 statements in **both** the bounded and
all-time branches (placeholder count matches bound args either way); `npm test` genuinely
runs both vitest projects and **fails the run** when a worker test fails — checked by
planting a failing test; the −200-day fixture row breaks no other assertion; and no real
`uid` (a 36-char UUID) or `source` (a short path, or `'manual'`) comes near the new caps.

- **B-15, Medium — I introduced this with the B-11 fix, and it made the y axis lie.** The mid
  gridline was drawn at exactly half height but labelled `Math.round(scaleMax / 2)`. Those
  agree only when `scaleMax` is even. With a busiest day of 3, the line labelled "2" sat at
  half height while the bar actually worth 2 topped out a sixth of the plot higher. **This is
  the regime PR 1 lands in** — post-cutover maxima are single digits for days. The position is
  now derived from the value rather than the value from the position. Verified live at max 5:
  the gridline labelled 3 sits at y=80, exactly where a bar worth 3 ends; it was at y=100.
- **B-16, Low.** Pinning the outermost x labels to the plot edges is necessary at 30+ days to
  stop them overflowing the viewBox, but at 2–5 days it threw a label ~106 units from the bar
  it names — again exactly what `/stats` shows in the week after merge. Now pinned only when
  centring would actually overflow.
- **B-17, Low.** `All time · … · 1 days` on the first day of collection. Now singular.
- **B-18, Low — a test that proved a query nobody runs.** `schema.spec.ts` asserted the
  daily-counts plan using SQL carrying an `event = ?` predicate; the real query groups by day
  **and** event and has no such predicate. It uses `idx_analytics_host_ts`, not
  `idx_analytics_host_ev_ts`. Still no scan, so nothing was slow — but the test would have
  kept passing if the real query regressed. Test and migration comment both corrected.
- **B-19, Low.** `docs/ANALYTICS.md` now documents the truncation caps under Known
  limitations, and says plainly that production `/stats` will look wrong for a few days
  after merge without being an outage: until PR 2 lands, every pre-cutover day renders as a
  zero stub and "Avg daily plays" divides by the full window. "All time" is the honest view
  in that period.

---

## 15. Superseded by the pre-prod split — 2026-08-05

**§8 questions 3 and 4 are CLOSED, and not in the way this plan expected.** Do not action
them as written; the commands in q4 point at paths that no longer exist.

- **q3 (create the database)** — done. Jamie created `clumeral-analytics`
  (`6e076e77-0937-4e3c-9756-3898a2b48ad6`) and a `clumeral-analytics-preprod` alongside it.
  The `REPLACE_WITH_…` placeholder in `wrangler.jsonc` is gone.
- **q4 (apply 0005/0006 remotely, by hand)** — **no longer a human step at all.** Migrations
  are now applied by wrangler's own `d1 migrations apply` from Cloudflare's builder: to
  pre-prod when a branch builds, to production when a PR merges. Nobody runs a command, and
  the bot never holds a Cloudflare credential.
- The migration files moved: `migrations/0005_*` and `0006_*` are now under
  `migrations/analytics/`, and the feedback ones under `migrations/feedback/`. The directory
  is what maps a migration to its database, via `migrations_dir`.

**P54/P55 are superseded.** This plan settled on one analytics database for all hostnames,
with `/stats` locked to the calling host as the separation. Prod and pre-prod are now
genuinely separate databases. The reasoning that picked one database was the cost of
maintaining a second migration target by hand — wrangler's tooling removed that cost, so the
trade-off it rested on no longer exists. The `hostname` column and the per-host lock both
stay, now as belt-and-braces rather than the mechanism.

Spec: `docs/superpowers/specs/2026-08-05-clumeral-preprod-split-design.md`.
Plan: `docs/superpowers/plans/2026-08-05-clumeral-preprod-split.md`.

---

## 16. Build notes — PR 2, 2026-08-06

Task 13 is built. **Tasks 14 and 15 are not code and cannot be done in this PR** — see
"Still owed after merge" below. What follows is every place Build departed from, or
resolved, what the plan said.

### P57. The plan's sub-day mechanism is not idempotent, and it is replaced

§3.4 step 4 imports an oversized day in `LIMIT/OFFSET` sub-windows with the day's `DELETE`
running **only on the first sub-window**. That is safe only if the cursor advances after
every window. A CPU kill advances nothing: the retry re-runs the same offset window with no
`DELETE` in front of it and silently doubles those rows — inside the very import that P19
exists to make re-runnable, and invisibly, because the duplicates are spread across a day.

Replaced by a **time cursor**. `sub_offset` holds milliseconds into the day rather than a row
offset, each window imports `[dayStart + sub_offset, windowEnd)`, and its `DELETE` covers
exactly that range. A window that fills closes on a **whole second** — the trailing rows
sharing the last timestamp are dropped and become the next window's first rows — so no second
is ever half-imported. Every window is then re-runnable on its own, killed anywhere, and the
"DELETE runs once per day" test in §6 becomes "re-running any sub-window changes nothing",
which is the property that was actually wanted.

The residual case is `MAX_ROWS_PER_RUN` rows inside one second, where the cursor cannot close
on a second boundary. It logs an error and advances a second, losing the overflow. The
busiest day on record is 677 rows across 86,400 seconds, so this is unreachable in practice —
recorded rather than silently handled.

### The Analytics Engine SQL API, measured before a line was written

Four of the plan's query forms would have failed at run time in production. Probed live
2026-08-06 (read-only, with the `.env` token) and now documented in `docs/ANALYTICS.md`:

- **`COUNT(*)` is rejected outright** — it must be `COUNT()`.
- **Absolute time bounds must be `toDateTime(<epoch seconds>)`.** A string literal is
  refused. §3.3 and §3.4 never say how the day window is expressed; the obvious
  ClickHouse-shaped guess is the one AE will not take.
- **Aggregates come back as strings** (`COUNT()` → `"677"`). Arithmetic on them silently
  concatenates.
- **`toUnixTimestamp(timestamp) AS ts` makes `timestamp` unaddressable in `ORDER BY`.**
  Order by the alias. P45 correctly insisted on an explicit `ORDER BY`; the form it needs
  is not the obvious one.

Also confirmed: `timestamp` is second-precision, so imported rows lose sub-second detail
(irrelevant to day bucketing, which is all `/stats` reads); `LIMIT 1000` on a 677-row day
returns 677, so P11/P45's "no hidden row cap" still holds; an `OFFSET` past the end returns
zero rows rather than erroring.

### Smaller departures

- **The statement budget is tighter than P49.** P49 budgeted 45 `INSERT`s plus five spare,
  but it also allows multi-day batches, and each extra day is another `DELETE`. `planDays`
  now counts `1 + ceil(rows / 10)` per day against 45, and rows against 450, taking whichever
  binds first — always at least one day.
- **Discovery imports in the same invocation.** §3.3 reads as though the first run only
  freezes the bounds. It freezes them in their own committed statement (so a crash mid-import
  cannot lose them) and then carries straight on, saving an invocation.
- **`done` needs one more invocation than the plan implies.** After the last day with rows is
  imported the cursor sits on the next day; only the following run's count query can tell
  "nothing left" from "not there yet". Finishing on evidence rather than on the absence of a
  row is the safer of the two.
- **Empty days are skipped in one hop.** The sizing query returns only days that hold rows,
  so a three-week gap costs one invocation, not twenty-one.
- **The cursor write, the totals, the failure reset and the lock release are one statement**,
  which is also the commit point.
- **Unrecognised cron expressions fall through to the daily puzzle job**, the behaviour that
  predates the backfill. `BACKFILL_CRON` lives in `backfill.ts` and in `wrangler.jsonc`, and
  `tests/wrangler-bindings.spec.ts` asserts they agree — get that wrong silently and the
  daily puzzle cron runs 1,440 times a day.
- **`MAX_UID` and `MAX_SOURCE` are now exported from `analytics-db.ts`** and imported here, so
  a live row and an imported row can never disagree about the same uid.

### Verified end-to-end against the live dataset, before the review

The importer was run against live Analytics Engine into a local D1 (temporary harness, not
committed), cutoff fixed at 2026-08-05T00:00Z:

**6,838 rows over 92 days in 23 invocations, and all 92 days matched AE exactly** on both
`COUNT()` and `SUM(_sample_interval)` — zero mismatches, so the ±1% gate was not needed. The
sub-day path ran for real (2026-08-04 as 448 + 31). Sampling survived: 1/2/3/10 in AE's own
proportions. 11 hostnames imported; `clumeral.com` is 4,690 of 6,838. Per-invocation rows
were 31–449, inside the 450 cap, so P49's sizing holds against real data.

This proves the query shapes, the mapping and the windowing. It cannot prove CPU per
invocation — that needs `wrangler tail` on the deployed cron.

### Open for Jamie — P35 versus the pre-prod split

P54 settled "import all hostnames" on 2026-08-04, when there was **one** analytics database.
§15 then split prod and pre-prod into two, and the backfill only ever runs in production, so
all 11 pre-prod hostnames now land in the **production** database, where `/stats` — locked to
`clumeral.com` — can never display them. That is 2,148 of 6,838 rows readable only by direct
SQL.

**Recommendation: leave P54 as it is.** The rows cost nothing, AE deletes this history within
days and it can never be re-imported, and clearing them later is a single targeted statement
against `hostname`. Importing and ignoring is reversible; not importing is permanent. Say the
word and it becomes a one-line hostname filter instead.

### Still owed after merge — Tasks 14 and 15

Neither is code and neither can be done from here, so they are not in this PR:

- **Task 14, the comparison.** `scripts/compare-ae-d1.mjs` reads the D1 side through
  `wrangler d1 execute --remote`, which the guard hook blocks for this agent and which needs
  Cloudflare credentials it does not hold. **Jamie runs it** once the backfill reports done.
  The local rehearsal above is the strongest evidence obtainable before merge.
- **Task 15, the measurement.** CPU per batch, wall-clock per run and rows per invocation come
  from `wrangler tail` against the deployed per-minute cron. Local wall-clock was ~890 ms per
  invocation including live AE round trips, which says nothing about CPU. If 450 rows will not
  parse inside the 10 ms budget the invocation is killed, the cursor does not move, and the
  next minute retries — the import gets slower, never wrong. That is why P21/P49's constant is
  tuning rather than risk.
- **Storage measurement for [104] cannot use `page_count × page_size`.** D1 refuses
  `pragma_page_count()` over the API with `not authorized: SQLITE_AUTH`, confirmed 2026-08-06.
  Use `wrangler d1 info clumeral-analytics` or the dashboard. The PR 3 checklist says so now.
- **Worker secrets must be confirmed present.** `CF_ACCOUNT_ID` and `CF_API_TOKEN` predate
  PR 1 (which removed the code that used them, not the secrets), but nobody has verified they
  are still set. If they are gone the cron fires every minute and imports nothing, logging one
  line per run.

### `da-build` review — findings and fixes, 2026-08-06

Fresh-context review of the PR 2 diff. Returned **2 High, 3 Medium, 5 Low**, verdict NOT
READY. Both Highs were silent, permanent data loss on a source that is being deleted, and
both were reproduced with probes rather than argued. All Highs and Mediums are fixed; the
Lows are fixed or recorded.

**High**

- **C-1. One empty response from AE would have ended the import forever, part-way.**
  `done = 1` is terminal, and `counts.length === 0` was taken as proof of completion — but an
  empty result is not a failure, so nothing would have retried, and the only trace was a
  `console.log`. `makeAEQuery`'s `body.data ?? []` widens it: any 200 with an unexpected shape
  becomes a clean empty array. **Verified by the reviewer: 10 of 30 rows imported, `done = 1`,
  `consecutive_failures = 0`.** Now three things must agree before it finishes — no days from
  the grouped query, a row reading zero from a differently shaped `COUNT()` over the same
  window, and D1's own row count matching `expected_rows`, the total AE reported at discovery.
  That total needs somewhere to live, hence **migration 0007**. A shortfall past 1%/3 rows
  refuses to finish, logs and counts as a failure, so five of them halt loudly. The reviewer
  was also right that the old comment had it backwards: retention deletes from the *old* end,
  which the cursor has already passed, so "AE deleted it underneath us" was never the
  explanation for an empty window.
- **C-2. A short read on a re-run window destroyed already-imported rows.** `importWindow`
  deleted unconditionally and inserted whatever came back, without checking it against the
  count the sizing query had just given for the same window. **Verified: 5 rows → 0 rows,
  cursor advanced, no failure recorded.** Not hypothetical — the import *starts* at AE's
  retention edge, so the first days it touches are precisely the ones AE is about to delete.
  Now a window whose row query returns fewer rows than its own count query promised throws
  before the `DELETE`, and the minute-later retry sees a consistent pair and proceeds.

**Medium**

- **C-3. The discovery invocation issued 51 D1 queries against a free-tier cap of 50.**
  `MAX_ROWS_PER_RUN = 450` is 45 INSERTs, 46 statements with the DELETE — already over
  `STATEMENT_BUDGET = 45`, which the single-oversized-day path bypasses because it always
  takes at least one day, and neither constant accounted for discovery's two extra reads.
  P48's 523-row first day is exactly that shape. Now 400 rows / 42 statements, worst case 47.
- **C-4. The statement-cap test was tautological** — it recomputed the implementation's own
  cost formula from the implementation's own constants and compared it to the implementation's
  own budget. It stayed green while the real path issued 51. Replaced by a counting
  `D1Database` wrapper that counts what actually reaches D1 across the discovery path, the
  oversized-day path and a maxed multi-day batch, asserted against 50 and 100 bound
  parameters. Mutation-checked: restoring 450 fails it.
- **C-5. The test file contained a literal NUL byte**, so git treated it as binary and the
  diff showed nothing — for the one change in this repo that cannot be undone. Fixed, and the
  fake AE's row ordering now sorts `ts` numerically rather than as text (it only agreed while
  every timestamp had the same digit count).

**Low** — C-6 backwards clock reached the same terminal `done` (now goes through the same
verification). C-7 `rows_written` double-counts re-run windows, so the PR 3 checklist now
checks `COUNT(*)` against `expected_rows` instead. C-8 no behavioural test for the cron
dispatch (added: the per-minute expression must reach the backfill without touching KV, and
`0 0 * * *` and an unknown expression must reach the daily job without touching D1). C-9
"runBackfill never throws" was untrue for the pre-lock state read (now inside its own try).
C-10 the same-second overflow path still reports success after logging its loss — accepted,
unreachable at 677 rows across 86,400 seconds.

**Re-verified live after the fixes.** Same harness, same 2026-08-05T00:00Z cutoff: **6,838
rows imported against 6,838 expected — exact — in 24 invocations, 0 failures, 92 of 92 days
matching AE on both counts and sampled sums.** Max rows in one invocation 399, inside the new
400 cap.
