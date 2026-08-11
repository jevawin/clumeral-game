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
| 3. How it works | Asked 2026-08-11 — awaiting Jamie on item 12 |
| 4. Maths | Not applicable — nothing here touches puzzle generation or filtering |
| 5. State & persistence | Not yet asked |
| 6. How it fits | Not yet asked |
| 7. How it looks | Not yet asked |
| 8. Copy & wording | Not yet asked |
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
