# Considerations — decisions that hold at today's volume

Choices made because Clumeral is small. Each one is correct now and names the point at which
it stops being correct. Nothing in CI will raise these: check this file when traffic grows,
and before any work on the surfaces named below.

Add an entry whenever a brief or plan accepts something "for now, at this volume".

---

## Today's time chart reads D1 uncached

Decided 2026-11-01, Jamie — [daily time chart brief](work/2026-11-01-daily-time-chart-brief.md), item 34.

- **What:** every visit to `/solved` queries `analytics_events` for today's `puzzle_time`
  values. No edge cache, no KV, no stored aggregate.
- **Why it is fine now:** tens of daily solves. The query is bounded by hostname, event and a
  narrow `ts` window on the `(hostname, event, ts)` index, so each read touches a handful of
  rows against a free allowance of millions a day. A cache would make the chart stale for no
  saving.
- **Revisit when:** daily solves pass the low thousands, or D1 rows-read shows up on the bill.
- **Likely fix then:** a short edge cache keyed by puzzle number. The response carries no uid
  or timestamp — only `(second, count)` pairs — so it is safe to share between players.
