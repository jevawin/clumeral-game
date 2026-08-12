# Plan — stats panel polish, and one page width everywhere

Date: 2026-08-12 · Branch: `dev/stats-tweaks` · Author: Claude (clumeral dev bot)

Built from [`2026-08-12-stats-polish-brief.md`](2026-08-12-stats-polish-brief.md), closed the
same day. Item numbers in brackets — `(b53)` — refer to that brief. **This plan settles how,
not what.** Anything the brief genuinely left unnamed is in "Open questions" rather than
decided quietly.

Status: **awaiting `da-plan`.**

---

## The two things the brief did not know

A read-only survey of every layout container in the repo turned up two facts that change the
shape of the margin work. Both are recorded here because the brief was written without them.

**1. The header and the footer have no width cap at all.** `index.html:160` is a direct child
of `<body>`, sibling to `<main>`, with `px-4` and nothing else. The footer at
`index.html:385` has no padding and no cap. Today that accidentally lines up, because every
screen also sits at a 16px gutter. The moment the content column caps at 480px and centres,
the logo stays hard against the left edge while the content starts at `(viewport − 480) / 2`.
On a 1280px desktop that is a 384px gap between the logo and the content beneath it.

That is exactly the "it jumps around on desktop" that b54 is about, so **the header and the
footer are in scope**, on both the app and `/archive`. The brief's file list did not mention
them and they are the largest part of this work.

**2. The menu dropdown is positioned against the viewport, not the header.** `index.html:180`
uses `absolute top-14 right-0`, and `<body>` is not positioned, so those resolve against the
initial containing block. Cap and centre the header and the menu stays pinned to the far
right of the window while its button moves inward. It needs a positioned wrapper, and that
is a real bug this change would otherwise introduce.

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

and two utilities in `@layer base`:

```css
.page-col  { inline-size: 100%; max-inline-size: var(--page-max); margin-inline: auto; }
.page-pad  { padding-inline: var(--page-gutter); }
```

**Test** — new `tests/page-width.spec.ts`, reading the files the way `tests/token-parity.spec.ts`
already reads them. There is **no existing test anywhere that asserts any width or padding**
(confirmed by survey), so this is the whole guard:
1. `--page-max` is `480px` and `--page-gutter` is `1rem` in `src/tailwind.css`.
2. `.page-col` sets `max-inline-size: var(--page-max)` and centres; `.page-pad` sets
   `padding-inline: var(--page-gutter)`.
3. **No `max-w-[…px]` survives on any screen section or its wrapper in `index.html`, and
   none in `src/welcome.ts`.** Asserted as an absence, because the failure this guards is
   someone adding a fourth screen with its own number.
4. The Worker stylesheets carry the same two numbers — `480px` and `1rem` — in their page
   containers. They cannot import the token, so this is the parity check that they agree.

Commit: `feat(layout): one page width, declared once`

---

## Task 2 — the three screens

Implements b53, b56, b57.

- `index.html:214` — the game section keeps `px-4 py-5`; swap `px-4` for `page-pad` so it
  reads from the token. `index.html:215` — `max-w-[390px] mx-auto` becomes `page-col`.
- `index.html:344` — the completion section gains `page-pad` and its vertical padding.
  `index.html:345` — `max-w-[390px] mx-auto … px-6 py-8` becomes `page-col … py-8`, and
  **`px-6` goes**: the padding moves out to the section. This is the change b38 is about.
- `index.html:210` — the welcome section gains `page-pad`.
- `src/welcome.ts:123` — `max-w-[390px] … px-6 py-8` becomes `page-col … py-8`, same move.
  It has no `mx-auto` today and is centred only because `welcome.ts:121` adds `items-center`
  to the section at runtime; `page-col` gives it `margin-inline: auto` so it no longer
  depends on that.

The digit boxes grow from about 110px to about 140px on a wide screen, which b57 records as
accepted. Nothing else on `/play` changes — b21's "no change to the play screen" was about
the font, and this is the sizing decision that came after it.

Commit: `feat(layout): the three screens share the page column`

---

## Task 3 — the header, the footer, and the menu

Implements b54, and the two survey findings above.

- `index.html:160` — the header keeps its height, background and bottom border, which must
  stay full-bleed. So the cap goes on a **new inner wrapper**, not on the header itself:
  `<header class="… h-14 bg-bg border-b border-border"><div class="page-col page-pad flex
  items-center justify-between h-full relative">…</div></header>`. A capped header would put
  the border in the middle of the screen.
- That wrapper carries `relative`, which is what the menu needs. `index.html:180`'s
  `absolute top-14 right-0` becomes `absolute top-full right-0` against the wrapper, so the
  menu tracks its own button at every width instead of the window's right edge. The burger's
  `-mr-[10px]` optical nudge is unaffected.
- `index.html:385` — the footer gains an inner `page-col page-pad` wrapper for the same
  reason: its text is centred, so without a cap it centres against the window while the
  content above it centres against 480px.

**Tests** — `tests/page-width.spec.ts`:
5. The header's inner wrapper carries `page-col`, and the `<header>` itself does not — the
   border must still run edge to edge.
6. The menu is `top-full` inside a `relative` ancestor and no longer `top-14` against the
   viewport.
7. The footer has a `page-col` wrapper.

`e2e/specs/` — one new check in the existing desktop suite: at a desktop width, the header
brand's left edge and the content column's left edge are within a pixel of each other. This
is the assertion that actually proves "it doesn't jump around", and it can only be made in a
browser. **Run by CI, never here.** The two mobile projects are 390px and 393px, so neither
would exercise the cap at all — this check has to be a desktop-project one to mean anything.

Commit: `fix(layout): header, footer and menu follow the page column`

---

## Task 4 — `/archive`

Implements b54.

`src/worker/puzzles.ts`, mirroring task 1's numbers by hand because the Worker page cannot
import the token:
- `main.archive` (`:178`) — `max-width: 32rem` becomes `480px`, and its `padding: 1.25rem 1rem
  2rem` loses the horizontal 1rem, which moves to a wrapper. Simpler and equivalent here:
  keep the padding on `main` and set `max-width: calc(480px + 2rem)`, so the **content** is
  480px. Both give the same result; the second is one line. Taking the second, with a comment
  saying why the number is not bare 480.
- `header.app-header` (`:127`) and `footer.app-footer` (`:276`) — an inner wrapper each, as
  in task 3, so the header border still runs edge to edge.

The table is `width: 100%`, so it follows the column from 512px down to 480px — a 32px
narrowing, which the date and goes columns absorb without wrapping.

Commit: `feat(layout): /archive on the page column`

---

## Task 5 — `/stats`, and the chart arithmetic that depends on it

Implements b54, b57.

This is the one page where the width is **load-bearing in code**, not just in CSS.
`src/worker/chart.ts:9-13` documents the derivation — "`/stats` body is max-width 40rem with
1.5rem padding, so it is 592px on desktop and 327px on a 375px phone" — and `chart.ts:29`
sets `LABEL_W = 87` for that 327px case.

- `src/worker/stats.ts:296` — `body` moves from `max-width: 40rem; padding: 1.5rem` to the
  480px content width with a 1rem gutter, expressed the same way as task 4.
- Desktop content goes 592px → 480px. **The labels still fit**: `LABEL_W` was sized for the
  327px phone case, and 480 is comfortably wider, so nothing collides. The narrow case is
  unchanged — a 375px phone was 327px and becomes 343px, because the gutter drops from 24px
  to 16px. So this page gets slightly *wider* on a phone and narrower on a laptop.
- `chart.ts:9-13`'s comment is corrected to the new numbers. It is the only place the
  derivation is written down, and leaving it wrong would mislead the next person sizing a
  label.
- `stats.ts:353-355`'s three viewport media queries scale the SVG text at 640/480/380px.
  They are viewport queries on a page whose content is now capped, so the 640 step no longer
  corresponds to anything. Left alone in this task and noted as a risk — retuning the chart
  is not what Jamie asked for, and it is a dashboard only the two of them read.

Commit: `feat(layout): /stats on the page column`

---

## Task 6 — the labels

Implements b9, b22, b25.

**Tests first** — `tests/completion-stats.spec.ts`:
1. The visible labels read `Fastest`, `Streak`, `Streak` — asserted on `.stat-box__label`.
2. The spoken labels read `Fastest time`, `Longest 1-go streak`, `Longest play streak` —
   asserted on the `.sr-only` span. The three `Current` labels are unchanged, which is the
   pairing b25 rests on.
3. No `Best` anywhere on the panel.

**Then** — `src/completion.ts`: six strings in the three `statPair` calls. Nothing structural;
the two-span mechanism from the redesign already separates seen from spoken.

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
- `src/tailwind.css` — `.stat-flame { inline-size: 1em; block-size: 1em; flex: none;
  vertical-align: -0.125em; margin-inline-end: 0.25rem; }`.

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

**Test** — `tests/completion-stats.spec.ts`:
8. `src/tailwind.css` declares no `background-color`, no `border` and no `box-shadow` for
   `.stat-box`.
9. **`src/completion.ts` emits no `shadow-box` on a `.stat-box`** — the half a
   stylesheet-only guard would miss.

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

- `e2e/pages/completion.page.ts` — the `average` locator goes; `boxes` stays (the Best block
  still has three).
- `e2e/specs/player-stats.spec.ts` — the Average-block assertions move back to All-time rows;
  `Best time` becomes `Fastest time`; `Current 1-go streak` and `Current play streak` are
  unchanged; the two-boxes-in-Average assertion goes and the three-in-Best one stays.
- `e2e/specs/completion.spec.ts` — the `completion.average` reference goes.
- The new header-alignment check from task 3.

Commit: `test(e2e): three blocks, new labels, and the column alignment`

---

## Task 12 — the docs

`docs/DESIGN-SYSTEM.md` (b45) — five wrong things after this work: the "four blocks in reading
order" line, the class list, the short-label/spoken-label pairs, the Inconsolata entry as it
applies to the panel, and the already-stale `max-w-sm (~24rem)` line. Rewritten for three
blocks, the new labels, the flame, the body font, and a new short section recording the page
column: the number, the rule behind it, and that the padding sits outside the cap.

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

## Risks worth naming

1. **This touches every page.** The panel work is contained; the width work is not. Tasks 3,
   4 and 5 are the ones to review hardest, and the header is where a mistake is most visible.
2. **The menu bug is introduced by this change and fixed inside it** (task 3). If task 3 is
   split or reordered, cap the header without moving the menu and the menu detaches from its
   button on desktop.
3. **`/stats` is the only page whose width is depended on by code** (task 5). The label
   arithmetic survives, but the SVG font-size media queries no longer line up with anything
   real. Named, not fixed.
4. **`.stat-boxes`' three-across breakpoint is a viewport media query on a component inside a
   capped column**, as are the `clamp(…, 5vw, …)` type sizes. They do not track the column.
   Harmless at 480px — the column only ever gets wider — but it is the same class of bug as
   the one this plan is fixing, one level down.
5. **Nothing tested any width before today.** Every assertion in task 1 and task 3 is new
   ground, so a mistake in them fails silently rather than loudly.

## Open questions

**None.** The brief settled the width, the reach, the labels, the speech and the flame. The
two survey findings above are consequences of b54 rather than new decisions — capping the
column without capping the header would not deliver what b54 asks for, and the menu would
break either way.
