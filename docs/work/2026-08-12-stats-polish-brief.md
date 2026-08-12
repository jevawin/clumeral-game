# Brief — stats panel polish, and a standard page margin

Date: 2026-08-12 · Branch: `dev/stats-tweaks` (brief 8) · Author: Claude (clumeral dev bot)

Jamie's tweak list of 2026-08-12, after seeing the redesign on the preview at
https://dev-stats-tweaks-clumeral-game.jevawin.workers.dev/solved?demo=stats

Follows [`2026-08-11-stats-redesign-brief.md`](2026-08-11-stats-redesign-brief.md) and its
plan, both of which are built and on this branch. Item numbers here start again at 1 and are
append-only; where an item reverses a redesign decision it says so.

**Short form: sections 1, 2, 3, 7, 8, 9, 11 — approved by Jamie 2026-08-12.** Sections 4
(maths), 5 (state) and 10 (analytics) are n/a: nothing here changes a number, stores
anything, or sends an event. Section 6 (how it fits) is folded into section 3, because the
only module question is which files carry the margin.

---

## 1. What it is
Settled: Jamie 2026-08-12 (his own list) · Ack: Override: Jamie 2026-08-12

1. Seven presentational changes, six to the completion panel and one to page margins
   site-wide. Jamie's own list, given after seeing the built redesign. (assumed)
2. **Nothing about what is counted changes.** No figure's arithmetic moves, nothing new is
   stored, no event is sent. Every change is markup, CSS, copy or an icon. (assumed)
3. Why now: the redesign is on the preview and unmerged, so these land in the same pull
   request rather than as a follow-up. (assumed)

## 2. Out of scope
Settled: Jamie 2026-08-12 (accepted all recommendations) · Ack: Override: Jamie 2026-08-12

4. Dave's alternative design stays parked, as agreed on 2026-08-11. (assumed)
5. The goes chart keeps its shape, its `6+` tail and its wording. (assumed)
6. Nothing about score saving appears on this panel, in any mode — unchanged from the
   redesign. (assumed)

## 3. How it works
Settled: Jamie 2026-08-12 (item 8 decided by him, rest accepted) · Ack: Override: Jamie 2026-08-12

### The margin

7. `/play` uses 16px side padding (`px-4`) and no maximum width. `/welcome` and `/solved`
   use 24px (`px-6`) inside a container capped at 390px. The Worker pages `/archive` and
   `/stats` already use 16px. So the change is: `/welcome` and `/solved` drop to 16px, and
   nothing else moves. (assumed)
8. **Keep the 390px cap on `/welcome` and `/solved`, or drop it so they run full width like
   `/play`?**
   My rec: keep it. Why: on a phone the cap never bites — a 390px screen at 16px padding
   gives 358px of content on all three screens, which is the match Jamie is asking for. The
   cap only does anything on a tablet or desktop, where a full-width completion panel would
   stretch a two-column layout across 1000px. Dropping it is a different change from the one
   asked for, and a bigger one.
   **Settled: Jamie, 2026-08-12 — keep the cap as it is.** His reasoning, recorded because
   it corrects mine: `/play` is not really unbounded either. Its clues stop expanding at
   mobile width because of caps further in, so the two screens already behave the same way
   on a wide window. The padding is the only thing that differs, and the padding is the only
   thing that changes.

### The panel

9. The Time box's "Best" label becomes **"Fastest"**. The 1-go and Plays boxes' "Best"
   becomes **"Streak"**. The "Current" labels are untouched. (assumed)
10. A Lucide `flame` icon goes in front of the fastest time and both streak numbers — three
    flames, none on the "Current" figures. Same colour as the number it precedes, which is
    `--color-accent-best`. (assumed)
11. Every font on the panel changes from Inconsolata to the body font, Quicksand, numbers
    included. (assumed — item 21 settles how far "every" reaches)
12. The Average block goes, and average time and average goes return as rows inside All
    time. This reverses redesign items 67, 72 and 84. (assumed)
13. The boxes around the three bests lose their background, border and offset shadow. The
    three-column layout, the titles, the icons and the pairs all stay. (assumed)
14. Nothing returns that redesign item 84 removed other than the two averages — the fastest
    first-go win stays deleted, because "Fastest" in the Time box is now the same idea told
    better. (assumed)

## 4. Maths
n/a — no figure's arithmetic changes.

## 5. State & persistence
n/a — nothing is stored or read.

## 6. How it fits
Folded into section 3. Files touched: `index.html` and `src/welcome.ts` for the margin;
`src/completion.ts`, `src/tailwind.css` and `public/sprites.svg` for the panel.

## 7. How it looks
Settled: Jamie 2026-08-12 (item 21 decided by him, rest accepted) · Ack: Override: Jamie 2026-08-12 (Dave sees it on the preview)

15. The three bests keep their three-column grid, their icons, their titles and their
    number-over-label pairs. Only the background, the border and the offset shadow go. The
    padding those boxes carried is replaced by a little vertical space, so the columns still
    read as three groups rather than one run of text. No dividing lines. (assumed)
16. Losing the boxes leaves the panel with no borrowed play-screen styling, which was the
    reason redesign item 20 gave for having them. That reason goes with them; the panel now
    follows the theme through colour alone. (assumed)
17. The flame is Lucide `flame`, sized to the text (`1em`), sitting inline before the
    number with a small gap. It inherits the number's colour rather than declaring one, so
    the "same colour as the number" holds automatically in both modes and all four themes.
    (assumed)
18. Three flames only — the fastest time and the two best streaks. None on a "Current"
    figure, none in Today, none in All time. (assumed)
19. With the Average block gone the panel is three blocks again: Today, Best, All time.
    (assumed)
20. Average time and average goes become rows inside All time, after Plays and First-go
    wins and before the chart — the order they had before the redesign moved them out.
    (assumed)
21. **How far does "all fonts, not the monospaced one" reach?**
    My rec: the completion panel only — its headings, the Today figures, the box titles and
    numbers, the All-time rows and the goes chart. Why: Inconsolata is also doing real work
    elsewhere on the site, and it is load-bearing in at least one place. The digit boxes,
    the keyboard keys, the clue tags and the "Your guesses" label all use it, and the
    keyboard in particular relies on every key being the same width so the rows line up.
    Changing those is a redesign of the play screen, not a tidy-up of the stats panel, and
    it would land unreviewed in a pull request about stats. Happy to do it — as its own
    piece of work, where it can be looked at properly.
    **Settled: Jamie, 2026-08-12 — the completion panel only. No change to the play
    screen.**

## 8. Copy & wording
Settled: Jamie 2026-08-12 (item 25 decided by him) · Ack: Override: Jamie 2026-08-12 (Dave sees it on the preview)

22. The words on screen, from Jamie's list: **"Fastest"** in the Time box, **"Streak"** in
    the 1-go and Plays boxes. All three "Current" labels stay as they are. (settled by the
    list itself)
23. The returning All-time rows keep the names and the explanatory lines they had before
    the redesign: "Average goes" / "Your average number of guesses." and "Average time" /
    "How long you usually take." Every other row in that block carries a line, so these
    would look half-finished without one. (assumed)
24. Nothing else on the panel changes wording. (assumed)
25. **What should a screen reader say for the three renamed labels?**
    Background: the panel shows a short word and speaks a full one, because "Best" alone
    tells you nothing about which figure it belongs to. Today they read "Best time", "Best
    1-go streak" and "Best play streak".
    My rec: **"Fastest time", "Longest 1-go streak", "Longest play streak"** — pairing with
    the unchanged "Current time", "Current 1-go streak" and "Current play streak".
    Why: "Fastest" is now the word on screen, so speech saying "Best" contradicts it. And
    "Streak" cannot be spoken on its own, because the figure below it is a streak too — a
    screen reader would announce two figures both called "streak" and the reader would have
    no idea which is the record. "Longest" against "Current" is the distinction the sighted
    reader gets from the flame.
    Jamie's call: accessibility is his.
    **Settled: Jamie, 2026-08-12 — "Fastest time", "Longest 1-go streak", "Longest play
    streak".**

## 9. Accessibility
Settled: Jamie 2026-08-12 (his section, signed) · Ack: n/a

26. The flame is `aria-hidden` and decorative, like every other icon on the panel. The word
    beside it — "Fastest", "Longest 1-go streak" — is what carries the meaning. (assumed)
27. Removing the boxes removes no semantics. The description list stays, the `h4` titles
    stay, the number stays above its label on screen while the DOM order stays `dt` then
    `dd`. Only background, border and shadow go. (assumed)
28. Colour is still never the only signal, and this is slightly better than before: the
    record was marked by the second accent colour alone, and now it also carries a flame and
    a different word. Someone who cannot tell the two accents apart now has two other
    signals. (assumed)
29. The font change raises no new legibility question — Quicksand is already the font of
    every sentence on the site, at every size. The one thing monospace was doing on this
    panel was lining up columns of digits, and the only column that matters is the goes
    chart's counts, which sit in a fixed-width track and stay aligned regardless. (assumed)
30. The margin change gives the content 16px more width and takes nothing away, so no line
    that fits today stops fitting. The three-across breakpoint is in `rem`, so the columns
    still stack at large browser text. (assumed)
31. Nothing here needs a new test beyond the ones in section 11 — the existing axe run over
    `/solved` in both colour schemes covers the structural half. (assumed)

## 10. Analytics
n/a — presentational only, no event of any kind.

## 11. Done / test plan
Settled: Jamie 2026-08-12 (blanket authorisation to proceed) · Ack: n/a

32. **QA level: light**, as the redesign was. No worker change, no storage change, no
    routing change, and no figure's arithmetic moves. The diff is markup, CSS, copy and one
    icon. (assumed)
33. `tests/completion-stats.spec.ts` carries most of it: the visible labels read "Fastest",
    "Streak", "Streak"; the spoken ones read "Fastest time", "Longest 1-go streak",
    "Longest play streak"; the panel has three blocks and no `data-stat-block="average"`;
    average time and average goes are rows inside All time with their explanatory lines; a
    flame sits on each of the three records and on none of the three "Current" figures; and
    every flame is `aria-hidden`. (assumed)
34. **Two guards that these changes stay done**, both reading `src/tailwind.css` the way the
    existing container-colour test does: the completion-panel rules declare no Inconsolata
    anywhere, and `.stat-box` declares no background, border or shadow. Cheap, and they are
    the two things a later tidy-up would put back without noticing. (assumed)
35. A margin test reading `index.html` and `src/welcome.ts`: the welcome and completion
    containers use the same side padding as the game screen. It is the only thing standing
    between "standardised" and "standardised until someone edits one of them". (assumed)
36. `e2e/`: the Average-block locator goes, its two assertions move back to All-time rows,
    and the three spoken labels change. Playwright is run **by CI, never here**. (assumed)
37. `npm test` after each task, `npm run build` before the pull request, and then by eye on
    the preview with `?demo=stats` — on a phone, both colour modes, all four themes. Dave
    sees it there before anything merges. (assumed)

---

## Closing

**Settled 2026-08-12.** Jamie signed section 9 (his, blocking) and section 8, settled the
margin in section 3 and the font reach in section 7, and then authorised the run through
`da-brief`, Plan, `da-plan` and Build in one go.

**Dave's ack on sections 7 and 8 is outstanding, and Jamie's authorisation stands as the
override** — recorded as an override, never as an ack, and following the same pattern as
2026-08-11: Dave challenges the look when there is a version on the preview to look at,
which is faster for him than reading a description of it. `Override: Jamie 2026-08-12.`
