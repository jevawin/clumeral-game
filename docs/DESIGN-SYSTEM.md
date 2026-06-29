# Design System

## Theming

- Tailwind v4 utility-first with `@theme` tokens in `src/tailwind.css`.
- Dark mode uses `@custom-variant dark (&:where(.dark, .dark *))` pattern. JS sets `html.dark` / `html.light`.
- Accent colour is user-selectable via a 4-theme picker — **Lime** (default), **Berry**, **Blue**, **Violet** — each with a light and dark value, persisted in `dlng_colour`. The active colour is written to the live `--color-accent` custom property per swatch ([src/colours.ts](../src/colours.ts)); `color-mix()`-based tokens re-resolve automatically, so no `dark:` variant is needed for accent-derived colours.
- `light-dark()` is used only inside `@keyframes octo-colours` mid-frames for animation colours. All other styling uses Tailwind dark: variants or explicit `html.dark` overrides.
- Use `--color-*` token variables -- never hardcode hex values for theme colours.

## Semantic colour tokens

Five tokens defined in `@theme` block. Dark mode overrides in `@layer theme` under `html.dark` (same cascade layer, higher specificity than `:root`).

| Token | CSS variable | Light | Dark | Usage |
|-------|-------------|-------|------|-------|
| bg | `--color-bg` | `#FAFAFA` | `#121213` | Page background |
| text | `--color-text` | `#262624` | `#FAF8F4` | Primary text — all text, including secondary copy (per CLR-01) |
| accent | `--color-accent` | `#0A850A` | `#1EAD52` | Accent colour, buttons, links |
| surface | `--color-surface` | `#FFFFFF` | `#363634` | Input/card backgrounds |
| border | `--color-border` | `rgba(38, 38, 36, 0.12)` | `rgba(246, 240, 232, 0.1)` | Borders, dividers |

Tailwind generates utility classes from these: `bg-bg`, `text-text`, `bg-accent`, `bg-surface`, `border-border`. The legacy `muted` token was removed in v1.1 (CLR-01) — secondary copy now uses `text-text`. Use `text-text/60` only for non-essential placeholder/decorative variants where pure text is unreadable.

### Derived: `accent-strong` (AA-safe accent text)

`--color-accent-strong` = `color-mix(in srgb, var(--color-accent) 82%, var(--color-text))`. The raw accent on light backgrounds sits at ~4.3:1 on the clue-tag tint (`bg-accent/5`) and ~4.6:1 on the page bg — at or below WCAG AA 4.5:1. Mixing 18% toward `text` darkens it in light mode and lightens it in dark mode, lifting all four accent themes to ~5.3:1+ (light) / ~7.5:1 (dark). Both source vars are live, so it re-resolves per accent and per theme — no `dark:` variant needed. Use `text-accent-strong` for accent-coloured **text**; keep raw `--color-accent` (`text-accent`, `border-accent`, `bg-accent`) for icons, borders, and fills.

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
