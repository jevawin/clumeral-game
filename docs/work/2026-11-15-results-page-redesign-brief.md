# Results page redesign — brief

Branch: `dev/results-page-redesign` · Started 2026-11-15 · Brief as a whole: Jamie 2026-11-15 · da-brief passed with fixes 2026-11-15 (items 81–92) · **Closed — ready for Plan**

Dave: Jamie 2026-11-15 — "dave's seen and signed off everything in advance from the designs
and many discussions, assume for now he's acked everything and no further involvement from
dave is required to get this live". Every Dave ack and sign-off below is recorded on that
basis, relayed by Jamie.

Target design: **board O** (`Idea-O-Time-vs-Everyone`, exported at
`docs/work/2026-11-01-Idea-O-Time-vs-Everyone.dc.html`). O is the whole page: board M with the
Daily leaderboard in M's "Everyone today" slot. From Streaks down to the actions its markup is
identical to M's (checked 2026-11-15). The leaderboard card shipped in #368 under
`docs/work/2026-11-01-daily-time-chart-brief.md` and is not reopened here; this brief builds
the rest of O. Where this brief cites "M", O says the same.

Other inputs: canvas "Clumeral Screens" (artifact AGBzCYXhuT3JHke4fEaA6R) boards `Idea-K-F4` /
`Idea-L-F4-Dark` (F4, the step before M) and `Results` (trace of the live page); canvas notes
`docs/work/2026-11-01-canvas-notes.md` (f3-note, onego-note, ideas-note, stats-note,
today-note, results-note).

## 1. What it is
Settled: Jamie 2026-11-15 (accepted all recommendations; item 6 with the note below) · Ack: Dave 2026-11-15 (relayed by Jamie: signed off in advance from the designs and discussions)

1. The problem. `/solved` today shows four accents at once (solved line in the player's
   accent, Current streaks, Records and All time in the three others), three rows of boxes
   with watermark icons, streaks split across two sections, and an attempts chart that does
   not move from one day to the next. It reads busy and says "solved in one" three ways.
   (assumed — results-note, ideas-note, today-note)
2. The fix is board O: board M with the Daily leaderboard (shipped #368) in M's "Everyone
   today" slot: Today → Daily leaderboard → Streaks → All time → next puzzle → actions, one
   accent, one card style. (assumed — the direction chosen on the canvas)
3. Who it is for: every player who lands on `/solved` after a daily solve. Random, archive,
   marker, saving-off and new-player modes still exist and §3 settles what each shows.
   (assumed)
4. Why now: the play timer (#347) gives the time figures, and #368 put the first new-style
   card into the old page, so the page is now half one design and half the other.
   (assumed)
5. This replaces the #311 panel in place and keeps every figure a player can see today
   unless an item below cuts it by name. Nothing is reverted. (assumed — #311 stays live, P1)
6. **One brief, or split Share out?**
   My rec: split. This brief does layout and content; per-section Share gets its own brief
   later. Why: the app has no share anywhere today, so it is a new feature with its own copy,
   spoiler rules, platform behaviour (`navigator.share` vs clipboard), analytics and tests.
   The page redesign is worth shipping without it, and bundling the two doubles the review.
   M and F4 both draw the buttons, so the layout leaves room for them (§7).
   **Settled: Jamie 2026-11-15 — split. Not started now: "one chat one brief one thing at a
   time". Share goes on the roadmap as next.** Done: scope added to existing issue #148
   (comment 2026-11-15) and #148 moved from Future to the top of Next.

## 2. Out of scope
Settled: Jamie 2026-11-15 (accepted all recommendations) · Ack: Dave 2026-11-15 (relayed by Jamie: signed off in advance from the designs and discussions)

7. Share, on any card. #148 owns it (item 6). No placeholder buttons ship. (assumed)
8. The Daily leaderboard card's content and behaviour (#368). Only its container and heading
   change to match the new card style, settled in §7. (assumed)
9. A named leaderboard, ranks or accounts. Still blocked on auth (canvas time-note). (assumed)
10. Worker, API and storage changes. Every figure on the page computes from `dlng_history`
    plus the existing `/api/times/:num` read. No new keys, no new endpoints. (assumed —
    redesign constraint, INVARIANTS)
11. The `/play` screen's result sentence (`heroLine`), welcome, archive and random screens.
    (assumed)
12. Dave's whisker chart and the `puzzle_complete` `source` fix. M's goes tally that needed
    the fix is replaced by the shipped time card. (assumed)
13. **Do the three spare accent tokens go too?** `--color-accent-2/3/4` are used only by the
    three results section rules (`src/tailwind.css:550-552`), and are also restated in the
    worker's inline CSS (`src/worker/puzzles.ts:80-118`).
    My rec: out of scope. Remove the three section rules, leave the tokens, and file a hygiene
    issue to delete them. Why: deleting them touches the worker and the palette parity check,
    which turns a frontend redesign into a worker change for no visible gain.
    **Settled: Jamie 2026-11-15 — yes, a post-redesign cleanup.** Filed as #370 (P3,
    hygiene), on the board in Future with Trigger "when: after the results page redesign
    ships".

## 3. How it works
Settled: Jamie 2026-11-15 (accepted all recommendations) · Ack: Dave 2026-11-15 (relayed by Jamie: signed off in advance from the designs and discussions); item 26 cut covered by the same · **Reopened by da-brief fixes 2026-11-15, re-settled Jamie 2026-11-15 (accepted all recommendations, items 81–92)**

Page order and modes

14. Order: Today → Daily leaderboard → Streaks → All time → "Next puzzle in…" → Feedback,
    then Show puzzle + Archive. The three action buttons keep their current order, icons and
    behaviour. (assumed — task brief, M)
15. Each panel mode shows what it shows today, restyled. `full`: all four cards. `new`
    (≤ 2 countable games): Today + leaderboard + the "starts from your third game" note.
    `saving-off`: Today + leaderboard. `marker`: Today with "Solved!" and no figures.
    `random`: Today + the random note, actions Another + Archive. `archive`: Today only.
    The leaderboard keeps its own #368 gate. (assumed — `panelMode`, `src/completion.ts:77`)

Today card

16. Heading "Puzzle #238 solved" (random: "Puzzle solved"), then one figure line
    "3 goes, 2m 28s". It replaces the "…solved! You took:" heading and the two icon
    figures. No time → "3 goes". No goes (marker) → "Solved!". (assumed — M, "kept exactly as
    Jamie set them")
17. **One message line under the figures: a ranked list, or only the average line?**
    My rec: M's ranked list, first true one wins:
      1. fastest ever — today's time beats your best before today
      2. solved in one — "your Nth one-go solve"
      3. quicker than your average time — "17s quicker than your average"
      4. fewer goes than your average — "a go better than your usual 2.3"
      5. nothing beaten — "Solve number 30"
    Why: the "quicker than average" line alone is missing on about half of days, and a blank
    there reads as "you did badly". The ranked list always says something true and kind.
    Exact wording is §8.
18. Every comparison in item 17 is against history BEFORE today, never including today.
    Otherwise today pulls the average and the best towards itself. Equal to your best is not
    "fastest ever". A rung needing a time is skipped when today or history has no valid time.
    (assumed)
19. The message shows in `full` mode only, where the averages have ≥ 2 earlier games behind
    them. (assumed — same gate as the stats)

Streaks card

20. Figure: the play streak, labelled "days played". When the current one-go run equals
    the play streak, the label is "days solved in one" instead (M's rule: name the harder
    one). Recency gate and archive exclusion unchanged. (assumed — M, `computePlayerStats`)
21. **What goes on the second line?** M shows "Best 30 · One-go run 1".
    My rec: "Best {best play streak}", plus "· One-go run {n}" only when the CURRENT one-go
    run is 2 or more. The best one-go run lives in All time (item 25). Why: onego-note —
    a live one-go run is 0 on 77% of days and 1 most of the rest; "One-go run 0" is a
    trophy that reads as nothing, so it earns space only at 2+.
22. The goes strip: one column per day, oldest left, today at the right end, scrolled to
    today on load. Each column stacks one cell per go from the bottom: misses faded, the
    solving go solid; unused cells are not drawn. Rows = your worst day, capped at 5. Below
    the strip: "{N} days" hint on the left, "Today" on the right; "Goes" as the y label.
    Whole history, no cap on days. Archive replays and markers are not columns. (assumed — M,
    f3-note)
23. A day past the cap (6+ goes) is a broken column: three faded cells, a bolt for the elided
    goes, the solid cap, and the true figure above the column. (assumed — f3-note; task)
24. **Does the strip show missed days?** M draws days played only, so gaps vanish.
    My rec: days played only, as M. Why: the strip is about goes, not attendance; the play
    streak figure already says whether the run is intact; and an empty column for every
    missed day stretches a casual player's strip into mostly blanks.

All time card

25. A ledger, one row each, label left, figure right: Solved in one {23%} · Best one-go run
    {3} · Fastest solve {1m 14s} · Puzzles solved {30}. The Records card is gone; its two
    figures move here. (assumed — M, onego-note: the percentage is the figure)
26. **Cut the attempts distribution chart?** M cuts it; F4 keeps it with two fixes (a zero
    draws nothing, any non-zero floors at 8px).
    My rec: cut. Why: 88% of completions are one-go, so it is one full bar and empty rows for
    most players, and it barely moves day to day. The goes strip above now shows goes per day,
    which the distribution only summarises. Dave built the live one, so his view is needed
    before this settles. **Settled: cut — covered by Dave's relayed ack (§3 header); no longer open (da-brief L5).**
27. **Agree these cuts from the page?** Avg. time (Current streaks and All time), Average
    attempts, the "1-go solve" current-streak box, the "Come back tomorrow" line, and the raw
    "7 (23%)" count (the percentage stays). Average time and goes are still computed for the
    item 17 message, just not shown.
    My rec: yes. Why: stats-note dropped average time on every board; the rest are the "three
    ways of saying solved in one" ideas-note set out to remove.

## 4. Maths
Settled: Jamie 2026-11-15 (accepted all recommendations) · Override: Jamie 2026-11-15 — items 17, 18, 21, 55 and the da-brief maths items (81, 83) are rules written in this brief, after the designs Dave saw, so Dave's advance sign-off cannot cover them. Jamie: "no further involvement from dave is required to get this live". Recorded as an override, not a sign-off (da-brief H1) · Ack: n/a

28. n/a for puzzle generation and filtering: nothing here touches the generator, clues,
    seeding or the guess path. (assumed)
29. **Should Dave still sign the stats definitions?** Items 17, 18, 20, 21 and 25 define
    figures: the "before today" baselines, "fastest ever" on a strict beat, the one-go run,
    the one-go percentage. All reuse `computePlayerStats` rules (archive excluded, recency
    gate, two-go day breaks a one-go run).
    My rec: yes, a short sign-off from Dave on those five items. Why: they are counting rules
    a player can check against their own history, and getting a streak or a "fastest ever"
    wrong is the kind of bug players report.

## 5. State & persistence
Settled: Jamie 2026-11-15 (accepted all recommendations) · Ack: Dave 2026-11-15 (relayed by Jamie, in advance) · **Reopened by da-brief fixes 2026-11-15, re-settled Jamie 2026-11-15 (accepted all recommendations, items 81–92)**

30. Nothing new is stored. Every figure reads `dlng_history` through `loadHistory` and is
    computed on each render; nothing is written. No new keys, no `dlng_` change. (assumed —
    INVARIANTS, item 10)
31. The message (item 17) uses history before today, so a reload of `/solved` later the same
    day shows the same line. (assumed — follows from item 18)
32. The goes strip opens scrolled to today every time; its scroll position is not
    remembered. (assumed)
33. Nothing goes in the URL. `/solved` stays the route. (assumed)

## 6. How it fits
Settled: Jamie 2026-11-15 (accepted all recommendations — "you know this better than i so i take your reccs plus a review later"; Jamie reviews at plan/build) · Ack: Dave 2026-11-15 (relayed by Jamie, in advance) · **Reopened by da-brief fixes 2026-11-15, re-settled Jamie 2026-11-15 (accepted all recommendations, items 81–92)**

34. `src/completion.ts` — `renderCompletion` keeps its signature, `panelMode`, the countdown,
    the links and the one announcement. It rewrites the panel markup as the Today, Streaks
    and All time cards. `statColumn`, `statLine`, `goesChart` and the per-section accent go.
    `heroLine` (the `/play` sentence) is untouched. (assumed)
35. `index.html` — the standalone `data-completion-heading` / `data-completion-subheading`
    pair leaves the completion section; the solved heading is rendered inside the Today card
    by `completion.ts`. Heading level is settled in §9. (assumed)
36. `src/player-stats.ts` — stays pure and stays the one place counting rules live. It gains
    additive outputs: the before-today baselines and the chosen message rung (items 17–18),
    and the per-day goes list for the strip (item 22). Existing fields stay; whether
    `goesDistribution` is removed once nothing reads it is the plan's call. (assumed)
37. The goes strip may be its own render module beside `time-chart-view.ts`; the plan
    decides. (assumed)
38. `src/time-chart-view.ts` — only the leaderboard's container and heading classes change
    to the card style (item 8). Its computation and fetch are untouched. (assumed)
39. `src/tailwind.css` — removes `.stat-col*`, `.stat-line*`, `.goes-*`, `.stat-figure*` and
    the section accent rules (550–556); adds the card, ledger and strip styles. (assumed)
40. `public/sprites.svg` — gains a bolt for the broken column. The section heading icons get
    tight viewBoxes so their ink sits on the padding line (time-note: "the fix belongs in the
    sprite sheet"). `icon-calendar` is also used on `/play` (`src/app.ts:881`), so the plan
    checks every reuse before changing a viewBox. (assumed)
41. Tests that change: `tests/completion-stats.spec.ts`, `tests/completion-links.spec.ts`,
    `tests/accent-rotation.spec.ts` (deleted or rewritten — its four-accent rule is what this
    removes), `tests/time-chart-view.spec.ts`, and e2e `player-stats`, `game-solve`, `a11y`,
    `random`, `testing-panel`, `time-chart` with `e2e/pages/completion.page.ts`. (assumed)
42. `src/demo-history.ts` / the testing panel gains days past the cap if needed, so the
    broken column can be seen on a preview. (assumed)
43. No worker change (item 10). `tests/token-parity.spec.ts` keeps passing because the
    spare tokens stay (item 13). (assumed)

## 7. How it looks
Settled: Jamie 2026-11-15 (44–50 assumed; 51 deferred to a live comparison; 52 accepted) · Ack: Dave 2026-11-15 (relayed by Jamie, in advance) · **Reopened by da-brief fixes 2026-11-15, re-settled Jamie 2026-11-15 (accepted all recommendations, items 81–92)**

44. Every section is a card: `--color-surface` fill, 1.5px `--color-border`, 6px radius,
    18px padding, heading row with its icon. The Daily leaderboard takes the same card.
    No Share buttons, so headings run the full width. (assumed — O, items 7, 8)
45. One accent. Figures and heading icons in `--color-accent`; every label and sentence in
    `--color-text`. No coloured labels, no watermark icons, no second container style.
    (assumed — ideas-note, O)
46. Today: "Puzzle #238" over "solved" (accent), then the figure line bold in accent, then
    the message with a small icon and its figure in bold. No section icon on Today.
    (assumed — O)
47. Streaks: the play streak large in accent with its label beside it; the second line with
    figures bold in accent; the strip as O draws it — 18px columns, 4px gaps, 10px cells,
    a 40px fade at the left edge, "Goes" rotated as the y label, "{N} days" and "Today"
    under it in 13px. Heading icon `icon-flame`. (assumed — O)
48. All time: the ledger, label left in text colour, figure right in bold accent, one size,
    no rules between rows. Heading icon `icon-calendar`. The Records trophy goes with the
    Records card. (assumed — O)
49. Widths follow the page column (up to 480px), not O's fixed 390. The strip fills the card
    and scrolls; the ledger stretches. (assumed)
50. Dark mode needs no extra rules: every colour is a token that already flips. (assumed)
51. **How are the missed goes drawn in the strip?** O draws them in a 22% accent tint
    (`--accent-soft`). That tint does not exist in the codebase (11 of the 15-token budget
    used), and at 22% the miss cells fall well under 3:1 against the card, so a low-vision
    player cannot count their goes (WCAG 1.4.11).
    My rec: misses as hollow cells — a 1.5px accent outline, no fill — and the solving go
    solid accent. Why: no new token, the outline passes 3:1 because it is the accent itself,
    and hollow vs solid is the same language as the hollow and solid buttons below. The
    message icon drops O's tinted pill for the same reason and sits as a plain accent icon.
    **Settled: Jamie 2026-11-15 — not decided on paper. "i need to see it … hollow didn't work
    well in the designs, possibly we'll try others like a dotted line … i need a live
    version to view".** Build ships the strip's miss style as switchable variants on the
    branch preview: at least **faded** (O's tint), **hollow** (accent outline) and **dotted**
    (dotted accent outline). The switch is preview-only (testing panel or similar, the plan
    decides) and never reaches production. Jamie picks on the live preview; the losing
    variants and the switch are removed before the PR. The pick also settles the message
    icon's pill. If the pick is under 3:1 (WCAG 1.4.11), Jamie as accessibility owner records
    the call in this brief.
    **Picked: Jamie 2026-11-15 — faded, at 20% (item 95), with the pill dropped: "1 drop",
    "3 faded". The 1.4.11 call is recorded in item 95.** The other variants and the switch are
    removed (plan Task 11). The message icon is a plain accent icon.
52. **Can a desktop mouse user scroll the strip?** O hides the scrollbar. Touch and trackpad
    still scroll, keyboard scrolls once the strip has focus, but a plain mouse wheel scrolls
    vertically and a mouse cannot drag, so a mouse-only user cannot reach older days.
    My rec: a thin native scrollbar on fine pointers (`@media (pointer: fine)`), hidden on
    touch, as O. Why: it costs a few pixels on desktop only, and phones keep O's clean look.
    **Settled: Jamie 2026-11-15 — yes. "don't block things like that (accessibility
    rules)".**

## 8. Copy & wording
Settled: Jamie 2026-11-15 (accepted all recommendations) · Ack: Dave 2026-11-15 (relayed by Jamie, in advance) · **Reopened by da-brief fixes 2026-11-15, re-settled Jamie 2026-11-15 (accepted all recommendations, items 81–92)**

53. Today heading: "Puzzle #238" over "solved"; random: "Puzzle" over "solved". The "!" and
    "You took:" go. (assumed — O)
54. Figure line: "{n} go/goes, {time}" in the sentence form of `formatDuration` ("1 go,
    0m 41s"), never the compact chart form. No time → "3 goes". Marker → "Solved!".
    (assumed — `formatDuration` rule: sentences keep the default form)
55. **The five message lines.** Bold part in brackets.
      1. [Your fastest ever], 9s under your best.
      2. [Straight in.] Your 8th one-go solve.   (first one: "Your first one-go solve.")
      3. [17s quicker] than your average.
      4. [Fewer goes] than your usual 2.3.
      5. Solve number [30].
    Differences are whole seconds in the sentence form (`1m 05s quicker`); a difference that
    rounds to 0s does not count as quicker. The average goes shows one decimal, as today.
    My rec: these five. Rung 4 is reworded from O's "A go better than your usual 2.3",
    because 2 goes against an average of 3.4 is not "a go" better.
56. Streak label: "days played" / "days solved in one"; singular "day" at 1. (assumed)
57. Second line: "Best 30", plus " · One-go run 2" from a run of 2 (item 21). (assumed)
58. Headings: "Daily leaderboard" (unchanged), "Streaks", "All time". (assumed — O)
59. Ledger labels and values: "Solved in one" 23% · "Best one-go run" 3 · "Fastest solve"
    1m 14s · "Puzzles solved" 30. No valid time → "—". Never solved in one → 0% and 0.
    (assumed — O, today's dash rule)
60. Strip: "Goes" y label, "{N} days" (singular "1 day"), "Today". (assumed — O)
61. The new-player and random notes keep today's wording. "Next puzzle in 2h 25m" keeps its
    wording with the time in bold. (assumed)

## 9. Accessibility
Settled: Jamie 2026-11-15 (accepted all recommendations; item 67 "summary") · Sign-off: Jamie 2026-11-15 · Ack: n/a (owned section) · **Reopened by da-brief fixes 2026-11-15, re-settled Jamie 2026-11-15 (accepted all recommendations, items 81–92)**

62. Each card is a `<section aria-labelledby>` pointing at its heading, as today. (assumed)
63. The Today heading is the screen's one `h2`, as the current "…solved!" heading is. "Puzzle
    #238" and "solved" are two lines of ONE heading (O draws two `h2`s, which a screen reader
    would hear as two headings). The other cards keep `h3`, as the leaderboard already has.
    (assumed)
64. The one polite announcement is unchanged: "Solved in 3. 2 minutes 28 seconds. Play
    streak 30." The message line is read in place, not announced. (assumed — keeps #311 and
    #368 behaviour)
65. The figure line is spoken in words: "3 goes, 2 minutes 28 seconds" via `speakDuration`,
    with the "2m 28s" text hidden from speech, so "m" is never read as a letter. (assumed —
    the reason `speakDuration` exists)
66. Decorative icons (heading icons, the message icon, the bolt) are `aria-hidden`. (assumed)
67. **What does a screen reader get from the goes strip?** The columns are pictures and there
    can be 240 of them.
    My rec: hide the columns from speech and give the strip a short text summary instead:
    "Goes per day, last 243 days: 56 in one, 104 in two, 48 in three, 24 in four, 8 in five,
    3 in six or more. Today: 3." Why: a list of 243 days is unusable by ear, and the summary
    carries what the picture shows at a glance. It also keeps the attempts distribution
    available to screen-reader users after item 26 cut it visually.
68. The strip is focusable (`tabindex="0"`) so keyboard users can scroll it with the arrow
    keys, with a 2px accent focus ring; desktop gets the scrollbar (item 52). (assumed —
    axe `scrollable-region-focusable`)
69. The All time ledger is a `dl`, read "Solved in one, 23%". The rotated "Goes" label and the
    broken-column figures are `aria-hidden`; the summary in item 67 covers them. (assumed)
70. All text stays in `--color-text` or `--color-accent`, which already pass AA in all eight
    theme × mode pairs. The miss-cell variant is held to 3:1 or recorded per item 51. No
    new motion. (assumed)
71. axe runs on `/solved` in full mode, light and dark. The Label in Name exception list is
    not widened. (assumed — memory: the five-node exception is deliberate)

## 10. Analytics
Settled: Jamie 2026-11-15 (accepted all recommendations) · Ack: Dave 2026-11-15 (relayed by Jamie, in advance)

72. No new events. Views of `/solved` are already counted by `route_change`; the solve itself
    by `puzzle_complete` and `puzzle_time`. (assumed)
73. Not tracked: which message line showed, and whether anyone scrolls the strip. Either
    would need a new name in `VALID_EVENTS` (`src/worker/index.ts`), which is a worker change
    and out of scope (item 10). If wanted later, it is its own small item. (assumed)
74. The preview-only variant switch (item 51) sends nothing. (assumed)

## 11. Done / test plan
Settled: Jamie 2026-11-15 (accepted all recommendations; item 79 full suite) · Ack: Dave 2026-11-15 (relayed by Jamie, in advance)

75. Unit, `player-stats`: each of the five message lines chosen when it should be and not
    otherwise; today excluded from every baseline; equal-to-best is not "fastest ever"; a
    rung needing a time is skipped with no time; "first" one-go solve wording; the streak
    label switch; the one-go run shown only from 2; the strip's per-day list excludes
    archive and marker rows; a 6+ day is a broken column; rows = worst day capped at 5; the
    item 67 summary text. (assumed)
76. Unit, `completion`: every panel mode renders exactly its cards (item 15) in the item 14
    order; one `h2`; no `accent-2/3/4`, watermark or attempts chart anywhere; the
    announcement unchanged. (assumed)
77. e2e against the production build: a full-mode solve with seeded history checks card
    order, ledger values, the strip opening at today, a broken column, keyboard scrolling of
    the strip, and the random, archive and new-player modes; axe on `/solved` light and dark.
    (assumed)
78. Read the Playwright tail, not the exit code, and count passes per project — Firefox is
    reported skipped locally. Unit count is checked by file count, not test count. (assumed —
    memory: e2e exit code can lie; unit count is build-dependent)
79. **QA level: full suite or results specs only?**
    My rec: the full Playwright suite on the production build, all engines. Why: this
    rewrites the whole results screen, its headings, styles and tests, and `/solved` is
    reached from every solve path (daily, random, archive, reload), so a narrow run would
    miss a break on a path nobody edited.
80. Done when: Jamie has picked the strip miss style on the live preview and the other
    variants and the switch are gone (item 51); unit, e2e and axe pass at the agreed level;
    the review gates have passed (da-plan, human review, da-build, self-review); and the PR
    into `staging` is open. (assumed)

## da-brief fixes (2026-11-15)

Review: fresh-context `da-brief`, 1 High, 7 Medium, 6 Low. Every Medium+ is fixed below or
waits on a question. Lows fixed too. New items continue the numbering; earlier items stand
unless an item here amends them by number.

H1 → §4 header now records an **Override: Jamie**, not a Dave sign-off, for the rules this
brief wrote after the designs.

81. (amends 17; M2) **Which line wins on most days?** The rationale in items 21 and 26 mixed
    two populations: 88% of all production completions are one-go (today-note), while "0 on
    77% of days" came from a sample player with a 23% one-go rate (onego-note). At 88%,
    rung 2 "Straight in" wins most days and the time lines (rung 3) almost never show — the
    one variable that moves day to day.
    My rec: reorder to fastest ever → quicker than your average → straight in → fewer goes →
    solve number. Why: time is the figure that differs every day (the leaderboard's own
    rationale); a one-go solve is the norm for most players, so it makes a weak headline.
    **Settled: Jamie 2026-11-15 (accepted recommendation).**
82. (amends 20, 21, 57; M1) **What does the Streaks second line say?** When the figure is
    "N days solved in one", "Best 30" reads as the best one-go run though it is the best
    play streak, and "· One-go run N" repeats the headline.
    My rec: the second line always names what it counts — "Best streak 30" — and adds
    "· One-go run N" only from 2 AND only when the label has not already switched. Item 21's
    rationale is corrected: at an 88% one-go rate a run of 2+ is common, so the part shows
    for many players; the rule is kept because "One-go run 0/1" still says nothing.
    **Settled: Jamie 2026-11-15 (accepted recommendation).**
83. (amends 18, 19; M3) **How many earlier timed games before a time line can show?** The
    gate counts games; most histories have 0–2 valid times because the timer is new (#347),
    so "fastest ever" and "quicker than average" would fire against a single earlier time.
    My rec: rungs 1 and 3 need 3 or more earlier valid times; until then they are skipped.
    Why: matches "stats start from your third game"; one or two times is not a best or an
    average anyone would trust.
    **Settled: Jamie 2026-11-15 (accepted recommendation).**
84. (amends 30, 51, 74; M4) The variant switch is a URL query parameter (e.g.
    `?strip=hollow`) read only on preview builds. It survives a reload, can be pasted
    between devices, writes no storage and needs no key. Removed with the losing variants.
    (assumed)
85. (amends 8, 38, 44, 50; M5) Moving the leaderboard onto a `--color-surface` card is more
    than its container: `--chart-dot` is mixed into `--color-bg` and the dot border is
    `--color-bg` (`src/tailwind.css:142-143`, `838-848`), and
    `tests/palette-contrast.spec.ts:139-158` measures against bg. Both rebase onto
    `--color-surface` and the test follows. Measured by da-brief on surface: lowest 3.36
    (Lime light) and 3.87 (Cherry dark), still over 3:1. Same token, new mix base, still
    11 of 15. (assumed)
86. (amends 41, 40; M6) Tests that also change: `e2e/specs/completion.spec.ts` (asserts
    Records, All time and "Average attempts", lines 32-37); `tests/sprites.spec.ts` (pins
    `icon-trophy` and `viewBox="0 0 24 24"` on `icon-flame`/`icon-podium`, lines 12, 28 —
    item 40's tight viewBoxes must update it); `tests/demo-history.spec.ts` (reads
    `goesDistribution`, line 50); `tests/player-stats.spec.ts` (item 75). The plan also
    checks `e2e/specs/archive.spec.ts` and `e2e/specs/undo-reset.spec.ts`, which reach the
    completion screen. (assumed)
87. (amends 51; M7) A fourth variant: **faded-passing** — misses in `--chart-dot`, the
    existing 72% mix, which da-brief measured at 3.36–4.49:1 on surface in all eight
    pairs. So the live pick has a faded look that already passes 1.4.11 with no new token.
    (assumed — Jamie asked for variants to compare)
88. (amends 67; L1, L2) The summary says "your 243 days played", not "last 243 days"
    (item 24: missed days are not columns). It is the scroller's accessible name
    (`role="group"` + `aria-label`, as O); the columns inside are `aria-hidden`, the scroller
    itself is not, so `aria-hidden-focus` holds. Text belongs to §8. (assumed)
89. (amends 55; L3) Rung 4 compares today's goes with the average as SHOWN (one decimal):
    2 goes against 2.04 shows nothing, never "Fewer goes than your usual 2.0". (assumed)
90. (amends 55; L4) "Nth" uses English ordinals: 1st→"first", then 2nd, 3rd, 4th … 11th,
    12th, 13th, 21st, 22nd, 23rd, 101st, 111th. Item 75's tests cover 11–13 and 21. Each
    rung's icon comes from the existing sprites; the plan picks them. (assumed)
91. (amends 46, 53, 63; L4) "Puzzle #238 solved" is one line as O draws it, "solved" in
    accent, wrapping naturally at narrow widths; still one `h2`. (assumed — O 148-150)
92. (amends 16; L6) In marker mode the figure line is dropped, since the heading already
    says solved; no "Solved!" under "Puzzle #238 solved". (assumed)

## Plan-stage questions (2026-11-15)

Raised by `da-plan` on the plan's revision 1 as plan readings R1 and R7. Both block Task 1.

93. (amends 55; plan R1) **Message time differences: compact or sentence form?** Item 55 says
    "the sentence form" but its examples are `17s quicker` and `9s under`, which only the
    compact form writes (the sentence form writes `0m 17s`).
    My rec: follow the examples — differences use the compact form (`17s`, `1m 05s`); the
    figure line keeps the sentence form (`1 go, 0m 41s`, item 54).
    **Settled: Jamie 2026-11-15 (accepted recommendation).**
94. (amends 18, 83; plan R7) **Does a 0s time count?** `validSeconds(0)` is valid, so a junk
    0s solve would read "Your fastest ever" and drag later averages. The time chart already
    refuses a 0s time.
    My rec: rungs 1 and 3 treat a time below 1s, today's or an earlier one, as no time.
    **Settled: Jamie 2026-11-15 (accepted recommendation).**

## Build-stage decisions (2026-11-15)

95. (amends 51) **The faded variant, lighter, under 3:1.** After seeing the preview, Jamie
    asked for faded to be "more faded" and relaxed the 3:1 floor for it: "relax the wcag rule
    for this since it's not text". The faded miss cell drops from O's 22% accent tint to 12%,
    then, on a second look, to 20% ("2 20%"). WCAG 1.4.11 is relaxed for the miss cells only,
    by Jamie as accessibility owner. Faded was then picked and its pill dropped (item 51).
96. **A Missed days history in the testing panel.** Jamie: "i need a missed days testing
    option". 45 days ending today with seven days skipped and one 12-day break, so the play streak breaks three
    days back and the strip shows that a skipped day draws no column (item 24). Preview only,
    like the other history swaps.
97. (amends 24) **Missed days show as empty columns.** After seeing the Missed days history,
    Jamie: "1 empty". Each calendar day missed between two played days draws a column with no
    cells, so the gap shows; nothing is drawn before the first day played. The "{N} days"
    hint still counts days played. The spoken summary adds the count: "your 23 days played,
    7 missed: …", and says nothing about misses when there are none. A long break is item 98.
98. (amends 97) **A long break is shortened.** Jamie: "1 shorten". A run of 7 or more missed
    days draws as one column marked with the count, such as "12d", on the cells' baseline.
    Runs of 1–6 still draw one empty column per day, so a skipped day or a weekend away
    still shows its true width. The spoken summary still counts every missed day.
    **Settled: Jamie 2026-11-15 — 7 days and "{n}d" confirmed on the preview ("2 yes").**
99. **A Long break history in the testing panel.** Jamie could not see the break in Missed
    days, because it sits off-screen until the strip is scrolled: "i don't have a long enough
    gap to see the gap can you add a testing function for it?". Long break: today and the two
    days before, 20 days missed, then 20 days played, so the "20d" column is in view on load.
    Preview only.

## Dave's review, worked through with Jamie (2026-11-15)

100. (amends time chart brief 131–133) **More spread in the leaderboard's dot sizes.** Dave:
     "make the dot for a single user time even smaller". One player is a fixed 9px (was 13px,
     down to 11px on a busy day); a shared second still grows by area from there: 2 players
     13px, 4 players 18px, 8 or more held at 25px. Yours stays 4px larger and at least 15px.
     Accessibility: no WCAG rule sets a size for a dot you cannot tap; a 9px dot shows about
     6px of colour inside its ring. **Settled: Jamie 2026-11-15 ("1 approved").**
101. **Streak copy.** Jamie: "3 days play should be 3-day play streak / Best: 20". The figure
     reads "3-day play streak" (or "3-day one-go streak" when the one-go run matches it); the
     line under it reads "Best: 20", with "· One-go run N" from 2 as before.
102. (amends 22, 47) **The strip gets two axes, and loses the "Goes" label.** Dave: "'Goes' is
     a little oddly placed"; Jamie: "try instead closing the gap on the left edge, and give
     both axes a line", with numbers in place of the text. A 1px y-axis line with a label
     per row, top down to "1 go"; a 1px x-axis line with "{n} days ago" under its left end
     and "today" under its right. {n} is calendar days from the oldest column to today. A
     long strip opens at today; a short one sits at the left beside the y axis. The 40px
     fade and its start padding are gone. The y labels are 11px, not rem, so each stays on
     its 10px row at 200% text (a rem label is 22px there and they pile up); they grow with
     page zoom as the cells do, and the figures are in the spoken summary. **Jamie accepted
     the 11px call as accessibility owner, 2026-11-15 ("1 yes").** Lines and layout amended
     by 105.
103. (amends 52) **Scrollbars are left to the platform.** Jamie: "can you leave as automatic? i
     have them set to show when scrolling on mac this seems to be overriding". No
     `scrollbar-width` and no hiding. The vertical scrollbar Jamie saw was overflow-x
     making overflow-y auto as well; the scroller now sets `overflow-y: hidden`.
104. (amends 27) **Average time comes back, in All time.** Jamie: "we still need your average
     time in all time". A ledger row, "Average time", between Fastest solve and Puzzles
     solved: the mean of every countable time, rounded to the second, a dash when there are
     none. The same figure the message already uses as its baseline.
105. (amends 102) **Labels always in view, an arrow, the fade back, no axis lines.** Jamie, on the
     preview: "'N days ago' is lost, i think that should always be on screen and if you can't
     see the end it has a left arrow before it … use lucide's arrow left in font colour … lose
     the x y axis lines for now, they look odd and losing the fade on the left edge makes it
     less obvious you're missing a chunk". The x labels sit outside the scroller, so they
     never scroll away. While earlier days are off-screen, a Lucide arrow-left in text colour
     sits before "{n} days ago" and the 40px fade is on; scrolled to the oldest day, or on a
     strip that fits, neither shows, so the oldest day sits beside the row numbers. A small
     script (`wireStrip`) sets this on load, scroll and resize. The row numbers stay; both
     axis lines go. The track hugs the right again, so today sits over "today"; on a short
     history that leaves room between the row numbers and the first column.
     Jamie 2026-11-15 also confirmed the 11px row numbers (item 102, "1 yes") and the
     lowercase x labels ("2 yes").
106. (amends 101) **The Streaks card is header, statement, strip, like the leaderboard.** Jamie:
     "for a quick fix set box 2 to [3-day play streak]. Best: [20]." The big figure goes; one
     line at body size reads "**3-day play streak**. Best: **20**.", the bold parts in accent.
     "One-go run: **N**." follows from 2, as before (Jamie: "keep", item 109).
107. **At most four type sizes on the results page.** Jamie: "aim for max 4 font sizes total on
     the results page", with today's third line "the same font size as the other boxes'
     sub-headers" and the strip's row numbers and break label at the x labels' size. The
     four: 2.125rem (today's figures), 1.1875rem (headings), 1rem (statements: today's
     message, the streak line, the leaderboard's line, the ledger, notes, the countdown,
     buttons) and 0.8125rem (x labels, break label, broken count; the row numbers are 13px,
     the same at default text, px so they hold their rows). The leaderboard's dot labels keep
     0.9375rem and 0.75rem when tight: their collision logic was tuned to them, so they are
     left for the design-system work.
108. (amends 102) **Row numbers stop at 3.** Jamie: "Remove 4 and 5 from the y axis … they don't
     make sense when we skip numbers eg you have 9 … only up to 3 makes sense then the skip
     starts". Rows 4 and 5 keep their space but carry no number when the strip has a broken
     column (a day of 6+ goes); a strip without one numbers every row. **Jamie: "1 only when
     skipping".**
109. (amends 106) **The run reads in text colour, only "N-day" bold.** Jamie: "keep and make
     n-day play streak white and bold only n-day". "**3-day** play streak" is text colour with
     "3-day" bold; "Best: **20**." and "One-go run: **2**." keep their bold accent figures.
     One-go run stays (Jamie: "keep").
