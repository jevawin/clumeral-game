# Brief — Analytics: all-time range + labelled daily plays chart

Requested by Jamie, 2026-08-03.

> "Add an 'all time' option to the analytics (currently caps at 90d). Also add dates and
> counts to the daily plays graph. Dates on x, counts as labels OR on y."

Branch: `dev/analytics-range-chart`

Short form: sections 1, 2, 3, 6, 7, 8, 9, 11 — approved by Jamie 2026-08-03.
Sections 4 (maths), 5 (state & persistence) and 10 (analytics) marked n/a.

**Scope status: REOPENED at §1/§2 on 2026-08-03.** Item 4's retention risk is confirmed
real, which changes what this piece of work is. See §2. Awaiting Jamie's scope decision.

---

## 1. What it is
Settled: pending · Ack: pending

1. The problem is two things in one request: `/stats` hard-caps the range at 90 days
   (`Math.min(Number(period), 90)` in `src/worker/index.ts:430,449`), and the daily plays
   chart is bare bars — no dates, no values, no axis, so you cannot read "which day" or
   "how many" off it at all. (assumed — read from the code)
2. Who it is for: Jamie and Dave only. `/stats` is internal and `noindex, nofollow`; it is
   not a player-facing surface. (assumed)
3. Why now: analytics has been collecting since 2026-04-05 (~120 days), so 90d has only
   just started actually truncating history. (assumed — from `git log` on `stats.ts`)
4. **Question — the catch.** Cloudflare Workers Analytics Engine retains data for roughly
   92 days, not forever. If that is right, "All time" would return only marginally more
   than the existing 90d view, and would keep returning ~92 days no matter how long the
   game runs.
   My rec: build it anyway, but call it **"All"** rather than "All time", and print the
   real first and last date in the range label (e.g. "5 Apr – 3 Aug · 120 days") so what
   you are actually looking at is never in doubt. Why: the honest label costs nothing and
   the option still has value — it removes the guessing about whether 90d is clipping.
   I will confirm the exact retention figure against Cloudflare's docs during Plan and
   write the answer into the plan file.

### §1 addendum — item 4 resolved, 2026-08-03

5. **Retention confirmed.** Cloudflare's own limits page states data written to Workers
   Analytics Engine "is retained for three months" — reported elsewhere as 90–93 days.
   There is no configuration flag and no paid extension; the docs invite you to ask on
   Discord if you want longer. Source:
   https://developers.cloudflare.com/analytics/analytics-engine/limits/
   Consequence: **"All time" as literally requested cannot be built.** No range option can
   show data Cloudflare has already deleted.
6. **We are actively losing data, as Jamie identified.** Analytics started 2026-04-05.
   Today is 2026-08-03 — 120 days. Everything before roughly 2026-05-05 is already gone
   and is not recoverable by any means.
7. **But the remaining loss is bounded and recoverable.** Roughly 2026-05-05 → today is
   still sitting in Analytics Engine right now. A one-off backfill run at build time
   captures all of it permanently. The only cost of not acting today is the tail: one
   further day falls off the back for each day we wait. (assumed — follows from 5 and 6)
8. **The archive is far smaller than "a bigger task" implies, because the infrastructure
   already exists.** `wrangler.jsonc` already binds D1 (`FEEDBACK_DB`) and already runs a
   daily cron (`"0 0 * * *"` → `scheduled()` → `runDailyCron` in `src/worker/index.ts:556`).
   An archiver is a new D1 table plus a rollup query added to the handler that already
   runs every night. No new bindings, no new services, no new cron. (assumed — read from
   the config and worker)
9. **Sampling — get this right before freezing anything.** Every query in `stats.ts` uses
   `COUNT()`. Analytics Engine samples under load and the correct expression for a true
   count is `SUM(_sample_interval)`. At Clumeral's volume the sample interval is almost
   certainly 1 today, so the numbers on screen are fine — but a rollup writes numbers into
   D1 permanently, and archiving an undercount is not fixable later.
   My rec: switch to `SUM(_sample_interval)` as part of the archive work. Why: cheap now,
   impossible to correct retrospectively.

## 2. Out of scope
Settled: pending · Ack: pending

10. **Question — the scope decision, and it is Jamie's.** Three ways to take this:
    - **(a) Split, archive first.** Pause this brief, brief the archiver, come back to the
      chart after. Stops the bleeding soonest.
    - **(b) Widen this brief to cover both.** One story — "make /stats show our whole
      history" — archiver plus chart plus range options, shipped together.
    - **(c) Ship the chart now, archive next.** Chart dates/counts and a range capped at
      the retention ceiling go out today; archiver gets its own brief afterwards.

    My rec: **(b)**. Why: the range nav and the "All" option are the same code either way,
    and building them against Analytics Engine now means rebuilding them against D1 in a
    fortnight. Splitting saves no time and duplicates the one bit of UI both halves touch.
    The urgency argument for (a) is weaker than it looks — per item 7, waiting a few days
    costs a few days off the tail, not the archive.

    This stops being a small request either way, so it needs Jamie's authorisation as dev
    lead before any building starts.
11. Out either way: retrieving pre-2026-05-05 data (gone), per-event raw row archival
    (aggregates only), and any player-facing analytics surface. (assumed)

## 3. How it works
Settled: pending · Ack: pending

## 4. Maths
n/a — no puzzle generation or filtering involved.

## 5. State & persistence
Settled: pending · Ack: pending

## 6. How it fits
Settled: pending · Ack: pending

## 7. How it looks
Settled: pending · Ack: pending

## 8. Copy & wording
Settled: pending · Ack: pending

## 9. Accessibility
Settled: pending · Ack: pending

## 10. Analytics
Settled: pending · Ack: pending

## 11. Done / test plan
Settled: pending · Ack: pending
