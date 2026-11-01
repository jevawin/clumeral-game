# Brief — Results screen: today's solve-time chart

Requested by Jamie, 2026-11-01. Input: [daily-time-chart handover](2026-11-01-daily-time-chart-handover.md)
and the canvas boards it names (Idea-O, P, R, N).

Branch: `dev/daily-time-chart`

**Status: `da-brief` ran 2026-11-01 — 2 High, 5 Medium, 4 Low. Fixes settled by Jamie the
same day (items 90–102); boards exported (items 103–108). Second `da-brief` (Fable) ran
2026-11-01: 4 Medium, 6 Low. Fixes settled by Jamie (items 111–121). Ready for Plan.** Dave signed
items 111 and 116, acked items 103–108, and re-acked §3, §4, §5, §8 and §11 (relayed by
Jamie, 2026-11-01).

**Read "da-brief fixes", "Boards export", "Plan-stage questions" and "Fable da-brief fixes"
at the end before planning. Later sections win over earlier ones and over the body.**

**Read "da-brief fixes" at the end before planning. Where it and the body disagree, it wins.**

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
14. Fixing `puzzle_complete` mixing daily, archive and random (`src/app.ts:1082`) is owed but
    not part of this. The chart does not read it. Raised as its own issue: #366. (assumed — keep
    maintenance out of a feature)
15. Forgery protection on `/api/event`: is it out of scope?
    My rec: yes, out of scope — but the new read query clamps values the same way the
    existing mean does (`value BETWEEN 0 AND 86400`, `src/worker/analytics-db.ts:207`), and
    the card shows a percentile, not a named rank. Why: anyone can already POST fake times.
    A flood could shift today's percentiles, but it cannot name or harm anyone, and the
    proper fix (accounts or signed completions) is a project of its own. The cost is that
    a determined troll could make the field look odd for a day.

## 3. How it works
Settled: Jamie 2026-11-01 (accepted all recommendations) · **Reopened by da-brief fixes 2026-11-01, re-settled Jamie** · Ack: Dave 2026-11-01 (relayed by Jamie, after the da-brief fixes)

16. The card appears on `/solved` after a daily solve, inside the #311 results panel. Not on
    `/play` in solved-replay mode, not on random or archive completion. (assumed — the stats
    panel lives on `/solved` only, `src/app.ts:832`)
17. Below 10 times in the field, the copy is a rank ("2nd fastest"). From 10, a percentile
    ("top 70%"). Visual states follow Idea-P: n = 1, 2, 3, 10+. (assumed — handover §3)
18. [amended — see 91] Your dot is always on the chart and counted exactly once, whether or not your own
    `puzzle_time` has reached the database by the time the card loads. (assumed — the POST
    is fire-and-forget, so a race is guaranteed; how to avoid it is the plan's job)
19. [amended — see 94] Ties share the better rank. Two players on 41s, both fastest, are both "fastest".
    (assumed — standard competition ranking; the Idea-O block's definition is ported, and
    the plan checks it agrees)
20. [void — item 106] Your time is past the p95 clip: your dot pins to the right edge and your label still
    shows your true time. (assumed — your label always tracks you, handover §3)
21. A time of 0s is floored to 1s for placement only, since `ln(0)` is undefined. Values
    outside 0–86400 are dropped server-side. (assumed)
22. [amended — see 92] You have no valid time — solved before the timer shipped, or the stored time is unknown:
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
25. [amended — see 93] You come back to `/solved` later the same day. Does the chart refresh?
    My rec: yes, fetch fresh on every visit. Your rank can move as others finish.
    Why: "does it change between visits" is the reason this card exists (item 1). A
    snapshot frozen at your solve would hide that. The cost: a player who was "top 10%" at
    9am may read "top 30%" at 9pm — which is true.
26. [amended — see 91, 92] Players with saving turned off (`saveScore` false). Their time is never sent (brief 141).
    Do they see the chart?
    My rec: yes. Their dot is placed locally against the field and is never added to it.
    The request for the field carries no uid and no time.
    Why: brief 141 is "nothing about your play leaves the device", and a request carrying
    nothing about them keeps that. Hiding it punishes the choice to opt out. The cost: the
    request itself shows an anonymous visitor reached the results screen — the same as
    loading any page.

## 4. Maths
Settled: Jamie 2026-11-01 (accepted item 28: Dave signs; items 84–87 reviewed 2026-11-01) · Sign-off: Dave 2026-11-01 (relayed by Jamie; covers items 28 and 84–87) · Items 90 and 106: Dave 2026-11-01 (relayed by Jamie) · Ack: n/a

27. n/a for puzzle maths: nothing touches generation, clues or filtering. (assumed)
28. [amended — see 111] The card does carry statistics — the percentile, tie ranking (item 19), the log axis,
    the p95 clip and the 1s floor (item 21). Proposed definition, for n times including
    yours: `top X%`, where X = ceil(100 × (count strictly faster than you + 1) / n).
    Fastest of 10 → top 10%. Slowest of 10 → top 100%. Ties share the better figure.
    Does Dave sign those?
    My rec: yes, Dave signs them here, as the maths owner, before Plan. Why: he set the
    log-scale requirement, and "top X%" is a number we publish to every player. Getting the
    definition wrong is cheap to fix but embarrassing to ship.
84. [void — item 106] p95 for the slow-tail clip is **nearest-rank**: it always lands on a real time, so at
    n = 10 it is the slowest time and nothing clips. Clipping bites only once there is a
    real tail. (reviewed 2026-11-01, accepted recommendation)
85. Median at even n is the **mean of the middle two, rounded to the nearest second**. The
    Idea-O disc rule then applies as written: drawn from n = 3, and only if nobody finished
    on that second. (reviewed 2026-11-01, accepted recommendation)
86. Where the ported Idea-O block disagrees with items 28, 84 and 85, the signed definitions
    win. The plan changes the block to match and tests each definition. (reviewed
    2026-11-01, accepted recommendation)
87. [amended — see 116] A 0s time should never happen in practice. The 1s floor (item 21) stays only as a guard
    against a junk or forged row, not as a case the design expects. Ties are by whole
    second, matching how times are shown. (reviewed 2026-11-01)

## 5. State & persistence
Settled: Jamie 2026-11-01 (accepted all recommendations, with item 36) · **Reopened by da-brief fixes 2026-11-01, re-settled Jamie** · Ack: Dave 2026-11-01 (relayed by Jamie, after the da-brief fixes)

29. The field lives on the server only, in `analytics_events` in `clumeral-analytics`. The
    one storage change is the puzzle-number column from item 24: a new nullable column via
    a numbered migration, additive. (assumed — settled in item 24)
30. Nothing new is stored on the client. No new `localStorage` or `sessionStorage` key; the
    `dlng_` keys are untouched. The field is fetched each visit and held in memory only.
    (assumed — item 25 makes a cache pointless)
31. [amended — see 92] Your own time comes from today's existing history entry (`seconds`), the same value the
    hero line already shows. (assumed — read from `src/app.ts:933`)
32. The field is filtered by hostname, as `/stats` is, so pre-prod and preview traffic never
    reaches a production card. (assumed — `hostname` exists for exactly this, see the
    `0005` migration)
33. The endpoint will answer for any puzzle number, not just today's. A past puzzle's times
    are harmless — they are times, never answers. (assumed — refusing them buys nothing and
    the server cannot know a browser's local "today")
34. [amended — see 95] Caching and cost: do we cache the read?
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
Settled: Jamie 2026-11-01 (accepted all recommendations) · **Reopened by da-brief fixes 2026-11-01, re-settled Jamie** · Ack: Dave 2026-11-01 (relayed by Jamie, after the da-brief fixes)

38. [amended — see 93] Client rendering hangs off `renderCompletion` in `src/completion.ts`, which builds the
    #311 panel synchronously. The chart needs a fetch, so it renders into its own slot after
    the rest of the panel is up and never delays it. (assumed — item 23 already says the
    panel must not depend on it)
39. [see 104] The Idea-O computation block (positions, sizes, median rule, p95 clip, rank and
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
Settled: Jamie 2026-11-01 (accepted all recommendations) · Reopened by item 64, re-settled Jamie 2026-11-01 (accepted recommendation) · **Reopened by da-brief fixes 2026-11-01, re-settled Jamie** · Ack: Dave 2026-11-01 (relayed by Jamie, after the da-brief fixes)

47. The design is Idea-O: a horizontal log axis, one dot per distinct second sized by how
    many share it, your dot solid accent with your time above it, Fastest / Median / Slowest
    below on short leader lines, the copy line above. Low-data states follow Idea-P.
    (assumed — handover §1, §3)
48. [amended — see 101] `— log scale` is on the card, always with the dash, positioned by the flip rule (Idea-R):
    the top corner furthest from your dot, with a 14px leader. (assumed — Dave's
    requirement, chosen 2026-11-01)
49. Two colours only: theme accent and foreground, with `--accent-soft` and `--fg-50`
    reused. Bold for emphasis. No new tokens. Dark mode comes free from the tokens.
    (assumed — handover §5)
50. Label widths are measured from the rendered text, not estimated from the mockup's
    per-character table. (assumed — handover §3; the comment travels with the lifted code)
51. No entrance animation. The dots are drawn in place. (assumed — nothing to animate that
    adds meaning, and it removes a reduced-motion case)
52. [amended — see 96] The card cannot be the fixed 390px it was designed at. The panel is `max-w-[26rem]`
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
64. **Reopens item 49.** `--accent-soft` and `--fg-50` do not exist in the codebase — they
    are canvas names. `src/tailwind.css` has `--color-accent` and `--color-text`, and builds
    derived shades inline with `color-mix` (`--color-border` is text at 12%). The accent
    comes in four palettes (lime, cherry, blueberry, grape), each in light and dark: eight
    combinations. What does item 49 mean in code?
    My rec: two new derived tokens in `src/tailwind.css`, defined with `color-mix` from
    accent and text exactly as `--color-border` is — not new colours, new mixes of the two
    colours we have. Their percentages are set by the contrast floor in item 69, not copied
    from the canvas's 22% and 50%.
    Why: the "two colours only" rule survives, and the shades follow the player's palette and
    theme for free. Copying the canvas percentages blind risks dots that vanish in one of
    the eight combinations. The cost: two new tokens, against a ceiling of 15 (CLAUDE.md).

## 8. Copy & wording
Settled: Jamie 2026-11-01 (accepted all recommendations) · Reopened by item 88, re-settled Jamie 2026-11-01 (accepted recommendation) · **Reopened by da-brief fixes 2026-11-01, re-settled Jamie** · Ack: Dave 2026-11-01 (relayed by Jamie, after the da-brief fixes)

55. Chart labels as on the canvas: Fastest, Median, Slowest, `— log scale`. Your dot carries
    your time only. (assumed — designed and agreed on Idea-O/N)
56. [amended — see 94] Below 10 times, the line is an ordinal rank: "You're the **2nd fastest**". Ties read
    "joint": "You're the **joint 2nd fastest**". The copy never calls you "slowest" — last of
    five reads "5th fastest". (assumed — item 19; the chart already shows where you are)
57. No loading copy, no error copy. The reserved space is empty while loading and collapses
    on failure. (assumed — items 23, 54)
58. No caveat that the field counts only players with saving on. (assumed — true of every
    figure we publish, and a footnote on a garnish is noise)
59. From 10 times, the percentile line. The handover quotes it as "You're in the **top 70%**
    solve times". Keep it, or add "of"?
    My rec: "You're in the **top 70%** of solve times". Why: without "of" it does not parse
    as English. If the canvas dropped it on purpose to fit a line, the measured width at
    320px (item 52) will tell us; fix the width, not the grammar.
60. [amended — see 111] The slowest player at 10+ reads "top 100%" (handover §4.1). What do they see?
    My rec: no rank at all: "**{n} players** solved today". The chart still shows their dot.
    Why: there is no honest phrasing of last place that does not read as a dig, and a
    euphemism ("steadiest solver") reads as one too. The dot already tells them the truth.
    Applies only to the strictly slowest — anyone tied with someone faster keeps a percentile.
61. n = 1: you are the only time today. "You're the **fastest**" of one is silly.
    My rec: "You're the **first** to solve today". Why: it is true, it is the one moment
    being early is the story, and item 25's refresh turns it into a rank later.
62. The other panel blocks have headings ("Current streaks", "All time"). This one?
    My rec: "Everyone today". Why: it names the comparison in two words, and "today"
    separates it from the history blocks below.
63. Time format (handover §4.2). `formatDuration` renders sub-minute as `0m 41s`; the axis
    labels need `41s` to fit.
    My rec: `formatDuration` gains a compact option, used only for the chart's own labels.
    The percentile line, the hero and every other figure keep the current form.
    Why: one formatter keeps the rules in one place. Axis labels are a different job from
    a sentence, and there is no room at 320px for `10m 05s` beside a neighbouring label.
    The cost: the same solve reads `0m 41s` in the hero and `41s` on the axis — the
    inconsistency `src/app.ts:833` warns about, accepted here as the price of fit.
88. [amended — see 94] **Reopens items 56, 59 and 61.** Raised 2026-11-01 on item 28: the sole fastest player —
    not tied — always reads a fastest line, never a percentile or "top 10%". Suggested
    wordings: "You're fastest today" or "You solved fastest today".
    My rec: "You're the **fastest** today". Why: it matches the rank frame used below 10
    ("You're the **2nd fastest**"), so the line reads the same at every n.
    Open: does this also replace item 61's n = 1 line ("You're the **first** to solve
    today")? My rec: keep "first" at n = 1. Being fastest of one is not an achievement;
    being first is. From n = 2 the fastest line takes over.
    **Settled: Jamie 2026-11-01 — "You're the fastest today" for the sole fastest from
    n = 2; "You're the first to solve today" stays at n = 1.**

## 9. Accessibility
Settled: Jamie 2026-11-01 (accepted all recommendations) · Sign-off: Jamie 2026-11-01; item 97 amends item 69, accepted Jamie 2026-11-01 · Ack: n/a (owned section)

65. Nothing on the card is interactive: no tab stops, no hover, no tooltips. (assumed —
    Idea-O has none)
66. Your dot is not distinguished by colour alone: it is solid, larger (13px against 9px)
    and carries your time as a label. (assumed — WCAG 1.4.1, already true of Idea-O)
67. No entrance animation (item 51), so no reduced-motion case. (assumed)
68. The reserved space carries `aria-busy="true"` while loading and drops it when drawn.
    (assumed)
69. [amended — see 97] Contrast is measured in all eight palette × theme combinations: text at 4.5:1, every
    dot and the axis at 3:1 against the surface (WCAG 1.4.3, 1.4.11). Others' dots are data,
    not decoration, so they meet 3:1 too. Labels scale with text size and are measured live
    (item 50), so 200% zoom does not break collision handling. (assumed — required, not
    optional)
70. The label-in-name exception list is not widened (#345). (assumed — standing rule)
71. [amended — see 113] What does a screen reader get?
    My rec: the SVG is `aria-hidden`. The copy line is real text and reads first. Beneath it,
    one visually hidden sentence: "14 solve times today. Fastest 23 seconds, median 1
    minute 10 seconds, slowest 4 minutes 2 seconds. Yours: 41 seconds." Durations are
    spoken in words, not `41s`.
    Why: it carries everything the picture does except the shape, in the order a sighted
    player reads it. A data table of every distinct second is more complete but is noise
    to listen to, and the shape is the one thing a listener does not need.
72. Is the result announced when it arrives?
    My rec: no. The completion announcement (`pendingAnnouncement` in `src/completion.ts`)
    stays as it is; the card is read in place.
    Why: it arrives after a fetch, mid-way through the existing announcement. A second live
    update interrupts the one that matters — that you solved it.

## 10. Analytics
Settled: Jamie 2026-11-01 (accepted all recommendations) · Ack: Dave 2026-11-01 (relayed by Jamie)

73. Nothing new about the player's own result is sent. Their rank and percentile are not
    events — both are derivable from `puzzle_time` rows already. (assumed)
74. `puzzle_time` gains the puzzle number (items 24, 40) and nothing else. (assumed)
75. Any new event goes into `VALID_EVENTS` (`src/worker/index.ts:39`) with a unit test that
    it is accepted, and into `docs/ANALYTICS.md`. (assumed — the comment above the set: a
    missing name records nothing and looks fine)
76. Anonymous as every event is: the existing analytics uid, no identity. (assumed)
77. [amended — see 93] Do we measure whether the card renders?
    My rec: yes, one event, `time_chart`, sent once per `/solved` render that should show the
    card (item 46's modes). Source `drawn` or `failed`; value the field size n (0 on
    failure). Sent for saving-off players too.
    Why: this is the first part of the panel that depends on a network call, and its
    failure mode is silent by design (item 23). Without it, a broken endpoint looks exactly
    like a quiet day. n also tells us when the low-data states stop mattering, which
    feeds the CONSIDERATIONS revisit point. Saving-off is fine: the event carries the
    field's size, nothing about their play. `puzzle_complete` is already sent for them
    ungated (`src/app.ts:1082`).

## 11. Done / test plan
Settled: Jamie 2026-11-01 (accepted all recommendations, plus item 89) · **Reopened by da-brief fixes 2026-11-01, re-settled Jamie** · Ack: Dave 2026-11-01 (relayed by Jamie, after the da-brief fixes)

Written before code. Each line is a check the build must pass.

78. **Unit, client** (`tests/`, vitest) — the pure module from item 39:
    - positions on the log axis, the single-distinct-time case at 50%, the 1s floor;
    - dot sizes, including the 21px cap;
    - the median rule: absent below 3, present from 3, suppressed when someone finished on
      the median second; odd and even n; n = 2 does not double-draw;
    - the p95 clip, and your dot pinned past it with your true time;
    - the item 28 percentile: fastest of 10 → 10%, slowest of 10 → 100%, ties share;
    - ordinal ranks with "joint", and the copy chosen at n = 1, 2–9, 10+, and strictly
      slowest at 10+ (items 56, 59–61);
    - the compact `formatDuration` option, and that the default form is unchanged;
    - your time counted once whether or not the field already contains it (item 18).
    (assumed)
79. **Unit, worker** (`tests/worker/`):
    - the new route returns only `(second, count)` pairs — the test asserts the exact key
      set, so a future uid or timestamp fails it (item 37);
    - it filters by hostname and puzzle number, drops NULL-number rows, clamps to 0–86400,
      and sends `Cache-Control: no-store`;
    - `recordEvent` stores a valid puzzle number and NULL for junk (string, negative,
      fraction, absent);
    - `time_chart` is in `VALID_EVENTS`;
    - migration 0008 applies, and `npm run lint:migrations` passes.
    (assumed)
80. **Contrast** — `tests/palette-contrast.spec.ts` extended: the two new tokens (item 64)
    meet 3:1 against the surface, and chart text meets 4.5:1, in all eight palette × theme
    combinations. (assumed — item 69)
81. [amended — see 96] **Pre-prod, by hand** — on the branch's `workers.dev` preview: solve today's daily, see
    the card, then reload `/solved` and confirm your second comes back from the new route —
    which proves the row landed with its puzzle number, since NULL rows are never returned.
    Confirm `time_chart` events arrive; the plan picks how to read them without
    `wrangler d1 … --remote`. Screenshots at 320px and 368px content width for Jamie to compare
    against Idea-O. (assumed)
82. **Not done until** Dave has signed item 28, and `docs/INVARIANTS.md` has been read
    against the final diff. `docs/ANALYTICS.md` documents the column and the event.
    (assumed)
83. What level of Playwright e2e?
    My rec: targeted, not the full battery. One new spec under `e2e/specs/` against the
    production build, with the endpoint stubbed so the field is deterministic:
    - the card at n = 1, 3 and 12, on `mobile-chromium` and `mobile-webkit` (the 320px
      case, item 52) and `chromium-desktop`;
    - a failed fetch collapses the reserved space and the rest of the panel is intact;
    - the card is absent in random, archive and marker modes;
    - axe on `/solved` with the card drawn, light and dark;
    - the screen-reader sentence (item 71) is present and the SVG is hidden.
    Plus the existing completion and a11y specs. Not the whole suite.
    Why: the risk sits in one panel and one route. The worker side is covered better by
    unit tests than by a browser. A full run buys little over that and costs the 40
    minutes CLAUDE.md warns about. Firefox is skipped locally (sandbox), so passes are
    counted per project, not read from the exit code.
89. Before going live, a Fable review (`claude-fable-5-1`) checks the whole change against
    this brief: the maths definitions, the copy at every state, the privacy rule (item 37),
    contrast and accessibility. It sits alongside the review gates, not instead of them.
    (Jamie, 2026-11-01)

---

## da-brief fixes
Review: fresh-context `da-brief` subagent, 2026-11-01. Findings F1–F11 checked against the
code by the main session; all held. Fixes settled by Jamie 2026-11-01 (accepted all
recommendations, plus item 101 from Jamie and Dave). **Where this section and the body
disagree, this section wins.**

90. (§4) The log is base e (`Math.log`), as in Idea-O. The base cannot move any dot: a change
    of base multiplies numerator and denominator of the position fraction by the same
    constant, which cancels. It would matter only if the axis gained round-number ticks —
    a base decision then, not now. (Jamie 2026-11-01; signed Dave 2026-11-01, relayed by Jamie)
91. (§3, F2 High — amends 18, 26) **How your dot is counted once.** A saving-on player's
    request carries their analytics uid. The server leaves out every row with that uid, and
    the client adds your own time locally. A saving-off player's request carries no uid,
    and their time was never sent, so the client adds it locally the same way. The
    response is still `(second, count)` pairs only — item 37 is unchanged. This also
    removes the duplicate when two tabs wrote two rows for one player. Test 78/79 inputs:
    your row present, absent, and present twice; and a stranger on your exact second, who
    must still be counted.
92. (§3, F3 Medium — corrects 22, 26, 31) **Saving-off players see the card on the solve
    visit only.** Their solve deletes history (`recordSolve`, `src/storage.ts:166`), so no
    time survives a reload. On the solve visit the time comes from the in-memory timer; on
    any later visit they are in marker mode and item 22 hides the card. Accepted: storing
    their time anywhere would break brief 141. Item 31's source is therefore "today's
    history entry, or the in-memory time on the solve visit".
93. (§3/§6, F4 Medium — defines 25, amends 38, 77) **A "visit" is each `screens:enter` for
    the completion screen** (`src/completion.ts:280`). The fetch and the `time_chart` event
    both hang off it — not off `renderCompletion`, which also runs at boot on `/welcome`
    and `/archive` (`src/app.ts:1591`) and does not re-run on an in-app return to `/solved`.
94. (§8, F6 Medium — amends 19, 56, 88) **Ties at the top.** Players tied for fastest read
    "You're the **joint fastest** today" at every n ≥ 2. The sole fastest reads "You're the
    **fastest** today" (item 88). Other ties read "joint" (item 56); item 19's "both are
    fastest" means the shared rank, not the copy. Item 78 gains: sole fastest at n = 2, 9,
    10 and 50 (never a percentile); tied fastest at n = 2 and 10+; a tie mid-field below
    and above 10.
95. (§5, F7 Medium — amends 34) **The query is bounded in time.** The server derives a `ts`
    window from the puzzle number's date: 14 hours either side of that UTC day, enough for
    every time zone. Combined with hostname and event, the existing
    `(hostname, event, ts)` index covers it, and the puzzle-number filter runs over that
    small slice. Item 79 gains an `EXPLAIN QUERY PLAN` assertion that the index is used,
    following `tests/worker/schema.spec.ts`. `docs/CONSIDERATIONS.md` adds abuse volume —
    someone hammering the public, uncached route — as a revisit trigger beside organic
    growth.
96. (§7, F5 Medium — corrects 52, 81) **The real widths.** Item 52 measured the feedback
    modal (`index.html:61`) by mistake. The results page is `.page-col` inside `.page-pad`
    (`src/tailwind.css:124–125, 776–777`): `--page-max` 480px with a 1rem gutter. Content
    is 288px on a 320px phone, 343px on a 375px phone, and up to 480px. Collision and
    flip-rule clearances are re-checked at 288px and 480px; item 81's screenshots are at
    288px, 343px and 480px.
97. (§7/§9, F8 Low — amends 69) The card sits on the page background (`--color-bg`), not in
    a `--color-surface` box. Contrast in items 69 and 80 is measured against `--color-bg`
    in all eight combinations. The block heading follows the same convention as the other
    panel blocks' headings.
98. (F9 Low) Item 14's issue is filed: #366, sibling of #306.
99. (F10 Low) Docs the build must update: `docs/ANALYTICS.md` (column, event, route); the
    `VALID_EVENTS` comment "No migration: the existing table already holds…", which becomes
    false; CLAUDE.md's "No worker/API changes" constraint, which item 7 lifts for this
    route. Item 82's wait on Dave's item 28 sign-off is already met.
100. (F11 Low) A saving-off player at n = 1 reads "You're the **first** to solve today"
    even if other saving-off players solved earlier. Accepted: the field counts only
    players with saving on (item 58), and "first" is true of that field.
101. (§7/§8 — amends 48, 55) The axis note reads **`— log scale`**, not `— log time`, so
    it reads as a scale and not a wooden log. Every mention in this brief is updated. The
    dash and the flip rule are unchanged. (Jamie and Dave, 2026-11-01)
102. (F1 High — blocks Plan) **The design is not in the repo.** Idea-O, P, R and N exist
    only on the canvas, and items 39, 47 and 48 depend on them. Before Plan, export the
    four boards — at minimum Idea-O's computation block — into `docs/work/`, then point
    items 39, 47 and 48 at those files and write the position and size formulas, the
    collision rules and the flip-rule clearances into this brief. Owner: Jamie (canvas
    access). **Open.**
    **Closed 2026-11-01** by items 103–108: the boards are in `docs/work/` (commit 682d227),
    byte-identical to published canvas version 1793547022-0828 by sha256.

## Boards export (item 102 follow-up)
Boards exported 2026-11-01 by a separate session; its report was checked against the files.

103. **The boards are the design; this brief is the spec. Where they disagree, the brief
    wins.** Files, all in `docs/work/`:
    - `2026-11-01-Idea-O-Time-vs-Everyone.dc.html` — the design to build.
    - `2026-11-01-Idea-P-First-Plays.dc.html` — n = 1, 2, 3, 10.
    - `2026-11-01-Idea-R-Log-Positions.dc.html` — the flip rule.
    - `2026-11-01-Idea-N-Copy-States.dc.html` — six copy states.
    - `2026-11-01-canvas-notes.md` — the canvas notes, verbatim.
    Idea-O is a whole results-screen mock. Only its "Daily leaderboard" card is in scope;
    the other cards and every Share button are context (items 11, 13).
104. [amended — see 115] **Port from Idea-O, lines 403–575.** Correcting the handover: the block is *not*
    byte-identical across O, P and R. The 127 lines from `var tally` to `var vPost` are;
    P and R wrap the logic in `pack()` and R adds 7 lines for the flip rule. Item 39
    points here.
105. [amended — see 115] **Known divergences the port must change**, each to the brief's settled item:
    - Axis note `— log time` → `— log scale` (101).
    - Percentile `Math.round(rank / n * 100)` → ceil (28). The rank itself already
      matches: `indexOf + 1` is "strictly faster + 1".
    - `TRACK = 319` in a fixed 390px card → the container's width, 288–480px (52, 96).
    - Slowest at n ≥ 10 reads "top 100% solve times" → "**{n} players** solved today" (60).
    - Percentile line "solve times" → "of solve times" (59).
    - n = 1 "You're first to finish today" → "You're the **first** to solve today" (61).
    - n = 2–9 sole fastest "You're 1st fastest" → "You're the **fastest** today" (88);
      no tie handling → "joint" (94).
    - Card heading "Daily leaderboard" → "Everyone today" (62).
    - `--accent-soft` / `--fg-50` → the two color-mix tokens (64).
    - Label widths estimated per character at 12px Quicksand → measured live (50). With a
      variable-width card this is required, not polish.
    Already matches: the median at even n (85), the log formula and base (90).
106. **The p95 clip does not exist in the boards** — removed on purpose. Idea-O line 418:
    the axis runs fastest to slowest, the last dot is the slowest player, and log spacing
    replaced the clip. The handover listed p95 by mistake, and items 20 and 84 inherited
    it. Do we keep a clip?
    My rec: no clip. Items 20 and 84 are void; item 78 drops its p95 case.
    Why: log scaling already tames the slow tail, which is why the clip was removed. With
    no clip there is no chevron, no "pinned past the edge" rule, and the last dot is
    simply the slowest player. Nearest-rank p95 would rarely bite at today's n anyway. The
    cost, stated on the board: one very slow solve pushes everyone else left.
    **Settled: Jamie 2026-11-01 (accepted recommendation). Signed: Dave 2026-11-01 (relayed
    by Jamie). Items 20 and 84 are void; item 78 drops its p95 case.**
107. **Idea-R draws no leader line on either flip card.** The `spread__lead` spans for
    the axis note were deleted after the design settled, but canvas note line 80 says the
    note "carries the same 14px leader every other label on the chart has" and gives the
    reason: without it the tag reads as floating text. Restore it?
    My rec: yes, restore the 14px leader to the note's corner. Why: the written decision
    has a reason and the deletion has none on record. Bottom-centred captions are the ones
    that deliberately carry no leader (note line 84), and that is not this design.
    **Settled: Jamie 2026-11-01 (accepted recommendation).**
108. Item 47's design reference and item 48's flip rule now resolve to these files.
    Clearances (106px and 186px) and card heights (235px flip, 253px caption) were measured
    at 390px and are re-measured at 288px and 480px (96).

## Plan-stage questions
Raised by the planning session 2026-11-01, where the brief and the boards could not settle the
build. Answered by Jamie the same day.

109. (amends 55) **Your label is "You" above your time**, as every board draws it. Item 55's
    "your time only" means no rank or percentile on the dot, not that the word "You" is
    dropped. (Jamie 2026-11-01, accepted recommendation)
110. (amends 26, 91; keeps 18) **The uid goes with the request whenever today's time was
    sent.** The rule is: send the uid when today's history holds a recorded (non-marker)
    entry; send none when the time comes from memory on a saving-off solve visit. Why: a
    player who solved with saving on and later turned saving off still has a row in the
    field, and without the uid they would be counted twice. The uid only removes their row
    and adds nothing to what the server already holds. (Jamie 2026-11-01, accepted
    recommendation)


## Fable da-brief fixes
Review: second fresh-context `da-brief` subagent, run on Fable, 2026-11-01, over the whole
brief and the board files. Findings G1–G10 checked against the code and boards by the main
session; all held. Fixes settled by Jamie 2026-11-01 (accepted all recommendations).
Ack: Dave 2026-11-01 (relayed by Jamie; also covers items 103–110) · Sign-off: Dave
2026-11-01 on items 111 and 116 (relayed by Jamie) · Item 113: Jamie 2026-11-01.

111. (G1, Medium — amends 28, 60) **"top 100%" never shows for anyone but the strictly
    slowest.** Rounding up gives 100 for every rank above 0.99n: the second-slowest of 101
    reads ceil(99.01) = 100. So X = min(99, ceil(100 × rank / n)) for everyone except the
    strictly slowest, who reads item 60's line. Tests: rank 100 of 101, and tied-slowest at
    rank 199 of 200, both read "top 99%". **Signed: Dave 2026-11-01 (relayed by Jamie).**
112. (G2, Medium) Already settled by item 110: the uid goes with the request whenever
    today's history holds a recorded entry, so saving toggled off after a saving-on solve
    still counts you once. Item 78/79 inputs gain that case.
113. (G3, Medium — amends 71) **Screen-reader sentence variants**, using "players"
    throughout, matching item 60:
    - n = 1: "1 player solved today. Yours: 41 seconds."
    - n = 2: "2 players solved today. Fastest 30 seconds, slowest 41 seconds. Yours: 41
      seconds."
    - all identical, any n: "5 players solved today, all in 41 seconds. Yours: 41 seconds."
    - otherwise, n ≥ 3: "14 players solved today. Fastest 23 seconds, median 1 minute 10
      seconds, slowest 4 minutes 2 seconds. Yours: 41 seconds."
    Item 83's e2e check covers n = 1, 2, all-identical and n ≥ 3. (Jamie signs —
    accessibility; signed 2026-11-01.)
114. (G4, Medium) Items 103–108 were settled by Jamie alone; the earlier status line saying
    "every section is acked" was wrong. Dave acked them 2026-11-01 (relayed by Jamie).
115. (G5, Low — amends 104, 105) Item 104's block is 137 lines, not 127. Item 105 also
    misses, each changed in the port to the settled rule:
    - "You're 2nd fastest" → "You're the **2nd fastest**" (56).
    - The board has no 1s floor; `Math.log(0)` is −Infinity there (21, and see 116).
    - `mmss()` has no hour branch. The compact `formatDuration` (63) shows `1h 04m` at
      an hour or more — the existing long form, already short enough.
    - The board's all-identical (`flat`) field draws Fastest only, at any n. **The board
      wins here**: with every dot on one second, Median and Slowest would say the same
      thing three times. This overrides item 47's "n ≥ 3 shows all three".
    - The `youW * 1.05` and `+3` width slack factors go; widths are measured (50).
116. (G6, Low — amends 21, 42, 79, 87) **Out-of-range rows are dropped, never clamped** —
    one word throughout. The new query reads `BETWEEN 1 AND 86400`, not 0: `recordEvent`
    writes 0 for any non-finite value (`src/worker/analytics-db.ts:130`), so every junk
    POST is a 0s row, and a real sub-second solve is impossible. The 1s floor stays as a
    client guard only. **Signed: Dave 2026-11-01 (relayed by Jamie).**
117. (G7, Low — amends 95) The ±14h window bounds are inclusive; UTC+14 sits exactly on the
    edge. Accepted: a tab left open past local midnight in a negative-offset zone can solve
    outside the window, and that row is missing from everyone else's field. The player's
    own dot is local, so they never see the gap.
118. (G8, Low — amends 91, 110) The uid travels in a request header, never in the query
    string, so it stays out of URL logs. Accepted beside item 35: anyone who knows a uid
    could compare responses with and without it to learn that player's time. The uid
    already travels in clear on every event POST.
119. (G9, Low — amends 99) Item 37's rule — the field route never returns a uid, a solve
    timestamp, or anything but a time and its count — is added to `docs/INVARIANTS.md`
    as a standing rule, and stated in `docs/ANALYTICS.md`. It is meant to outlive this
    build, so it cannot live only in a brief and one test.
120. (G10, Low — amends 78, 79) Tests gain: rank 100 of 101 and tied-slowest of 200 (111);
    uid sent or not per item 110, including saving toggled after a saving-on solve (112);
    all-identical fields at n = 3 and n = 10 — dots, labels, copy and SR sentence (113,
    115); a 0s row is dropped (116); compact format at an hour or more (115); the SR
    sentence at n = 1 and 2 (113).
121. (noted) Item 93's `screens:enter` for `completion` also fires after a random solve
    (`src/app.ts:1147`). The listener checks item 46's modes before fetching, so random
    never fetches or sends `time_chart`.

## Plan-stage questions, second round
Raised by the `da-plan` review of plan revision 2, 2026-11-01. Answered by Jamie the same day.
Neither touches the maths or the copy.

122. (amends 48, 69; raised by `da-plan`) **The flip rule falls back to the bottom caption when
    the far corner has no room.** At 200% text on a 288px track, the note (about 132px) and
    your label (about 88px) overlap by up to 32px when your dot is near the middle; Idea-R's
    clearances were measured only at 390px and normal text. When the note in the far corner
    would touch your label, it is drawn centred below the chart instead, Idea-R's fixed
    alternative, with no leader. It costs about 18px of height, for large-text players only.
    At normal text size the flip rule always clears, so nothing changes. (Jamie 2026-11-01,
    accepted recommendation)
123. (amends 48, 107) **The note sits on the second row of its top corner**, the row of your
    time nearest the axis, so its restored 14px leader starts 2px under the text as your
    label's does. On the board's top row the leader would run about 18px longer than every
    other leader. (Jamie 2026-11-01, accepted recommendation)

## Build-stage changes
Raised by Jamie on the pre-prod preview, 2026-11-01, during human review. Later items win.

124. (amends 48, 107, 123) **The axis note has no leader line.** `— log scale` is the
    axis's key, not a label on a mark, so a line from it to the axis reads as pointing at
    something. Item 107's restored leader is removed. The note stays on the second row of its
    top corner (123), level with your time, and keeps the flip rule and the caption fallback
    (122). (Jamie 2026-11-01)
125. (amends 105's port, 69) **Chart labels are 14px**, up from the board's 12px, on 16px
    rows; 13px or 12px if 14 does not fit. The board's vertical geometry is kept with the row
    height as the variable, and the reserved height is re-measured (12.6rem). Measured: at
    default text the widest three labels take 178px of a 288px track, so 14px fits with room
    to spare. At 200% text on a 320px phone (288px of content) three 14px labels need about
    306px, so they cannot sit side by side. **Settled: Jamie 2026-11-01 — keep 14px, and
    step every chart label down to 12px only when the three references cannot sit side
    by side at 14** (large text on a narrow phone). Rows stay 16px, so nothing moves
    vertically. Rejected: 13px everywhere (still overlaps at 200% once times pass about
    10 minutes) and 12px everywhere. (Jamie 2026-11-01)
126. (amends 62, 105) **The heading is "Daily leaderboard"**, the board's own name, not
    "Everyone today". Item 8 still holds: no names and no identities on the card. The
    `data-stat-block` id follows the heading (`daily-leaderboard`). Copy is a joint
    section: Dave's ack is owed. (Jamie 2026-11-01)
127. (new — testing, not a feature) **A Testing panel on preview hosts.** A "Testing"
    button in the footer opens a dialog with: play actions (fill the correct answer, solve
    now, submit a wrong answer); history swaps (rich, random, new player, saving off,
    not solved today, clear); and Daily leaderboard field presets (real data, 1, 2, 3, 12,
    20 players, tied fastest, all the same, you slowest, random, fetch fails). It shows
    only on localhost and `*.workers.dev`, never on clumeral.com, and the answer helpers
    depend on `/api/dev/answer`, which 404s there. The field choice lives in sessionStorage
    for the tab. It replaces the visible fill-answer link the #226 redesign removed, so no
    separate roadmap item is needed for it. (Jamie 2026-11-01)
128. (amends 47, 64, 66, 78's sizes, 105's port) **Heavier chart, from the preview on an
    iPhone, where it read as spindly.** (Jamie 2026-11-01)
    - The axis and every leader are solid `--color-text`, 1.5px: white in dark mode.
      `--chart-line` is gone; text on bg already clears 4.5:1 in every combination.
    - Leaders run from 2px off their text right to the axis, under the dot, so they meet
      it. Dots draw over them.
    - The axis ends come in by half the largest dot (11.5px), so the end dots sit whole
      inside the track and the Fastest and Slowest leaders sit on their dots' centres.
    - Dots are 11px, yours 15px, +4 per extra player, capped at 23 (were 9, 13 and 21).
      Your dot stays larger than everyone else's (item 66).
129. (amends 128) **End labels are flush with the track's edges.** Fastest's box starts at
    the left edge and Slowest's ends at the right edge, so their leaders, on the end dots,
    sit just inside the labels. Your own label follows the same rule when you are at an
    end, so it lines up with the label below it. (Jamie 2026-11-01)
