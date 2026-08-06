# Brief — widen the AE/D1 comparison to every event, and record the 2026-08-04 delta

Date: 2026-08-06 · Branch: `dev/analytics-compare-all-events`

Short form: sections 1, 2, 3, 6, 11 — **proposed, awaiting Jamie's approval**.
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

Ledger: **Settled: pending · Ack: pending**

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
