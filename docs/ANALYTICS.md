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
| Schema | `migrations/0005_create_analytics_events.sql` |
| Backfill cursor | `migrations/0006_create_backfill_state.sql` |
| Write path | `POST /api/event` → `recordEvent()` in `src/worker/analytics-db.ts` |
| Read path | `GET /stats`, `GET /api/stats` → `getStats()` |

**One database for every hostname.** Every row carries `hostname`, and `/stats` is locked
to the host it is called from — so `clumeral.com/stats` shows production, a preview's
`/stats` shows that preview, and staging shows staging. The per-host lock *is* the
prod/pre-prod separation; a second database would enforce the same property twice while
doubling the migration surface forever. Splitting later is one `INSERT ... SELECT` plus one
`DELETE`, because the column is there.

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

**PR 1 (this one).** Schema, dual write, D1 reads, the rebuilt chart, test harness, docs.
After it merges, D1 collects and `/stats` shows post-merge data only. The chart will look
sparse on the preview URL — that is expected, not a defect.

**PR 2.** The backfill: imports everything from before the dual-write cutover out of AE,
all hostnames, idempotent per UTC day, driven by a temporary per-minute cron.

**PR 3.** AE removal — `writeDataPoint`, the `ANALYTICS` binding, the second cron entry,
and the API token revoked. Gated on the comparison below.

### Cutover instant

Recorded here as an exact UTC value once PR 1 is deployed:

> **Cutover: _to be filled in from the first live D1 row after PR 1 merges._**
> `SELECT MIN(ts), datetime(MIN(ts)/1000, 'unixepoch') FROM analytics_events WHERE backfilled = 0;`

The backfill discovers this value itself and freezes it — it is never typed in by hand.

### Comparison gate (blocks PR 3)

Run `node scripts/compare-ae-d1.mjs` from the Pi. It compares **per-day
`SUM(_sample_interval)` on the AE side against `SUM(sample_interval)` on the D1 side**, over
**full UTC days only** — never a partial day, which removes the midnight-boundary class of
mismatch outright.

**Pass:** every full day within **±1% or ±3 events, whichever is larger**.

Not "match exactly": at ~80 events/day a ±1% band is ±0.8 events, i.e. a gate that could
never realistically go green. The absolute floor tolerates the real cause — a handful of
requests landing on one write path but not the other around a deploy. A day outside the
band, or any day at zero or half, is a real defect and blocks PR 3.

**Differences inside the tolerance get recorded here with the day and the delta**, not
silently passed.

### PR 3 removal checklist

- [ ] Three consecutive full days, including a weekend day, inside the tolerance
- [ ] Storage measured (`page_count × page_size`) and recorded here
- [ ] `env.ANALYTICS.writeDataPoint` removed from `POST /api/event`
- [ ] `analytics_engine_datasets` removed from `wrangler.jsonc`
- [ ] The per-minute cron entry removed from `triggers.crons`
- [ ] `backfill.ts` and its cron dispatch removed
- [ ] The Analytics Read API token revoked in the Cloudflare dashboard
- [ ] `CF_ACCOUNT_ID` / `CF_API_TOKEN` Worker secrets deleted
- [ ] This file updated to drop the dual-write language

## The API token

A scoped **Account · Account Analytics · Read** token, created by Jamie on 2026-08-03 and
confirmed 2026-08-04 to be sufficient for the AE SQL API — no wider scope is needed. It
lives in `.env` at the repo root (gitignored) and is used only from the Pi, by
`scripts/compare-ae-d1.mjs`. It is **not** a Worker secret and the Worker does not need it.

Account id: `06ff16a35fdefa6cae9e3463116086aa`.

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

## Outstanding actions

- **Compare D1 against Analytics Engine before retiring AE** — the gate above. Raised by
  Jamie 2026-08-04: "we'll look at d1, ask you to compare vs ae in a few days."
- **Custom and comparison date ranges** — pick start/end, and compare against the previous
  period / previous year. GitHub issue #297, out of scope here.
