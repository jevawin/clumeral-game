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
- Mono (labels/digits): Inconsolata 400/700 (Google Fonts)

## Layout

- Fluid. `max-w-sm` (~24rem). No fixed breakpoints.
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

## Clue display

- **Boolean** (`type: 'text'`): `[subject] [is [not] predicate]`
  - Affirmative (`= true` / `!= false`): "The first digit **is a prime number**"
  - Negative (`= false` / `!= true`): "The first digit **is not a prime number**"
- **Numeric**: `[label] [operator in accent] [value in bold]`
- Operator rendering: `<=` -> `<=`, `>=` -> `>=`, `!=` -> `!=`, `=` -> `=`
