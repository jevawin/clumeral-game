# Plan — stats panel polish, and one page width everywhere

Date: 2026-08-12 · Branch: `dev/stats-tweaks` · Author: Claude (clumeral dev bot)

Built from [`2026-08-12-stats-polish-brief.md`](2026-08-12-stats-polish-brief.md), closed the
same day. Item numbers in brackets — `(b53)` — refer to that brief. **This plan settles how,
not what.** Anything the brief genuinely left unnamed is in "Open questions" rather than
decided quietly.

Status: **Built, 2026-08-12.** All twelve tasks are committed on `dev/stats-tweaks`, one
commit each (tasks 4 and 5 share one, and 8 and 9 share one — both pairs are a single
coherent change). 827 unit tests and the build pass. Not yet pushed; `da-build` has not run.

Two things the build settled that the plan did not name:
- **Task 8's font sweep found seven rules, not the six the plan listed** — `.stat-hero` was
  the seventh, exactly as `da-plan` low 10 predicted. The guard is written as a sweep over
  the whole panel section rather than a list, so the next one is covered too.
- **`.stat-boxes--two` went with the Average block**, as planned, and nothing else referenced
  it.

Earlier: **`da-plan` run and answered, 2026-08-12.** The review returned 2 High, 6 Medium and
10 Low. Every one is fixed in place below; what it changed is listed at the end.

---

## What the survey found, and what Jamie did with it

A read-only survey of every layout container turned up two facts the brief was written
without: the header and footer have no width cap, and the menu dropdown is positioned against
the viewport rather than the header. The first draft of this plan put both in scope.

**Jamie's answer, 2026-08-12 (b59): the header is deliberately full width, and it stays.**
The jumping around he wants gone is **the same content area changing width between one page
view and the next** — not chrome sitting at a different edge from the content. So the header
is untouched, the footer with it, and the menu bug does not arise, because nothing about the
header moves. Two tasks came out of this plan as a result.

He added a second kind of jumping in the same breath (b61): on a desktop, `/welcome` and
`/solved` centre their content vertically while `/play` starts at the top, so moving between
screens walks the content up and down. **Everything is top-aligned.** That is now task 3.

---

## Task 1 — one width, declared once

Implements b53, b56.

Three files already repeat `max-w-[390px]` and two stylesheets repeat their own numbers. The
whole point of b56 is that this is now a decision rather than an accident, so it gets a name.

`src/tailwind.css`, in `@theme` beside the existing tokens:

```css
/* The page column. One width for every screen (brief 56): a phone always fills
   its screen and only a desktop ever meets the cap, so nothing jumps around
   between pages. 480px is above the widest phone in portrait — a Galaxy S24
   Ultra reports 480 and a Pixel 8 Pro 448 — which is what makes the rule hold.
   The padding lives OUTSIDE the cap, so content is min(480, viewport - 32). */
--page-max: 480px;
--page-gutter: 1rem;
```

and two utilities in `@layer utilities`:

```css
.page-col  { inline-size: 100%; max-inline-size: var(--page-max); margin-inline: auto; }
.page-pad  { padding-inline: var(--page-gutter); }
```

**They go in `@layer utilities`, not `@layer base`.** In `base` they lose to every Tailwind
utility on layer order, so a stray `max-w-[390px]` left behind would silently beat
`.page-col` and the only thing catching it would be a test. In `utilities` they sit after
Tailwind's own, which is also where `.btn`, `.link` and `.key-face` already live.

**Test** — new `tests/page-width.spec.ts`, reading the files the way `tests/token-parity.spec.ts`
already reads them. There is **no existing test anywhere that asserts any width or padding**
(confirmed by survey), so this is the whole guard. In this task, two assertions only:
1. `--page-max` is `480px` and `--page-gutter` is `1rem` in `src/tailwind.css`.
2. `.page-col` sets `max-inline-size: var(--page-max)` and centres, `.page-pad` sets
   `padding-inline: var(--page-gutter)`, and both are inside `@layer utilities`.

The rest of the file's assertions land in the tasks that make them true — task 2 for the
screens, task 4 for `/archive`, task 5 for `/stats`. Writing them here would leave the tree
red at this commit, which the gate forbids.

Commit: `feat(layout): one page width, declared once`

---

## Task 2 — the three screens

Implements b53, b56, b57.

- `index.html:214` — the game section keeps `px-4 py-5`; swap `px-4` for `page-pad` so it
  reads from the token. `index.html:215` — `max-w-[390px] mx-auto` becomes `page-col`.
- `index.html:344` — the completion section gains `page-pad`. `index.html:345` —
  `max-w-[390px] mx-auto … px-6 py-8` becomes `page-col … py-8`: **`px-6` goes** and the
  horizontal padding moves out to the section, while `py-8` stays exactly where it is. This
  is the change b38 is about.
- `index.html:210` — the welcome section gains `page-pad`.
- `src/welcome.ts:123` — `max-w-[390px] … px-6 py-8` becomes `page-col … py-8`, same move.
  It has no `mx-auto` today and is centred only because `welcome.ts:121` adds `items-center`
  to the section at runtime; `page-col` gives it `margin-inline: auto` so it no longer
  depends on that.

The digit boxes grow from about 110px to about 140px on a wide screen, which b57 records as
accepted. Nothing else on `/play` changes — b21's "no change to the play screen" was about
the font, and this is the sizing decision that came after it.

**Test** — `tests/page-width.spec.ts` gains the assertion that belongs with this change:
3. **No `max-w-[…px]` survives on any screen section or its wrapper in `index.html`, and
   none in `src/welcome.ts`.** Asserted as an absence, because the failure it guards against
   is someone adding a fourth screen with a number of its own.

Commit: `feat(layout): the three screens share the page column`

---

## Task 3 — everything starts at the top

Implements b61.

Two declarations, and the whole of the second kind of jumping around goes.

- `index.html:345` — the completion screen's inner div drops `justify-center`. It keeps
  `flex-1`, so it still fills the space, and it keeps `items-center`, which is horizontal
  centring and is not what moves. Content starts at the top of the screen.
- `src/welcome.ts:121` — `screen.classList.add("items-center", "justify-center")` becomes
  `add("items-center")`. Same reasoning: `items-center` centres the column horizontally and
  stays; `justify-center` is what pushes it down the page.
- `/play` already starts at the top and is not touched.

The comment at `index.html:211` says the welcome content "fills remaining viewport (flex-1)
and centres content; footer pushes it slightly above visual centre" — that stops being true
and is corrected in the same commit.

**Test** — `tests/page-width.spec.ts`:
4. No screen's container carries `justify-center` — asserted across `index.html` and
   `src/welcome.ts` together, so a fourth screen cannot quietly reintroduce it.

**The header, the footer and the menu are all untouched** (b59). The first draft of this plan
restructured all three, and that work is deleted rather than deferred: with the header full
width by design, there is nothing to align it to and no reason to move the menu.

Commit: `fix(layout): every screen starts at the top`

---

## Task 4 — `/archive` needs nothing but a comment

Implements b60.

`src/worker/puzzles.ts:177` is already right, and this task exists to record that rather than
to change it. `main.archive` is `max-width: 32rem` with `padding: 1.25rem 1rem 2rem`, under
the global `box-sizing: border-box` at `:115`. 32rem is 512px; minus 2 × 16px of padding that
is **480px of content behind a 16px gutter** — exactly the target, already met, and Jamie's
b60 asked specifically that the 16px stay.

The first draft proposed rewriting it as `calc(480px + 2rem)`, which computes to the same
512px and would have swapped a `rem` for a `px`: at a 20px root font the column is 600px of
content today and would have become 480px. That is the large-text case b30 cares about, so
the `rem` stays.

So the only edit is a comment above the declaration recording why 32rem is the right number —
`32rem = 512px = 480px content + 2 × 1rem gutter` — so that nobody, including a later me,
"standardises" it into something worse.

The header and footer on this page are untouched, for the same reason as the app's (b59).

**Test** — `tests/page-width.spec.ts`:
5. `/archive`'s `main` resolves to 480px of content and a 16px gutter: parse `max-width` and
   the horizontal padding and assert `max − 2 × pad === 480px`. Asserting the derived width
   rather than looking for the strings `480px` and `1rem`, because `1rem` appears a dozen
   times in that stylesheet and a substring check would pass whatever the container said.
   This is what makes a no-op task worth a commit: the number is correct today by accident of
   history, and nothing was stopping it drifting.

Commit: `docs(layout): record why /archive is already on the page column`

---

## Task 5 — `/stats`, and the chart arithmetic that depends on it

Implements b54, b57.

This is the one page whose width is **load-bearing in code**. `src/worker/chart.ts:9-13`
documents the derivation — "`/stats` body is max-width 40rem with 1.5rem padding, so it is
592px on desktop and 327px on a 375px phone" — and `:30` sets `LABEL_W = 87` from it.

- `src/worker/stats.ts:296` — `body`'s `max-width: 40rem; padding: 1.5rem` becomes
  `max-width: calc(480px + 2rem); padding: 1rem`, giving 480px of content. The page is a
  single `<body>` container with no header, footer or `<main>`, so there is nothing else to
  wrap.
- **The label budget survives.** `LABEL_W = 87` was derived for the 327px phone case, and
  every width here is wider than that, so nothing collides. The narrow end actually improves:
  a 375px phone goes from 327px to 343px, because the gutter drops from 24px to 16px.
- **The chart's text does not survive untouched, and this is `da-plan`'s finding.** The SVG
  is drawn in a 600-unit viewBox and scaled by `container / 600`. Desktop today is 592/600 =
  0.987, so `.axis`'s 11 units render at 10.9px. At 480px the scale is 0.8 and the same 11
  units render at **8.8px** — a fifth smaller, on the page Jamie and Dave actually read
  numbers off. Worse, `stats.ts:353`'s steps are **viewport** queries while the container is
  now capped from 512px up, so axis text would be 11.2px at a 640px window and 8.8px at
  641px: a jump the wrong way as the window gets bigger.
  Fix, and it is small: above 512px the scale is a constant 0.8, so raise the base sizes to
  cancel it — `.axis` 11 → 14 units and `.direct` 13 → 16 — which lands them back at 11.2px
  and 12.8px, within a rounding error of today. The 640px step then has nothing left to do
  and goes; the 480px and 380px steps stay, because below 512px the scale really does vary
  with the viewport.
- `chart.ts:9-13`'s comment and `tests/chart.spec.ts:101`'s "327px" comment are corrected to
  the new numbers. That comment is the only written record of the derivation, and leaving it
  wrong would mislead whoever next sizes a label.

**Test** — `tests/page-width.spec.ts`:
6. `/stats`'s body resolves to 480px of content, by the same `max − 2 × pad` assertion as
   task 4.

Commit: `feat(layout): /stats on the page column, with the chart text rescaled`

---

## Task 6 — the labels

Implements b9, b22, b25.

**Tests first** — `tests/completion-stats.spec.ts`:
1. The visible labels read `Fastest`, `Streak`, `Streak` — asserted on `.stat-box__label`.
2. The spoken labels read `Fastest time`, `Longest 1-go streak`, `Longest play streak` —
   asserted on the `.sr-only` span. The three `Current` labels are unchanged, which is the
   pairing b25 rests on.
3. No `Best` anywhere on the panel.

**Then** — `src/completion.ts`: six strings in the three `statPair` calls. The mechanism does
not change — the redesign's two-span markup already separates what is seen from what is
spoken.

**But the test file is not a three-line edit**, which the first draft implied and `da-plan`
corrected. `tests/completion-stats.spec.ts` keys **nine existing assertions** off the old
full labels through its `pair()` helper — at lines 137, 255, 257, 259, 265, 274, 313, 429 and
440, including one that asserts the visible short word is `Best`. Every one of them changes
in this same commit, or `npm test` is red at the task boundary.

Commit: `feat(stats): Fastest and Streak, with the full words in speech`

---

## Task 7 — the flame

Implements b10, b17, b18, b46.

- `public/sprites.svg` — Lucide `flame` as `icon-flame`, house style: `viewBox="0 0 24 24"`,
  `fill="none"`, `stroke="currentColor"`, `stroke-width="2"`, round caps and joins.
- `src/completion.ts` — `statPair` gains a flame when `isBest`. It goes **inside** the `dd`,
  before the value, so it sits with the number rather than the label:
  `<dd class="stat-box__value stat-box__value--best"><svg class="stat-flame"
  aria-hidden="true"><use href="/sprites.svg#icon-flame"/></svg>1m 20s</dd>`.
  Inheriting `currentColor` from the `dd` is what makes b17's "same colour as the number"
  true in both modes and all four themes without a second declaration.
- **No flame when the value is `—`** (b46). `bestTimeSeconds` is `null` whenever no game
  carries a time and that is reachable on a full panel — `tests/completion-stats.spec.ts`
  already pins the dash. A flame beside a dash is a badge for an achievement nobody has.
  `statPair` has no way to know that from its arguments, so say it explicitly: the flame is
  emitted when `isBest && value !== '—'`, comparing against the exact character
  `formatDuration` returns for `null` (`src/player-stats.ts`). One condition, in one place.
- `src/tailwind.css`, in `@layer base` beside the other panel rules — `.stat-flame {
  inline-size: 1em; block-size: 1em; vertical-align: -0.125em; margin-inline-end: 0.25rem; }`.
  No `flex: none`: the `dd` is a block, not a flex container, so it would do nothing.

**Tests** — `tests/sprites.spec.ts` gains `icon-flame` to its list, which already checks the
id, the viewBox and `currentColor`. `tests/completion-stats.spec.ts`:
4. A flame in each of the three `--best` values and in none of the three `Current` ones.
5. Every flame is `aria-hidden="true"`.
6. **No flame when Best time is a dash**, rendered from a history with no times.
7. The flame is inside the `dd`, not the `dt` — so it never lands in the spoken label.

Commit: `feat(stats): a flame on each record`

---

## Task 8 — the body font

Implements b11, b21, b49.

`src/tailwind.css` — delete the `font-family: "Inconsolata", monospace` declaration from
every completion-panel rule. Deleting rather than overriding is right: `html, body` already
sets `var(--font-sans)`, so removal inherits Quicksand correctly.

The rules are `.stat-block__head h3`, `.stat-hero`, `.stat-figure__value`, `.stat-box__title`,
`.stat-box__value`, `.stat-row dd:not(.stat-note)` and `.goes-row`. **`.stat-hero` is in that
list and b21's prose left it out** (b49) — it is the `Solved!` line for a saving-off player.

Nothing outside the panel is touched (b21). The digit boxes, the keypad, the clue tags and
the "Your guesses" label keep Inconsolata.

**Test** — `tests/completion-stats.spec.ts`, in the existing describe that reads the
stylesheet: no completion-panel rule declares Inconsolata. Written as a sweep over the panel's
rules rather than a list of seven, so a rule added later is covered too.

Commit: `style(stats): the panel reads in the body font`

---

## Task 9 — the boxes go

Implements b13, b15, b42, b51, b52.

- `src/tailwind.css` — `.stat-box` loses `background-color`, `border` and `padding`. It keeps
  nothing at all, so the rule goes entirely rather than sitting empty.
- `src/completion.ts` — the `shadow-box` utility comes off the `.stat-box` div. **The shadow
  is in the markup, not the stylesheet** (b42), which is why the guard below reads both files.
- `.stat-boxes`'s `gap` goes from `0.5rem` to `1rem` (b51). With no borders, the gap is the
  only thing separating the three groups, and vertical space cannot do that job for a
  horizontal grid.
- `.stat-boxes--two` is deleted with the Average block in task 10 (b52).

**Test** — `tests/completion-stats.spec.ts`, and both halves matter:
- **No rule whose selector is exactly `.stat-box` exists**, and no `.stat-box*` rule declares
  `background-color`, `border` or `box-shadow`. Written as both, because the plan deletes the
  rule outright: a test that looks up the rule body and asserts an absence inside it passes
  trivially when the rule is gone, and would go on passing if someone re-added it under a
  near-identical selector. A loose `.stat-box` pattern also matches `.stat-boxes`,
  `.stat-box__title` and `.stat-box__value`, so the selector match has to be exact.
- **`src/completion.ts` emits no `shadow-box` on a `.stat-box`** — the half a
  stylesheet-only guard would miss entirely (b42), because the shadow is a utility in the
  markup.

Commit: `style(stats): the records lose their boxes`

---

## Task 10 — the averages go back to All time

Implements b12, b20, b23, b48, b52.

**Tests first** — `tests/completion-stats.spec.ts`:
10. No `data-stat-block="average"`; the panel is three blocks.
11. All time reads, in order: **Plays, First-go wins, Average goes, Average time**, then the
    chart (b48, stated literally because the state it refers to is only in git history).
12. Both returning rows carry their explanatory line — "Your average number of guesses." and
    "How long you usually take." (b23).
13. Fastest first-go win does **not** come back (b14).

**Then** — `src/completion.ts`: delete the `block('average', …)` call, add two `statRow` calls
and their two `NOTES` entries back. `src/tailwind.css`: delete `.stat-boxes--two`.

The existing pair-based assertions for `Average time` and `Average goes` move back to the
`stat()` row helper. `CompletionPage.stat()` in the e2e page object handles both shapes
already, so it needs no change for this.

Commit: `feat(stats): the averages return to All time`

---

## Task 11 — end to end

Implements b36. **I cannot run Playwright on this machine and will not try.** These edits get
read carefully; CI is the first real signal.

- `e2e/pages/completion.page.ts` — **the `average` locator stays.** The first draft deleted
  it and `da-plan` found two uses the draft had not counted: `e2e/specs/player-stats.spec.ts`
  asserts `completion.average` has count 0 in the brand-new-player test and again in the
  saving-off test. Those assertions are still meaningful — the block should be absent — so
  keeping the locator is both less work and a better test than deleting three lines. `boxes`
  stays too; the Best block still has three.
- **The header-alignment check is gone**, with the header work it was written for (b59).
- `e2e/specs/player-stats.spec.ts` — the Average-block assertions move back to All-time rows;
  `Best time` becomes `Fastest time`; `Current 1-go streak` and `Current play streak` are
  unchanged; the two-boxes-in-Average assertion goes and the three-in-Best one stays.
- `e2e/specs/completion.spec.ts` — the `completion.average` reference goes.
- The new header-alignment check from task 3.

Commit: `test(e2e): three blocks and the new labels`

---

## Task 12 — the docs

`docs/DESIGN-SYSTEM.md` (b45) — five wrong things after this work: the "four blocks in reading
order" line, the class list, the short-label/spoken-label pairs, the Inconsolata entry as it
applies to the panel, and the already-stale `max-w-sm (~24rem)` line. Rewritten for three
blocks, the new labels, the flame, the body font, and a new short section recording the page
column: the number, the rule behind it, that the padding sits outside the cap, and one
consequence worth writing down — the cap is in `px`, so the column stops growing at large
browser text, while `.stat-boxes`' three-across breakpoint is in `rem` deliberately so that
it still stacks. b56 chose 480px knowingly; this is the note that stops someone "fixing" one
of the two to match the other.

Commit: `docs(design-system): the page column and the polished panel`

---

## QA

**Light** (b32). No worker logic, no storage, no routing, no arithmetic. But note this is a
wider diff than the redesign was: it touches every page, not one panel.

- `npm test` after every task; `npm run build` before the pull request.
- Playwright by CI. The header-alignment check is the only new one and it must run on a
  desktop project — the two mobile projects are 390px and 393px and never meet the cap.
- By eye on the preview with `?demo=stats`: both modes, all four themes, and specifically at
  **320px, 375px, 480px and a desktop width**, which are the four cases the cap and the
  gutter behave differently at.
- The 320px check also settles b50 — redesign item 69's three-column fit was calculated in
  Inconsolata, and both the font change and the loss of the box padding move it.
- **Dave is asked one specific thing on the preview** (b43): whether the two averages coming
  back into All time bothers him, given that taking them out was the answer to his own
  "it repeats itself and runs long". The brief flagged it and the first draft of this plan
  left it to a general "by eye", which is how a named question quietly becomes nobody's.

## Risks worth naming

1. **The width work reaches beyond the panel**, though far less than the first draft assumed:
   the three screens, and `/stats`. Task 5 is the one to review hardest.
2. **Top-aligning is a visible change to `/welcome`** (task 3) that nobody has seen yet. It is
   two declarations and trivially reversible, but it changes the first screen a new player
   meets, so it wants a real look on the preview rather than a nod.
3. **`/stats` is the only page whose width is depended on by code** (task 5). The label
   arithmetic survives, but the SVG font-size media queries no longer line up with anything
   real. Named, not fixed.
4. **`.stat-boxes`' three-across breakpoint is a viewport media query on a component inside a
   capped column**, as are the `clamp(…, 5vw, …)` type sizes. They do not track the column.
   Harmless at 480px — the column only ever gets wider — but it is the same class of bug as
   the one this plan is fixing, one level down.
5. **Nothing tested any width before today.** Every assertion in `tests/page-width.spec.ts` is
   new ground, so a mistake in it fails silently rather than loudly.
6. **The footer still has no horizontal padding**, so its text meets the screen edge at
   320px. Real, small, not asked for, and deliberately not smuggled into this pull request.

## Open questions

**None.** The brief settled the width, the reach, the labels, the speech and the flame. The
two survey findings above are consequences of b54 rather than new decisions — capping the
column without capping the header would not deliver what b54 asks for, and the menu would
break either way.

**One stated omission**, so it is not a silent one. `src/worker/feedback.ts` renders a fourth
Worker page — the feedback triage tool — at `max-width: 680px`. b54 said "everywhere", and
this is deliberately not included: it is an internal admin tool, nobody but Jamie opens it,
it is read on a laptop, and it is a list of feedback rows rather than a game screen. Say if
you want it in.

---

## What `da-plan` changed

- **HIGH — the menu had to move, not just be restyled.** `#app-menu` is a sibling of
  `</header>`, so `top-full` against an unchanged parent would have dropped it a full
  viewport below the fold. Overtaken by Jamie's b59 — the header does not move, so neither
  does the menu — but the finding was correct and is recorded in case the header is ever
  capped later.
- **HIGH — task 1 left the tree red.** Two of its four tests asserted states that tasks 2, 4
  and 5 create. Split across those tasks.
- **MEDIUM — `/archive` is already 480px of content**, and the proposed change was a
  `rem` → `px` regression that would have hurt the large-text case. Its width now stays put.
- **MEDIUM — the `/stats` chart text would have shrunk a fifth** and gained a size cliff at a
  641px window. Base sizes raised to cancel the new scale; the 640px step dropped.
- **MEDIUM — the alignment check would have failed by 4px** on the brand button's `-mx-1`,
  and would have run on two phone projects where the cap never binds. Also overtaken by b59:
  the check is gone with the header work.
- **MEDIUM — task 6 understated its own diff**: nine existing assertions key off the old
  labels, not three.
- **MEDIUM — the Worker parity test was close to vacuous.** Now asserts the derived content
  width rather than looking for `1rem` in a stylesheet full of them.
- **The Lows, all taken**: utilities layer rather than base; the footer's real reason is its
  missing padding, not centring; four drifted line numbers; the triage page named; the
  `.stat-box` guard made non-vacuous; two more `completion.average` uses; task 2's
  contradiction about `py-8`; the flame's dash condition and its dead `flex: none`; the `rem`
  consequence of a `px` cap recorded in the docs task; and Dave's question given a home.
