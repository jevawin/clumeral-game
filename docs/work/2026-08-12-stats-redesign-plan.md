# Plan — player stats panel: the redesign

Date: 2026-08-12 · Branch: `dev/stats-tweaks` (brief 7) · Author: Claude (clumeral dev bot)

Built from [`2026-08-11-stats-redesign-brief.md`](2026-08-11-stats-redesign-brief.md), which
closed on 2026-08-12 with every section settled and `da-brief` answered. Item numbers in
brackets — `(b12)` — refer to that brief. **This plan settles how, not what.** Where the
brief left something genuinely unnamed it is flagged in "Open questions" below rather than
decided quietly.

Status: **`da-plan` run and answered, 2026-08-12. Awaiting Jamie's approval.** The review
returned 1 High, 4 Medium and 5 Low. Every one is fixed in place below; the changes it caused
are listed under "What `da-plan` changed" at the end.

---

## What the finished panel is

Four blocks in reading order, each a `<section>` with an `h3` and a decorative rule, exactly
as the three blocks work today.

**Today** (b66) — always present.
- Two figures side by side, each an icon and a value: calculator-with-tick `1 go`, stopwatch
  `2m 38s` (b38, b65).
- No `Solved in 1 go, 2m 38s` sentence on screen (b38).
- No time available → the stopwatch figure is absent and the goes figure sits alone (b36).
- `marker` mode (played, never recorded) → the plain word `Solved!` and no figures (b76).
- The random line and the new-player line keep their present position, directly under the
  figures (b76).

**Best** (b66) — full mode only. Three boxes across.

| Box | Icon | Upper pair | Lower pair |
|---|---|---|---|
| Time | stopwatch | best time / "Best" | today's time / "Current" |
| 1-go | calculator-with-tick | best first-go streak / "Best" | first-go streak / "Current" |
| Plays | gamepad | best play streak / "Best" | play streak / "Current" |

Numbers sit above their labels (the drawing, b68). Today's time appearing twice is
deliberate and stands as an override, not an agreement (b71, b73).

**Average** (b67) — full mode only. Two boxes across: average time (stopwatch) and average
goes (calculator-with-tick), each one figure labelled "Avg." (b72).

**All time** (b84) — full mode only. Two rows and the chart:
- Plays, with its note.
- First-go wins with its percentage, with its note.
- The "How many goes you take" chart, 1 to 6+, unchanged (b4, b43).

Average time, average goes and fastest first-go win come **out** (b84). No explanatory lines
inside any box, and no shared line under the row (b45).

### The rules that cross all four blocks

- **Colour** (b81): "Best" figures take the second accent, `--color-accent-best`. Every other
  figure — the Today pair, the three "Current" figures, both "Avg." figures — takes the
  player's own `--color-accent`. One exception, one rule.
- **Size ladder** (b29): (1) the Today icons and figures, (2) the box titles and the numbers
  in the boxes, (3) the small labels in the boxes.
- **Weight** (b30): numbers bold; box titles the same size but not bold; small labels regular
  in the ordinary foreground colour. No all-caps on anything inside a box. The block
  headings keep the all-caps they have today (b83 low-13).
- **Screen-reader labels** (b78): the `dt` carries the full words — "Best time", "Current
  1-go streak" — and the screen shows the short ones, trimmed with a visually hidden span.
  The label itself is never shortened.
- **Icons** (b34, b49): `aria-hidden`, decorative, inheriting the surrounding colour.
- **Three across from 360px, one column below it** (b77), expressed in `rem` so it also
  stacks at large browser text (b53).

---

## Task 1 — the counting rules

Implements b14, b22–b28, b58, b83 low-11, b83 low-15.

Drops the thirty-minute exclusion and adds the one new figure. Deliberately keeps
`fastestFirstGoSeconds` alive so the tree compiles; task 8 removes it with its last caller.

**Tests first** — `tests/player-stats.spec.ts`:
1. Rewrite the test at line 167 ("leaves a game over thirty minutes out of the average"). It
   becomes "counts a game over thirty minutes in the average": history of one 60-second game
   and one 2000-second game gives `avgTimeSeconds` 1030. This is the test that discriminates
   — a best-time test cannot, because a slow game can never lower a minimum (b83 low-11).
2. `bestTimeSeconds` is the fastest solve of **any** number of goes: a 3-go game at 90s and a
   1-go game at 120s gives 90. Proves it is not first-go-only.
3. `bestTimeSeconds` applies no upper exclusion: a lone 2400-second game gives 2400.
4. `bestTimeSeconds` is `null` when no countable row carries a valid time.
5. `bestTimeSeconds` ignores archived rows and markers.
6. `OUTLIER_SECONDS` is gone, not merely unused (b58): `import * as playerStats from
   '../src/player-stats.ts'` then `expect('OUTLIER_SECONDS' in playerStats).toBe(false)`.

`tests/demo-history.spec.ts`: line 58's `fastestFirstGoSeconds` assertion becomes
`bestTimeSeconds`. The `avgTimeSeconds` bound at line 64 still holds — the seed's average
moves from 220s to 344s once the 2210-second row counts — but assert the new value exactly
rather than a loose bound, so the change is visible next time. **Rename the test too**: it is
currently titled `'excludes the over-thirty-minute game from the average, as a real one
would'`, which becomes a lie the moment the assertion changes.

**Then** — `src/player-stats.ts`:
- Delete `export const OUTLIER_SECONDS` and the paragraph of comment above it explaining two
  thresholds; `MAX_STORED_SECONDS` is the only bound left and its comment says so.
- `contributableSeconds(h)` becomes `validSeconds(h.seconds)` and is inlined away, or kept as
  a one-line named function for readability — either, but not a function whose body no longer
  matches its name.
- Add `bestTimeSeconds: number | null` to `PlayerStats`, computed as
  `times.length ? Math.min(...times) : null` over the same `times` array the average uses.
- Update `validSeconds`'s doc comment, which currently explains why it does *not* apply
  `OUTLIER_SECONDS`.

Comment-only corrections, all naming a rule that no longer exists (b83 low-15):
- `src/types.ts:34` — the `seconds` field's note about values above `OUTLIER_SECONDS`.
- `src/play-timer.ts:121` — the note about a long game being left out.
- `src/demo-history.ts:41` — the 2210-second row's bullet in the doc comment, **and** the
  inline `// the 6+ bucket, and an outlier time` on line 58, which is a second stale mention
  of the same dead rule. **Keep the row**; correct both comments to say it exercises the
  hour-plus format and now counts like any other game.

Commit: `refactor(stats): drop the thirty-minute rule, add best time`

---

## Task 2 — the second accent colour, in CSS

Implements b31, b60, b75. Supersedes b17 entirely: nothing is derived at render.

`da-brief` was right that this cannot be computed in JS — chroma differs per theme *and* per
mode, and the panel renders once, so a theme change while sitting on `/solved` would move the
current colour and freeze the best one.

**Tests first** — new `tests/accent-best.spec.ts`, reading `src/tailwind.css` and
`src/palette.ts` the way `tests/token-parity.spec.ts` already reads files:
1. For each theme in `PALETTE.hues` order, `--accent-best-h` in `html[data-theme="…"]` equals
   the hue of the **next** theme, and Grape wraps to Lime (b31, b60).
2. `--accent-best-c` names the next theme's `--chroma-*` variable, so the best colour picks up
   that hue's own per-mode chroma rather than borrowing the wrong one — which is what
   `palette.ts` warns puts Cherry out of gamut.
3. No theme's best hue equals its own hue.

**Then** — `src/tailwind.css`:
- In `@theme`, beside `--accent-h` / `--accent-c`, add the Lime defaults' next colour:
  `--accent-best-h: 5; --accent-best-c: var(--chroma-cherry);` and
  `--color-accent-best: oklch(var(--accent-l) var(--accent-best-c) var(--accent-best-h));`
- In `html.dark`, add `--accent-best-c: var(--chroma-cherry);` beside the existing
  `--accent-c` default line, for the same reason that one is there.
- Each of the four `html[data-theme="…"]` rules gains its next pair: Lime→Cherry,
  Cherry→Blueberry, Blueberry→Grape, Grape→Lime.

**And mirror every one of those declarations in `src/worker/puzzles.ts`** — `:root`,
`:root.dark` and the four `:root[data-theme="…"]` rules. `/archive` does not use the colour,
but `tests/token-parity.spec.ts` compares every `--(accent|chroma|color)-*` declaration
between the two stylesheets with `toEqual`, and it is right to: a token added to one file and
not the other is exactly the #243 failure it was written for. That is three declarations in
`:root`, one in `:root.dark` and two in each of the four `:root[data-theme]` rules — about
twelve declarations across six rules, which is still far cheaper than weakening the guard.

Contrast needs no new test. The best colour is one of the same four accents at the same
`--accent-l`, and `tests/palette-contrast.spec.ts` already pins all four against bg and
surface in both modes (b51).

Commit: `feat(theme): a second accent colour for "best" figures`

---

## Task 3 — three icons in the sprite sheet

Implements b33, b79. Supersedes b19 — the sheet already exists with 28 symbols on
`currentColor` and `completion.ts` already uses it three times, so a second icon mechanism in
one file would be the odd choice.

`public/sprites.svg`, three new symbols matching the existing house style — `viewBox="0 0 24
24"`, `fill="none"`, `stroke="currentColor"`, `stroke-width="2"`, round caps and joins:

- `icon-stopwatch` — Lucide `timer`, unchanged: the circle, the crown line across the top and
  the hand.
- `icon-gamepad` — Lucide `gamepad-2`, unchanged.
- `icon-calculator-check` — assembled, because Lucide has no such icon. Lucide `calculator`'s
  outer rounded rectangle (`x=4 y=2 w=16 h=20 rx=2`), a screen rectangle in the upper third,
  Lucide `check`'s tick scaled to sit inside that screen, and two rows of keypad dots below
  it. The calculator's own screen line and its four-by-four keypad are dropped — at 18px they
  turn the icon into a grey block. Exact coordinates are settled by eye at 18px and 24px in
  both modes; the composition above is the specification.

**Test** — new `tests/sprites.spec.ts`, reading `public/sprites.svg`: the three symbols exist
by id, each carries a `viewBox`, and each uses `currentColor` rather than a literal colour. A
missing symbol renders as nothing at all and no other test would notice.

Commit: `feat(icons): stopwatch, calculator-with-tick and gamepad`

---

## Task 4 — the box and figure styles

Implements b20, b29, b30, b32, b53, b77, b81, b83 low-14.

`src/tailwind.css`, in the completion-panel section beside the existing `.stat-*` rules. The
classes land before the markup that uses them, so this commit changes nothing on screen; the
markup tasks assert the class names.

- `.stat-today` — flex row, `gap: 1.5rem`, `flex-wrap: wrap`, so an hour-long time wraps to a
  second line rather than overflowing at 320px.
- `.stat-figure` — flex row, `gap: 0.5rem`, baseline-aligned icon and value.
- `.stat-figure__icon` — `1.5rem` square, rung 1 of the ladder.
- `.stat-figure__value` — Inconsolata, bold, `clamp(1.375rem, 7vw, 1.75rem)`,
  `color: var(--color-accent)`. Rung 1.
- `.stat-boxes` — `display: grid; gap: 0.5rem; grid-template-columns: 1fr`, becoming
  `repeat(3, 1fr)` at `min-width: 22.5rem`. `.stat-boxes--two` becomes `repeat(2, 1fr)` at
  the same breakpoint. 22.5rem is 360px at default text size (b77) and, being `rem`, also
  stacks at large browser text on a wide screen — which is what b53 is really about.
- `.stat-box` — the play screen's digit-box styling, so a theme change moves both screens
  together (b20, b32): `background-color: var(--color-surface)`, `border: 1.5px solid
  var(--color-border)`, `border-radius: 0.25rem`, `padding: 0.5rem`. The shadow is the
  `shadow-box` **utility** on the element, not a declaration here — that is how the digit
  boxes do it at `index.html:293` and in `welcome.ts`. Correcting b83 low-14 on one detail:
  there is no dark variant to add. `--shadow-box` is a `color-mix` over `--color-text`, which
  flips in `html.dark`, so the single utility already covers both modes.
- `.stat-box__title` — Inconsolata, **not bold** (b30), `clamp(1.125rem, 5vw, 1.375rem)`,
  flex row with `gap: 0.375rem` so the icon sits beside the word. Rung 2.
- `.stat-box__icon` — `1.125rem` square.
- `.stat-box__pair` — `display: flex; flex-direction: column-reverse`, so the number appears
  above its label while the DOM stays `dt` then `dd`. The mismatch is deliberate and is the
  point: a screen reader must hear "Best time, 1m 20s", and `dd` before `dt` is not
  conforming HTML. Meaning survives the reorder because the pairing is carried by the
  description list, not by position (WCAG 1.3.2).
- `.stat-box__value` — Inconsolata, bold, same `clamp()` as the title, `color:
  var(--color-accent)`. Rung 2.
- `.stat-box__value--best` — `color: var(--color-accent-best)`. The only exception (b81).
- `.stat-box__label` — `0.875rem`, regular weight, `color: var(--color-text)`. Rung 3.
  b29 says rung 3 matches "the all-time text size", and All time has two: `.stat-row dt` at
  `0.9375rem` and `.stat-note` at `0.8125rem` (`src/tailwind.css:539, 564`). 14px sits between
  them and is the size b69's fit arithmetic was done at, so that is the one this follows.

Delete `.stat-streaks`, `.stat-streak__value`, `.stat-streak__best` and the `22rem` media
query with them, in task 6 where their markup goes.

CSS carries no unit test of its own. It is proved by the class-name assertions in tasks 5–8,
by the existing container-colour test (b61), and by eye on the preview with `?demo=stats`
(b63).

Commit: `style(stats): box and figure styles for the redesign`

---

## Task 5 — the Today block

Implements b35, b36, b38, b39, b47, b48, b59, b65, b66, b76, b83 low-12.

**`heroLine` is not renamed and not changed.** The first draft of this plan said it was, and
`da-plan` caught it: `heroLine` has a second caller the brief's module list never mentions.
`src/app.ts:22` imports it and `src/app.ts:795` uses it to write the **`/play` screen's**
`Solved in 1 go, 1m 05s` line into `dom.feedback`. That is the sentence brief item 39
explicitly protects. Renaming it is a compile break; gutting its sentence branches would
silently delete the play screen's result line, and neither would show up in the panel's own
tests. `tests/completion-stats.spec.ts:339–340` and `e2e/specs/undo-reset.spec.ts:246` pin
it, and both stay exactly as they are — they are now the guard that `/play` did not move.

So the panel gets a **new** function beside it, and `src/app.ts` is not touched at all.

**Tests first** — `tests/completion-stats.spec.ts`:
1. The block heading reads "Today", not "This game".
2. A normal solve renders two figures: `1 go` and a time matching `/^\d+m \d\ds$/`.
3. No `Solved in` anywhere in the panel's text.
4. Each figure carries its hidden word, so the block's text content contains "Goes, 1 go" and
   "Time, 2m 38s" (b47).
5. Both icons are `aria-hidden="true"` (b49).
6. Archive replay and marker: no stopwatch figure at all, not an empty one (b36).
7. `marker` mode renders the plain word `Solved!` and no figures (b76).
8. The forged-history guard survives, now on the new function: a `tries` that is not an
   integer of at least 1 renders `Solved!` and puts no markup in the panel. This matters
   because `loadHistory` does not validate and the value reaches `innerHTML`. The existing
   `heroLine` assertions at `tests/completion-stats.spec.ts:333, 339–340` stay untouched —
   they now prove the `/play` sentence is unchanged.
9. The announcement is **unchanged** — "Solved in 1. 48 seconds. Play streak 5." It is built
   by `buildAnnouncement` from the raw figures and never touched the hero string, so this is
   an assertion that nothing moved, not that a sentence survived (b48, b83 low-12).
10. The random line and the new-player line still sit inside the Today block, after the
    figures (b76).

**Then** — `src/completion.ts`:
- Add `todayFigures(tries, seconds, showTime)`, a new export. It applies the same guard
  `heroLine` applies and returns `<p class="stat-hero">Solved!</p>` when `tries` is not an
  integer of at least 1 — which is also `marker` mode's whole rendering (b76). Otherwise it
  returns the two figures.
- `heroLine` stays exactly as it is, exported, for `src/app.ts`. The small duplication of the
  guard between the two is deliberate: they are two screens with two audiences, and the last
  time one string served both is what the comma discussion of 2026-08-11 was about.
- Add a small `figure(iconId, spokenLabel, value)` helper emitting
  `<span class="stat-figure"><svg class="stat-figure__icon" aria-hidden="true"><use
  href="/sprites.svg#…"/></svg><span class="sr-only">Goes, </span><span
  class="stat-figure__value">1 go</span></span>`.
- The block heading string becomes `Today`; the block id stays `this-game`, so the e2e page
  object and every existing locator keep working.
- `buildAnnouncement`, `showsTime` and the `screens:enter` listener are untouched.
- **`src/app.ts` is not edited in this task or any other.**

Commit: `feat(stats): Today block — two icon figures instead of a sentence`

---

## Task 6 — the Best block

Implements b11, b12, b13, b30, b41, b42, b52, b59, b66, b68, b71, b78, b81, b83 low-16.

### The box markup, pinned exactly

`da-plan` was right that the first draft left the `dl` unplaced and specified a label
mechanism that could not produce the Average block's labels. One shape, used by all five
pairs in tasks 6 and 7:

```html
<div class="stat-box shadow-box">
  <h4 class="stat-box__title">
    <svg class="stat-box__icon" aria-hidden="true"><use href="/sprites.svg#icon-stopwatch"/></svg>Time
  </h4>
  <dl class="m-0">
    <div class="stat-box__pair">
      <dt>
        <span class="stat-box__label" aria-hidden="true">Best</span>
        <span class="sr-only">Best time</span>
      </dt>
      <dd class="stat-box__value stat-box__value--best">1m 20s</dd>
    </div>
    <!-- second pair -->
  </dl>
</div>
```

Two things this settles. The `dl` wraps the pairs and sits **inside** the box, below the
`h4` — a `dt` with no `dl` ancestor breaks b46 outright and trips axe's `definition-list`
rule at serious level, which `e2e/specs/a11y.spec.ts:60` runs over `/solved` in both colour
schemes. And the short word is a separate `aria-hidden` span rather than a prefix of the
full one, because `"Avg."` is not a prefix of `"Average time"` — a hidden *suffix* works for
the Best block and cannot work for the Average block. One mechanism, both blocks.

**Tests first** — `tests/completion-stats.spec.ts`:
1. The block exists with `data-stat-block="best"` and the heading "Best".
2. Three boxes, titled "Time", "1-go" and "Plays", each title an `h4` (b52).
3. The Time box shows best time over today's time; the 1-go box best over current first-go
   streak; the Plays box best over current play streak — read by their `.sr-only` label text.
4. Each pair's spoken label reads in full — "Best time", "Current time", "Best 1-go streak",
   "Current 1-go streak", "Best play streak", "Current play streak" — while the visible label
   is "Best" or "Current" (b78). Assert the `.sr-only` span's text for the full words and the
   `.stat-box__label` span's text for the short ones. Not raw `dt.textContent`, which holds
   both and reads `"BestBest time"`.
5. Every `dt` has a `dl` ancestor, and DOM order inside each pair is `dt` then `dd` (the
   reversal is visual only, task 4).
6. The three "Best" values carry `.stat-box__value--best` and the three "Current" values do
   not (b81).
7. "Current" in the Time box shows `—` when this game has no valid time, matching the
   all-time rows' existing behaviour rather than vanishing (b83 low-16).
7a. **On a personal-best day the same number appears three times.** `renderCompletion` reads
   history *after* today's row is written, so today's game is inside `bestTimeSeconds`. Beat
   your record and the screen reads `1m 20s` under the stopwatch in Today, then `1m 20s /
   Best` over `1m 20s / Current` in one box. b71 and b73 parked Dave's objection to a number
   appearing twice; nobody has seen the three-way case, so this test pins it as a decision
   rather than letting it be a discovery on the preview. It is also the cheapest thing to
   change if Dave rejects the repeat when he can see it — one `statPair` call.
8. The boxes are absent, not hidden, before the third countable game and when saving is off —
   the existing reveal-gate tests, re-pointed at the new block id (b9, b76).
9. No explanatory sentence inside any box, and none under the row (b45).

**Then** — `src/completion.ts`:
- Replace `streakColumn` with two builders, emitting exactly the markup pinned above:
  `statBox(title, iconId, pairs)` and `statPair(shortLabel, fullLabel, value, isBest)`.
- The block: `block('best', 'Best', '<div class="stat-boxes">…three boxes…</div>')`.
- Delete `NOTES.playStreak`, `NOTES.firstGoStreak` and `NOTES.streakPair` (b45).
- Delete `.stat-streaks`, `.stat-streak__value`, `.stat-streak__best` and their `22rem` media
  query from `src/tailwind.css`.

Commit: `feat(stats): Best block — three boxes replacing the streak columns`

---

## Task 7 — the Average block

Implements b67, b72, b78, b81.

**Tests first** — `tests/completion-stats.spec.ts`:
1. `data-stat-block="average"` exists with the heading "Average" and an `h3` and rule like the
   other three (b78).
2. Two boxes, two across, each with one figure labelled "Avg." on screen.
3. The spoken labels read "Average time" and "Average goes" in full, from the `.sr-only` span,
   while the visible `.stat-box__label` reads "Avg." (b78). This is the pair the task 6
   markup was designed around — a hidden suffix could not have produced it.
4. Neither value carries `.stat-box__value--best`; both take the ordinary accent (b81).
5. Each shows `—` when there is no data.
6. Absent before the third game and when saving is off, like Best and All time.

**Then** — `src/completion.ts`: a fourth `block('average', 'Average', …)` using the same
`statBox` builder with `.stat-boxes--two`, the stopwatch on the time box and the
calculator-with-tick on the goes box (b72).

Commit: `feat(stats): Average block`

---

## Task 8 — All time trimmed, and `fastestFirstGoSeconds` deleted

Implements b6 as superseded by b84, plus b84's own consequence.

**Tests first**:
1. `tests/completion-stats.spec.ts` — the All-time block contains "Plays" and "First-go wins"
   and the chart, and contains none of "Average goes", "Average time" or "Fastest first-go
   win".
2. `tests/player-stats.spec.ts` — remove `fastestFirstGoSeconds` from it entirely. Three
   places, and one of them is a whole test rather than a line: the `it('only considers
   first-go rows for the fastest win (brief 13)')` block **goes**, because the assertion is
   its entire body; the assertion inside `it('reports empty history as zeros and nulls')`
   goes; and the third sits in the test task 1 already rewrote. Located by name, not by line
   number — task 1 edits this file first and moves them.

**Then**:
- `src/completion.ts` — drop the three `statRow` calls and `NOTES.avgGoes`, `NOTES.avgTime`,
  `NOTES.fastest`.
- `src/player-stats.ts` — delete `fastestFirstGoSeconds` from `PlayerStats`, its computation
  and the `firstGoTimes` array that feeds only it. Nothing else in `src/` reads it (checked:
  `src/worker/stats.ts` has its own unrelated `avgTimeSeconds` from the analytics database).

Commit: `feat(stats): All time keeps plays, first-go wins and the chart`

---

## Task 9 — end to end

Implements b62. **I cannot run Playwright on this machine and will not try** — CI runs it
across engines. These edits therefore get read carefully rather than proved locally, and the
first real signal is the CI run on the pull request.

- `e2e/pages/completion.page.ts` — `streaks` becomes `best`; add `average`; point `stat()` at
  `.stat-row, .stat-box__pair` so it finds figures in both shapes; add a `boxes` locator for
  `.stat-box`.
- `e2e/specs/player-stats.spec.ts`, the first test (lines 56–95):
  - "Average goes", "Average time" and "Fastest first-go win" come out of All time; average
    goes and average time reappear as Average-block assertions.
  - "Play streak" and "First-go streak" become "Current play streak" and "Current 1-go
    streak", which is the spoken label a locator matches.
  - The `Solved in 1 go, …` hero assertion becomes the two icon figures.
  - **All four** explanatory-line assertions at lines 82–85 go, not three. Three of them are
    the streak lines that b45 drops; the fourth, "Your quickest win on a first guess.", is
    `NOTES.fastest`, whose row task 8 deletes. The two surviving all-time notes are not
    asserted there today, so add them: "Daily puzzles you have finished." and "Puzzles you
    got on your first guess."
  - The announcement assertion is unchanged, and is the e2e proof of b48.
- **The one new check** (b62): on a seeded history the Best block shows three boxes and the
  Average block two; on a brand-new player both blocks have count 0. Added to the existing
  describe rather than as a new file.
- `e2e/specs/completion.spec.ts:33–37` — `completion.streaks` becomes `completion.best`; the
  "Average goes" assertion at line 36 moves to the Average block's box; and **line 37's
  `stat("Play streak")` becomes `stat("Current play streak")`**, which the first draft of this
  plan missed.

Commit: `test(e2e): the four blocks after the redesign`

---

## Task 10 — the docs

`docs/DESIGN-SYSTEM.md`, lines 187–214. The class list gains `.stat-today`, `.stat-figure*`,
`.stat-boxes`, `.stat-box*` and loses `.stat-streaks`. "The completion panel" section is
rewritten for four blocks: the size ladder, the two-accent rule and its one exception, the
360px breakpoint, the boxes borrowing the digit-box styling, and the `column-reverse` reason.
The bullet claiming the hero reads `Solved in 1 go, 0m 30s` and that the play screen says the
same thing is corrected — the play screen keeps its sentence (b39), the completion screen no
longer has one, and that divergence is now deliberate.

Commit: `docs(design-system): the redesigned completion panel`

---

## Traceability

Every numbered item in the brief, and where it lands.

| Brief items | Where |
|---|---|
| 1, 2, 3 | Context. No code. |
| 4, 5 | Out of scope. No code — the chart and the screen length are untouched. |
| 6 | Superseded by 84 → task 8. |
| 7, 8 | Branch decisions. No code. Task ordering keeps the figures separate from the layout so a second design can swap in (21). |
| 9, 10 | Task 6, tests 8 — the reveal gate and the minimal archive panel are unchanged behaviour, re-pinned. |
| 11, 12, 13 | Task 6. |
| 14, 22–28 | Task 1. |
| 15, 16 | Task 1 — nothing new is stored; best time is a minimum over rows that exist. No code beyond the figure itself. |
| 17 | Superseded by 75 → task 2. |
| 18 | Tasks 1–8, plus the comment corrections in task 1. |
| 19 | Superseded by 79 → task 3. |
| 20, 32 | Task 4. |
| 21 | Structural, satisfied by tasks 5–7: every figure comes out of `computePlayerStats` and only the builders and styles differ. |
| 29, 30 | Task 4. |
| 31 | Task 2. |
| 33 | Task 3. |
| 34, 49 | Tasks 5–7 — every icon `aria-hidden`. |
| 35, 36, 38, 65 | Task 5. |
| 37 | Answered by 38. No code. |
| 39 | Task 5, actively rather than passively: `heroLine` and `src/app.ts` are left alone on purpose, and the two `heroLine` unit tests plus `e2e/specs/undo-reset.spec.ts:246` are the guard. Task 10 records why the two screens now differ. |
| 40, 41, 42 | Superseded by 66 and 68 → tasks 5–7. |
| 43 | Task 8 — the two surviving rows and the chart keep their words. |
| 44, 45 | Task 6 — no lines in the boxes, none under them. |
| 46 | Tasks 6, 7 — every figure stays a `dt`/`dd` pair. |
| 47 | Task 5. |
| 48 | Task 5, test 9 — asserted unchanged. |
| 50 | No code — every figure has a word label, so colour is never the only signal. |
| 51 | No code — `tests/palette-contrast.spec.ts` already covers all four accents. |
| 52 | Tasks 6, 7 — `h4` box titles, `h3` block headings. |
| 53 | Task 4 — `rem` breakpoints and `clamp()`. |
| 54 | Answered by Jamie's sign-off. No code. |
| 55, 56, 57 | No code — no analytics change of any kind. |
| 58 | Task 1. |
| 59 | Tasks 5, 6, 7, 8. |
| 60 | Task 2. |
| 61 | No code — the existing container-colour test stays and is not touched. |
| 62 | Task 9. |
| 63 | Manual, on the preview with `?demo=stats`, after the pull request builds. |
| 64 | QA level: light. See below. |
| 66, 67, 68 | Tasks 5, 6, 7. |
| 69 | Corrected by 77 → task 4. |
| 70, 71, 73 | Task 6 — the Time box carries "Current" and the repeat stands as an override. |
| 72 | Task 7. |
| 74, 85 | Closed. No code. |
| 75 | Task 2. |
| 76 | Task 5, tests 6, 7, 10. |
| 77 | Task 4. |
| 78 | Tasks 6, 7. |
| 79 | Task 3. |
| 80, 84 | Task 8. |
| 81 | Task 4, asserted in tasks 6 and 7. |
| 82 | Closed. No code. |
| 83 low-11 | Task 1, test 1. |
| 83 low-12 | Task 5, test 9. |
| 83 low-13 | Task 4 — all-caps stays on the block headings, never inside a box. |
| 83 low-14 | Task 4, with one correction: there is no dark shadow variant to add. |
| 83 low-15 | Task 1. |
| 83 low-16 | Task 6, test 7. |
| 83 low-17 | Noted, not reopened. No code. |
| 83 low-18 | Dave's branch, not this one. No code. |
| 83 low-19 | QA level: light. See below. |

---

## QA

**Light** (b64, b83 low-19). No worker change, no storage change, no routing change. The diff
is markup, CSS, three icons and one counting rule.

- `npm test` after every task. The counting rule, all four blocks' markup, the theme wrap and
  the two stylesheets' parity are all covered by unit tests.
- `npm run build` before the pull request.
- Playwright: the existing suite plus the one new check, **run by CI, never here**.
- By eye on the preview with `?demo=stats`, on a phone, both modes, all four themes (b63).

## Risks worth naming

1. **`da-brief` HIGH 2 is the one that could still bite.** Task 2 moves the second colour into
   CSS, which fixes it. The test that guards it reads the stylesheet rather than the rendered
   page, so it proves the mapping and not the paint. The paint is proved by eye (b63).
2. **The `column-reverse` visual/DOM mismatch** is deliberate and justified above, but it is
   the kind of thing a later reader "fixes". Task 4's comment and task 6's DOM-order test both
   exist to stop that.
3. **The e2e specs cannot be run here.** Between tasks 6 and 9 the e2e suite refers to a block
   id that no longer exists. Nothing on the branch is pushed until task 9 lands.
4. **Dave's objection to repeated numbers is parked, not settled** (b71, b73). Today's time
   appears twice by design, and three times on a personal-best day (task 6, test 7a). If it
   grates on the preview, the change is confined to one `statPair` call in task 6.
5. **`heroLine` is shared with `/play`.** It looks like panel code and it is not. Task 5
   leaves it alone; anyone tidying `completion.ts` later should read the comment that task
   goes in before touching it.

## Open questions

**One, and it is small.** The Average block's two box titles are not named anywhere in the
brief. Item 67 says "two boxes: average time and average goes" and item 72 gives them icons
and the "Avg." labels, but no titles. To match the Best block's "Time / 1-go / Plays" I have
assumed **"Time"** and **"Goes"**. Worth a yes or no at approval rather than a round trip.

One consequence to weigh with it: "Time" would then be an `h4` in both the Best block and the
Average block, so someone moving through the page by heading hears it twice. The alternative
is "Avg. time" and "Avg. goes" as the titles, which removes the clash but repeats the word
that is already the label underneath. I still lean to "Time" and "Goes" — the block heading
above them says "Average", and heading text repeating across sections is ordinary.

---

## What `da-plan` changed

Recorded so a later reader can see the plan was reviewed and what it cost.

- **HIGH — `heroLine` also builds the `/play` screen's sentence** (`src/app.ts:22, 795`). The
  first draft renamed it and stripped its branches, which would have compile-broken the app
  and silently deleted the line brief 39 protects. Task 5 rewritten: a new `todayFigures`
  beside an untouched `heroLine`.
- **MEDIUM — the label mechanism could not produce the Average block's labels.** A hidden
  suffix works for "Best" → "Best time" and cannot work for "Avg." → "Average time". Replaced
  with one mechanism for all five pairs, pinned as markup in task 6.
- **MEDIUM — no `dl` was placed in the box markup.** `dt` without a `dl` ancestor breaks b46
  and trips axe at serious level, which `e2e/specs/a11y.spec.ts:60` runs over `/solved`. Now
  pinned, with a test.
- **MEDIUM — task 9's e2e instructions were wrong in both directions.** Four explanatory-line
  assertions go, not three, and `e2e/specs/completion.spec.ts:37` was missed.
- **MEDIUM — best time includes today's game**, so a personal best shows the same number three
  times. Now named and pinned by test 7a rather than discovered on the preview.
- **The five Lows**, all taken: a whole `it` block to delete rather than a line; two more stale
  thirty-minute comments; which all-time size rung 3 follows and why; the real count of
  mirrored declarations; and the heading clash added to the open question.
