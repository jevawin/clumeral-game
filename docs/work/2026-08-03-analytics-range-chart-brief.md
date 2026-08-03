# Brief — Analytics: all-time range + labelled daily plays chart

Requested by Jamie, 2026-08-03.

> "Add an 'all time' option to the analytics (currently caps at 90d). Also add dates and
> counts to the daily plays graph. Dates on x, counts as labels OR on y."

Branch: `dev/analytics-range-chart`

Short form: proposed — awaiting Jamie's approval.

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

## 2. Out of scope
Settled: pending · Ack: pending

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
