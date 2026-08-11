# Brief — player stats: fixes and design tweaks

Date: 2026-08-11 · Branch: `dev/stats-tweaks` · Author: Claude (clumeral dev bot)

Follows the player-stats build merged to staging on 2026-08-11 (PR #310). Source of truth
for what was already agreed: [`2026-08-10-player-stats-brief.md`](2026-08-10-player-stats-brief.md)
and its plan. Numbering here starts fresh at 1 and is append-only.

Status: **OPEN.** Section 1 asked 2026-08-11.

## Ledger

| Section | State |
|---|---|
| 1. What it is | Asked 2026-08-11 |
| 2. Out of scope | Not yet asked |
| 3. How it works | Not yet asked |
| 4. Maths | Not applicable — nothing here touches puzzle generation or filtering |
| 5. State & persistence | Not yet asked |
| 6. How it fits | Not yet asked |
| 7. How it looks | Not yet asked |
| 8. Copy & wording | Not yet asked |
| 9. Accessibility | Not yet asked |
| 10. Analytics | Not yet asked |
| 11. Done / test plan | Not yet asked |

## 1. What it is

1. **The problem.** The panel shipped to staging on 2026-08-11 and both of you found faults
   within the hour. They fall into two piles, and the piles want different treatment:
   **three concrete defects** with obvious right answers, and **a design direction** that is
   not settled and that Jamie has said he wants to think about. (assumed — from the chat,
   2026-08-11)

2. **The three concrete ones.**
   - The Streaks block's labels — "Play streak", "First-go streak" — render **black in dark
     mode**, so they are invisible. Diagnosed: `.stat-row dt` carries a colour and
     `.stat-streak dt` does not, and nothing up the tree sets one, so those two labels fall
     through to the browser's default black. Jamie 2026-08-11, Dave confirmed.
   - The explanatory lines **run into the text above and below**. "Days in a row you have
     finished the puzzle." has 0.25rem above it and nothing below, so three different kinds
     of line sit at the same rhythm. Jamie 2026-08-11.
   - Neither of you can see the **full panel**, because streaks and all-time need three
     daily games and there is no way to fast-forward that. Jamie asked for a pre-filled
     history on this branch. Dave 2026-08-11: "we'll need to wait three days".

3. **The design pile, recorded now and decided later.** Dave: the streaks block looks
   untidy, the best numbers lack emphasis, only some of the panel is in the theme colour,
   the goes chart stops at 6+ and a 20-go day has nowhere to go, and the screen is long.
   Jamie: it needs icons for faster pattern recognition — a flame for streaks, a variation
   to tell plays from the first-go streak — and "it's all a big ol' list", not "LOOK HERE".
   Jamie has said he will think about the design himself.

4. **Who it is for.** The same players as the original build, and — for the pre-filled
   history — Jamie and Dave, so that iterating on the design does not cost three days per
   round. (assumed)

5. **Why now.** It is on staging, the dark-mode fault makes two labels unreadable for
   anyone in dark mode, and the design conversation is live. (assumed)

6. **Should this be one piece of work or two?**
   **My rec: two.** Ship the three fixes above as a small branch this afternoon, and open a
   separate brief for the redesign once Jamie has had his think.
   Why: the dark-mode fault is a live accessibility bug on staging and should not wait
   behind a design conversation that has no agreed shape yet. The fixes are small, provable
   and independent. And a redesign brief written before Jamie has decided what he wants
   would be me guessing at his layout, which is the worst of both.
   The counter-argument, honestly: two branches is two rounds of review, and the spacing fix
   is arguably part of the redesign, so it might get done twice.

7. **The root cause of the dark-mode fault is worth fixing properly, not patching.**
   My rec: set the text colour **once on the panel container** so everything inherits it,
   rather than colouring elements one at a time. Why: the bug happened precisely because I
   coloured seven things individually and missed the eighth. Patching just `.stat-streak dt`
   leaves the next new element with the same trap. (assumed — a mechanism, but it changes
   whether this class of fault can recur)
