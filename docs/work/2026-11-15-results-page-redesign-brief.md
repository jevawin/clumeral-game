# Results page redesign — brief

Branch: `dev/results-page-redesign` · Started 2026-11-15

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
Settled: Jamie 2026-11-15 (accepted all recommendations; item 6 with the note below) · Ack: pending (Dave)

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
Settled: Jamie 2026-11-15 (accepted all recommendations) · Ack: pending (Dave)

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
Settled: Jamie 2026-11-15 (accepted all recommendations) · Ack: pending (Dave — and item 26 needs his view on the record, since he built the live chart)

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
    before this settles.
27. **Agree these cuts from the page?** Avg. time (Current streaks and All time), Average
    attempts, the "1-go solve" current-streak box, the "Come back tomorrow" line, and the raw
    "7 (23%)" count (the percentage stays). Average time and goes are still computed for the
    item 17 message, just not shown.
    My rec: yes. Why: stats-note dropped average time on every board; the rest are the "three
    ways of saying solved in one" ideas-note set out to remove.

## 4. Maths
Settled: pending · Sign-off: pending (Dave) · Ack: n/a

28. n/a for puzzle generation and filtering: nothing here touches the generator, clues,
    seeding or the guess path. (assumed)
29. **Should Dave still sign the stats definitions?** Items 17, 18, 20, 21 and 25 define
    figures: the "before today" baselines, "fastest ever" on a strict beat, the one-go run,
    the one-go percentage. All reuse `computePlayerStats` rules (archive excluded, recency
    gate, two-go day breaks a one-go run).
    My rec: yes, a short sign-off from Dave on those five items. Why: they are counting rules
    a player can check against their own history, and getting a streak or a "fastest ever"
    wrong is the kind of bug players report.
