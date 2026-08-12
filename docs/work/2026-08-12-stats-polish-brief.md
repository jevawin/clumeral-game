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
6a. **`/stats` keeps its own 24px margin and 40rem measure.** It is the team's dashboard,
   not a player screen: read on a laptop, and its width has nothing to do with the 390px
   phone layout the three player screens share. See item 41. (assumed)

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
`src/completion.ts`, `src/tailwind.css` and `public/sprites.svg` for the panel; and
`docs/DESIGN-SYSTEM.md`, which this work makes wrong in five places (item 45).

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
Settled: Jamie 2026-08-12 (blanket authorisation to proceed) · Ack: Override: Jamie 2026-08-12

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

## 12. What `da-brief` found
Run 2026-08-12, fresh context. 1 High, 6 Medium, 5 Low. Every one is answered below with a
new numbered item; item numbers stay append-only, so 38 onwards.

### The High — item 7 was factually wrong, and it changes what "standardise" means

38. **`/play` DOES have a 390px cap. The difference is where the padding sits, not whether
    there is a cap.** `index.html:214` puts `px-4` on the section, **outside**
    `max-w-[390px]` on the div inside it. `src/welcome.ts:123` and `index.html:345` put
    `px-6` **inside** the cap. So the content widths are:
    - `/play` — `min(390, viewport − 32)`
    - welcome and solved, after dropping to `px-4` — `min(390, viewport) − 32`

    These are equal only up to a 390px-wide screen. On a 393px iPhone 14 Pro, a 412px Pixel
    or a 430px Pro Max, `/play` gives 390px of content and the other two give 358px. My
    arithmetic in item 7 picked the one width where the mismatch is invisible.
    Jamie's reasoning in item 8 stands as a decision — the cap stays — but the detail was
    wrong too: the cap is explicit, not emergent from the clues.
39. **So there are two different changes hiding behind "standardise the margin".**
    (a) Match the declaration: `px-6` → `px-4` on welcome and solved. One-line change. The
    32px mismatch on a phone wider than 390px stays.
    (b) Match what is actually on screen: move the padding outside the cap on welcome and
    solved, the way `/play` does it. Then all three are `min(390, viewport − 32)` at every
    width and the screens genuinely match.
    My rec: **(b)**. Why: (a) makes the three declarations look the same while leaving the
    screens different on most current phones, which is the opposite of standardising and is
    the kind of thing nobody finds again. (b) is a handful of class moves and no new
    concept. **Jamie's call.**
40. Item 35's test has to assert whichever of those was chosen, measured the same way for
    all three screens. A test comparing a padding class on structurally different elements
    would pass while the screens still differ — which is how the wrong answer survives.

### The Mediums

41. **`/stats` is 24px, not 16px** (`src/worker/stats.ts:300`, `padding: 1.5rem`, inside a
    40rem cap). Item 7 said it already matched and it does not. `/archive` really is 16px.
    Recommendation: leave `/stats` alone and say so — it is the team's own dashboard, not a
    player screen, it is read on a laptop, and its 40rem measure has nothing to do with the
    390px phone layout the other three share. Added to section 2 rather than section 3.
    (assumed — say if you want it changed too)
42. **Item 34's shadow guard would have read the wrong file.** `.stat-box` gets its offset
    shadow from the `shadow-box` **utility in the markup** (`src/completion.ts`), not from a
    declaration in `src/tailwind.css`. A guard reading only the stylesheet would pass before
    the change, after it, and again if someone put `shadow-box` back — which is the exact
    regression it exists to catch. The guard must also assert `src/completion.ts` emits no
    `shadow-box` on a `.stat-box`. (assumed)
43. **Item 12 reverses a decision that was made for Dave.** Redesign item 84 cut three rows
    out of All time, and it was Jamie's answer to Dave's complaint that the panel repeated
    numbers and ran long. Putting two of them back partly undoes that, and Dave has not been
    asked. Recorded here so it is visible rather than buried; **Dave should say whether the
    two averages coming back bothers him**, and the preview is the fastest way for him to
    judge it.
44. **The ack bookkeeping was wrong.** Section 11 is joint and was marked `Ack: n/a`, which
    is only correct for an owned section. Sections 1, 2, 3 and 11 have no Dave ack either,
    and the Closing named only 7 and 8. Both fixed below.
45. **`docs/DESIGN-SYSTEM.md` goes stale in five places** and nothing said so: the "four
    blocks in reading order" line, the class list, the short-label/spoken-label pairs, the
    Inconsolata entry as it applies to the panel, and a `max-w-sm` line that is already wrong
    against the real `max-w-[390px]`. Added to section 6 and to the done list. (assumed)
46. **A flame beside an em-dash.** `bestTimeSeconds` is `null` whenever no game carries a
    time, and that is reachable on a full panel — there is already a test for it. Item 18's
    unconditional "three flames" would render 🔥 — under "Fastest".
    Recommendation: **no flame when the value is a dash.** A flame is a badge for an
    achievement, and there is no achievement. Only the Time box can hit this; the two
    streaks are always numbers. (assumed)
47. **The reviewer challenged the on-screen words** "Fastest / Streak / Streak" as not
    parallel with each other, and "Streak" as not parallel with the "Current" underneath it.
    **Noted, not reopened.** Jamie chose those three words on 2026-08-12 with the built
    screen in front of him, which is exactly the position the objection is arguing from. The
    speech half — where the ambiguity genuinely bites, because there is no flame in speech —
    is fixed by item 25. If the words grate on the preview they are one string each.

### The Lows, all taken

48. Item 20's row order, stated literally instead of by reference to a commit nobody can
    see: **Plays, First-go wins, Average goes, Average time**, then the chart.
49. **Item 21's list was not exhaustive**: `.stat-hero` also declares Inconsolata and is
    panel markup — it is the `Solved!` line for a player who solved with saving off. It
    changes with the rest. Item 34's guard would have caught the miss, which is the guard
    doing its job, but the prose should not disagree with it.
50. **Redesign item 69's three-column fit arithmetic was done in Inconsolata**, and both the
    font change and the loss of the boxes' padding move it — in opposite directions, roughly
    16px per column back from the padding against a wider typeface. It should land fine, but
    item 30 argued only from the margin. The 320px check in item 37 is where this is
    settled, and it is now an explicit thing to look at rather than a general eyeball.
51. **Name what separates the three columns** once the borders go: a wider column gap, not
    vertical space. Vertical space does nothing for a horizontal grid. The gap goes from
    `0.5rem` to about `1rem`.
52. **`.stat-boxes--two` becomes dead CSS** when the Average block goes, and is deleted with
    it. The two sprite symbols are not dead — the Best boxes still use both.

---

## 13. The margin, specified properly

Item 39 asked Jamie to choose between two changes. He answered with a third and better one:
he had never actually specified the sizing, so he specified it.

53. **Settled: Jamie, 2026-08-12.** Every inner div gets `max-width: 400px`. Every section
    gets 16px padding. The padding therefore sits **outside** the cap on every screen, which
    is option (b) in item 39, and the cap moves from 390px to a round 400px.
    What that gives, in his words: above 432px of viewport the content is the full 400px;
    below it the content is whatever is left after 16px each side. 432 is 400 + 16 + 16.
    This supersedes items 7, 8 and 39. It is a real specification rather than a match
    against whatever `/play` happened to be doing, which is what makes it worth having.
54. **Open: does "all pages" include `/archive` and `/stats`?** Those two are Worker-rendered
    and are shaped differently — `/archive` is a table of every past puzzle at a 512px
    measure, `/stats` is the team's dashboard with a chart at 640px.
    My rec: **the three player screens only** — welcome, play and solved. Why: 400px is a
    phone column, and it is the right measure for a column of clues or a stack of figures.
    A table of dates squeezed into 400px wraps every row, and the analytics chart is read on
    a laptop and would lose most of its width. Consistency between a game screen and a
    spreadsheet is not obviously worth having.
    Item 6a already put `/stats` out of scope on the same reasoning and Jamie did not object,
    but he has since said "all pages", so this is asked rather than assumed.

## 14. The demo seed

55. **Settled: Jamie, 2026-08-12 — leave it alone.** The fake history seeded by `?demo=stats`
    includes a row for today with the answer 314, which is why the preview showed a solved
    puzzle whose answer did not match the real one. That cost an hour of a live-site scare
    on 2026-08-12. It is not being changed: the seed is temporary scaffolding and goes when
    the redesign lands. `?demo=clear` puts the preview back to a normal unplayed puzzle.

---

## Closing

**Settled 2026-08-12.** Jamie signed section 9 (his, blocking) and section 8, settled the
margin in section 3 and the font reach in section 7, and then authorised the run through
`da-brief`, Plan, `da-plan` and Build in one go.

**Dave's ack is outstanding on sections 1, 2, 3, 7, 8 and 11, and Jamie's authorisation
stands as the override** — recorded as an override, never as an ack, and following the same
pattern as 2026-08-11: Dave challenges the look when there is a version on the preview to
look at, which is faster for him than reading a description of it. `Override: Jamie
2026-08-12.`

One thing in there is more than a formality, and item 43 says so: putting the two averages
back partly reverses redesign item 84, which was Jamie's answer to Dave's own complaint that
the panel repeated itself and ran long. Dave should see that on the preview and say.

**`da-brief` run and answered 2026-08-12** — items 38 to 52. Item 39 was then superseded by
Jamie's own specification in section 13: 400px inner cap, 16px section padding, padding
outside the cap.

One question remains open, and it does not block the panel work: **item 54**, whether
`/archive` and `/stats` are in "all pages". Everything on the completion panel can be
planned and built while that is decided.
