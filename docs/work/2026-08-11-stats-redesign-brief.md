# Brief — player stats panel: the redesign

Date: 2026-08-11 · Branch: `dev/stats-tweaks` (see item 7) · Author: Claude (clumeral dev bot)

The redesign that [`2026-08-11-stats-tweaks-brief.md`](2026-08-11-stats-tweaks-brief.md)
item 8 deliberately pushed out of the fixes branch. That brief's items 14–17 — what Dave
raised, what Jamie raised, the examples, and the diagnosis — are the starting material and
are **not repeated here**. Read them alongside this.

Numbering starts fresh at 1 and is append-only.

Status: **CLOSED, 2026-08-12. Ready for Plan.** Every section settled and acked. Jamie
signed off accessibility and the brief as a whole; `da-brief` ran and every Medium-and-above
finding is answered in items 74–84. One thing is parked rather than agreed: Dave's objection
to repeated numbers (items 71 and 73), to be tested against the preview.

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
| 1. What it is | Settled: Jamie 2026-08-11 · Ack: Dave 2026-08-11 |
| 2. Out of scope | Settled: Jamie 2026-08-11 · item 6 superseded by item 84 · Ack: Dave 2026-08-11 |
| 3. How it works | Settled: Jamie 2026-08-11 (item 13) · Ack: Dave 2026-08-11 |
| 4. Maths | Settled: Dave 2026-08-11 (item 28 — cut-off dropped) · Ack: n/a, owned section |
| 5. State & persistence | Settled 2026-08-11 · Ack: Dave 2026-08-11 · Jamie 2026-08-11 |
| 6. How it fits | Settled 2026-08-11 · Ack: Dave 2026-08-11 · Jamie 2026-08-11 |
| 7. How it looks | Settled: Jamie 2026-08-11 (items 66–72) · Ack: Dave, relayed by Jamie 2026-08-12 (item 85) · Override on item 71 (item 73) |
| 8. Copy & wording | Settled: Jamie 2026-08-11 (items 66–68, 71) · Ack: Dave, relayed by Jamie 2026-08-12 (item 85) |
| 9. Accessibility | Signed off: Jamie 2026-08-11 ("approved") · Ack: n/a, owned section |
| 10. Analytics | Settled 2026-08-11 — none (items 55–57) · Ack: Dave 2026-08-11 · Jamie 2026-08-11 |
| 11. Done / test plan | Settled 2026-08-11 (items 58–64, light QA) · Ack: Dave 2026-08-11 · Jamie 2026-08-11 |

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

45. **Item 44 SETTLED: Dave 2026-08-11 — "drop them".** No explanatory lines inside the
    boxes and no shared line under them. The all-time rows keep their notes and carry the
    explaining. **Jamie's ack wanted**, since the spacing of those very lines was one of
    the three faults he reported and had fixed on this branch — this removes them instead.

## 7 and 8 reopened — Jamie's tweaks, 2026-08-11

65. **Item 38 ACKED: Jamie 2026-08-11** — "yes replace solved in x with the two icon and
    text sections". Section 7 is closed.

66. **Headings change. Jamie 2026-08-11.** "This game" becomes **"Today"**. "Stats" becomes
    **"Best"**. This supersedes item 40, including the small worry recorded there — "Best"
    says what the block is for, which "Stats" did not.

67. **A fourth block: "Average". Jamie 2026-08-11.** Below the Best block, styled the same,
    **two boxes**: average time and average goes.
    Note that *average goes* is a figure the All-time list already carries, so it now
    appears twice. Consistent with item 13's decision to accept that for average time.

68. **Shorter labels throughout. Jamie 2026-08-11**, from his column sketch:

        ⏱️ Time        🧮 1-go        🕹️ Plays
        1m 38s         7              6
        Best           Best           Best
        2m 23s         6              6
        Avg.           Current        Current

    So: **"1-go"** not "First-go"; **"Best"** alone, not "Best time" or "Best streak";
    **"Current"**; **"Avg."** abbreviated. This supersedes items 41 and 42.

69. **Three columns fit. That was never the concern.** Jamie asked whether three across is
    the problem and pointed at Strava. It is not — three columns are fine.
    The arithmetic, at the narrowest phone we support (320px): 16px page padding each side
    and two 8px gaps leaves about 90px per box, roughly 74px of it usable inside the box's
    own padding. "Current" at 14px is about 49px wide. An icon plus "Plays" is about 58px.
    "1m 38s" bold at 18–20px is 60–66px. All inside 74px, with the tightest being the time
    figure rather than any label. So **yes, 14px works** for the small labels.
    What does *not* fit is what item 44 was actually about: a full sentence like "Days in a
    row you have finished the puzzle" inside a 74px column wraps to six or seven lines and
    makes the three boxes wildly different heights. Short labels are fine; sentences are
    not. Dave dropped the sentences (item 45) and Jamie's sketch has none, so **item 45
    stands** and the two of you agree.
    Safety net kept: below the width where the numbers would start to wrap, the row falls
    to one column, exactly as the two streak columns do today.

70. **The question this raises: "Avg." now appears in two places.** Jamie's column sketch
    keeps `2m 23s / Avg.` inside the Time box, and item 67 adds an Average block with an
    average-time box in it. Both cannot be right.
    My rec: **take "Avg." out of the Time box.** The Time box then shows best time alone,
    and every average lives in the Average block. Why: it makes "Best" honestly mean best,
    and it stops the same number appearing twice a few centimetres apart — the exact thing
    Dave objected to earlier tonight and the reason we dropped the "Solved in…" sentence.
    The cost: the Time box has one figure where the other two have two, so the row is a
    little ragged. I think that is right rather than wrong — a streak has a "current" and a
    time does not.
    The alternative: keep "Avg." in the Time box and make the Average block hold **average
    goes only**, as a single box rather than two. That keeps the three boxes even, at the
    price of a lopsided Average block.

71. **Item 70 SETTLED: Jamie 2026-08-11 — "Current", and accept the repeat.** The Time box
    reads `best time / Best` over `today's time / Current`. The Average block stays as item
    67 describes it, with both averages in it. So the three Best boxes are even, and
    today's time appears twice: once under "Today" and once as "Current".
    Jamie's reasoning, recorded: "It'll be a repeat of above, that's fine. Otherwise it'll
    be lopsided and will be more noticeable."
    **Dave's ack is wanted here specifically**, because it cuts against what he said
    earlier the same evening — "I don't see a benefit in repeating numbers close together"
    (item 38). Both views are on the record and they point different ways. UI is joint, so
    if Dave still disagrees, Jamie's is the deciding vote as dev lead — but not before Dave
    has had the chance to say so.

72. **The Average block's two boxes take the matching icons** — the stopwatch for average
    time, the calculator-with-tick for average goes — and the same box styling, two across
    rather than three. Labels: "Avg." under each, matching item 68's shortening. (assumed)

73. **Item 71 CLOSED BY OVERRIDE, not by ack. Jamie 2026-08-11:** "let Dave challenge
    repeats when there's a version live to see." So Dave's earlier objection to repeated
    numbers stands unresolved on purpose, and gets tested against the preview rather than
    against a description. If it still grates when he can see it, it reopens then.
    Recorded as **Override: Jamie 2026-08-11**, deliberately not as Dave's agreement.

## 9. Accessibility

Jamie signs this section off and his sign-off blocks. Written 2026-08-11.

46. **Every number keeps its label attached in the markup.** The boxes stay description
    lists: the label is a `dt`, the figure a `dd`, so a screen reader says "Best time, 1m
    20s" rather than reading a loose number. That is how the panel works today and the
    redesign must not lose it. (assumed — carried from the original build, brief 97)

47. **The two "This game" figures get short spoken labels.** On screen they are an icon and
    `1 go`. Spoken, the icon says nothing, so each figure carries a visually hidden word —
    "Goes" and "Time" — and reads as "Goes, 1 go" and "Time, 2m 38s".
    Why this matters more than it used to: item 38 removes the "Solved in 1 go, 2m 38s"
    sentence from the screen. Someone returning to `/solved` later, or moving through the
    page rather than hearing the one announcement, would otherwise meet two bare figures.

48. **The announcement on solving is unchanged** and still speaks the full sentence, goes
    and time and streak together. It is built separately from the visible markup, so item
    38 does not touch it. (assumed)

49. **Icons are `aria-hidden` and decorative.** Each sits beside text that already names it;
    announcing them would add noise and no information. (item 34)

50. **Colour is never the only signal.** Best and current differ by hue, but each also has
    its own word underneath, so the pairing survives colour blindness and greyscale
    entirely. (WCAG 1.4.1)

51. **Contrast is safe by construction, and there is a test.** All four theme hues share one
    accent lightness precisely so none can fail AA, so using a second hue as a figure colour
    cannot break contrast. `tests/palette-contrast.spec.ts` already pins that.

52. **Heading order stays sane.** The three block headings remain `h3`. Each box title
    becomes an `h4` inside its section, so the boxes are reachable as structure rather than
    being three unlabelled groups of numbers.

53. **Text sizes are relative, not fixed.** The size ladder in item 29 is built in `rem`, so
    a player with a larger browser text size gets the whole ladder scaled rather than a
    broken layout. The three boxes drop to one column when they no longer fit, the way the
    two streak columns already do at 22rem.

54. **The question for §9, Jamie:** anything you want adding, and are you happy that the
    hidden "Goes"/"Time" labels in item 47 are enough to replace the sentence item 38
    removes?

## 10. Analytics

55. **No new events, and no changed events.** This is a presentational change; every figure
    on it is computed on the device from history that is already there. (assumed)

56. **Dropping the thirty-minute rule changes no analytics either.** I checked: the
    `puzzle_time` event's four conditions are random, archive replay, saving opted out, and
    a valid value — `OUTLIER_SECONDS` is not among them. So the server-side average is
    unaffected by item 28; only the figures on the player's own device change.

57. **Nothing about the redesign is worth tracking.** We would learn nothing actionable from
    "the stats panel rendered", and it fires on every solve, so it is pure noise in a
    dataset we are actively trying to keep small. (assumed)

## 11. Done / test plan

58. **Unit tests, on the counting.** Best time over a mixed history, including a game over
    thirty minutes now counted rather than excluded; average time likewise; and a test that
    pins `OUTLIER_SECONDS` is gone rather than merely unused.

59. **Unit tests, on the markup.** Each box renders its title, its icon, both figures and
    both labels; the icons are `aria-hidden`; the "This game" figures carry their hidden
    labels; the "Solved in…" sentence is absent from the panel but still present in the
    announcement.

60. **A theme test on the second colour.** For each of the four themes, the best figure gets
    the next hue along and Grape wraps to Lime.

61. **The dark-mode rule stays pinned.** The container-level colour rule from the fixes
    branch keeps its test, so the fault that started all this cannot come back through a
    redesign.

62. **End-to-end: the existing smoke test, plus one new check** that the three boxes appear
    on a seeded history and do not appear before the third game. Chromium on staging, the
    full set on main — the arrangement Jamie described on 2026-08-11.

63. **Looked at by eye, on a phone, both modes, all four themes**, via the preview URL with
    `?demo=stats`. That is what the seeded history was built for.

64. **The QA level: light.** No worker change, no storage change, no routing change, and one
    new counting rule with unit tests behind it. A full Playwright battering would cost
    forty minutes to re-prove things this change cannot reach. (assumed — the proportional
    QA rule in `CLAUDE.md`)

## The `da-brief` review — 2026-08-12

A fresh-context devil's-advocate pass on this brief returned 2 High, 8 Medium and 9 Low
findings. Every Medium and above is answered below. Where a finding needs a person rather
than a decision from me, it says so and names them.

74. **HIGH 1 — Dave's ack predates the design it is claimed to cover. UPHELD, and it needs
    Dave.** The review checked the commits: Dave's "happy" (`89e351c`) lands *before* items
    66–68 (`35a620d`) and items 70–71 (`491fb5f`). So the headings, the fourth block, every
    label and the Time box's "Current" are all closed on a joint section with one
    signature. Item 73's override covers item 71 only.
    Not something I can fix by writing. **Dave needs to see the final shape and say yes or
    no**, and until he does §7 and §8 are settled but not acked.

75. **HIGH 2 — the second accent colour must be CSS, not a value computed at render.
    UPHELD, and item 17 is wrong.** The review is right: accent colour resolves entirely in
    CSS today (`colours.ts` sets `data-theme`, `tailwind.css` maps it to `--accent-h` and
    `--accent-c`), and chroma differs **per theme and per mode**. Computing the next hue in
    JS would need a light/dark branch, and `palette.ts` warns that using the wrong mode's
    chroma puts Cherry out of gamut. Worse, the panel renders once — a player who changes
    theme or flips to dark mode while sitting on `/solved` would get the theme colour
    updating and the "best" colour frozen.
    **The fix: add `--accent-best-h` and `--accent-best-c` alongside the existing pair in
    each `html[data-theme=…]` block**, light and dark, taken from the same table in
    `palette.ts`. The best figure then uses `--accent-best-*` exactly as everything else
    uses `--accent-*`, and a theme or mode change moves both together with no re-render.
    Item 17 is superseded: nothing is derived at render at all.
    The behaviour this settles, which should have been a question in §5: **yes, the best
    figure's colour follows a theme change made while the completion screen is open.**

76. **MEDIUM 3 — the panel has six modes and the brief covered three. UPHELD.** `panelMode`
    returns `random | archive | marker | saving-off | new | full`. Adding the two missing:
    - **`marker`** (played, not recorded — `tries` is null): item 38 deletes the sentence,
      which in this mode was the whole of the block. So "Today" would render a heading, a
      rule and nothing. **Decision: in `marker` mode the Today block keeps the plain word
      `Solved!` and shows no icon figures.** There is nothing to put in them.
    - **`saving-off`**: it returns before the reveal check, so those players never see the
      boxes however long they have played. Item 9 described only half the gate. **No
      change in behaviour — the boxes stay hidden for a player who has saving off** — but
      it is now written down rather than implied.
    - `RANDOM_LINE` and `NEW_PLAYER_LINE` keep their present position, directly under the
      Today block's figures.

77. **MEDIUM 4 — the fit arithmetic used the wrong padding, and the breakpoint contradicts
    it. UPHELD; item 69's numbers are corrected here.** The completion container is
    `max-w-[390px] … px-6` (index.html:345), so 24px each side, not 16px.
    - At a 390px viewport or wider the content is capped at 342px, giving 109px per box.
      Comfortable.
    - At 320px — the narrowest phone we support — it is 272px, giving 85px per box and
      about 69px usable inside the box padding. "1m 38s" bold at 18px is about 59px and
      fits; **"12h 05m" is about 69px and does not**, and hour-long times are now more
      likely, not less, because item 28 stopped excluding them.
    - Item 53's kept breakpoint made the whole argument moot anyway: `.stat-streaks` falls
      to one column at 22rem, which is 352px, so at 320px the row was never three across.
    **Decision: three across from 360px up; one column below it.** Real phones at 375px and
    above — which is nearly all of them — get Jamie's Strava layout. The 320px class of
    device gets a single column rather than a squeezed one. The figures also get a `clamp()`
    so they step down slightly in the tight band instead of wrapping.

78. **MEDIUM 5 — the shortened labels break the promise in item 46. UPHELD.** With item 68
    the panel has "Best / Current" three times over and "Avg." twice, and a screen reader
    walking the description lists hears the same two words repeated with the box title
    outside the list.
    **The fix: the `dt` carries the full words and the screen shows the short ones.** The
    markup reads "Best time", "Best 1-go streak", "Best play streak", "Average time",
    "Average goes"; the visible text is trimmed with a span, not by shortening the label
    itself. Nothing changes on screen and the promise in item 46 holds.
    Also from this finding: item 52 said three `h3` headings and there are now four. The
    Average block gets an `h3` and a rule like the rest.

79. **MEDIUM 6 — item 19's stated reason for inline SVG is false. UPHELD.**
    `public/sprites.svg` already exists with 28 symbols on `currentColor`, and
    `completion.ts` already uses it three times. So "they must take the theme colour" does
    not choose between the options.
    **Decision: put the three new icons in the existing sprite sheet.** One icon mechanism
    in this file rather than two, and they come down in a separately cached request instead
    of as bytes in the JS bundle. Item 19 is superseded.

80. **MEDIUM 7 and 8 — the panel now says several things twice, and only a person can
    decide what comes out. THIS ONE NEEDS JAMIE AND DAVE.** Two duplications, both created
    by decisions taken after item 6 froze the All-time list:
    - **"Fastest first-go win" against the new best time.** Best-of-any-goes is by
      definition equal to or faster than fastest-first-go, so two similarly named times
      will usually disagree, a short scroll apart, with nothing explaining why.
    - **The Average block against the All-time rows.** "Average time" and "Average goes"
      now each appear twice on one screen.
    My rec: **take those three rows out of All time** — average time, average goes and
    fastest first-go win — leaving All time as plays, first-go wins and the chart. Why: the
    new blocks say the same things better and higher up, and Dave's original complaint was
    that the screen is long. This shortens it by three rows without losing a single figure.
    The counter: item 6 was Jamie's explicit "All time is fine as it is now", and that was
    said before the Average block existed.

81. **MEDIUM 9 — item 31 left several figures with no colour. UPHELD.** The rule now covers
    every number on the panel: **the "best" figures take the second accent; everything else
    takes the player's own theme colour** — the Today figures, the "Current" figures and
    both "Avg." figures. One exception, one rule, nothing unstated.

82. **MEDIUM 10 — item 45 was closed by inference. PARTLY UPHELD.** The review is right that
    no explicit ack exists and that item 45 asked for one. I disagree that it is unresolved:
    Jamie's "Approved" on 2026-08-11 came after he had seen item 45 written up and had
    himself asked whether shorter words would let the lines fit, which item 69 answered.
    Recorded as **covered by Jamie's sign-off of the brief as a whole**, not as a separate
    ack — and flagged here so it is visible rather than buried.

83. **The Lows, answered.**
    - **11** — right, the best-time test cannot fail; the average-time test is the one that
      discriminates. Item 58 is corrected to say so.
    - **12** — right about `buildAnnouncement`; item 59 should assert the announcement is
      unchanged, not that it contains a sentence it never contained. `heroLine` keeps its
      `Solved!` branch for `marker` mode (item 76) and loses the rest, and the forged-history
      test stays.
    - **13** — right, `.stat-block__head h3` is uppercase today. **All-caps stays on the
      block headings**, which is what items 6 and 43 preserve; item 30's "no all-caps"
      applies to the labels inside the boxes, which is what Jamie was talking about.
    - **14** — right, `.digit-box` carries no shadow. **The boxes take the border, surface
      and rounding, and the `--shadow-box` token as a utility with its dark variant**, the
      way the digit boxes do at their usage sites.
    - **15** — right. `types.ts`, `play-timer.ts` and `demo-history.ts` all mention the
      thirty-minute rule and go stale; the demo seed's 2210-second row keeps its comment
      corrected rather than the row removed, since it still exercises an hour-plus format.
      Added to item 18.
    - **16** — right, "Current" can be a dash when today's row has no time. It shows "—",
      matching the All-time rows' existing behaviour rather than vanishing.
    - **17** — fair. The block is titled "Best" and holds a current figure in every box.
      Left as Jamie chose it; noted for him rather than reopened.
    - **18** — right that item 8 is ambiguous. **Dave's alternative branches off `staging`**,
      so the two designs are compared against the same base rather than one inheriting the
      other.
    - **19** — the QA level. My view: **light still stands.** The diff is bigger but it is
      markup, CSS and one counting rule, with no server, storage or routing change; unit
      tests cover the counting and the markup, and item 63's eyeball on the preview covers
      the look. Flagged for Jamie rather than changed on my own.

84. **Item 80 SETTLED: Jamie 2026-08-12 — "lose them from all time".** Three rows come out
    of the All-time list: **average time, average goes and fastest first-go win**. All time
    keeps plays, first-go wins and the goes chart.
    This **supersedes item 6** ("All time is fine as it is now"), which was said before the
    Average block existed. No figure is lost from the panel — each of the three now lives
    higher up, in the Best or Average block — and the screen gets three rows shorter, which
    was Dave's original complaint.
    Consequence for §11: `computePlayerStats` keeps computing `fastestFirstGoSeconds` only
    if something still uses it. Nothing will, so it goes too, along with its test — the
    plan should delete it rather than leave a dead figure behind.

85. **Item 74 CLOSED. Jamie 2026-08-12: "Dave knows and approves those changes."** So items
    66–72 — the "Today" and "Best" headings, the Average block, the shorter labels and the
    Average block's icons — carry Dave's agreement, relayed by Jamie rather than said by
    Dave here. Recorded that way deliberately, so a later reader can see which it was.
    Item 73's override on item 71 still stands as an override: Dave's objection to repeated
    numbers is parked until he can see the preview, not withdrawn.

**The brief is CLOSED, 2026-08-12.** Every section settled, every joint section acked,
`da-brief` run and answered. Next stage: Plan, from this file.
