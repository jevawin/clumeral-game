# Brief — Results screen: today's solve-time chart

Requested by Jamie, 2026-11-01. Input: [daily-time-chart handover](2026-11-01-daily-time-chart-handover.md)
and the canvas boards it names (Idea-O, P, R, N).

Branch: `dev/daily-time-chart`

**Status: in progress.**

---

## 1. What it is
Settled: Jamie 2026-11-01 (accepted all recommendations) · Ack: Dave 2026-11-01 (relayed by Jamie)

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
Settled: Jamie 2026-11-01 (accepted all recommendations) · Ack: Dave 2026-11-01 (relayed by Jamie)

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
Settled: Jamie 2026-11-01 (accepted all recommendations) · Ack: Dave 2026-11-01 (relayed by Jamie)

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

## 4. Maths
Settled: Jamie 2026-11-01 (accepted item 28: Dave signs) · Sign-off: Dave pending (blocking) · Ack: n/a

27. n/a for puzzle maths: nothing touches generation, clues or filtering. (assumed)
28. The card does carry statistics — the percentile, tie ranking (item 19), the log axis,
    the p95 clip and the 1s floor (item 21). Proposed definition, for n times including
    yours: `top X%`, where X = ceil(100 × (count strictly faster than you + 1) / n).
    Fastest of 10 → top 10%. Slowest of 10 → top 100%. Ties share the better figure.
    Does Dave sign those?
    My rec: yes, Dave signs them here, as the maths owner, before Plan. Why: he set the
    log-scale requirement, and "top X%" is a number we publish to every player. Getting the
    definition wrong is cheap to fix but embarrassing to ship.

## 5. State & persistence
Settled: Jamie 2026-11-01 (accepted all recommendations, with item 36) · Ack: Dave 2026-11-01 (relayed by Jamie)

29. The field lives on the server only, in `analytics_events` in `clumeral-analytics`. The
    one storage change is the puzzle-number column from item 24: a new nullable column via
    a numbered migration, additive. (assumed — settled in item 24)
30. Nothing new is stored on the client. No new `localStorage` or `sessionStorage` key; the
    `dlng_` keys are untouched. The field is fetched each visit and held in memory only.
    (assumed — item 25 makes a cache pointless)
31. Your own time comes from today's existing history entry (`seconds`), the same value the
    hero line already shows. (assumed — read from `src/app.ts:933`)
32. The field is filtered by hostname, as `/stats` is, so pre-prod and preview traffic never
    reaches a production card. (assumed — `hostname` exists for exactly this, see the
    `0005` migration)
33. The endpoint will answer for any puzzle number, not just today's. A past puzzle's times
    are harmless — they are times, never answers. (assumed — refusing them buys nothing and
    the server cannot know a browser's local "today")
34. Caching and cost: do we cache the read?
    My rec: no cache. Query the database on every `/solved` visit.
    Why: volume is tens of solves a day. The query is bounded by event, hostname and a
    narrow `ts` window, which the existing `(hostname, event, ts)` index covers, so each read
    touches a handful of rows. D1's free allowance is millions of rows read a day. A cache
    adds staleness (item 25) to save nothing. Revisit if daily solves pass the thousands.
35. What does the server expose, given low n makes times identifiable?
    My rec: return only `(second, count)` pairs for the puzzle number. No uid, no timestamp
    of the solve, no idle label. Accept that at n = 2 a player who knows who else played
    can work out that person's time.
    Why: one dot per distinct second is what the card draws, so the client needs exactly
    this and no more. A solve time is low-harm to reveal. The alternative — hide the card
    below some n — throws away the low-data states that item 6 decided to ship.
36. Jamie, 2026-11-01, on item 34: log the no-cache decision and its revisit point so it is
    not forgotten as traffic grows. Logged in [docs/CONSIDERATIONS.md](../CONSIDERATIONS.md),
    linked from `CLAUDE.md`.
37. Jamie, 2026-11-01, on item 35, as a hard rule: the endpoint **never** returns a uid, a
    solve timestamp, or anything other than a time and its count. This holds for any future
    change to the endpoint, not just this build.

## 6. How it fits
Settled: Jamie 2026-11-01 (accepted all recommendations) · Ack: Dave pending

38. Client rendering hangs off `renderCompletion` in `src/completion.ts`, which builds the
    #311 panel synchronously. The chart needs a fetch, so it renders into its own slot after
    the rest of the panel is up and never delays it. (assumed — item 23 already says the
    panel must not depend on it)
39. The Idea-O computation block (positions, sizes, median rule, p95 clip, rank and
    percentile) is ported into one new pure client module, with no DOM and no fetch, so it
    is unit-testable on its own. Rendering sits beside it. (assumed — handover: port the
    block, do not re-derive it)
40. Your time is sent with the puzzle number: `track()` in `src/app.ts` gains an optional
    puzzle number, used only by the `puzzle_time` call at `src/app.ts:1131`. No other event
    changes. (assumed — item 24, and item 14 keeps `puzzle_complete` out)
41. Worker: `POST /api/event` (`src/worker/index.ts:424`) accepts the optional puzzle
    number; `recordEvent` (`src/worker/analytics-db.ts:114`) writes it, storing NULL for
    anything that is not a positive integer. The Analytics Engine dual write does not gain
    it — AE is being retired. (assumed)
42. One new public read-only route in `src/worker/index.ts`, with its query in
    `src/worker/analytics-db.ts`. It returns `(second, count)` pairs only (items 35, 37),
    clamped to 0–86400, filtered by hostname, and sent `Cache-Control: no-store` (items 25,
    34). It sits under `/api/`, so the service worker already treats it network-only
    (`public/sw.js:53`). (assumed)
43. Migration `migrations/analytics/0008_*.sql` adds the nullable puzzle-number column. 0008
    follows the highest existing number across both directories (0007). No new binding:
    `ANALYTICS_DB` is already declared in `env.preprod`. (assumed — CLAUDE.md migration
    rules)
44. Untouched: `src/worker/puzzle.ts`, the generator, `/api/guess`, tokens, `PUZZLES` KV,
    `src/storage.ts` and every `dlng_` key, `src/play-timer.ts`. The answer never comes near
    the new route. (assumed — read against `docs/INVARIANTS.md`)
45. Old clients — a cached PWA build that predates this — keep sending `puzzle_time` without
    a puzzle number. Those rows are stored with NULL and never shown. (assumed — additive,
    no breakage)
46. Which panel modes get the card? `panelMode` (`src/completion.ts:78`) has six: random,
    archive, marker, saving-off, new, full.
    My rec: full, new and saving-off. Not random or archive (item 4). Not marker — it has no
    recorded play, so no valid time (item 22).
    Why include new: the `REVEAL_AFTER_GAMES = 2` gate is about *your* history being too
    thin to show streaks. Today's field does not depend on your history, so a first-time
    player has as much reason to see it as anyone — arguably more.

## 7. How it looks
Settled: pending · Ack: pending

47. The design is Idea-O: a horizontal log axis, one dot per distinct second sized by how
    many share it, your dot solid accent with your time above it, Fastest / Median / Slowest
    below on short leader lines, the copy line above. Low-data states follow Idea-P.
    (assumed — handover §1, §3)
48. `— log time` is on the card, always with the dash, positioned by the flip rule (Idea-R):
    the top corner furthest from your dot, with a 14px leader. (assumed — Dave's
    requirement, chosen 2026-11-01)
49. Two colours only: theme accent and foreground, with `--accent-soft` and `--fg-50`
    reused. Bold for emphasis. No new tokens. Dark mode comes free from the tokens.
    (assumed — handover §5)
50. Label widths are measured from the rendered text, not estimated from the mockup's
    per-character table. (assumed — handover §3; the comment travels with the lifted code)
51. No entrance animation. The dots are drawn in place. (assumed — nothing to animate that
    adds meaning, and it removes a reduced-motion case)
52. The card cannot be the fixed 390px it was designed at. The panel is `max-w-[26rem]`
    with `px-6` (`index.html:61`), so the content is at most 368px wide — about 320px on a
    375px phone. How does it fit?
    My rec: the track takes the container's width. Positions are already fractions of the
    track, so dots scale for free. Label collisions and the flip rule's clearances (106px
    and 186px, measured at 390) are re-checked at 320px in the build, with Playwright at a
    phone viewport.
    Why: the alternative, a horizontally scrolling or scaled-down card, makes 9px dots
    smaller still and is worse on exactly the screens most players use.
53. Where in the panel?
    My rec: its own block directly under the this-game figures, above Current streaks.
    Why: it is about today, and so are the figures above it. Streaks and All time are about
    your history; putting the chart between them would split "today" from "today".
54. The card arrives after a fetch, below content the player is already reading. Do we
    reserve its space?
    My rec: yes. Reserve the card's height (about 235px, Idea-R) the moment the panel
    renders, draw the chart into it when the data arrives, and collapse it only if the
    fetch fails.
    Why: inserting it late pushes Current streaks and All time down mid-read. A failure
    still shifts, but failure is the rare case. The cost: an empty 235px gap for the
    length of one request.
