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

### Jamie's challenge, 2026-08-03: is two systems the right shape at all?

> "That creates two systems: capture into A, archive into B. We'd need to report from B OR
> a mix and are immediately introducing real-time vs archived. Is there a better tracking
> solution all in one?"

12. **Measured volume, and it reframes everything.** Live production `/api/stats?period=30`
    returns **2,440 events across 30 days — ~81 events/day**, across 8 event types
    (`route_change` 1289, `puzzle_start` 638, `puzzle_complete` 239, `tooltip_opened` 185,
    `incorrect_guess` 60, `theme_toggle` 16, `htp_opened` 12, `feedback_submitted` 1).
    At that rate a raw row per event is ~30k rows/year. D1's free tier allows 500 MB and
    100k row-writes/day; we would use roughly 3 MB/year and 0.08% of the daily write
    budget. Even 100× growth stays comfortably inside the free tier. (measured)
13. **Therefore the two-system design is not required.** It exists to protect a write path
    that, at 81 events/day, needs no protection. Options considered:

    - **(1) AE live + D1 nightly rollup** — the original proposal. Two query paths, a seam
      at the 90-day boundary, today's data missing from the archive until the cron fires,
      and the rollup's dimensions frozen at design time. Jamie's objection is correct.
    - **(2) D1 only, raw rows** — replace `writeDataPoint` with a D1 insert. One system,
      unlimited retention, exact counts, arbitrary re-slicing of history later.
    - **(3) D1 only, counter upserts** — ~10 rows/day, but history can never be re-sliced
      by a dimension not stored up front. No reason to accept that at this volume.
    - **(4) Third-party (Plausible / Umami / PostHog / Fathom)** — retention and dashboards
      included, but a monthly cost, a third-party script on the page, a privacy/consent
      posture change, and custom events (guess distribution, undo source) need rebuilding.
      Poor value for 81 events/day.
    - **(5) Durable Object with SQLite storage** — no advantage over D1 here; more moving
      parts.
    - **(6) Do nothing, accept 90 days** — free, but Jamie has ruled it out.

14. **My rec: option (2), D1 only, raw rows.** Why: it is the one-system answer to the
    challenge; measured volume makes the scale objection theoretical; D1 is already bound
    (`FEEDBACK_DB`); keeping raw rows means future questions are answerable without a
    schema change; and the six queries in `stats.ts` are already plain aggregate SQL, so
    they port to D1 with small edits rather than a rewrite. `/api/event` keeps returning
    202 immediately by doing the insert in `ctx.waitUntil`.
15. **The `SUM(_sample_interval)` problem disappears** under option 2 — D1 rows are exact
    and unsampled. Item 9 becomes moot rather than needing a fix. (assumed)
16. **The backfill can be raw, so there is no granularity seam either.** AE's SQL API will
    return raw rows, not just aggregates — ~7,300 rows for the surviving ~90 days, paged by
    day. So the imported history is the same shape as what we collect afterwards, and
    "unique users over June–July" stays computable. This was the strongest argument for
    option 1 and it does not survive contact with the row count.
17. **Question — retention of `uid`.** Raw rows keep the anonymous user id forever, where
    AE would have aged it out at 90 days. Not a regulatory problem (no personal data, it is
    a random local id), but it is a deliberate change of posture.
    My rec: keep raw rows, and add a prune step to the existing nightly cron that nulls
    `uid` on rows older than 12 months while leaving the row countable. Why: preserves the
    ability to answer unique-user questions across a year, without keeping identifiers
    indefinitely for no purpose.
18. **Migration safety.** Keep `writeDataPoint` running alongside the D1 insert for one
    release, compare the two on `/stats`, then remove the AE call. Why: a silent analytics
    outage is invisible by definition — a dual-write overlap is the only cheap way to prove
    the new path works before the old one is gone. (assumed)
19. Noted in passing, not proposed as scope: `/stats` and `/api/stats` have no
    authentication — only `noindex`. Worth a separate issue; flagging it, not widening
    this brief.

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
