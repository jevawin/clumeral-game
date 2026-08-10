# Brief — clearer end-of-puzzle player stats

Date: 2026-08-10 · Branch: `dev/player-stats` · Author: Claude (clumeral dev bot)

Status: OPEN. Section 1 asked.

Related tickets: #252 (streak tidy-up), #163 (streaks on the main screen), #143 (stats
dashboard), #148 (sharing — **comes after this work**, and its sharing sections get folded
into this brief once the stats are settled; Jamie 2026-08-10).

## Ledger

| Section | State |
|---|---|
| 1. What it is | asked 2026-08-10 |
| 2. Out of scope | not started |
| 3. How it works | not started |
| 4. Maths | not started |
| 5. State & persistence | not started |
| 6. How it fits | not started |
| 7. How it looks | not started |
| 8. Copy & wording | not started |
| 9. Accessibility | not started |
| 10. Analytics | not started |
| 11. Done / test plan | not started |

## Background — what we show today

`src/completion.ts` `computeStats()` reads `dlng_history` (entries: `date`, `tries`,
`archived`) and renders four boxes: **Played**, **Avg tries**, **Streak**, **Best streak**.

Known, deliberate behaviours already in the code:
- Archive solves are tagged `archived: true` and excluded from every daily stat.
- History is sorted date-descending before the streak walk (fixes a June under-count).
- Day keys are the player's local date, not UTC.
- A current streak only shows if the most recent play was today or yesterday; otherwise 0.

None of these rules is written down anywhere a player can see. That is the problem this
brief starts from.

Everything Jamie asked for is computable from the history we already store, **except time** —
`tries == 1` gives both one-go counts. Time is a new field with no past data.

## 1. What it is

1. **The problem:** the end-of-puzzle stats do not explain themselves. "Streak" is never
   defined on screen, and the four boxes give a returning player little to aim at.
   (assumed — Jamie raised it directly, 2026-08-10)
2. **Who it is for:** everyone who finishes a puzzle, and especially first-time visitors
   arriving from the maths community, who see the stats panel before they have any history.
   (assumed)
3. **Why now:** traffic is spiking, clearer stats give people a reason to come back, and the
   sharing work (#148) reads these exact numbers, so they have to be right first.
   (assumed)
4. **The stats Jamie asked for:** play streak, answer-in-one streak, total plays, total
   one-go plays, time to complete, average time to complete. (assumed — his message,
   2026-08-10)
5. **We currently show four boxes: Played, Avg tries, Streak, Best streak. Which of the old
   ones survive?**
   My rec: keep *Played* (renamed) and drop *Avg tries* — "one-go plays" says the same thing
   in a way people actually feel. Keep a *best* figure for each streak, but as small text
   under the streak rather than its own box. Why: six headline numbers is already a lot on a
   phone, and two of the four old boxes are re-expressed by the new ones.
6. **Does the answer-in-one streak break on a day you don't play, or only on a day you play
   and miss?**
   My rec: it breaks on both — it is a run of consecutive days that you each got first go.
   Why: it is one sentence to explain, and a streak you can pause by not playing is not a
   streak. The alternative (only counting days you played) is kinder but confusing.
7. **Archive puzzles stay excluded from the daily streaks.** (assumed — existing deliberate
   behaviour, and replaying old puzzles should not build a daily habit stat)
8. **Should archive plays count towards *total plays* and *total one-go plays*?**
   My rec: yes. Why: totals are a lifetime count of puzzles solved, not a habit measure, and
   a player who works through the archive has genuinely played them. Streaks stay
   daily-only, so nothing is gamed.
9. **Time stats start from launch — there is no past timing data**, so early players see
   their times build from zero while their other stats carry over. (assumed — unavoidable)
10. **Not part of this work:** the share link and preview picture (#148), and any
    leaderboard. Both come after. (assumed — Jamie, 2026-08-10)
