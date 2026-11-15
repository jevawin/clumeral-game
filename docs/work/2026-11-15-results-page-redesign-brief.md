# Results page redesign — brief

Branch: `dev/results-page-redesign` · Started 2026-11-15

Inputs: canvas "Clumeral Screens" (artifact AGBzCYXhuT3JHke4fEaA6R) boards
`Idea-M-Today-vs-Everyone` (M, the target), `Idea-K-F4` / `Idea-L-F4-Dark` (F4),
`Results` (trace of the live page); canvas notes `docs/work/2026-11-01-canvas-notes.md`
(f3-note, onego-note, ideas-note, stats-note, today-note, results-note). The Daily
leaderboard card (Idea-O) shipped in #368 under `docs/work/2026-11-01-daily-time-chart-brief.md`
and is not reopened here.

## 1. What it is
Settled: pending · Ack: pending

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
