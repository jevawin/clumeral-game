# Brief — player stats panel: the redesign

Date: 2026-08-11 · Branch: `dev/stats-tweaks` (see item 7) · Author: Claude (clumeral dev bot)

The redesign that [`2026-08-11-stats-tweaks-brief.md`](2026-08-11-stats-tweaks-brief.md)
item 8 deliberately pushed out of the fixes branch. That brief's items 14–17 — what Dave
raised, what Jamie raised, the examples, and the diagnosis — are the starting material and
are **not repeated here**. Read them alongside this.

Numbering starts fresh at 1 and is append-only.

Status: **OPEN.** Section 1 asked.

## The source drawing

Jamie sent a hand-drawn wireframe on 2026-08-11. It is the design direction and it is what
this brief is written against. Reading it top to bottom:

- **This game** — heading with a rule beside it, then two figures side by side, each with an
  icon: a calculator with a tick in its screen for `1 GO`, a stopwatch for `2m 38s`.
- **Stats** — heading with a rule, then **three bordered boxes across**:
  - **Time** — stopwatch icon. `1m 38s` / "Best time", then `2m 38s` / "Current".
  - **First-go** — calculator-with-tick icon. `7` / "Best streak", then `4` / "Current".
  - **Plays** — game-controller icon. `8` / "Best streak", then `5` / "Current".
  - In each box the number sits **above** its label. The upper pair is the best, the lower
    pair is the current.
- **All time** — heading with a rule, then the existing rows unchanged: `Plays 71` with
  "Total completed puzzles" under it, `First-goes 37 (48%)` with "Puzzles solved in 1", and
  a squiggle standing for the remaining rows as they are today.
- **How many goes you take** — the existing distribution chart, 1 to 6+, unchanged.

## Ledger

| Section | State |
|---|---|
| 1. What it is | Settled: Jamie 2026-08-11 (items 1–3 accepted, "park for now, build this") · Ack: Dave pending |
| 2. Out of scope | Settled: Jamie 2026-08-11 (items 4–6 parked) · Ack: Dave pending |
| 3. How it works | Settled: Jamie 2026-08-11 (item 12 decided as item 13) · Ack: Dave pending |
| 4. Maths | Settled: Dave 2026-08-11 (item 28 — cut-off dropped) · Ack: n/a, owned section |
| 5. State & persistence | Asked 2026-08-11 — no decision in it |
| 6. How it fits | Asked 2026-08-11 — no decision in it |
| 7. How it looks | Settled: Dave 2026-08-11 (item 38) · Ack: Jamie pending on item 38 |
| 8. Copy & wording | Asked 2026-08-11 — awaiting a word on item 44 |
| 9. Accessibility | Not yet asked |
| 10. Analytics | Not yet asked |
| 11. Done / test plan | Not yet asked |

## 1. What it is

1. **The problem.** The panel reads as a flat list. Nothing on it is louder than anything
   else, so there is no order to read it in and no single thing that lands. That is the
   diagnosis already written down as item 17 of the tweaks brief, and Jamie's drawing is a
   direct answer to it: a clear size ladder, three bordered boxes that group the recurring
   numbers, and icons so each block is recognisable before it is read.

2. **What changes, in one sentence.** The figures stay almost entirely as they are; the
   **layout, the sizes, the colours and the icons** change, and the middle block grows from
   two streak columns into three boxes by taking on time. (assumed — from the drawing)

3. **Who it is for and why now.** The same players. Now, because the panel is on staging,
   both of you have looked at it, and there is a drawing to build to rather than a
   conversation to guess from. (assumed)

## 2. Out of scope

4. **The `6+` tail stays as it is.** Dave raised that a 20-go day has nowhere to go. The
   drawing keeps the chart 1 to 6+ and unchanged. (assumed — from the drawing)
   My rec: leave it. Why: the tail is a counting decision, not a layout one, and folding it
   into a visual pass makes both harder to review.

5. **The length of the screen is not being cut.** Dave raised that it is long. The drawing
   keeps every existing figure and adds one box, so it gets slightly longer, not shorter.
   (assumed — from the drawing)
   My rec: accept that, and treat the size ladder as the fix. Why: what made it feel long
   was that everything competed; a clear hierarchy makes a long screen scannable. Tabs or a
   "show more" would be the alternative and neither is in the drawing.

6. **All-time rows and the chart keep their current content and styling.** Jamie: "All time
   is fine as it is now, so is the distribution chart at the bottom."

## 3. How it works

7. **Which branch this is built on. SETTLED: Jamie 2026-08-11 — into PR #311.** My
   recommendation was a fresh branch off `staging` so the dark-mode fix could merge ahead of
   a larger review. Jamie overruled it: "park for now, build this into the pr." So the
   redesign lands on `dev/stats-tweaks` and PR #311 grows to carry both.
   The cost, recorded rather than argued: the dark-mode fix now waits for the redesign
   review, and `da-build` runs once over a much bigger diff.

8. **Dave's design gets a second branch. SETTLED: Jamie 2026-08-11.** Dave has mocked up an
   alternative and will send it. When he does, it is built on its own branch off the same
   base, so the two previews can be opened side by side and compared. Jamie expects the end
   result to merge ideas from both, so neither branch is a winner-takes-all.
   Consequence to plan for: whatever this branch builds should be **structured so a second
   layout can replace it without rewriting the numbers** — the computed figures are the same
   in both designs, only the presentation differs.

9. **When the three boxes appear.** With the streaks block today: from the third countable
   game, the same reveal gate. Before that, the panel is the hero line only. (assumed — the
   drawing shows the full state and nothing suggests changing the gate)

10. **Archive replays and random puzzles are unchanged.** They keep the minimal panel with
    no boxes and no timing. (assumed — settled in the original build, brief 54)

11. **The play-streak and first-go-streak boxes carry exactly the figures the two streak
    columns carry today** — current and best of each. No new counting. (assumed — from the
    drawing)

12. **The Time box is the one genuinely new thing, and its two figures need naming.** The
    drawing shows "Best time" over "Current". The panel today has no such pair: it has
    *Average time* and *Fastest first-go win*, both under All time.
    My rec: **best time = the fastest solve of any kind**, not first-go only; **current =
    this game's time**. Why: the other two boxes read "your record" over "where you are
    now", and this keeps that rhythm. Restricting best to first-go wins would make the two
    numbers incomparable — a best you can only beat on a one-go day.
    The honest cost: "current" then repeats the stopwatch figure at the top of the screen,
    so the same number appears twice within a screen's height.
    The alternative, if that repetition grates: make the lower figure **average time**
    instead, which is a genuinely different number and is already computed — but it breaks
    the "current" label the other two boxes share.
    Also note: *Fastest first-go win* and *Average time* would then both still sit in the
    All-time list, which Jamie has said stays as it is. So one of those numbers is shown
    twice whichever way this goes.

13. **Item 12 SETTLED: Jamie 2026-08-11 — best time over average.** The Time box reads:

        1m 20s
        Best time
        2m 25s
        Average

    Jamie: "Do average in the box so it doesn't repeat at the top." So this game's time
    appears once, in the hero line, and the box carries two all-time figures.
    Two consequences, recorded rather than re-asked:
    - The lower label is **"Average"**, not "Current". The three boxes therefore no longer
      share a second label. That is fine because each label is explicit, but it does mean
      the Time box is a record-and-average pair while the other two are record-and-current.
    - **Average time now appears twice on the screen** — in this box and in the All-time
      list, which stays as it is. Deliberate, and the cheaper of the two repeats: a
      duplicated all-time figure two screens apart is less jarring than the same number
      twice within one screen's height.

14. **What "best time" counts.** My rec: the fastest solve of **any** number of goes, using
    the same exclusions the existing time figures use — a game over 30 minutes
    (`OUTLIER_SECONDS`) is shown on its own row but never becomes a fastest or feeds an
    average, and anything over a day is discarded entirely. Why: a new figure that counted
    differently from the two beside it would make the panel internally inconsistent, and
    the 30-minute rule exists because a walked-away-from tab is not a fast solve.
    **Dave — this is the only counting rule in the redesign, and it is yours to confirm.**

## 4. Maths — reopened 2026-08-11

22. **Item 14 is REOPENED.** Jamie and Dave both independently asked why the cut-off is
    thirty minutes. It is my number, carried over from the original stats brief (items 31
    and 134), and on re-examination I do not think it survives the question.

23. **What the cut-off actually does today.** `OUTLIER_SECONDS = 1800`. A game above it
    still **shows its own time**, formatted with hours — nothing is hidden. It is left out
    of *average time* and out of *fastest first-go win* only.

24. **The fact that changes the argument: idle time is already discarded.** The play timer
    is an accumulator, not a wall clock. Two minutes with no interaction and the whole gap
    is thrown away (`IDLE_TIMEOUT_MS`, brief 34/50). So a game that took an hour of
    elapsed time may record twelve minutes of counted solving. The walked-away-from-tab
    case — the thing the thirty minutes was defending against — is **already handled
    upstream, and handled better**. Jamie's "people might take longer, I have done" is
    about elapsed time; the stored figure is not elapsed time.

25. **For "best time" the cut-off is a no-op.** Best time is a minimum. A slow game cannot
    lower a minimum, so excluding slow games changes the answer never. The rule only ever
    bore on the average.

26. **My rec: drop the thirty-minute exclusion entirely.** Count every game whose time is
    valid — that is, under the one-day bound in `MAX_STORED_SECONDS`, which stays and is
    doing a different job (catching a forged or corrupt value, not a slow player).
    Why: after the idle rule has run, what is left is real solving, and a genuinely hard
    forty-minute game belongs in your average. An average that quietly drops your hardest
    games is not your average.
    The honest cost: one long game shifts a short history's average visibly — a 40-minute
    game among ten 3-minute ones moves the average from 3m to about 6m 42s. That is a real
    effect, and I think it is the true one rather than a distortion.
    Knock-on if accepted: *fastest first-go win* in the All-time list also stops excluding,
    which is likewise a no-op for the same reason as item 25, and `OUTLIER_SECONDS` is
    deleted rather than left unused.

27. **Dave owns this — it is the counting rule and the only maths in the redesign.**
    Asked 2026-08-11.

28. **Item 26 SETTLED: Dave 2026-08-11 — "yes happy to drop the cut off of 30 minutes".**
    So: `OUTLIER_SECONDS` is deleted. Average time and best time count every game whose
    stored time is valid, and `MAX_STORED_SECONDS` (one day) is the only bound left.
    Section 4 is now closed and signed by its owner, so it needs no separate ack.

## 5. State & persistence

15. **Nothing new is stored, anywhere.** Every figure is recomputed from `dlng_history` on
    each render, exactly as today — no running totals, no new key, no server call.
    (assumed — settled in the original build and unchanged by a visual redesign)

16. **Best time needs no new storage.** History entries already carry `seconds`; the figure
    is a minimum over rows that already exist. It therefore works retrospectively, on
    history saved before this change. (assumed)

17. **The "next theme colour" is derived at render, not stored.** The player's chosen theme
    already persists; the second colour is read off the palette order at the moment the
    panel draws, so changing theme changes both colours together. (assumed)

## 6. How it fits

18. **Modules touched.** `src/completion.ts` for the markup, `src/tailwind.css` for the
    styling, `src/player-stats.ts` for the one new figure, and a new small module holding
    the icons. **No worker or API change**, no routing change, no storage change.
    (assumed)

19. **Icons are inline SVG in a module**, from Lucide, with the calculator-and-tick
    assembled by hand from two Lucide paths since it does not exist as one icon.
    Inline rather than a sprite sheet or an icon font because they must take the theme
    colour via `currentColor` and there are only three of them. (assumed)

20. **The three boxes borrow the play screen's box styling** — same border, same background
    — as Jamie asked, so a theme change moves the whole app together. (assumed)

21. **Built so Dave's alternative can swap in.** The figures come out of
    `computePlayerStats` unchanged; only the builders in `completion.ts` and the styles
    differ between the two designs. That is what makes a later merge of the two a layout
    decision rather than a rewrite. (assumed — follows from item 8)

## 7. How it looks

All of this is Jamie's specification, 2026-08-11, written back so it survives a context
clear. Where an item says "assumed", it is my reading of the drawing rather than something
he said in words.

29. **The size ladder, largest to smallest.** (1) the "This game" icons and figures,
    (2) the box titles and the numbers inside the boxes, (3) the small labels inside the
    boxes, which match the all-time text size. Jamie's words: "Top section (this game) icon
    and text should be largest, then title and numbers in streaks boxes, then text in boxes
    which can be same size as all time stats."

30. **Weight.** Numbers **bold**. The small labels — "Best time", "Best streak", "Average",
    "Current" — regular weight in the ordinary foreground colour. The **box title is the
    same size as the numbers but not bold**, so size carries the grouping and weight
    carries the figure. And **no all-caps** anywhere.

31. **Colour: two accents, not one.** The *current* figure takes the player's own theme
    colour. The *best* figure takes **the next colour along in the picker**.
    The picker order is Lime, Cherry, Blueberry, Grape, and it **wraps** — a player on
    Grape gets Lime for their bests. (assumed — the order is the palette's own; only the
    wrap is my call, and there is nowhere else for the last one to go.)
    Contrast is safe by construction: all four hues share one accent lightness precisely so
    that none of them can fail AA, so borrowing a second one as text colour cannot break
    it. Colour is never the only signal either — every figure has its own word label.

32. **The three boxes borrow the play screen's digit-box styling** — surface background,
    the 1.5px border in the border token, the same rounding and the same soft shadow — so
    the completion screen and the play screen read as the same app under any theme.

33. **Icons: three, all inline SVG.** A **calculator with a tick in its screen** for goes
    and for the first-go streak; a **stopwatch** for time; a **retro game controller** for
    plays. Lucide where one exists, and the calculator-with-tick built by hand out of two
    Lucide paths, since it is not one icon. They inherit the surrounding colour.
    This **supersedes** the flame Jamie floated on 2026-08-11 — the drawing replaced it.

34. **Icons are decorative and are hidden from screen readers.** Every one sits beside text
    that already says what it is, so announcing them would only add noise. (assumed —
    §9 will confirm)

35. **"This game" becomes two figures side by side, not a sentence.** The drawing shows a
    calculator icon with `1 GO` and a stopwatch with `2m 38s`, not "Solved in 1 go,
    2m 38s". That sentence was itself agreed only on 2026-08-11 after a long back and
    forth about the separator, so this is a real change and is flagged rather than assumed.
    See item 37.

36. **When there is no time, the row shows one figure, not a gap.** Archive replays and
    random puzzles carry no timing, so the stopwatch pair is simply absent and the goes
    figure sits alone. (assumed — follows from item 10)

37. **The question for §7: does the "Solved in 1 go, 2m 38s" line survive, and where?**
    My rec: **keep the sentence and put the two icon figures beneath it.** Why: you two
    settled that wording yesterday and the comma argument was a real one; it is also the
    line that carries the result for someone who cannot see the layout, and it reads as a
    result rather than as a readout. The two icon figures then do the fast-glance job the
    drawing is asking for.
    The alternative, which is what the drawing literally shows: **drop the sentence** and
    let the two icon figures be the whole of "This game". Cleaner and less repetitive — the
    same two numbers are otherwise said twice, a foot apart.
    Either way the spoken announcement keeps the full sentence, so nothing is lost for a
    screen reader.

38. **Item 37 SETTLED: Dave 2026-08-11 — the icons replace the sentence.** Dave: "I prefer
    Jamie's version. I don't see a benefit in repeating numbers close together." That is
    also what Jamie's drawing literally shows, so the two agree. My recommendation is
    dropped.
    So "This game" is: the `Puzzle #123 solved!` heading as today, then two icon figures —
    calculator with `1 go`, stopwatch with `2m 38s`. No `Solved in 1 go, 2m 38s` sentence
    on screen. **Jamie's ack still wanted**, because it was his sentence that yesterday's
    comma discussion produced and he has not said in words that it goes.

39. **The `/play` screen sentence is untouched.** Jamie asked on 2026-08-11 for the play
    screen to read "in 1 go" with a matching time. That is a different screen and no
    drawing covers it, so it stays exactly as it is. (assumed)

## 8. Copy & wording

40. **Section headings.** "This game" and "All time" keep their words. The middle one
    changes from **"Streaks" to "Stats"**, because it is no longer only streaks — it has
    taken on time. (assumed — from the drawing)
    Small worry, recorded not asked: "Stats" is a slightly odd name for one block on a
    panel that is entirely stats. "Your records" or "Bests" would say more. Not worth a
    round trip; say the word if either of you disagrees.

41. **Box titles: "Time", "First-go", "Plays".** Straight from the drawing.

42. **Labels inside the boxes.** Time: "Best time" then "Average". First-go: "Best streak"
    then "Current". Plays: "Best streak" then "Current". Sentence case, not capitals.
    (settled by items 13 and 30)

43. **All-time rows and the chart keep every word they have today.** (settled by item 6)

44. **The question for §8: the explanatory lines under the streaks.** Today each streak
    carries a plain-English note — "Days in a row you have finished the puzzle", and the
    equivalent for the first-go streak. They exist because "first-go streak" is not
    self-explanatory, and their spacing was one of the three faults fixed on this branch.
    The drawing has **no room for them**: a box holds an icon, a title, two numbers and two
    small labels, and a sentence would break the three-across layout on a phone.
    My rec: **drop them from the boxes and let the all-time rows carry the explaining** —
    those rows keep their notes, and "Puzzles solved in 1" already defines what a first-go
    is a short scroll below.
    The alternative: **one line under the row of three boxes**, the way the streak pair
    already has a shared note today — something like "Streaks count days in a row; they
    reset if you miss a day." One sentence for all three rather than three.
    The cost of dropping them entirely is that a new player meets "First-go — best streak
    7" with nothing telling them what a first-go streak is until they scroll.
