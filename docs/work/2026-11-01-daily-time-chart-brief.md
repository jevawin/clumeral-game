# Brief — Results screen: today's solve-time chart

Requested by Jamie, 2026-11-01. Input: [daily-time-chart handover](2026-11-01-daily-time-chart-handover.md)
and the canvas boards it names (Idea-O, P, R, N).

Branch: `dev/daily-time-chart`

**Status: in progress.**

---

## 1. What it is
Settled: Jamie 2026-11-01 (accepted all recommendations) · Ack: Dave pending

1. The problem: the results panel shows figures that barely move between visits. A daily
   game's results screen is seen once a day, and an all-time distribution reads 237-of-239
   today and 238-of-240 tomorrow. Today's field changes every day. (assumed — handover §1)
2. The feature: a strip on the results screen plotting your solve time against everyone
   else's today, on a log axis, with copy ranking you. Design is Idea-O on the canvas.
   (assumed — handover §1)
3. Why time, not goes: production is 88.1% one-go, so goes cannot rank anyone. Time is the
   only captured variable with real spread. (assumed — handover §1)
4. Who it is for: players who have just solved today's daily. Random and archive solves do
   not get the chart — the data is daily-only (`playTimeToSend` in `src/play-timer.ts`
   returns null for both). (assumed — read from the code)
5. Dave's whisker chart (stats-polish brief items 106/107) stays parked as the successor.
   This card is not a rejection of it. (assumed — handover §4.6)
6. Why now, and do we launch on almost no data?
   My rec: build and ship now, relying on the low-data states (Idea-P, n = 1, 2, 3, 10).
   Why: `puzzle_time` reached main today (#347) and has 5 rows. Waiting buys nothing — the
   field is only ever one day deep, so day one of launch looks the same as day thirty.
7. This breaks the redesign constraint "no worker/API changes": no endpoint serves today's
   times. Do we lift it for this item?
   My rec: yes, lift it explicitly for one new read-only endpoint. Why: the chart cannot
   exist without it, and a read-only aggregate is the smallest worker surface that works.
   Writes stay as they are.

## 2. Out of scope
Settled: pending · Ack: pending

8. No named leaderboard and no other player's identity on the card. A named rank is the first
   real incentive to forge events, and `/api/event` takes any `uid` unauthenticated. Blocked
   on accounts. (assumed — handover §2)
9. No goes on this card. (assumed — follows from item 3)
10. Today only. No past days' charts, no history view of your own times. (assumed — item 1)
11. The rest of the #311 results panel stays as it is. This card is added to it, not a
    redesign of it. (assumed — P1 and the stats-panel memory)
12. The timer itself does not change: what it measures, idle handling, opt-out, and the
    `puzzle_time` event are all untouched. (assumed — reading only)
13. Share text does not gain your time or rank. (assumed — separate feature if wanted)
14. Fixing `puzzle_complete` mixing daily, archive and random (`src/app.ts:1065`) is owed but
    not part of this. The chart does not read it. Raised as its own issue. (assumed — keep
    maintenance out of a feature)
15. Forgery protection on `/api/event`: is it out of scope?
    My rec: yes, out of scope — but the new read query clamps values the same way the
    existing mean does (`value BETWEEN 0 AND 86400`, `src/worker/analytics-db.ts:207`), and
    the card shows a percentile, not a named rank. Why: anyone can already POST fake times.
    A flood could shift today's percentiles, but it cannot name or harm anyone, and the
    proper fix (accounts or signed completions) is a project of its own. The cost is that
    a determined troll could make the field look odd for a day.
