# Design System

## Theming

- Tailwind v4 utility-first with `@theme` tokens in `src/tailwind.css`.
- Dark mode uses `@custom-variant dark (&:where(.dark, .dark *))`. JS sets `html.dark` / `html.light`.
- Accent colour is user-selectable via a 4-theme picker — **Lime** (default), **Cherry**, **Blueberry**, **Grape** — persisted in `dlng_colour`. `colours.ts` sets `data-theme` on `<html>`; CSS resolves hue and chroma from it.
- `light-dark()` is used only inside `@keyframes octo-colours` mid-frames. All other styling uses Tailwind `dark:` variants or explicit `html.dark` overrides.
- Use `--color-*` token variables — never hardcode hex values for theme colours.

## The palette is derived, not picked

Every colour computes from a small set of declared values in
[src/palette.ts](../src/palette.ts), which is the single source of truth for the
CSS, the Worker mirror and the tests.

The CSS cannot import it, so that claim is enforced rather than assumed:
[tests/token-parity.spec.ts](../tests/token-parity.spec.ts) compares `palette.ts`
against **both** stylesheets, three-way. Two-way parity between the stylesheets
alone would let them drift together away from `palette.ts` — and since
[tests/palette-contrast.spec.ts](../tests/palette-contrast.spec.ts) asserts AA
from `palette.ts`, that drift would ship a sub-4.5:1 palette with a green suite.
Change a declared value in one place only and the parity test names the other two.

```
bases          dark #121213 · light #FAFAFA
surfaces       dark #2A2A2B · light #FFFFFF
text           dark #FAF8F4 · light #262624
accent-l       light 0.50 · dark 0.78          <- the AA guarantee
hue angles     Lime 145 · Cherry 5 · Blueberry 262 · Grape 305
accent chroma  light  0.157 · 0.201 · 0.178 · 0.237
               dark   0.174 · 0.135 · 0.111 · 0.140
semantics      success = Lime · error = Cherry (aliases, not values)
```

Accents resolve as `oklch(var(--accent-l) var(--accent-c) var(--accent-h))`.

### The rule that matters

**Contrast rides on `--accent-l` alone**, and it is shared by all four themes. So
a theme cannot fail WCAG AA — the parameter that determines contrast is not one
a theme gets to vary.

Chroma and hue are **contrast-inert**: pushing chroma to its sRGB ceiling moves
the ratio by at most ~0.5, and never below AA. That is what makes them free
aesthetic dials, and why chroma can be set per theme without reopening the
contrast question.

This is the point of the whole system. #254 shipped an AA failure because
contrast was audited *per pairing* by hand, so one missed pairing shipped. Here
the failure is structurally unrepresentable rather than merely fixed, and
[tests/palette-contrast.spec.ts](../tests/palette-contrast.spec.ts) asserts it by
computation across every accent × mode × surface pairing.

Worst accent ratio 5.36 (Lime light on bg); worst overall 5.36.

### Adding a theme

Add a hue angle to `PALETTE.hues` and a chroma to `light.accentC` / `dark.accentC`
— three numbers. Then add the `html[data-theme="..."]` rule in `tailwind.css`, its
mirror in the Worker, and an entry in `ICONS` in `colours.ts`.

No contrast pairings to verify by hand: the AA test covers the new theme
automatically. Pick the dark chroma by finding the hue's sRGB ceiling at L=0.78
rather than by eye — dark chroma is usually gamut-limited, not a free choice.

**Truncate chroma to 3dp, never round.** Cherry dark's ceiling is 0.135523; the
value 0.136 is out of gamut, and out-of-gamut colours get clipped, which shifts
lightness — the one thing the AA guarantee rests on. The gamut assertion in the
contrast spec catches this, and did catch it during #255.

### success and error alias two themes

They are not colours of their own: `success` is the Lime accent and `error` is
the Cherry accent, at the same lightness, chroma and hue. Under Lime the success
message and the accent are the same green; under Cherry the error message and the
accent are the same red.

That is acceptable because **colour is never the signal**. The wording differs
outright ("Solved in 2 tries!" vs "Not quite — try again") and a tick or cross
sits beside it. Colour is the third, fully redundant cue (WCAG 1.4.1).

**The constraint this creates:** success and error must always differ in words or
icon. If both were ever reduced to colour alone, there would be no difference
left to read under the aliased theme.

An earlier revision gave the semantics their own lightness band below the accent.
It was dropped: green is gamut-crushed at the bottom of the scale (ceiling 0.110
at L=0.40), so the light success green came out too dark, and lifting it spent
the very separation the band existed to provide. Aliasing removed six declared
values and the tightest pairing in the system — error dark on surface was 4.70.

### Two tokens are gone

- **`--color-accent-strong`** — removed. One accent per mode now clears AA on
  both `bg` and `surface` in all four themes, so the strong/raw split has nothing
  left to do. Use `text-accent` everywhere.
- **`--color-on-accent`** — collapsed into `--color-bg`. Contrast is symmetric,
  so "accent text on bg" and "bg text on accent fill" are the same ratio; making
  on-accent literally `bg` turns two AA checks into one.

### Tokens

| Token | CSS variable | Light | Dark | Usage |
|-------|-------------|-------|------|-------|
| bg | `--color-bg` | `#FAFAFA` | `#121213` | Page background |
| text | `--color-text` | `#262624` | `#FAF8F4` | Primary text |
| accent | `--color-accent` | derived | derived | Accent colour, buttons, links |
| surface | `--color-surface` | `#FFFFFF` | `#2A2A2B` | Input/card backgrounds |
| border | `--color-border` | derived | derived | Borders, dividers |
| success | `--color-success` | derived (Lime) | derived (Lime) | Correct feedback, correct-box highlight |
| error | `--color-error` | derived (Cherry) | derived (Cherry) | Wrong-guess and error feedback |

`--color-border` is `color-mix(in srgb, var(--color-text) 12%, transparent)`, so
it follows the mode without an override.

### Known exceptions

- **`--octo-c1/2/3` stay hardcoded hex.** They cannot use `var()` inside SVG
  `fill` keyframes — Lightning CSS rewrites it to an invalid `<paint>` value that
  falls back to black (#210). Six values, decorative, no contrast requirement.
  They are **frozen legacy values** — the pre-#255 hand-picked Cherry, Blueberry
  and Grape accents. They no longer match any theme and do not track the palette.
- **`--color-border` has a light-only build fallback.** Lightning CSS emits
  `--color-border:#2626241f` ahead of the live `color-mix`, and that literal is
  light-mode text at 12% with no dark counterpart. Every browser that supports
  `color-mix` (Baseline since 2023) takes the live value and is correct in both
  modes; a browser older than that gets near-invisible borders in dark mode.
  Accepted: adding a hardcoded dark literal to fix a pre-2023 path would
  reintroduce the per-mode hand-maintained value this system exists to remove.
- **The Worker mirrors the tokens.** See below.

### Build constraints

- **Unused `@theme` tokens are tree-shaken out of the bundle.** A token only JS
  reads must be referenced somewhere in CSS or it will not ship.
- **`oklch(var(--x) var(--y) var(--z))` survives the build verbatim**, as does
  `calc()` inside it. Verified by building and reading the emitted bundle.
- **`color-mix()` with a `var()` inside emits an `@supports` guard** plus a plain
  fallback. Static `color-mix` is folded to a literal at build time.

### SSR pages duplicate these tokens

`/archive` is Worker-rendered ([src/worker/puzzles.ts](../src/worker/puzzles.ts))
with its own inline `<style>` that mirrors the token set, the per-theme rules and
the `.btn` system. It does not load `tailwind.css`. **A colour change in
`tailwind.css` does not reach it** — update both. This is exactly how #243
survived its first fix.

[tests/token-parity.spec.ts](../tests/token-parity.spec.ts) fails if the two
drift apart. It also guards a subtler trap: the Worker's inline `<script>` runs
before the stylesheet applies and writes to `documentElement.style`, which
outranks every rule in the `<style>` block. It must set `data-theme` and must
never set a colour custom property inline, or `/archive` would silently pin
itself to a hardcoded value while every parity check still passed.

The duplication goes away with #200, which migrates `/archive` to a SPA route.

## Typography

- Body / headings: **Quicksand** 400/600/700 (Google Fonts), fallback `system-ui` — `--font-sans`
- Mono (digit boxes, keypad, clue tags): Inconsolata 400/700 (Google Fonts). **Not the
  completion panel** — that reads in Quicksand, numbers included.

## Layout

### The page column

**One content width for every page: 480px, behind a 16px gutter.** Declared once, as
`--page-max` and `--page-gutter` in `src/tailwind.css`, and applied through two utilities:
`.page-col` caps and centres, `.page-pad` puts the gutter on the element **outside** it.

- The split matters. Padding *inside* a capped box eats the content width, which is how
  `/welcome` and `/solved` ended up 32px narrower than `/play` on a large phone without
  anybody noticing. Content is `min(480, viewport − 32)` everywhere.
- **Why 480**: the cap must never be narrower than a phone, so a phone always fills its
  screen and only a desktop ever meets it. A Galaxy S24 Ultra reports 480 and a Pixel 8 Pro
  448, so 440 would not have held.
- **Why px and not rem**: at large browser text the column stops growing rather than
  outrunning the window. Components inside it keep their `rem` breakpoints — `.stat-boxes`
  is `min-width: 22.5rem` deliberately, so the three records still stack at 200% text. Do
  not "fix" one of the two to match the other; they answer different questions.
- The Worker-rendered pages cannot import the token, so `/archive` and `/stats` repeat the
  numbers. `tests/page-width.spec.ts` asserts the width they *work out to*, not the strings.
  `/archive`'s `32rem` is already 480px of content behind its 1rem padding — leave it.
- **One divergence, accepted.** `/archive` is in `rem` and everything else is in `px`, so at
  200% browser text its column grows to 600px of content while the app stays at 480. At
  default text they are identical. Both choices are deliberate: `px` stops the app column
  outrunning the window, and the `rem` genuinely helps `/archive`'s large-text case. If one
  of them ever has to give, this is the note saying it was a trade-off and not an oversight.
- **The header and footer are deliberately full width** and have no cap. The jumping around
  this solves is the content area changing width between page views, not chrome sitting at a
  different edge from the content.
- **Every screen starts at the top.** No `justify-center` on a screen container: `/welcome`
  and `/solved` used to centre vertically while `/play` did not, so moving between screens
  walked the content up and down the window.

### Other

- No fixed breakpoints beyond the page column.
- Game screen uses new screen architecture: `data-screens` overlay with `data-screen` sections.
- Legacy wrapper (`min-h-screen bg-bg`) holds header octo + title.
- No `!important` unless overriding third-party.

## Component styles

Component-specific CSS lives in `src/tailwind.css` using data-attribute selectors:

- `[data-octo-wrap]` -- octopus mascot base styles and animations
- `[data-octo-slot]` -- fixed-dimension layout spacer for octo
- `[data-fb-modal]` -- feedback modal fade + scale animation
- `[data-digits].digit-correct` -- correct-answer green tint on digit boxes
- `[data-tlt]` -- title letter groups for staggered reveal animation
- `.skip-link` -- keyboard-accessible skip navigation
- `.htp-*` -- how-to-play visual example components
- `.clue__*` -- clue display components (tag, digits, lines)
- `.digit-box*` -- digit entry box and grid styles
- `.fb-cat` -- feedback category pill selected state
- `.toast-msg` -- toast notification element
- `.recurring` -- recurring decimal overdot
- `.stat-block__*`, `.stat-hero`, `.stat-today`, `.stat-figure*`, `.stat-boxes`,
  `.stat-box__*`, `.stat-flame`, `.stat-row`, `.stat-note` -- the completion panel's three
  blocks. Note there is no `.stat-box` rule: the records have no box left, only a grid gap.
- `.goes-*` -- the "How many goes you take" chart
- `.save-note*` -- the untick warning and submit countdown on the play screen

## The completion panel

Three blocks in reading order: **Today**, **Best**, **All time**.

- **Today is the hero** -- two figures side by side, each an icon and a number, and the
  largest type on the panel. It is the only thing that changed in the last ten seconds.
  It shows `1 go` under a calculator-with-tick and `2m 38s` under a stopwatch.
- **The completion panel has no `Solved in ...` sentence; the play screen still does.**
  That divergence is deliberate. `heroLine` in `src/completion.ts` builds the play
  screen's line and is called from `src/app.ts`, not from the panel -- it looks like panel
  code and is not. Leave it alone when tidying that file.
- **Three rungs of type size**, used by every block: (1) the Today icons and figures,
  (2) the box titles and the numbers in the boxes, (3) the small labels in the boxes.
  Numbers are bold; box titles are the same size and not bold; labels are regular in the
  ordinary foreground colour. All-caps stays on the block headings and never appears
  inside a box.
- **Section headings are 24px, normal case, with no rule beside them** and a decorative icon
  in the section's own colour -- a flame for Streaks, a trophy for Records, a calendar for
  All time.
- **Figures sit in boxes borrowing the undo/reset controls' resting state**: surface fill,
  the same 1.5px border (in the section's colour) and the same radius. The box's own icon is
  repeated as a **watermark** -- 4rem, rotated 45deg, faint, run off the bottom-right corner
  so the box clips it. `overflow: hidden` on `.stat-col` is what does the clipping.
- **The label is above the number, in the DOM as well as on screen.** The redesign needed
  `column-reverse` to put the number on top; this layout does not, so the visual order and
  the reading order agree again. Do not add it back.
- **Labels 16px, numbers 20-28px, subtitles never below 14px.** The number's `clamp` tops
  out where three boxes still fit a 390px screen.
- **The whole panel reads in Quicksand**, numbers included. The rules declare no font family
  at all and inherit from `html`/`body`, which is why removal was the right edit rather than
  an override. The play screen keeps Inconsolata: its keypad relies on every key being the
  same width.
- **The two averages live in All time**, as rows with their explanatory lines, alongside
  plays and first-go wins. They had their own block briefly and it repeated the panel.
- **All four theme colours are on screen at once**, in picker order from the player's own:
  their solve keeps `--color-accent`, then Streaks takes `--color-accent-2`, Records
  `--color-accent-3` and All time `--color-accent-4`. Change theme and all four rotate
  together. Each section sets `--section-accent` once and every icon, number and box border
  inside reads from it, so there is no per-figure colour class to get wrong.
- **Colour lands on icons, numbers and box borders only.** Never on a label, a heading or a
  divider: everything a player has to read stays in the foreground colour.
- It is CSS, not JavaScript. Chroma differs per theme *and* per mode, and the panel renders
  once, so deriving the colours at render time would freeze three of them the moment
  somebody switched theme on `/solved`. Each slot names the other hue's own `--chroma-*`
  rather than reusing the current theme's -- borrowing Lime's chroma for Cherry puts Cherry
  out of gamut. The mapping is pinned in `tests/accent-rotation.spec.ts`, and mirrored into
  the Worker's inline style because `tests/token-parity.spec.ts` compares every `--accent-*`
  declaration between the two.
- **The boxes borrow the play screen's digit-box styling** -- surface background, 1.5px
  border, 0.25rem radius, the `shadow-box` utility -- so a theme change moves both screens
  together.
- **Boxes are three across from 22.5rem and one column below it.** `rem`, not pixels: it
  is 360px at default text size and also stacks at large browser text on a wide screen,
  which is what the 320px / 200% requirement is really about.
- **The number sits above its label on screen while the DOM stays `dt` then `dd`.**
  `.stat-box__pair` is `column-reverse`. A screen reader must hear "Best time, 1m 20s",
  and `dd` before `dt` is not conforming HTML; the pairing is carried by the description
  list, not by position (WCAG 1.3.2). Do not "fix" the markup to match the picture --
  `tests/completion-stats.spec.ts` pins the DOM order.
- **The visible label is short and the spoken one is full.** "Fastest", "Streak" and
  "Current" on screen; "Fastest time", "Longest 1-go streak", "Current play streak" in a
  visually hidden span. Two spans, not a prefix and a suffix -- neither is the start of the
  other.
- **There is no Today block.** The two figures for this game sit centred directly under the
  solved message, which reads `Puzzle #160 solved! You took:` -- and gains those three words
  only when there are figures to follow them.
- **Times use unit letters, never a colon**: `0m 30s`, `4m 06s`, `1h 04m`. `4:06` can read
  as four hours at a glance, and the separator the hero used to need -- a bullet, or the
  pipe Dave suggested -- sits right beside a number, where a pipe is hard to tell from a 1.
  Letters remove the ambiguity and the separator both. Seconds are padded to two digits so
  a column lines up; minutes are not. An unknown time is a dash in a column of figures and
  is dropped entirely from the play screen's sentence. On the panel an unknown time drops
  the stopwatch figure altogether rather than showing an empty one. (Jamie and Dave,
  2026-08-11.)
- **All time is open, not folded, but quiet**: plain rows rather than boxes, and no dividing
  lines between them. Plays, first-go wins, average goes, average time, then the chart. The
  fastest first-go win is gone for good -- "Fastest" under Records is the same idea told
  better. The goes chart's bars stay on the player's own accent.
- **The explanatory lines live in All time only.** Inside a box, "Best" over "Current"
  under a labelled icon is already the explanation, and three sentences in three small
  boxes was the clutter the redesign was called for.
- **No new type sizes, and exactly one new colour token.** Everything is built from
  `--color-text`, `--color-accent`, `--color-accent-2/3/4`, `--color-border` and
  `--color-surface`. All four accents are the same four theme accents at the same
  `--accent-l`, so `tests/palette-contrast.spec.ts` already covers every one of them.
- **Blocks are absent, not hidden**, when they do not apply. A hidden block can still
  reach the accessibility tree, and an empty "All time" heading reads as broken.
- **The goes chart's bars are `aria-hidden`**; the count beside each bar is the accessible
  content, so nothing in the chart is available only as a picture.
- **The submit button dims to 0.5 opacity** while the untick countdown holds it. WCAG
  1.4.3 and 1.4.11 both exempt inactive controls from their contrast minimums, and those
  five seconds are exactly when the control is inactive. Deliberate -- do not "fix" it.

## Clue display

- **Boolean** (`type: 'text'`): `[subject] [is [not] predicate]`
  - Affirmative (`= true` / `!= false`): "The first digit **is a prime number**"
  - Negative (`= false` / `!= true`): "The first digit **is not a prime number**"
- **Numeric**: `[label] [operator in accent] [value in bold]`
- Operator rendering: `<=` -> `<=`, `>=` -> `>=`, `!=` -> `!=`, `=` -> `=`
