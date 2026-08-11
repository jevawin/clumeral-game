# Brief — player stats: fixes and design tweaks

Date: 2026-08-11 · Branch: `dev/stats-tweaks` · Author: Claude (clumeral dev bot)

Follows the player-stats build merged to staging on 2026-08-11 (PR #310). Source of truth
for what was already agreed: [`2026-08-10-player-stats-brief.md`](2026-08-10-player-stats-brief.md)
and its plan. Numbering here starts fresh at 1 and is append-only.

Status: **OPEN — short form.** The three fixes are built and in a pull request into
staging. The redesign gets its own brief once Jamie has had his think.

## Ledger

| Section | State |
|---|---|
| 1. What it is | Settled: Jamie 2026-08-11 (split agreed by asking for the fixes PR) · Ack: Dave pending |
| 2. Out of scope | Settled by item 8 · Ack: Dave pending |
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

## Settled, 2026-08-11

8. **Item 6 SETTLED: Jamie 2026-08-11**, by asking for the fixes PR with the pre-filled
   history rather than a full brief. So this is a **short form** brief: the three fixes
   only. The redesign — icons, emphasis, the 6+ tail, the length of the screen — is
   explicitly **out of scope here** and gets its own brief when Jamie is ready.

9. **Item 7 accepted and built.** The panel container sets its text colour once and
   everything inherits it, rather than eight elements each carrying their own. A test pins
   that the container rule exists and uses the token rather than a hex, because the rule is
   what makes the class of fault impossible rather than the one instance fixed.

10. **The spacing fix, concretely.** The explanatory line had 0.25rem above it and nothing
    below, so the label, the number and the explanation all sat at the same rhythm. Now:
    0.375rem above the line and none below, the row's own padding raised from 0.375rem to
    0.625rem, and the line's leading opened from 1.35 to 1.45. The effect is that the
    explanation reads as belonging to the stat above it and as clearly separate from the
    next one.

11. **The pre-filled history is a query parameter, not a console command.** Both of you test
    on a phone, where there is no console.
    - `<preview-url>/solved?demo=stats` — fills a rich history and shows the full panel
    - `<preview-url>/play?demo=clear` — puts it back to nothing
    It **cannot run on clumeral.com**: the gate is the hostname, the same one
    `/api/dev/answer` already uses, and a test asserts it. The parameter is stripped from
    the URL afterwards, so a reload does not reseed.

12. **The seeded history is shaped to exercise the panel, not to be a flat run.** It carries
    a live play streak of 6 with a best of 9 behind it, so current and best visibly differ;
    a first-go streak that is a different number from the play streak; goes in all six chart
    buckets including a 9-go day in the tail; one game over thirty minutes, which shows its
    own time but is excluded from the average and from fastest; one row with no time at all,
    standing in for a pre-launch game; and one archived row, which must change no figure.
    Every one of those is asserted through the real counting rules.

13. **Dave, this needs your ack** on items 8 to 12 — particularly item 8, since it means the
    things you raised (the untidy streaks, the emphasis on the best numbers, the 6+ tail and
    the length of the screen) are deliberately NOT in this branch and are waiting for their
    own brief.

## Parked for the redesign brief — 2026-08-11

Everything below is **not built here**. It is written down so it survives a context clear
and so the redesign brief starts from something rather than from memory.

14. **What Dave raised**, 2026-08-11: the streaks block looks untidy; the best numbers lack
    emphasis; only some of the panel is in the theme colour; the goes chart stops at `6+`
    and a 20-go day has nowhere to go; and the screen is long.

15. **What Jamie raised**, 2026-08-11: it needs icons for faster pattern recognition — a
    flame for streaks, and a variation on it so plays and the first-go streak are
    distinguishable at a glance — and "it's all a big ol' list", not "LOOK HERE". Jamie is
    thinking about the layout himself, so the direction is his to set.

16. **Examples worth looking at, and the one thing each does well** (asked for by Jamie,
    2026-08-11):
    - **Wordle** — four plain numbers, then the guess-distribution chart. The chart is the
      hero and the bit people screenshot; the numbers are deliberately quiet.
    - **Duolingo's streak screen** — the flame IS the screen, with a week strip beneath.
      Exactly the pattern Jamie described.
    - **Apple Fitness** — one graphic you read in half a second; detail only if you scroll.
    - **Strava** — big number, tiny label, and "this week / all time" as tabs rather than
      one long page. That is a direct answer to Dave's "it's quite long".
    - **Chess.com's profile** — the rating chart is the hero and the counts sit in a small
      grid underneath.
    - Browsable: https://dribbble.com/tags/stats_screen and
      https://www.behance.net/search/projects/stats%20ui

17. **The pattern running through all of them, and the diagnosis of our own screen:** one
    thing shouts and the rest whispers. Our three blocks currently whisper equally, which is
    exactly why it reads as a list rather than as a result. Whatever layout Jamie lands on,
    that is the problem to solve — not the number of figures.

18. **Open and owed on THIS branch**, so it is not lost:
    - `da-build` has not run on the fixes diff (PR #311).
    - Dave has not acked item 8 — that the redesign is deliberately out of this branch.
