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
Settled: Jamie 2026-11-01 (accepted all recommendations) · Ack: Dave pending

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

## 3. How it works
Settled: pending · Ack: pending

16. The card appears on `/solved` after a daily solve, inside the #311 results panel. Not on
    `/play` in solved-replay mode, not on random or archive completion. (assumed — the stats
    panel lives on `/solved` only, `src/app.ts:832`)
17. Below 10 times in the field, the copy is a rank ("2nd fastest"). From 10, a percentile
    ("top 70%"). Visual states follow Idea-P: n = 1, 2, 3, 10+. (assumed — handover §3)
18. Your dot is always on the chart and counted exactly once, whether or not your own
    `puzzle_time` has reached the database by the time the card loads. (assumed — the POST
    is fire-and-forget, so a race is guaranteed; how to avoid it is the plan's job)
19. Ties share the better rank. Two players on 41s, both fastest, are both "fastest".
    (assumed — standard competition ranking; the Idea-O block's definition is ported, and
    the plan checks it agrees)
20. Your time is past the p95 clip: your dot pins to the right edge and your label still
    shows your true time. (assumed — your label always tracks you, handover §3)
21. A time of 0s is floored to 1s for placement only, since `ln(0)` is undefined. Values
    outside 0–86400 are dropped server-side. (assumed)
22. You have no valid time — solved before the timer shipped, or the stored time is unknown:
    the card does not show. (assumed — the card is about you; without your dot it is a
    chart of strangers)
23. The fetch fails or you are offline: the card does not show. No error, no retry button.
    The rest of the panel is unaffected. (assumed — it is a garnish, not the game)
24. Which players count as "today"?
    My rec: everyone who solved the same puzzle number as you. That needs `puzzle_time` to
    carry the puzzle number — one new nullable column, additive.
    Why: the puzzle day is browser-local (`todayKey()` in `src/date.ts`, bug #205), but
    `analytics_events` stores only a UTC `ts`. A New York player solving at 8pm on 1 Nov
    writes a 2 Nov UTC row. Windowing on the UTC day mixes two different puzzles, and solve
    times on different puzzles are not comparable — one day's puzzle can be twice as hard.
    The cost: rows written before the column exists (today's 5) have no number and are never
    shown. Alternative: window on the UTC day and accept the mix.
25. You come back to `/solved` later the same day. Does the chart refresh?
    My rec: yes, fetch fresh on every visit. Your rank can move as others finish.
    Why: "does it change between visits" is the reason this card exists (item 1). A
    snapshot frozen at your solve would hide that. The cost: a player who was "top 10%" at
    9am may read "top 30%" at 9pm — which is true.
26. Players with saving turned off (`saveScore` false). Their time is never sent (brief 141).
    Do they see the chart?
    My rec: yes. Their dot is placed locally against the field and is never added to it.
    The request for the field carries no uid and no time.
    Why: brief 141 is "nothing about your play leaves the device", and a request carrying
    nothing about them keeps that. Hiding it punishes the choice to opt out. The cost: the
    request itself shows an anonymous visitor reached the results screen — the same as
    loading any page.
