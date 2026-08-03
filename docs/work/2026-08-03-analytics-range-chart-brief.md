# Brief — Analytics: all-time range + labelled daily plays chart

Requested by Jamie, 2026-08-03.

> "Add an 'all time' option to the analytics (currently caps at 90d). Also add dates and
> counts to the daily plays graph. Dates on x, counts as labels OR on y."

Branch: `dev/analytics-range-chart`

Short form: sections 1, 2, 3, 6, 7, 8, 9, 11 — approved by Jamie 2026-08-03.
Sections 4 (maths), 5 (state & persistence) and 10 (analytics) marked n/a.

**Status: settled, acked, and `da-brief` review closed, 2026-08-03.** Ready for Plan.

**Read the da-brief section at the end of this file before planning.** It reverses item 15,
reinstates item 9, and adds the schema, the backfill mechanism and the durability question
that the body of the brief was missing. Where the body and that section disagree, that
section wins.

The request arrived as "add an all-time option and label the chart". §1 established that
Analytics Engine deletes data after ~90 days, so "all time" could not be built at all; §2
widened the scope on Jamie's decision; §6 replaced Analytics Engine with D1 entirely after
Jamie challenged the two-system design and measured volume (~81 events/day) showed it was
unnecessary. The chart work is now the smaller half of this brief.

Related: GitHub issue #297 (custom date range and period comparison) — logged as a future
idea, out of scope here.

---

## 1. What it is
Settled: Jamie 2026-08-03 · Ack: Dave 2026-08-03 (deferred to Jamie)

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
Settled: Jamie 2026-08-03 (chose (b), widen to cover both) · Ack: Dave 2026-08-03 (deferred to Jamie)

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

*(§3 is written out in full after §6 — the two-systems challenge in §6 had to be settled
before "how it works" could be described, so the sections were filled in that order.)*

## 4. Maths
n/a — no puzzle generation or filtering involved.

## 5. State & persistence
~~n/a~~ — **REOPENED by da-brief finding M9, see item 77.** Marking this n/a was wrong: the
substance of this brief *is* persistence, and §6 turned out to carry no schema. Client-side
state genuinely is n/a (the range lives in the URL as `?period=`, nothing new is stored in
the browser). Server-side storage design lives in **items 64, 65 and 17**: the
`analytics_events` table, the database choice, and indefinite `uid` retention.

## 6. How it fits
Settled: Jamie 2026-08-03 (D1 only, raw rows; dual write (a); scoped read-only token) · Ack: Dave 2026-08-03 (deferred to Jamie)

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
15. ~~**The `SUM(_sample_interval)` problem disappears** under option 2 — D1 rows are exact
    and unsampled. Item 9 becomes moot rather than needing a fix. (assumed)~~
    **WRONG — REVERSED by da-brief finding H1, see items 62–63.** True only of rows written
    after cutover; the backfill imports raw AE rows that carry `_sample_interval`. Item 9
    is live again and the schema gains a `sample_interval` column.
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
Settled: Jamie 2026-08-03 (accepted all recommendations) · Ack: Dave 2026-08-03 (deferred to Jamie)

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
Settled: Jamie 2026-08-03 (accepted all recommendations) · Ack: Dave 2026-08-03 (deferred to Jamie)

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
43. **Palette check — run, not eyeballed.** (The validator ships inside the `dataviz` skill
    bundle, not this repo — clarified by da-brief finding M2, see item 70.) It passes the light
    accent `#bc3c2c` on the `#f5edd8` surface on every check. In dark, `#ff8070` on
    `#262624` **passes contrast** but sits just outside the recommended lightness band
    (L 0.741). It is the site-wide brand accent, so I am **not** proposing to change a brand
    token for one chart — flagging it, not acting on it. Jamie's call if he wants it looked
    at separately.
44. **Range nav needs no restyling** — the existing pill styling takes a fourth item as is.
    (assumed)

## 8. Copy & wording
Settled: Jamie 2026-08-03 (accepted all recommendations) · Ack: Dave 2026-08-03 (deferred to Jamie)

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
Settled: **Jamie 2026-08-03 (owner sign-off — accepted 51(a)+(c) and all recommendations)** · Ack: n/a (owned section)

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

## 10. Analytics
n/a — this work *is* the analytics system; it adds no new tracked events and changes no
event shape. The existing **10** events in `VALID_EVENTS` and their blobs/doubles carry
over to D1 unchanged. Approved as n/a under short form, Jamie 2026-08-03.

*(Corrected from "8" by da-brief finding M1 — see item 69. The missing two are `undo_used`
and `reset_used`, which are also the only events carrying `blob3`/`source`, so they are the
schema's hardest case rather than an afterthought.)*

## 11. Done / test plan
Settled: Jamie 2026-08-03 (confirmed CI-only Playwright, no local runs) · Ack: Dave 2026-08-03 (deferred to Jamie)

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
    not surface to the player or block the response. ~~Explicit test: force the D1 insert to
    throw and confirm the endpoint still answers 202.~~
    **REVISED by da-brief finding H5, see item 68** — that test passes however broken the
    write path is. Reframed as "a D1 outage does not change the response and raises no
    unhandled rejection", and joined by a real integration test asserting row contents.
59. **Migration verification, before the AE call is removed**: row counts per day from the
    AE query and from D1 match exactly across the backfilled window, and no day is doubled
    (item 24's cutoff working).
60. **The dual-write comparison** per item 23: AE and D1 daily counts equal for 3
    consecutive full days including a weekend day. Recorded in `docs/ANALYTICS.md` with the
    cutover date, per item 28.
61. **Done means**: all four ranges work; the chart carries dates, a y axis and the two
    direct labels; zero-play days are **zero-filled and render a 1px baseline stub** (was
    "appear as gaps" — corrected by da-brief finding M5, see item 73; item 31 is the
    settled behaviour); the hidden table matches the chart;
    `/stats` reads D1 only; the backfill has run once; and the AE removal is queued behind
    the item 60 check, not done in this PR.

---

# da-brief review — findings and fixes, 2026-08-03

Fresh-context review run after the brief was signed off. It returned 5 High, 10 Medium and
9 Low findings and judged the brief **not ready for planning**. Every High and Medium is
addressed below. Numbering continues from 61 (append-only); where a fix reverses an earlier
item, the earlier item is marked REVISED and points here.

The headline: the chart half of this brief was fine. The migration half was not
self-sufficient — a cleared-context builder could not have produced the right table or run
the backfill safely from it.

## H1 — Sampling does not disappear. Item 15 was wrong. (data loss, irreversible)

62. **Item 15 is REVISED and item 9 is REINSTATED as live.** I wrote that
    `SUM(_sample_interval)` became moot under D1 because D1 rows are exact. That is true
    only of rows written *after* cutover. Item 16's backfill imports **raw Analytics Engine
    rows**, and every AE row carries `_sample_interval` — where AE sampled, one stored row
    stands for *n* real events. Importing those rows and later counting them with
    `COUNT(*)` undercounts the imported ~90 days permanently, and the source is deleted
    before anyone could notice. That is exactly the failure item 9 raised; option (2) moved
    it rather than removing it.
63. **Fix, and it is a schema change:** the D1 table carries a `sample_interval INTEGER NOT
    NULL DEFAULT 1` column — 1 for live writes, the AE value for backfilled rows — and
    **every aggregate in `stats.ts` becomes `SUM(sample_interval)`, never `COUNT(*)`**.
    Items 59 and 60 must also state the exact query on each side, because comparing AE
    `COUNT()` against D1 `COUNT(*)` compares two different quantities the moment sampling
    is not 1. The Plan must record the `_sample_interval` values actually observed in AE at
    backfill time rather than assuming 1.

## H2 — §6 settled an architecture with no schema

64. **The table, stated explicitly so Build does not have to invent it.**

    ```sql
    CREATE TABLE analytics_events (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      ts              INTEGER NOT NULL,   -- UTC epoch milliseconds
      event           TEXT    NOT NULL,   -- blob1
      uid             TEXT    NOT NULL,   -- blob2, retained indefinitely per item 17
      source          TEXT,               -- blob3, 'keyboard' | 'button', NULL otherwise
      hostname        TEXT    NOT NULL,   -- blob4
      value           REAL    NOT NULL DEFAULT 0,  -- double1 (guess count)
      new_user        INTEGER NOT NULL DEFAULT 0,  -- double2, 0 or 1
      sample_interval INTEGER NOT NULL DEFAULT 1   -- per item 63
    );
    CREATE INDEX idx_analytics_host_ts    ON analytics_events (hostname, ts);
    CREATE INDEX idx_analytics_host_ev_ts ON analytics_events (hostname, event, ts);
    ```

    **`hostname` is the one that would have bitten us.** `whereClause` filters
    `blob4 = '<hostname>'` (`stats.ts:34`), so every figure on `/stats` today is per-domain.
    Drop that column and staging and preview traffic silently merges into production
    numbers — with no error, and no way to unpick it afterwards. The indexes matter for the
    same reason the change exists: an unindexed scan by day degrades as history grows.
65. **Question — which database?** Item 14 reached for `FEEDBACK_DB` because it was already
    bound, which is a reason to look, not a reason to decide.
    My rec: a **separate `clumeral-analytics` database** with its own `ANALYTICS_DB`
    binding. Why: independent lifecycle from user feedback; `npm run e2e:db` drops tables
    in `clumeral-feedback` and would need to know not to touch analytics; and D1's free
    tier allows 10 databases, so it costs a binding and nothing else. Moving a table
    between D1 databases later is a migration; choosing now is free.
    Note for Build: the next migration in `migrations/` is **0005**, not 0002 —
    `0002_import_legacy_feedback.sql` is gitignored, so the directory listing misleads.

## H3 — The backfill had no mechanism, and every obvious one collided with item 19

66. Item 24 specified a *property* ("one-shot, guarded"), not a design. The backfill needs
    AE read (`CF_API_TOKEN`, a Worker secret) **and** D1 write — only the Worker holds both.
    But a backfill route on a Worker whose `/stats` is deliberately unauthenticated (item
    19) is an internet-reachable endpoint that doubles the archive if hit twice. Running it
    from the Pi is blocked by item 36, which grants Analytics Read only and no D1 write.
    **Fix: the backfill is a one-shot inside the existing `scheduled()` handler**, gated on
    a sentinel row in D1 (`backfill_complete`). It needs no route, so it cannot be triggered
    externally at all, it already has both bindings, and the guard is a row read. Item 19's
    won't-fix stands untouched — no new surface is exposed.

## H4 — Durability of the write is a behaviour decision, not an implementation detail

67. **Question for Jamie.** `src/worker/index.ts:221` is `async fetch(request, env)` — there
    is no `ctx` parameter, so item 14's `ctx.waitUntil` does not currently exist. More than
    a signature: today's `writeDataPoint` is synchronous fire-and-forget and costs the
    player nothing. A D1 insert is async, and the choice is observable behaviour:
    - **(a) await the insert** before responding — the write is confirmed, but D1 latency
      lands inside the request. The client's `track()` already swallows the response, so no
      player waits on it; it costs Worker duration only.
    - **(b) `ctx.waitUntil(insert)`** — respond 202 at once, runtime keeps the isolate alive
      until the write settles.
    - **(c) bare fire-and-forget** — may be torn down mid-write. Silent loss, which is
      precisely item 21's fear.

    My rec: **(b)**, with a `.catch()` that logs, so a failure is at least visible in
    `wrangler tail` rather than absolutely silent. Why: it is what `waitUntil` exists for —
    no added response latency and a completion guarantee — and (c) reintroduces the risk
    dual write is there to cover. Requires adding `ctx: ExecutionContext` to the fetch
    signature.

## H5 — The test plan did not test the failure the brief calls existential

68. **Item 58 is REVISED.** As written — "force the D1 insert to throw and confirm the
    endpoint still answers 202" — it is the inverse of the real risk: under (b) or (c) a
    throw *cannot* affect the 202, so it passes no matter how broken the write path is.
    Nothing in §11 asserted that a valid event produces a correctly-shaped **row**.
    Fix: (i) an integration test that POSTs each of the 10 valid events and asserts the
    resulting D1 row column by column — `uid`, `new_user` as 0/1, `source` on undo/reset,
    `hostname`, `value`, `sample_interval` = 1; (ii) item 58 reframed as "a D1 outage does
    not change the response and raises no unhandled rejection".

## Medium findings

69. **M1 — there are 10 valid events, not 8.** `VALID_EVENTS` (`index.ts:28-35`) also holds
    `undo_used` and `reset_used`. Item 12 measured 30 days of *traffic*; those two happened
    to have zero volume in the window, and I wrote the traffic list into §10 as if it were
    the vocabulary. They are also the only two carrying `blob3` (source) — the exact
    dimension a naive schema drops, and the one the sixth query in `getStats` depends on.
    §10 corrected; the schema in item 64 covers them.
70. **M2 — item 43's palette check, clarified.** The review reported the script does not
    exist in this repo, and that is correct — but the check *was* run: `validate_palette.js`
    ships inside the `dataviz` skill bundle, not the repo, and the L 0.741 figure is its
    real output. Item 43 stands on its facts; the wording implied a repo script and is
    corrected here. Worth recording separately: `/stats` **hardcodes** its colours at
    `stats.ts:184` and does not use `src/palette.ts`, so `tests/palette-contrast.spec.ts`
    does not cover the dashboard at all. That gap is pre-existing, not created here.
71. **M3 — the port uses bound parameters, not string interpolation.** `whereClause`
    interpolates `days` and `hostname` straight into SQL. Today that points at a read-only
    external API; after migration the identical pattern points at our own D1 database, from
    an endpoint item 19 leaves unauthenticated, with `hostname` derived from the request
    Host header. All ported queries use `.bind()`. Added to §11 as a checked item.
72. **M4 — `/api/stats` comes into scope too.** It calls the same `getStats` and parses
    `period` differently from `/stats` (line 430 has no `|| 90` fallback, so `?period=all`
    already yields `NaN` → `whereClause` → `1=1` → an unintended all-time query *today*).
    Item 30's parsing rule applies to both endpoints, and §11 asserts
    `/api/stats?period=all|7|junk`.
73. **M5 — items 31 and 61 contradicted each other, and item 61 is the one Build would
    test against.** Item 31 settled zero-*fill* (the day keeps its x position); item 61 said
    zero days "appear as gaps". Item 31 wins. Item 61 is corrected. Additionally neither
    said how a zero day is *visible* — a zero-height `<rect>` renders as nothing, so a zero
    day and a rendering bug look identical. Fix: a zero day renders a **1px baseline stub**,
    so it is distinguishable and assertable.
74. **M6 — all day bucketing is UTC**, matching `toStartOfDay()` in AE and the game's own
    `todayUTC` rollover. That covers the chart, the D1 bucketing, item 46's date label and
    item 24's cutoff. The cutoff is recorded as an exact UTC instant in `docs/ANALYTICS.md`.
75. **M7 — item 57's smoke test could not have run.** `/stats` returns 503 unless
    `CF_ACCOUNT_ID` and `CF_API_TOKEN` are set (`index.ts:443`); after the D1 move that
    guard is wrong and must be removed. And there is no fixture mechanism — `npm run e2e:db`
    drops and recreates only the `feedback` table, so CI would hit an empty analytics table
    and render item 35's empty state rather than bars. Fix: `e2e:db` is extended to apply
    the analytics migration and load a fixture SQL file; the secrets guard removal is
    recorded in §6.
76. **M8 — the AE comparison needs an artefact, not just a token.** A token in `.dev.vars`
    is read by `wrangler dev`, but local `/stats` reads the *local* D1, which is empty — so
    item 36 alone still leaves nothing that puts AE and D1 counts side by side. Item 60
    gates the removal of `writeDataPoint`, so it has to be runnable. Fix: a committed script
    that runs both queries and prints them side by side, executed from the Pi with the
    scoped token, documented in `docs/ANALYTICS.md` per item 28.
77. **M9 — §5 is un-n/a'd.** Marking "state & persistence" n/a on a brief whose substance
    is persistence was wrong once §6 turned out to carry no schema. §5 now holds the
    storage design: item 64's table, item 65's database choice, and item 17's decision that
    `uid` is retained indefinitely.
78. **M10 — modules §6 omitted:** `tests/stats-dashboard.spec.ts` (its `fakeStats()` is
    shaped to the six AE `QueryResult` objects and breaks with the data layer), `migrations/`,
    `wrangler.jsonc` (new binding per item 65), and `package.json` (`e2e:db` per item 75).

## Low findings — accepted, with two deferred

79. Accepted and folded in: **L2** `toStartOfDay()` and `NOW() - INTERVAL` are ClickHouse-only
    and have no SQLite equivalent — both need rewriting, so item 14's "small edits" was
    optimistic. **L3** `renderDashboard` renders `htp_dismissed` and `colour_change`, neither
    of which is in `VALID_EVENTS`; they are permanently zero and get dropped rather than
    ported. **L7** item 3's "collecting since 2026-04-05" is the add-date of `stats.ts` per
    git, not of the `writeDataPoint` call — inference, not fact; the Plan takes the true
    start from the earliest AE row. **L8** noted in item 65. **L1** item 12's volume came
    from a hostname-filtered query, so total AE row volume across preview and staging
    deploys is higher and item 16's ~7,300-row estimate is a floor; item 16's claim that
    the AE SQL API pages raw rows cleanly is unverified and the Plan must confirm it (AE
    SQL has row limits and no `OFFSET`).
80. **L5 deferred, with justification.** Item 53 leaves an accessibility decision open
    ("check every text token at build and lift any that fails") inside a section Jamie has
    signed. That is deliberate: the check needs rendered output to run against, so it
    cannot be settled on paper. It is recorded in §11 as a build gate rather than a
    resolved decision. Jamie retains the call when the numbers exist.
81. **L6 deferred.** The hidden accessibility table is 120 rows today and grows one row per
    day. It needs revisiting past a few hundred days; not a launch blocker. **L9** noted for
    the record: every joint section was acked "deferred to Jamie", so this brief had one
    reviewer — legitimate under the non-blocking rule, and the reason this DA pass caught
    as much as it did.

## Decisions on the da-brief open questions, Jamie 2026-08-03

82. **Item 65 settled: a separate `clumeral-analytics` database** with its own `ANALYTICS_DB`
    binding. `FEEDBACK_DB` is not reused.
83. **Item 67 settled: (b) `ctx.waitUntil`.** Jamie asked how long it gets before timing out.
    Answer, from Cloudflare's limits page: work passed to `ctx.waitUntil()` may continue for
    **up to 30 seconds** after the response is sent or the client disconnects. A single D1
    insert is single-digit to low-tens of milliseconds, so the headroom is roughly three
    orders of magnitude. Network wait does not count toward CPU time either, so the insert
    costs almost nothing against the CPU budget. Source:
    https://developers.cloudflare.com/workers/platform/limits/
    Confirmed: (b) with a logging `.catch()`, and `ctx: ExecutionContext` added to the fetch
    signature.
84. **New risk surfaced while checking item 83 — the backfill may not fit in one cron run.**
    Cron-triggered Workers get 15 minutes of wall clock, but **CPU time is 10 ms on the free
    plan** against 30 s on paid. Item 66 puts the backfill inside `scheduled()`, and pulling
    ~7,300+ rows from the Analytics Engine SQL API and inserting them into D1 will not fit
    in 10 ms of CPU if this account is on the free plan.
    My rec: the Plan confirms the account's Workers plan tier first, and the backfill is
    written to **batch regardless** — process N days per cron run and advance a cursor in the
    sentinel row, so it completes over several nights and is safe on either tier. Why: the
    batched version is barely more code than the one-shot, and it removes a dependency on a
    billing fact that could change. This also supersedes the "one-shot" wording in items 24
    and 66: the guard becomes "resumable and idempotent" rather than "runs exactly once".

## Free-tier confirmation and its consequences, Jamie 2026-08-03

85. **Confirmed: the account is on the Cloudflare Workers FREE plan.** Item 84's risk is
    therefore real, not hypothetical, and several things in this brief harden from
    recommendations into requirements.
86. **The backfill MUST batch, and the batch unit is one day.** Free-plan cron invocations
    get **10 ms of CPU**. Network wait does not count, but `JSON.parse` of the Analytics
    Engine response does — parsing ~7,300 rows in one invocation would blow the budget
    outright. One day is ~81 rows, which parses and inserts comfortably, and it makes the
    cursor trivially simple (the sentinel row stores the last completed date).
    Consequence: the backfill completes over ~90 nights at one day per run, or fewer with a
    small multi-day batch. My rec: **start at 1 day per run, measure actual CPU with
    `wrangler tail`, and raise the batch only if there is clear headroom.** Why: 90 nights
    sounds slow but costs nothing and finishes long before AE's retention window closes on
    the newest of those rows; over-batching risks a silent CPU kill mid-write.
87. **Item 84's "confirm the tier during Plan" is now closed** — no need, it is free. The
    Plan should still measure real CPU per batch rather than trusting the estimate above.
88. **The `/api/event` insert is fine on free tier.** A single D1 insert is dominated by
    network wait, which is excluded from CPU time; the CPU cost is serialising one small
    statement. Item 83's `ctx.waitUntil` decision stands unchanged.
89. **`/stats` reads are fine too.** D1 aggregates server-side, so the Worker only pays to
    receive a small result set. Free-tier D1 allows 5 M row-reads/day; an all-time query
    scanning ~30 k rows is well inside it even at high refresh rates. The item 64 indexes
    matter here — an unindexed scan is what would eventually bite.
90. **Item 36 REVISED: the token goes in `.env`, not `.dev.vars`** (Jamie's call). Scope and
    TTL are unchanged — Account · Account Analytics · Read, ~60 day expiry.
    **`.env` was not in `.gitignore`.** Only `.dev.vars` was (line 45), so a token dropped
    into `.env` would have been committable. Fixed in the same commit as this item:
    `.gitignore` now ignores `.env` and `.env.*`, with `!.env.example` kept unignored so a
    documented template can still be committed later. This was a live footgun independent of
    this brief — anyone adding a `.env` for any reason would have hit it.
