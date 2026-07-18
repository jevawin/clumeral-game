# Design System

## Theming

- Tailwind v4 utility-first with `@theme` tokens in `src/tailwind.css`.
- Dark mode uses `@custom-variant dark (&:where(.dark, .dark *))` pattern. JS sets `html.dark` / `html.light`.
- Accent colour is user-selectable via a 4-theme picker — **Lime** (default), **Berry**, **Blue**, **Violet** — each with a light and dark value, persisted in `dlng_colour`. The active colour is written to the live `--color-accent` custom property per swatch ([src/colours.ts](../src/colours.ts)); `color-mix()`-based tokens re-resolve automatically, so no `dark:` variant is needed for accent-derived colours.
- `light-dark()` is used only inside `@keyframes octo-colours` mid-frames for animation colours. All other styling uses Tailwind dark: variants or explicit `html.dark` overrides.
- Use `--color-*` token variables -- never hardcode hex values for theme colours.

## Semantic colour tokens

Nine tokens defined in `@theme` block (budget is 15, per CLAUDE.md). Dark mode overrides in `@layer theme` under `html.dark` (same cascade layer, higher specificity than `:root`).

| Token | CSS variable | Light | Dark | Usage |
|-------|-------------|-------|------|-------|
| bg | `--color-bg` | `#FAFAFA` | `#121213` | Page background |
| text | `--color-text` | `#262624` | `#FAF8F4` | Primary text — all text, including secondary copy (per CLR-01) |
| accent | `--color-accent` | `#0A850A` | `#1EAD52` | Accent colour, buttons, links |
| surface | `--color-surface` | `#FFFFFF` | `#363634` | Input/card backgrounds |
| border | `--color-border` | `rgba(38, 38, 36, 0.12)` | `rgba(246, 240, 232, 0.1)` | Borders, dividers |
| accent-strong | `--color-accent-strong` | derived | derived | AA-safe accent for text + paired borders — see below |
| on-accent | `--color-on-accent` | `#FFFFFF` | `var(--color-bg)` | Text/icons sitting **on** an accent fill — see below |
| success | `--color-success` | `#1a7a3a` | `#4cc990` | Correct feedback text, correct-box highlight |
| error | `--color-error` | `#c03030` | `#f07070` | Wrong-guess and error feedback text |

Tailwind generates utility classes from these: `bg-bg`, `text-text`, `bg-accent`, `bg-surface`, `border-border`, `text-success`, `text-error`, `bg-success/12`. The legacy `muted` token was removed in v1.1 (CLR-01) — secondary copy now uses `text-text`. Use `text-text/60` only for non-essential placeholder/decorative variants where pure text is unreadable.

`success` / `error` are deliberately **not** accent-derived — they must stay green and red whichever accent theme the player picks. Both clear AA on `--color-bg` in their own mode. Note `error` dark on `--color-surface` is 4.18:1, so keep error text on the page background.

### Derived: `accent-strong` (AA-safe accent text)

`--color-accent-strong` = `color-mix(in srgb, var(--color-accent) 82%, var(--color-text))`. The raw accent on light backgrounds sits at ~4.3:1 on the clue-tag tint (`bg-accent/5`) and ~4.6:1 on the page bg — at or below WCAG AA 4.5:1. Mixing 18% toward `text` darkens it in light mode and lightens it in dark mode, lifting all four accent themes to ~5.3:1+ (light) / ~7.5:1 (dark). Both source vars are live, so it re-resolves per accent and per theme — no `dark:` variant needed.

Use `text-accent-strong` for accent-coloured **text**, and for any **border sitting directly alongside that text** — clue tags, the `.link` underline, `.btn-hollow`. Per #249, a strong-shade text inside a raw-accent border is what read as mismatched; matching them makes the pairing look deliberate. Keep raw `--color-accent` for icons, standalone fills (`bg-accent`), and low-opacity tints (`bg-accent/5`), where the shade difference is imperceptible and the fuller colour reads better.

### `on-accent` (text on an accent fill)

`--color-on-accent` is the foreground for anything sitting on a solid accent background — `.btn-solid`, `.skip-link`, the selected feedback category pill. White clears AA on the light accents (4.78–4.80:1) but only manages 2.94–3.01:1 on the lighter dark accents, which was #243. Flipping to the page background in dark mode gives 6.22–6.38:1 across all four themes.

It is set per mode rather than via `color-mix()` because the correct answer **flips between the two ends of the scale** rather than sliding along it.

### SSR pages duplicate these tokens

`/archive` is Worker-rendered ([src/worker/puzzles.ts](../src/worker/puzzles.ts)) with its own inline `<style>` block that mirrors the token set and the `.btn` system. It does not load `tailwind.css`. **A colour change in `tailwind.css` does not reach it** — update both, or the SSR page silently keeps the old value. This is exactly how #243 survived the first fix.

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
