# Results page redesign — brief

Branch: `dev/results-page-redesign` · Started 2026-11-15

Inputs: canvas "Clumeral Screens" (artifact AGBzCYXhuT3JHke4fEaA6R) boards
`Idea-M-Today-vs-Everyone` (M, the target), `Idea-K-F4` / `Idea-L-F4-Dark` (F4),
`Results` (trace of the live page); canvas notes `docs/work/2026-11-01-canvas-notes.md`
(f3-note, onego-note, ideas-note, stats-note, today-note, results-note). The Daily
leaderboard card (Idea-O) shipped in #368 under `docs/work/2026-11-01-daily-time-chart-brief.md`
and is not reopened here.

## 1. What it is
Settled: Jamie 2026-11-15 (accepted all recommendations; item 6 with the note below) · Ack: pending (Dave)

1. The problem. `/solved` today shows four accents at once (solved line in the player's
   accent, Current streaks, Records and All time in the three others), three rows of boxes
   with watermark icons, streaks split across two sections, and an attempts chart that does
   not move from one day to the next. It reads busy and says "solved in one" three ways.
   (assumed — results-note, ideas-note, today-note)
2. The fix is board M with the Daily leaderboard (Idea-O, shipped #368) in M's "Everyone
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
Settled: pending · Ack: pending

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
