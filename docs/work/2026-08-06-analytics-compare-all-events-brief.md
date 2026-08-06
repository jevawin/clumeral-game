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

Ledger: **Settled: Jamie 2026-08-06 · Ack: pending (Dave)**

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

Ledger: **Settled: pending · Ack: pending**

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
