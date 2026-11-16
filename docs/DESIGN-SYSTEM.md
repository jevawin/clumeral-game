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
  outrunning the window. Components inside it keep their `rem` breakpoints — the Daily
  leaderboard's loading reserve switches at `max-width: 22.4375rem` deliberately, so it
  follows large browser text too. Do not "fix" one of the two to match the other; they
  answer different questions.
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
- `.result-card*`, `.streak__*`, `.ledger*` -- the results page's cards (Today, Daily
  leaderboard, Streaks, All time)
- `.goes-strip*` -- the Streaks card's goes strip
- `.time-chart*` -- the Daily leaderboard's drawing
- `.save-note*` -- the untick warning and submit countdown on the play screen

## The completion panel

Board O from the results page redesign (`docs/work/2026-11-15-results-page-redesign-brief.md`).
Four cards in reading order: **Today**, **Daily leaderboard**, **Streaks**, **All time**, then
"Next puzzle in…" and the actions.

- **One card style.** Every section is a `.result-card`: `--color-surface` fill, 1.5px
  `--color-border`, 6px radius, 18px padding, 18px between cards. The leaderboard takes the
  same card. No second container style, no watermark icons.
- **One accent.** Figures, heading icons and the strip in `--color-accent`; every label and
  sentence in `--color-text`. The three spare accents (`--color-accent-2/3/4`) are read by
  nothing since this redesign. They stay declared until #370, because the Worker mirrors them
  and `tests/token-parity.spec.ts` compares the two.
- **Headings.** Today has none of its own: "Puzzle #238 solved" is the screen's one `h2`,
  `solved` in accent, one line that wraps naturally. Every other card has an `h3` at
  1.1875rem with a decorative icon -- podium, flame, calendar. The icons' viewBoxes are
  tightened on the left to their ink edge (`icon-flame`, `icon-podium`, `icon-calendar-head`),
  so the ink sits on the padding line. `icon-calendar` itself stays square for `/play`.
- **Today**: the figure line "3 goes, 2m 28s" (the sentence form of `formatDuration`; spoken
  as "2 minutes 28 seconds"), then one message line in full mode only, chosen by
  `todayMessage` in `src/player-stats.ts`. Message differences use the compact form
  ("17s quicker"). A marker has no figure line.
- **The completion panel has no `Solved in ...` sentence; the play screen still does.**
  That divergence is deliberate. `heroLine` in `src/completion.ts` builds the play
  screen's line and is called from `src/app.ts`, not from the panel -- it looks like panel
  code and is not. Leave it alone when tidying that file.
- **Streaks**: two lines at body size, each streak with its own best (results brief 111):
  "**3-day** play streak. Best: **20**." then "**2-day** solve-in-one streak. Best: **4**."
  The second line is left out while the solve-in-one streak is 0.
- **Bold in a card's statement is always bold accent** (results brief 110): today's message,
  the leaderboard's line ("top **40%**") and the streak line.
- **Four type sizes on the results page** (results brief 107): 2.125rem for today's figures,
  1.1875rem for card headings, 1rem for statements, the ledger, the countdown and buttons,
  and 0.8125rem (13px for the strip's row numbers) for small labels. The leaderboard's own
  dot labels (0.9375rem, 0.75rem when tight) are the one exception.
- **The goes strip** (`src/goes-strip.ts`): one 18px column per day played, an empty 18px column per day missed between them (a break of 7 or more days is three cell-sized blocks on the bottom row: the broken
  column's bolt turned 90° in text colour, its count such as `12d`, and a bolt; results
  brief 112), 4px gaps, 10px
  cells stacked from the bottom, misses then the solving go. Misses are `--strip-miss`, a
  20% accent mix into surface; the solving go is solid accent. The misses sit under 3:1 on
  purpose -- Jamie relaxed WCAG 1.4.11 for them as accessibility owner (results brief 95).
  The message icon beside today's line is a plain accent icon with no pill. Rows are the worst day capped at
  5; a day past the cap is a broken column -- three misses, a bolt, the solving go and the
  true figure on top. Row numbers down the left, "1 go" at the bottom, and none above 3 when the strip has a
  broken column (results brief 108), in 13px type (px, not rem) so
  each stays on its 10px row at any text size; no axis lines (results brief 102, 105). Under the
  scroller, outside it so they never scroll away: "{n} days ago" on the left and "today" on
  the right, with a Lucide left arrow before the first and a 40px fade at the left edge
  while earlier days are off-screen (`data-more-left`, set by `wireStrip`). The scroller is
  `direction: rtl` so it opens at today with no script, and the track hugs the right so
  today sits over "today". Scrollbars are left to the platform (results brief 103) with
  `overflow-y: hidden`. The scroller is a focusable `role="group"` named by a one-sentence
  summary; the columns and labels are `aria-hidden`. Its focus ring is drawn on the
  unmasked frame, because the mask would fade it.
- **All time** is a `dl` ledger: label left in text colour, figure right in bold accent, one
  size, no rules -- Solved in one, Solve-in-one streak, Fastest solve, Average time, Puzzles
  solved.
- **The whole panel reads in Quicksand**, numbers included. The rules declare no font family
  and inherit from `html`/`body`. The play screen keeps Inconsolata for its keypad.
- **`--chart-dot` mixes into `--color-surface`**, not `--color-bg`, since the leaderboard
  sits on a card. Lowest ratio 3.36:1 (Lime light). The dot border is `--color-surface` too.
- **Times use unit letters, never a colon**: `0m 30s`, `4m 06s`, `1h 04m`. `4:06` can read
  as four hours at a glance. Seconds are padded to two digits; minutes are not. An unknown
  time is a dash in the ledger and is dropped from the figure line. (Jamie and Dave,
  2026-08-11.)
- **Cards are absent, not hidden**, when they do not apply. A hidden card can still reach
  the accessibility tree, and an empty "All time" heading reads as broken.
- **The submit button dims to 0.5 opacity** while the untick countdown holds it. WCAG
  1.4.3 and 1.4.11 both exempt inactive controls from their contrast minimums, and those
  five seconds are exactly when the control is inactive. Deliberate -- do not "fix" it.

## Clue display

- **Boolean** (`type: 'text'`): `[subject] [is [not] predicate]`
  - Affirmative (`= true` / `!= false`): "The first digit **is a prime number**"
  - Negative (`= false` / `!= true`): "The first digit **is not a prime number**"
- **Numeric**: `[label] [operator in accent] [value in bold]`
- Operator rendering: `<=` -> `<=`, `>=` -> `>=`, `!=` -> `!=`, `=` -> `=`
