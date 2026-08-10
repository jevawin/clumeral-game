# Brief — clearer end-of-puzzle player stats

Date: 2026-08-10 · Branch: `dev/player-stats` · Author: Claude (clumeral dev bot)

Status: OPEN — da-brief run 2026-08-10, 4 High and 10 Medium findings, all answered at items 116-138. Four decisions still needed; see the foot of the file.

Was: CLOSING. All eleven sections settled with Jamie; section 9 signed off by its owner.

**Dave never acked sections 2, 3 (items 52-56), 4, 5, 6, 7, 8, 10 or 11.** Jamie, as dev
lead, overrode on 2026-08-10: "assume Dave is happy with everything, crack on with DA
review." That is recorded as an override, NOT as Dave's agreement, because he did not give
one. Dave's only direct words on this brief are at items 24 (goes along, no strong view),
50 (agrees two minutes) and his "makes sense to me" on the /stats figure. If anything here
later surprises him, this is the line that explains why.

Next: fresh-context `da-brief` review, fix every Medium and above, then clear context and
plan.

Related tickets: #252 (streak tidy-up), #163 (streaks on the main screen), #143 (stats
dashboard), #148 (sharing — **comes after this work**, and its sharing sections get folded
into this brief once the stats are settled; Jamie 2026-08-10).

## Ledger

| Section | State |
|---|---|
| 1. What it is | Settled: Jamie 2026-08-10 · Ack: Dave 2026-08-10 (goes along, no strong view) |
| 2. Out of scope | Settled: Jamie 2026-08-10 · Override: Jamie 2026-08-10 (not a Dave ack) |
| 3. How it works | Settled: Jamie 2026-08-10 · Ack: Dave on the timer · Override: Jamie 2026-08-10 for items 52-56 |
| 4. Maths | REOPENED by da-brief (item 127) · Dave's sign-off needed, blocking |
| 5. State & persistence | Settled: Jamie 2026-08-10 · Override: Jamie 2026-08-10 (not a Dave ack) |
| 6. How it fits | Settled: Jamie 2026-08-10 · Override: Jamie 2026-08-10 (not a Dave ack) |
| 7. How it looks | Settled: Jamie 2026-08-10 · Override: Jamie 2026-08-10 (not a Dave ack) |
| 8. Copy & wording | Settled: Jamie 2026-08-10 · Override: Jamie 2026-08-10 (not a Dave ack) |
| 9. Accessibility | REOPENED by da-brief (items 126, 137) · Jamie to re-sign |
| 10. Analytics | Settled: Jamie 2026-08-10 · Override: Jamie 2026-08-10 (not a Dave ack) |
| 11. Done / test plan | Settled: Jamie 2026-08-10 · Override: Jamie 2026-08-10 (not a Dave ack) |

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

*(Struck 2026-08-10 after the da-brief review: this line said "Item 5 is open with Dave".
Item 5 is settled at item 5 and item 11's shape is superseded by item 17. Left visible
rather than deleted, because the numbering is append-only.)*

Jamie proposed grouping the stats in three blocks instead of one grid, and said the layout
does not have to stay a grid:

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

25. **Section 1 SETTLED: Jamie 2026-08-10, "yep"** — items 12, 13, 17, 18, 19, 20, 21 and 23
    all accepted as recommended, on top of the settles at items 5, 6 and 16. Dave's ack is
    item 24.

## 3. How it works — the timer

Section 2 (out of scope) is still to do; timing was taken next at Jamie's request,
2026-08-10. Jamie's stated goal: a best-effort *"the player is actually here solving it"*
measure, not wall-clock. His example of what must NOT happen — "opened at 9am, closed two
minutes later, came back at 11am and finished, so it took two hours".

26. **Count only while the tab is visible.** Switching tabs, backgrounding the app or
    locking the phone pauses the clock; coming back resumes it. Use the browser's own
    page-visibility signal rather than window focus, which is unreliable on phones.
    (assumed — already agreed in #148)
27. **Start on the first real action, not on page load.** Reading the clues before you
    touch anything is not solving. (assumed — already agreed in #148)
28. **Visibility alone does not deliver what Jamie asked for.** On a laptop a tab stays
    "visible" while you wander off, make coffee, or read something in another window that
    does not cover the tab. That is the two-hour puzzle all over again, just with the tab
    left open. So we also need an idle cut-off.
29. **How long with no taps or key presses before we stop the clock?**
    My rec: **three minutes**. Pause after three minutes of nothing, resume on the next
    action, and throw the gap away entirely. Why: staring at a Clumeral board and thinking
    for three straight minutes without touching anything is rare, and the cost of getting it
    slightly wrong is small — worst case someone's honest thinking time is under-counted by
    a few minutes, which is much better than a two-hour "solve".
30. **The clock survives a reload.** Elapsed time is saved with the in-progress board, so a
    refresh or an iOS app-switch does not reset it to zero. Reload is a common accidental
    gesture and losing your time would look broken. (assumed — mechanism decided in §5)
31. **A silly time does not poison the averages.** If a single game somehow records more
    than 30 minutes of counted time, keep it on that game but leave it out of the average
    time and out of fastest one-go win.
    My rec: yes, do this. Why: one bad measurement would otherwise sit in your average for
    hundreds of games, and averages are the stat people trust least when they look wrong.
32. **The clock is never visible during play.** No ticking, no pressure — it only appears at
    the end. (assumed — Jamie's original ask and #148)
33. **Time is never used to break a streak or gate anything.** It is a stat, nothing more.
    (assumed)
34. **Item 29 CHANGED to two minutes: Jamie 2026-08-10** — "3m without any movement feels
    quite long… 3m staring at the screen not touching a thing is unlikely when the point is
    to interact with the boxes. Change to 2 unless Dave disagrees or proposes something
    else." **Two minutes it is, unless Dave says otherwise.** Awaiting Dave.
35. **Jamie's reasoning on the desktop case, recorded 2026-08-10:** most play is on phones;
    on a laptop people navigate away, sleep the machine or close the lid, and screensavers
    kick in, so the idle cut-off should fire rarely. Which is the point of item 36 — we will
    measure whether that holds.

### The rest of section 3 — who sees which blocks, asked 2026-08-10

Two cases in the existing code mean some players have no history to show. Both need a
decision, because the new panel is mostly history.

52. **Random puzzles are never written to history** (`src/app.ts`: "Random puzzles are never
    written to history"). So a random solve has no streak, adds no total, and records no
    time.
    My rec: after a random puzzle show the *This game* block only — goes and time — and one
    plain line saying random puzzles do not count towards your stats. Why: showing streaks
    that did not move looks broken, and silently showing nothing looks broken too. Also send
    no `puzzle_time` event for randoms, so the tracking measures real daily play.
53. **A player can turn off "save my score"** — the game still records the day so it knows
    you solved it, but keeps no answer. That player's all-time numbers are thin by choice.
    My rec: show *This game* plus a short line offering to turn stats back on, and hide the
    streak and all-time blocks. Why: nagging is worse than useless, but a person who forgot
    they switched it off will otherwise think the feature is broken.
54. **Archive solves keep the minimal panel they have today** — no streaks, no totals, no
    timing. (assumed — existing behaviour, and item 16 keeps archive separate)
55. **Everything on the panel is worked out fresh each time it is shown**, from the stored
    history, rather than kept as running totals. Why: a running total drifts the moment one
    write is missed, and this history is small enough that recomputing costs nothing.
    (assumed — matches how `computeStats` works today)
56. **Nothing on this panel blocks the celebration animation or the countdown to tomorrow.**
    (assumed — existing behaviour stays)
57. **Section 3 SETTLED: Jamie 2026-08-10, "me too, happy"** — items 52 to 56 as
    recommended, on top of the timer rules already agreed by both at items 26 to 35 and 50.
    Dave's ack on items 52 to 56 still needed.

## 4. Maths — not applicable

58. **Nothing here touches puzzle generation, clue filtering or the answer check.** The only
    arithmetic is counting days, counting games and averaging. Recorded as not applicable
    rather than skipped, so the next reader knows it was considered. Dave, say if you
    disagree. (assumed — 2026-08-10)

## 5. State and persistence

59. **The clock for the game in progress is saved with the board** (`saveActive`), so a
    refresh, a phone call or an app-switch does not reset your time to zero.
    (assumed — item 30, and reload is a common accidental gesture)
60. **The finished time is stored on the history entry**, next to the date and the number of
    goes, because every all-time figure is recomputed from history (item 55).
    (assumed)
61. **Entries written before this ships have no time, and the code must treat that as
    "unknown", not zero.** A missing time must never count as a 0-second game in the average
    or become the fastest win. (assumed — this is the classic way an average goes wrong)
62. **If a player has turned "save my score" off, do we still store their time?**
    My rec: no. Record the day, as we do now so the game knows you solved it, and store no
    time. Why: they asked us not to keep their results, and a stored time is a result. The
    panel already shows them this-game numbers from memory, so they lose nothing on screen.
63. **Nothing new is stored on our servers.** Stats stay in the player's own browser; the
    only thing that leaves the device is the anonymous timing event. (assumed — item 44)
64. **The extra storage is tiny** — one number per game, on a history that is one row a day.
    (assumed)

### Jamie's decision on score saving, 2026-08-10

65. **Item 62 SETTLED: Jamie 2026-08-10, "nope, if they turn off save… we save nothing".**
    With saving off we store no time and no results. Plus the behaviour he set out:
    - Under the *All time* heading, in place of the numbers: "Turn on score saving to see
      your all time stats", and the checkbox "Save my scores in a cookie".
    - Ticking it saves that game and every game after it, until they turn it off again.
    - If they untick it during a later game, warn them it will delete their history.
    - If they then submit with it unticked, delete the stored history.
66. **This conflicts with why we record the day today, and the conflict is real.** Right now
    `recordGame` still writes an entry when saving is off — deliberately, so a reload can
    tell you already solved today (`src/app.ts`, marked WR-02). Store literally nothing and
    a refresh lets you replay today's puzzle, and the archive's "goes" column loses the day
    too.
    My rec: keep a **day-only marker** — the date and nothing else. No goes, no time, no
    answer. That is not a result, so it honours what the player asked for, and today's
    puzzle still cannot be replayed. Say so plainly in the copy: we remember that you
    finished today, and nothing else.
    The alternative is to accept that turning saving off lets you replay today's puzzle,
    which I think is a bug people will report.
67. **There will now be two checkboxes for one setting** — the existing one during play
    (`dom.saveCheck`) and the new one on the stats panel. They must read and write the same
    stored preference and stay in step, or a player will tick one and see the other unticked.
    (assumed — one setting, two controls)
68. **Deleting history is not undoable and needs the warning to say so.** Wording lands in
    section 8; the behaviour is Jamie's, item 65. (assumed)
69. **"Cookie" is not what we actually use** — the setting and the history live in the
    browser's local storage, which unlike a cookie is never sent to our servers and does not
    expire. Jamie's draft copy says cookie.
    My rec: keep it plain but true — "Save my scores on this device". Why: "cookie" makes
    people think of tracking and of something that leaves their machine, and neither is
    true here. Decide properly in section 8.
70. **Section 5 SETTLED: Jamie 2026-08-10** — "yes to both, change the language to drop
    cookie, keep the day's data so they can refresh." So: day-only marker stays when saving
    is off, and the word "cookie" goes from the copy. Jamie's reasoning, recorded as his:
    *"I think that's within the PECR / cookie rules given it's about core functionality
    (saving your current play state)."* Ack from Dave still needed.
71. **What "day-only marker" means exactly, so the build cannot get it wrong:** with saving
    off we keep the date and nothing else — no number of goes, no time, no answer. It exists
    only so a refresh does not hand you today's puzzle again. It is never counted in any
    all-time figure and never in a streak. (assumed — the point of item 66)

## 6. How it fits

72. **The stats panel is rendered in one place only** — `src/completion.ts`. Checked
    2026-08-10: nothing in the Worker draws this panel, so there is no second copy to keep
    in step. That matters because #221 exists precisely because other views do have two.
    (assumed)
73. **Should the stat rules move into their own small module now, instead of living inside
    the completion screen?**
    My rec: yes, move them. Why: two queued pieces of work need the same numbers — streaks
    on the main game screen (#163) and the share picture (#148). If the rules stay inside
    the completion screen, both will copy them, and copied streak rules drift. We are
    rewriting these rules anyway, so the extra cost now is small. The counter-argument is
    that it is a bit more churn in a build that already touches a lot.
74. **The timer is its own small piece**, driven from `src/app.ts` where play already
    happens, and saved through `src/storage.ts` with the rest of the in-progress board.
    (assumed)
75. **`src/storage.ts` gains three jobs:** store the time on a history entry, write the
    day-only marker, and delete the history when someone turns saving off. (assumed)
76. **The new event needs no database change.** It fits the existing analytics table as it
    stands — a name, a number and a short label — so there is no migration in this build. It
    does need adding to the Worker's list of accepted event names, or it will be rejected.
    (assumed — checked against `src/worker/index.ts` and the analytics table, 2026-08-10)
77. **`/stats` gains one figure** through the existing read path, not a new page.
    (assumed — item 49)
78. **Section 6 SETTLED: Jamie 2026-08-10, "definitely yes, consolidate."** The stat rules
    move into one shared module that the completion screen reads, so #163 and #148 can use
    the same rules instead of copying them. Ack from Dave still needed.

## 7. How it looks

79. **Three blocks in this order: This game, Streaks, All time**, per the sketch at item 23.
    (settled at item 17)
80. **This game is the hero** — one line, largest type on the panel. (settled at item 17)
81. **Should the All time block be folded away behind a tap by default?** It is the longest
    block, and Dave's worry at item 22 was the sheer number of figures.
    My rec: no — keep it open, but make it visually quiet: smaller type, muted colour, plain
    rows rather than boxes. Why: a folded block is a block nobody opens, and these numbers
    are the reason a returning player scrolls at all. Density is better solved by making
    them quiet than by hiding them. Scrolling on a phone costs nothing.
82. **The goes chart sits at the foot of the All time block**, small, using the existing
    accent colour for the bars. (assumed — item 18)
83. **No new colours and no new type sizes.** Everything uses the tokens already in the
    design system. (assumed — house rule, and the palette is deliberately under 15 tokens)
84. **The two share buttons sit on the section rules**, as Jamie drew them at item 21.
    They are drawn now and do nothing until #148. (settled at item 21)
85. **The panel keeps working at 320 pixels wide and at 200% text size** without the numbers
    colliding. (assumed — the streak block is two columns, so it needs to stack)
86. **Section 7 SETTLED: Jamie 2026-08-10, "agreed"** — all time stays open and quiet, not
    folded. Ack from Dave still needed.

## 8. Copy and wording

87. **Section headings: "This game", "Streaks", "All time".** (assumed — Jamie's own words)
88. **Hero line: "Solved in 2 · 3:41".** Times under an hour read as minutes and seconds;
    nothing shows hours, because a game that long is excluded anyway (item 31). (assumed)
89. **Which phrase do we use for getting it right first time?** It appears about six times —
    a streak, a total, a record and the chart.
    My rec: **"first go"** throughout — "First-go streak", "First-go wins", "Solved in one".
    Why: it is what a person says out loud, it survives translation better than "1-go", and
    a digit in the middle of a label reads like a number the player has scored. Jamie's own
    shorthand was "1-go", which is why this is a question and not an assumption.
90. **All-time block when saving is off:** "Turn on score saving to see your all-time stats",
    with the checkbox **"Save my scores on this device"** — no mention of cookies.
    (settled at items 65, 69 and 70)
91. **The warning when someone turns saving off mid-game:** "This deletes the stats you have
    saved so far. It cannot be undone." Buttons say what they do — "Delete my stats" and
    "Keep them" — rather than OK and Cancel. (assumed — a destructive action needs a plain
    warning, per item 68)
92. **New player, first two games:** "Your streaks and all-time stats start from your third
    game." (assumed — item 19, and it explains the empty space instead of hiding it)
93. **After a random puzzle:** "Random puzzles don't count towards your stats."
    (assumed — item 52)
94. **The chart is labelled "How many goes you take".** (assumed — item 18)
95. **Every stat that needs explaining gets one short line under it, not a tooltip.** The
    whole point of this build is that "streak" currently explains nothing. (assumed —
    item 1; exact lines land with the design)
96. **Section 8 SETTLED: Jamie 2026-08-10, "first go good".** Item 89 resolved: "first go"
    throughout — "First-go streak", "First-go wins", "Solved in one". Ack from Dave still
    needed.

## 9. Accessibility

Jamie owns this section outright; his sign-off is blocking.

97. **Every number is read out with its label attached**, so a screen reader says "play
    streak, 14, best 21" rather than three loose numbers. The panel is a list of pairs, and
    it should be built as one. (assumed)
98. **The goes chart carries the same numbers in text**, so nothing in it is available only
    as a picture. The counts are already beside each bar for everyone. (assumed — a chart
    that only works visually fails for the people most likely to be using our archive)
99. **The panel does not announce itself over the existing win announcement.** We already
    tell people they solved it; two announcements talking at once is worse than one.
    (assumed — check against the current celebration behaviour during the build)
100. **The save-my-scores control is a real checkbox with a real label**, reachable and
     operable by keyboard, and it says the same thing as the one during play. (assumed —
     item 67)
101. **The delete warning is a proper dialogue:** focus moves into it, Escape closes it
     without deleting, and focus returns to the checkbox afterwards. Its buttons say
     "Delete my stats" and "Keep them". (assumed — items 68 and 91)
102. **Colour is never the only signal**, and everything uses the existing tokens, whose
     contrast is already measured. No new colours (item 83). (assumed)
103. **Should the numbers count up when the panel appears?**
     My rec: no animation at all — the numbers are simply there. Why: a counting animation
     delays the information for everyone, needs a reduced-motion alternative, and is one
     more thing to get wrong on a screen people see every single day. The celebration
     animation already carries the moment.
104. **The panel works at 200% text and 320 pixels wide** (item 85), which mainly means the
     two-column streak block stacks rather than squeezing. (assumed)
105. **Section 9 SIGNED OFF: Jamie 2026-08-10, "no count no animation".** Item 103 resolved:
     the numbers appear as they are, with no counting and no animation, so there is no
     reduced-motion branch to get wrong. Accessibility is Jamie's to sign and he has signed
     it, so this section needs no ack from Dave.

## 11. Done and how we test it

106. **The stat rules get proper unit tests, because they are the part that has gone wrong
     before.** Each rule gets its own case: a missed day breaks both streaks; a first-go
     streak breaks on a day you played and missed; a run that ended more than a day ago
     reports zero; archive solves change no daily figure; a game with no stored time counts
     as unknown, never as zero seconds; a game over thirty minutes is left out of the
     average and out of the fastest win; the day-only marker counts towards nothing.
     (assumed — the June streak under-count is exactly this class of bug)
107. **The timer gets its own tests:** it starts on the first action and not on load, it
     stops while the page is hidden, it stops after two minutes with no input, it starts
     again on the next input, and it survives a reload. (assumed)
108. **The delete flow is tested end to end:** warning appears, "Keep them" leaves the
     history untouched, "Delete my stats" removes it, and the two checkboxes agree with each
     other afterwards. (assumed — it is the only destructive thing in this build)
109. **What level of browser testing does this warrant?**
     My rec: a focused set, not the full suite. Cover the panel appearing with the right
     numbers after a solve, the new-player state, the saving-off state, and the delete flow.
     Leave the long regression run for the release that carries sharing. Why: this build
     changes one screen and the storage under it, so a targeted set catches what matters;
     a forty-minute battering costs an hour and tells us about screens we did not touch.
110. **`/stats` gets a check that the average time appears and weights the sampling column**
     (item 51). (assumed)
111. **Playwright runs in CI, never on the Pi.** (assumed — house rule; the Pi cannot run the
     engines CI covers)
113. **Item 109 was the wrong question, corrected by Jamie 2026-08-10:** "you can't browser
     test here so we rely on e2e smoke, chromium on staging, everything on main." The level
     of browser testing is already fixed by the workflows — `ci-smoke.yml` runs chromium on
     every pull request into staging and main, `ci-matrix.yml` runs the remaining engines
     into main. There was nothing to decide about the level; the real question was which new
     tests to add.
114. **Section 11 SETTLED: Jamie 2026-08-10, "agreed on those updates to e2e then".** Four
     new browser tests join the existing suite and ride the existing gates: the panel after a
     solve showing the right numbers, a brand-new player, a player with saving turned off,
     and the delete flow. No new workflow, no new gate. Ack from Dave still needed.
115. **Done means (extended at item 134):** the panel shows the agreed numbers for a normal player, a new player, a
     player with saving off and a random puzzle; the timer behaves as items 26 to 35 say;
     turning saving off deletes the history after a warning; `/stats` shows the average time;
     and the timing event reaches the database with its clean-or-idle label. (assumed)

## 10. Analytics

Brought forward at Jamie's request, 2026-08-10, because the timer decision depends on being
able to check it. Background: every event lands in `analytics_events` with an event name, an
anonymous id, a free-text `source`, a whole-number `value`, and the hostname.

36. **Jamie's ask: how many plays, and what share of plays, hit the idle cut-off.**
    (recorded — Jamie 2026-08-10)
37. **We cannot put the time inside the existing `puzzle_complete` event.** Its `value`
    already holds the number of goes, and the goes-distribution chart on `/stats` reads
    exactly that. Overwriting it would silently break a chart we already rely on.
38. **Recommendation: one new event, `puzzle_time`, and nothing else.**
    - `value` = the counted time in whole seconds.
    - `source` = `clean` if the idle cut-off never fired, or `idle-N` where N is how many
      times it fired.
    That single event answers all three questions at once: average time on real traffic,
    what share of plays ever went idle, and whether people go idle once or repeatedly.
    Why one event and not three: it fires once per finished puzzle, so it adds about the
    same volume as `puzzle_complete` — small against the daily write ceiling — and it needs
    no change to the events we already have.
39. **Nothing else gets added.** No per-pause events, no timer start/stop events. They would
    multiply with every game and answer nothing we have asked. (assumed)
40. **Whoever reads this later must add up the sampling column, not count rows.** Measured
    2026-08-04, plain counting under-reported by 1.70%. Recorded here because the person
    reading these numbers in three months will not be in this conversation.
    (assumed — existing house rule in `docs/ANALYTICS.md`)
41. **A player who never finishes records no time at all.** We only send the event on a
    correct answer, so abandoned puzzles are invisible to the timing numbers. (assumed —
    accepted; measuring give-ups is a different question)
42. **Section 10 SETTLED: Jamie 2026-08-10, "yep, give ups indicated by start without
    finish".** One new `puzzle_time` event, nothing else. Give-ups are read as the gap
    between `puzzle_start` and `puzzle_complete`, both of which we already record, so this
    build adds no event for them. Ack from Dave still needed.

## 2. Out of scope

43. **No leaderboard.** (assumed — Jamie 2026-08-10, it comes "if and when")
44. **No accounts and no syncing between devices** (#162). Your stats stay in this browser
    on this device, exactly as today. Clearing your browser data still wipes them.
    (assumed — a big piece of work in its own right)
45. **No sharing** (#148) — buttons are drawn in their places but do nothing yet.
    (assumed — Jamie 2026-08-10, stats first)
46. **No archive stats and no archive leaderboard** (#160, #161). (assumed — item 16)
47. **No streaks on the main game screen** (#163). This build only changes the end-of-puzzle
    panel. (assumed)
48. **No back-filling.** Games played before this ships have no time recorded and never
    will. (assumed — item 9)
49. **Does the team's own `/stats` dashboard get the new timing numbers in this build?** —
    **SETTLED against my recommendation: Jamie 2026-08-10, "show avg time to complete in
    /stats as a single number, no graph".** So `/stats` gains one figure: average time to
    complete across the selected range. No chart, no extra range controls. It is in scope
    for this build.
    My rec was: no. Store the event now, read it with a one-off query when we want it, and add a
    chart later once we know the numbers are sane. Why: it is a separate screen with its own
    accessibility and contrast work, and adding it here doubles the review surface for
    something only the two of you look at.
50. **Item 34 CONFIRMED by Dave, 2026-08-10: "I agree on 2 mins."** The idle cut-off is two
    minutes. Both are agreed, so it is closed.
51. **One figure on `/stats` still carries the sampling rule** (item 40): the average must
    weight each row by its sampling column, not treat every row as one game. An unweighted
    average would be wrong by roughly the same 1.70% measured on 2026-08-04, and worse if
    sampling ever bites harder. (assumed — consequence of item 49)

---

## da-brief review — findings and fixes, 2026-08-10

Fresh-context review run 2026-08-10 against this file and the repo. Result: **4 High,
10 Medium, 6 Low. Gate not passable as written.** Every High and Medium is answered below.
Numbering continues; nothing above is rewritten except two struck lines, marked as struck.

### Housekeeping first (the Low findings)

116. **Numbering slipped once.** There is no item 112 — it was overwritten while items 113
     to 115 were added. Recorded rather than reused, so "item 112" means nothing anywhere.
117. **Item 57 overstated Dave's agreement.** It said the timer rules were "agreed by both
     at items 26 to 35 and 50". Items 26 to 35 are my assumptions; item 50 is the only one
     Dave confirmed in his own words. Corrected here rather than in place.
118. **Item 51's reasoning is wrong, though its instruction stands.** The 1.70% under-count
     came from rows imported from the old analytics system. `puzzle_time` is brand new and
     will never be imported, so every row of it counts as one and the weighting changes
     nothing today. Keep the weighting anyway — it is the house rule and it protects us if
     sampling ever starts — but item 110 must not assert a difference it cannot see.
119. **This file's sections are out of order** (1, 3, 4, 5, 6, 7, 8, 9, 11, 10, 2) because
     Jamie asked for them out of order. Anyone reading for scope: §2 is at the foot, and
     item 49 inside it puts one figure *into* scope rather than out of it.
120. **Two tabs on the same puzzle both run a clock and both save the board; the last one to
     write wins.** Accepted, not fixed. It is rare, it costs a player at most one game's
     time, and guarding it properly means coordinating tabs for no real gain.

### High findings

121. **H2 — the saved board carries a version number, and the fix must not bump it.**
     `src/storage.ts` discards a saved board whose version does not match, by design.
     My rec: **do not bump it.** Add the elapsed time as an optional field, and treat a
     board that has none as zero elapsed. Why: bumping the version throws away the
     in-progress board of every player mid-puzzle at the moment we deploy, to save writing
     one `if`. That is a real cost to real people for no gain.
122. **The elapsed time must be validated like everything else in that store.** Saved boards
     are editable by anyone who wants to edit them, which is why every other field is
     checked. Rule: accept only a whole number of seconds between 0 and 1800; anything else
     (missing, negative, fractional, absurd, not a number) means the time for that game is
     unknown. An unknown time shows as no time, sends no event, and never becomes a fastest
     win. (fixes the hole the review found in item 31, which capped the top end only)
123. **H3 — the day-only marker needs a defined shape, and it has a second reader.**
     My rec: the marker is a normal history row with `tries: 0` and a flag saying it is a
     marker. Every figure filters markers out *before* counting, so they change no total, no
     average and no streak. Why a flag rather than a missing field: the code that averages
     goes adds `tries` up, and a missing number there poisons the whole average silently.
124. **The archive page reads this same history directly** (`src/worker/puzzles.ts` fills its
     "goes" column from it), which item 72 missed — it was true only of the panel.
     My rec: a marker day shows a dash in that column, not a blank and not a zero. It means
     "you played, we did not keep the score", which is exactly what happened. `src/worker/
     puzzles.ts` joins the list of files this build touches.
125. **The redirect that sends a returning player to the puzzle rather than the welcome
     screen also reads this history**, so markers must keep it working: a marker counts as
     "this person has played before". (assumed — it is the plain reading, but it must be
     tested, so it joins item 108)
126. **H4 — REOPENS SECTION 9, which Jamie has already signed.** Item 99 said the panel must
     not announce itself because "we already tell people they solved it". **We do not.** The
     review checked: finishing a puzzle changes text on screen and moves nothing to a screen
     reader. So as written, section 9 bans the only thing that would tell a blind player
     they had won.
     **Question for Jamie, who owns this section:** should finishing a puzzle announce the
     result — something like "Solved in 2, 3 minutes 41 seconds. Play streak 14" — read out
     once when the panel appears?
     My rec: yes. Why: without it, the moment the whole screen exists for is silent for
     anyone not looking at it. One announcement, the headline numbers only, not the whole
     panel.
127. **H1 — REOPENS SECTION 4. The maths section is Dave's to sign, and he has not signed
     it.** Jamie's override at the top of this file closed the joint sections; it cannot
     close an owned one. Nothing here touches puzzle generation, so "not applicable" is very
     likely right — but the streak walks, the outlier rule, the percentage and the weighted
     average are all counting rules, and counting rules are where the June streak bug lived.
     **Dave's call, and it blocks planning.**

### Medium findings

128. **M1 — three more files this build touches, missing from section 6.**
     - There is no reusable "are you sure?" dialogue in the codebase today, so the delete
       warning needs one built (`src/modals.ts` has toasts and the feedback form, nothing
       else).
     - The average time on `/stats` needs both the reading code and the page that draws it
       (`src/worker/analytics-db.ts`, `src/worker/stats.ts`).
     - The shared type definitions change — the history row and the saved board.
       **Jamie owns types**, so that is named here rather than left to the plan.
129. **M2 — the existing checkbox on the play screen still says "Keep my score in a 🍪
     cookie", with a biscuit icon.** Item 70 dropped the word "cookie"; item 90 only
     rewrote the new one. Both controls change: same words, "Save my scores on this device",
     and the biscuit goes. Otherwise we ship one setting wearing two different labels.
130. **M3 — when does deleting actually happen on the completion panel?** Jamie's rule was
     written for the play screen, where there is a submit to hang it on. There is no submit
     on the completion panel.
     My rec: unticking there warns immediately, and deleting happens when they confirm the
     warning — not on some later action. Ticking it on saves that game straight away. Why:
     an unconfirmed destructive change that fires later is the kind of thing people cannot
     predict, and there is no later action here to fire on.
131. **A player who has just switched saving on has exactly one game of history.** Item 19
     hides the streak and all-time blocks until the third game, so they will see them
     appear two games later.
     My rec: show them the same "your stats start building" line as a new player, worded
     the same. It is the same situation.
132. **M4 — archive replays must send no timing event either.** Item 52 excluded random
     puzzles and item 54 said nothing about archive, but the existing complete event fires
     on all three paths, so archive replays would silently mix into the average time on
     `/stats`. Only today's daily puzzle sends `puzzle_time`.
133. **M5 — the goes chart needs a top bucket, because nothing caps how many goes a player
     can take.** My rec: rows for 1, 2, 3, 4, 5 and "6 or more". Why: the tail is real but
     thin, and a chart that grows a new row for someone's 20-go day is a chart that breaks.
134. **M6 — item 88 was wrong that nothing can show hours.** A game over thirty minutes is
     excluded from the *average* and from *fastest*, but it still shows its own time on the
     panel. My rec: show `1h 04m` above an hour, `3:41` below it.
135. **M7 — the explanatory lines are the whole point of this build, so here they are**
     rather than "with the design":
     - Play streak — "Days in a row you have finished the puzzle."
     - First-go streak — "Days in a row you got it on your first guess."
     - Plays — "Daily puzzles you have finished."
     - First-go wins — "Puzzles you got on your first guess."
     - Average goes — "Your average number of guesses."
     - Average time — "How long you usually take."
     - Fastest first-go win — "Your quickest win on a first guess."
     Streaks also carry, under the pair: "Miss a day and the streak starts again."
136. **M8 — item 115's "done" list left out three things we agreed.** Done also requires the
     goes chart (item 18), the explanatory lines (item 135), and whatever we decide about
     the share buttons at item 137.
137. **M9 — the two share buttons would be drawn but dead, and section 9 says nothing about
     them.** A focusable button that silently does nothing is exactly the trap that section
     exists to catch.
     **Question for Jamie:** leave the buttons out of this build entirely and add them with
     the sharing work?
     My rec: leave them out. Why: the layout work is done either way, and a button that
     does nothing is worse than no button — people tap it, nothing happens, and they assume
     the site is broken. The alternative, drawing them disabled, means shipping a permanent
     "coming soon" on our best screen.
138. **M10 — does a player with saving switched off still send the anonymous timing number?**
     Item 63 says the timing event is the only thing that leaves the device; item 65 says we
     save nothing. The two have never been reconciled, and a reasonable person could go
     either way.
     My rec: send nothing. Why: "save nothing" is a promise people will read broadly, and
     the event is tied to an anonymous id we keep on their machine. The cost is that our
     average time is measured over opted-in players only, which is nearly everyone.
     **Question for Jamie.**

### What is still open after these fixes

- **Section 4** — Dave's sign-off. Blocking. (item 127)
- **Section 9** — Jamie, does finishing a puzzle announce the result? (item 126)
- **Section 7 and 9** — Jamie, share buttons in or out of this build? (item 137)
- **Sections 5 and 10** — Jamie, does an opted-out player send the timing number? (item 138)

Everything else the review raised is answered above and needs no further decision.
