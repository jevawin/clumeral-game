# Brief — clearer end-of-puzzle player stats

Date: 2026-08-10 · Branch: `dev/player-stats` · Author: Claude (clumeral dev bot)

Status: OPEN. Section 1 asked.

Related tickets: #252 (streak tidy-up), #163 (streaks on the main screen), #143 (stats
dashboard), #148 (sharing — **comes after this work**, and its sharing sections get folded
into this brief once the stats are settled; Jamie 2026-08-10).

## Ledger

| Section | State |
|---|---|
| 1. What it is | Ack: Dave 2026-08-10 (goes along, no strong view) · awaiting Jamie's settle |
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
   ones survive?** — **SETTLED: Jamie 2026-08-10, "keep it".** Average tries stays, demoted
   into the All time block per item 17. Played survives as "Plays". Best streaks per item 12.
   My rec was: keep *Played* (renamed) and drop *Avg tries* — "one-go plays" says the same thing
   in a way people actually feel. Keep a *best* figure for each streak, but as small text
   under the streak rather than its own box. Why: six headline numbers is already a lot on a
   phone, and two of the four old boxes are re-expressed by the new ones.
6. **Does the answer-in-one streak break on a day you don't play, or only on a day you play
   and miss?** — **SETTLED: Jamie 2026-08-10, "both, since it's partly a come-back-and-play
   function".** A run of consecutive days each answered first go; missing a day breaks it.
   My rec was: it breaks on both — it is a run of consecutive days that you each got first go.
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

### Reopened after Jamie's reply, 2026-08-10

Item 5 is open with Dave. Jamie proposed grouping the stats in three blocks instead of one
grid, and said the layout does not have to stay a grid:

11. **Proposed grouping (Jamie 2026-08-10, awaiting Dave):**
    - *This game:* tries · time to complete
    - *Streak:* play streak · one-go streak
    - *All time:* plays · one-go plays · average attempts · average time · fastest game
    (recorded as proposed, not settled — item 5 asks Dave whether average attempts stays)
12. **The proposed list drops "best streak", which we show today.**
    My rec: keep both bests, as small text under each streak — "best 14". Why: players have
    already earned those numbers, and removing them makes the panel feel like a downgrade.
    A best streak is also the only stat that still means something after a streak breaks,
    which is exactly the moment we want someone to come back.
13. **"Fastest game completed" rewards a lucky guess as much as skill.** A one-go correct
    guess on your first look could be five seconds.
    My rec: keep it, but only count games you got right first go, so it reads as "fastest
    one-go win". Why: it stays a real record instead of a luck record. Alternative is to
    drop it.
14. Item 8 (do archive plays count towards total plays and one-go plays?) was unanswered at
    the time of writing — **now settled at item 16.**
15. No record anywhere of suggestions from Emma — nothing in the repo, the docs, the issues
    or the feedback. If there were any, they were only ever said out loud. (noted
    2026-08-10)

### Jamie's second reply, 2026-08-10 — archive settled, full list requested

16. **Item 8 SETTLED: Jamie 2026-08-10 — "archive is separate, separate stats separate
    leaderboard if and when we do leaderboard".** Archive plays are excluded from every
    stat in this brief, totals included. Archive gets its own stats later, out of scope
    here. This also matches the existing `archived: true` behaviour, so nothing changes in
    how history is tagged.

17. **Recommended list and grouping (Claude, 2026-08-10 — replaces the shape in item 11).**
    Reasoning: at the end of a game people want two things — how did I just do, and is my
    run still alive. Wordle shows only four numbers plus a guess-distribution chart, and the
    chart, not the averages, is the part players talk about. Averages move so slowly they
    become invisible, so they belong lower down as reference, not up top as the headline.

    **Block 1 — This game (the hero, biggest type):** solved in *n* · time.
    One line, not two boxes. It is the only thing that changed in the last ten seconds.

    **Block 2 — Streaks (the return hook, two numbers, best underneath each):**
    play streak (best *n*) · one-go streak (best *n*).
    Keeping both bests — see item 12. This block is what brings people back tomorrow, so it
    sits above the all-time block, not below it.

    **Block 3 — All time (smaller, reference):** plays · one-go plays · average tries ·
    average time · fastest one-go win.
    Keeping average tries (item 5) — it is the closest thing we have to a skill measure and
    it costs nothing to show once it is demoted out of the headline. "Fastest one-go win"
    per item 13.

18. **Add a tries distribution — a small bar chart of how many goes you have taken across
    all your games.**
    My rec: yes, include it. Why: it is the single most-copied element of Wordle's stats
    screen, and it answers the question a newcomer actually has, which is "is 3 goes good?"
    We already store tries per game, so there is no new data to collect. It is extra design
    and build work though, so it is a fair thing to cut.
19. **What does a first-time player see?** Every all-time number is 0 or 1 on day one, which
    makes the panel look broken rather than promising.
    My rec: on your first two games show only "This game" and a line saying the rest starts
    building tomorrow. Reveal the streak and all-time blocks from the third game.
20. **Show one-go plays as a count, or as a percentage of games?**
    My rec: both, as "23 (18%)". Why: the count is the brag, the percentage is the one that
    stays meaningful after 400 games, when everyone's counts are large.

### Layout sketch and share buttons, 2026-08-10

21. **Two share buttons, one per section header — "This game" and "All time".** (Jamie
    2026-08-10: "probably share all time, but we could give them both options", with the
    button sitting on the section rule.)
    My rec: two buttons, not three. The streaks block shares as part of *All time*, because
    a streak with no totals around it is a thin thing to post, and a third button starts to
    look like a toolbar. Sharing itself is still #148 and comes after this build — this
    brief only fixes where the buttons live so the layout does not have to change twice.
22. **Dave's concern, 2026-08-10: "what would people show or share because that looks a
    lot?"** Fair. Two answers: the sections are collapsible in reading order, so the eye
    lands on this game first; and the shared picture is a deliberate subset — roughly five
    numbers — not a screenshot of the whole panel. The panel is for you, the picture is for
    other people. To be settled properly in §7 and in #148.
23. **Screen sketch (phone width), 2026-08-10:**

```
        Puzzle #157 — solved!

  THIS GAME ───────────── [ ↗ Share ]

        2 goes         3:41

  STREAKS ─────────────────────────

     Play streak     One-go streak
          14               3
       best 21           best 7

  ALL TIME ────────────── [ ↗ Share ]

     Plays                     128
     One-go plays          23 (18%)
     Average goes              2.4
     Average time             4:12
     Fastest one-go win       0:48

     How many goes you take
     1  ███░░░░░░░░░  23
     2  ████████████  61
     3  ██████░░░░░░  34
     4  █░░░░░░░░░░░   8
     5  ░░░░░░░░░░░░   2
```

24. **Dave, 2026-08-10: "I am not sure. I'll go along with yours and Jamie's suggestions
    for now."** Recorded as an ack on section 1, but a soft one — he liked the three-block
    split (2026-08-10) and his only stated worry is the volume of numbers, item 22. Treat
    that worry as live in §7 rather than closed. His maths sign-off is not needed here;
    section 4 is not applicable.

Still needed to close section 1: **Jamie's settle** on items 5, 12, 13, 17, 18, 19, 20, 21
and 23.
