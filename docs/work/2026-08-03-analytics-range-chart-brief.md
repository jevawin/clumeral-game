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

### Decisions, Jamie 2026-08-03

- **Item 13/14 — option (2), D1 only, raw rows: ACCEPTED.** This is the architecture.
- **Item 17 — REJECTED, and my reasoning was wrong.** No `uid` prune, no anonymisation.
  Jamie: the 90-day expiry was a Cloudflare limitation we inherited, never a design
  decision, so preserving it in the new system would be cargo-culting a constraint. `uid`
  is retained indefinitely.
- **Item 19 — WON'T FIX.** Jamie: no auth needed, `/stats` being public is not a problem.
  No separate issue.

### Dual write — Jamie asked for detail, 2026-08-03

20. **What it is.** For one release, `/api/event` writes the event to **both** Analytics
    Engine (`writeDataPoint`, as today) and the new D1 table. Nothing else changes. `/stats`
    reads from D1. A follow-up PR then deletes the `writeDataPoint` call and the AE binding.
21. **Why it is worth doing: analytics failure is silent.** If the D1 insert breaks — wrong
    binding, schema mismatch, a throw inside `ctx.waitUntil`, a column that rejects a null
    — nobody gets an error. No player complains that their `puzzle_start` did not record.
    We would find out weeks later looking at a chart with a hole in it, by which point the
    events are unrecoverable. Dual write means AE still holds everything while we confirm
    the D1 path is real. (assumed)
22. **This is the whole argument, and it is worth being precise about it: AE is its own
    safety net, but only while we keep writing to it.** If we cut over and D1 silently
    fails, we lose nothing permanently *provided* we notice inside 90 days — because the
    backfill can simply be re-run from AE. The moment `writeDataPoint` is removed, that net
    is gone. So the cost of dual write is a few lines for one release; the cost of skipping
    it is an unrecoverable gap if anything goes wrong.
23. **Exit criterion — a date, not a vibe.** "One release" is too vague to act on. Concretely:
    hold the overlap until **AE and D1 daily counts match exactly for 3 consecutive full
    days** (covering at least one weekend day, since traffic shape differs). At ~81
    events/day that is a real sample, not a smoke test. Then open the removal PR.
    My rec: render both numbers side by side in a small temporary row on `/stats` during
    the overlap, so the check is a glance rather than a manual query.
24. **The trap: backfill and dual write overlap, and will double-count if we are careless.**
    The AE→D1 backfill covers the surviving ~90 days; dual write is inserting live rows at
    the same time. Run naively, the window between D1 going live and the backfill running
    gets written twice, and every number in it is doubled.
    My rec: the backfill takes a hard cutoff — `WHERE timestamp < <the instant D1 writes
    went live>` — and is a one-shot guarded operation, not something that can be triggered
    twice. Why: a duplicate-detection scheme is more machinery than a cutoff timestamp, and
    AE rows carry no natural unique id to dedupe on.
25. **Alternatives considered, since this is a judgement call:**
    - **(a) Dual write, then remove** — my rec. Cheap net, clear exit.
    - **(b) Hard cutover** — simplest code, no net, per item 22 an unnoticed D1 failure is
      unrecoverable. Not recommended.
    - **(c) Keep AE writing permanently** as a silent 90-day cross-check. Costs nothing —
      `writeDataPoint` is fire-and-forget and free. But it leaves a write path nobody reads,
      which is exactly the two-systems cruft Jamie objected to. Reporting stays single-source
      either way, so this is defensible if he wants a permanent belt-and-braces.
26. **Question for Jamie: (a), (b) or (c)?** My rec is (a), with the item 23 exit criterion
    and the item 24 cutoff.
    → **Settled: (a), Jamie 2026-08-03.** Dual write, then remove. Item 24 cutoff stands.
    Item 23's side-by-side row on `/stats` is **rejected** — Jamie will read D1 numbers only
    and ask for the AE comparison in a few days.

27. **Consequence of rejecting the side-by-side: I need some way to read AE after cutover,
    or the comparison cannot happen.** Once `/stats` reads D1 only, there is no route that
    returns AE numbers, and the `CF_API_TOKEN` needed to query AE directly is a Worker
    secret — it is not available to me locally. So "compare vs AE in a few days" has no
    mechanism behind it unless we build one.
    My rec: a temporary, unlinked `/stats/compare` route that prints the two daily-count
    tables side by side, deleted in the same PR that removes `writeDataPoint`. Why: keeps
    `/stats` itself clean as Jamie asked, while making the comparison a single URL fetch
    rather than a credentials exercise. Alternative if he would rather not add a route:
    put `CF_API_TOKEN` on the Pi so I can query the AE SQL API directly — fewer moving
    parts in the app, but a production credential sitting on a dev machine.
28. **The reminder mechanism — and an honest limit on it.** Jamie asked for a note so I
    "remind us". I cannot send an unprompted message; the next message is always a human's.
    What *does* work: `CLAUDE.md` is loaded into context at the start of every session in
    this repo, so a dated outstanding-action line there surfaces automatically whenever we
    next talk. It is not a timer — it fires on conversation, not on a date.
    My rec: one line in `CLAUDE.md` under a new "Outstanding actions" heading, pointing at
    a fuller `docs/ANALYTICS.md` holding the cutover date, the exact comparison queries and
    the removal checklist. Both written during Build, not now.

## 3. How it works
Settled: pending · Ack: pending

29. **Range options become unbounded once D1 holds the history.** Current nav is 30/60/90.
    My rec: **7 · 30 · 90 · All**. Why: drop 60 (little to read between 30 and 90 that 90
    does not already show), add 7 for a recent-trend view, add All as requested. `All`
    resolves to the earliest row in D1 rather than a fixed number.
30. **`?period=` keeps working and gains `all`.** `/stats?period=all`. Unrecognised or
    out-of-range values fall back to 30. Why: the range already lives in the URL, so it
    stays shareable and bookmarkable with no new state. (assumed — this is why §5 is n/a)
31. **Zero-play days must be filled in, and this only becomes visible now.** Today the chart
    packs bars with no gaps: a day with no events simply has no row, and the bars sit
    shoulder to shoulder. That is invisible while the x axis is unlabelled — the moment we
    put dates on it, a missing day silently shifts every later bar and the axis lies.
    My rec: generate a continuous day series across the range and zero-fill absent days.
    Why: it is a correctness fix, not a cosmetic one, and the labels are what expose it.
32. **Counts: y axis, not per-bar labels — with one exception.** Per-bar numbers are
    unreadable once bars are a few pixels wide, which is every range above ~30 days.
    My rec: a y axis with three gridlines (0, mid, max) at all ranges, **plus** per-bar
    count labels only at 7 and 30 day ranges where the bars are wide enough to carry them.
    Why: it answers Jamie's "counts as labels OR on y" as *both, whichever fits*, and
    degrades sanely to 365+ days.
    → **REVISED 2026-08-03 after checking the `dataviz` skill.** "A number on every bar"
    is a named anti-pattern — flooding the chart with values is chaos and they go unread;
    direct labels work *because* they are sparing. Revised rec: y axis at every range,
    plus direct labels on **only the highest bar and the most recent bar**, at every range
    rather than just short ones. Why: those are the two a reader actually looks for
    ("best day", "yesterday"), it reads the same at 7 days and at 365, and the axis plus
    the item 34 tooltip carry everything else.
33. **X-axis dates thin out as the range grows.** Every day at 7d; roughly weekly at 30d;
    monthly at 90d and above. Rec: pick the step from the day count so labels never collide.
    (assumed)
34. **Every bar carries an SVG `<title>`** — "5 Jul 2026: 13 plays". Free native tooltip on
    hover, and it is what a screen reader announces. (assumed — cheap, no library)
35. **Empty state.** If the range contains no data at all, render the axes with a "No plays
    in this range" message rather than an empty box. (assumed)

### §6 addendum — decisions, Jamie 2026-08-03

36. **Item 27 settled: scoped read-only token on the Pi, no `/stats/compare` route.**
    Jamie asked whether a new stats-only token on the machine is simple and safe. It is,
    with two conditions. Cloudflare API tokens are permission-scoped, so this one needs
    **Account · Account Analytics · Read** and nothing else — it cannot deploy, cannot read
    or write KV, D1 or R2, cannot touch DNS, and cannot read Worker secrets. That is a much
    smaller blast radius than reusing the existing `CF_API_TOKEN`, whose scope is wider.
    Conditions: (a) **set a TTL on it** — it is only needed until the AE call is removed, so
    an expiry ~60 days out means it self-destructs rather than lingering; (b) it lives in
    `.dev.vars`, which is already in `.gitignore` (line 45), never in a tracked file.
    **Jamie has to create it** — it needs the Cloudflare dashboard, which I have no access
    to. Consequence: item 27's `/stats/compare` route is **dropped**, which is the better
    outcome anyway — no temporary route to build and then remember to delete.
37. **Future idea to log as a GitHub issue** (Jamie's, 2026-08-03): custom date range —
    pick start and end — plus period comparison. Likely reshapes the nav into two date
    pickers with 7/30/90 as presets "within", and a compare control offering previous
    period, previous year, and a custom window. Out of scope here; wording to be confirmed
    with Jamie before the issue is filed.

## 7. How it looks
Settled: pending · Ack: pending

38. **The chart grows a bottom band and a left gutter, and the container grows with it.**
    A fixed-height container that excludes the axis band is a named anti-pattern — the plot
    fits, the labels do not, and the card sprouts a tiny nested scrollbar. Rec: plot area
    stays 200px, total SVG becomes ~240px tall with ~32px left gutter for y ticks and ~24px
    bottom band for dates.
39. **Fit to width, drop the horizontal scroll.** Rec: `viewBox="0 0 600 240"` with
    `width: 100%`. Why: at "All" the whole point is the shape of the trend, and a scrolling
    chart hides it — worse, the y axis scrolls out of view. It also renders better on a
    phone than today's fixed 600px, which currently forces a sideways scroll on mobile.
    The `.chart-wrap { overflow-x: auto }` rule goes.
40. **Gridlines and axes: solid 1px hairlines, one step off the surface, never dashed.**
    Dashed grid reads as "threshold" or "projection" when it is just a grid. (assumed —
    `dataviz` mark spec)
41. **Bars keep `var(--acc)`, capped at 24px wide, with a 2px gap between neighbours.**
    Current code already spaces bars by 2px; it also uses `rx="1"` which rounds all four
    corners. Rec: round the top only (4px) and keep the baseline square, so bars sit on the
    axis rather than floating. Why: matches the mark spec and reads as measured-from-zero.
42. **All axis text and direct labels use the existing muted ink tokens, never `var(--acc)`.**
    Text never wears the data colour. The dashboard already has the tokens
    (`rgba(38,38,36,0.7)` / `rgba(246,240,232,0.6)`). (assumed)
43. **Palette check — run, not eyeballed.** `scripts/validate_palette.js` passes the light
    accent `#bc3c2c` on the `#f5edd8` surface on every check. In dark, `#ff8070` on
    `#262624` **passes contrast** but sits just outside the recommended lightness band
    (L 0.741). It is the site-wide brand accent, so I am **not** proposing to change a brand
    token for one chart — flagging it, not acting on it. Jamie's call if he wants it looked
    at separately.
44. **Range nav needs no restyling** — the existing pill styling takes a fourth item as is.
    (assumed)

## 8. Copy & wording
Settled: pending · Ack: pending

45. Range nav labels: **7d · 30d · 90d · All**. (assumed — matches the existing terse pill
    style)
46. **The period label always states the real span**, not just the preset name:
    "Last 30 days · 5 Jul – 3 Aug 2026", and for All, "All time · 5 Apr – 3 Aug 2026 ·
    120 days". Why: this was item 4's honesty fix, and it stays useful after the D1 move —
    "All" should show you where the data actually begins.
47. Dates: **UK format, day first** — "5 Jul" on the axis, "5 Jul 2026" in the tooltip.
    (assumed — UK project, matches "colour" elsewhere in the codebase)
48. Tooltip text: "5 Jul 2026: 13 plays", singular "1 play". (assumed)
49. Empty range: "No plays in this range". Section heading stays "Daily plays". (assumed)

## 9. Accessibility
Settled: pending · Ack: pending — **BLOCKING, Jamie's call**

50. **The real problem: the chart is currently invisible to a screen reader.** Today it is
    one `<svg role="img" aria-label="Daily plays chart">` — that announces the *existence*
    of a chart and not one number in it. Adding dates and counts visually makes that gap
    wider, because sighted readers gain information a screen reader user still cannot get.
51. **Question — how do we expose the values?**
    - (a) A **visually-hidden data table** rendered alongside the chart, same numbers.
    - (b) A visible "show as table" toggle.
    - (c) Just a richer `aria-label` summarising the series.

    My rec: **(a), plus (c)**. The hidden table makes every value reachable with no
    interaction, and the summary label gives the shape up front — "Daily plays, 5 Apr to
    3 Aug 2026. Average 8.1 per day, highest 27 on 12 July." Why not (b): a toggle is more
    UI to build and maintain on an internal page, and it makes the accessible route
    opt-in rather than always present. Why not (c) alone: a summary is not the data, and
    the `dataviz` guidance is explicit that a tooltip must never be the only way to a
    value.
52. **Bars will not be individually focusable.** At "All" that is 120+ tab stops today and
    growing indefinitely — hostile to keyboard users, for data the table already carries.
    The `<title>` in item 34 is a mouse affordance and a nicety, not the access route.
    (assumed)
53. **Axis and label text must clear WCAG AA against both surfaces.** The dashboard's
    existing muted tokens go as low as `rgba(38,38,36,0.5)` on the domain label, which I
    have not verified as passing. Rec: check every text token used by the chart at build
    time and lift any that fails. Jamie owns this call.
54. Single series, so nothing is encoded by colour alone. No animation, so no
    `prefers-reduced-motion` work. (assumed)

## 11. Done / test plan
Settled: pending · Ack: pending

55. **QA level: moderate, and weighted towards the data layer rather than the UI.** The
    dashboard is internal, but `/api/event` sits on the player path, so the write change is
    the part that can hurt. Rec: unit tests plus a narrow Playwright smoke — not the full
    suite. Why: proportional to a change that is mostly server-side with one internal page.
56. **Unit tests** on the pure functions, which is where the bugs will be: day-series
    zero-fill across a range (item 31), x-label thinning by day count (item 33), max/latest
    label selection (item 32), and `?period=` parsing including `all` and junk values.
57. **Playwright smoke**: `/stats` renders at all four ranges without error, the chart has
    the expected bar count for a known fixture, and the nav marks the right pill active.
    Runs in CI, never locally.
58. **Gameplay must be unaffected** — `/api/event` still returns 202, and a D1 failure must
    not surface to the player or block the response. Explicit test: force the D1 insert to
    throw and confirm the endpoint still answers 202.
59. **Migration verification, before the AE call is removed**: row counts per day from the
    AE query and from D1 match exactly across the backfilled window, and no day is doubled
    (item 24's cutoff working).
60. **The dual-write comparison** per item 23: AE and D1 daily counts equal for 3
    consecutive full days including a weekend day. Recorded in `docs/ANALYTICS.md` with the
    cutover date, per item 28.
61. **Done means**: all four ranges work; the chart carries dates, a y axis and the two
    direct labels; zero-play days appear as gaps; the hidden table matches the chart;
    `/stats` reads D1 only; the backfill has run once; and the AE removal is queued behind
    the item 60 check, not done in this PR.

## 10. Analytics
Settled: pending · Ack: pending

## 11. Done / test plan
Settled: pending · Ack: pending
