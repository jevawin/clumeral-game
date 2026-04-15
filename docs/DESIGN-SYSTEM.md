# Design System

## Theming

- Tailwind v4 utility-first with `@theme` tokens in `src/tailwind.css`.
- Dark mode uses `@custom-variant dark (&:where(.dark, .dark *))` pattern. JS sets `html.dark` / `html.light`.
- Green accent only -- no colour picker, no multiple themes.
- `light-dark()` is used only inside `@keyframes octo-colours` mid-frames for animation colours. All other styling uses Tailwind dark: variants or explicit `html.dark` overrides.
- Use `--color-*` token variables -- never hardcode hex values for theme colours.

## Semantic colour tokens

Six tokens defined in `@theme` block. Dark mode overrides in `@layer theme` under `html.dark` (same cascade layer, higher specificity than `:root`).

| Token | CSS variable | Light | Dark | Usage |
|-------|-------------|-------|------|-------|
| bg | `--color-bg` | `#FAFAFA` | `#121213` | Page background |
| text | `--color-text` | `#262624` | `#FAF8F4` | Primary text |
| muted | `--color-muted` | `rgba(38, 38, 36, 0.7)` | `rgba(246, 240, 232, 0.6)` | Secondary text, labels |
| accent | `--color-accent` | `#0A850A` | `#1EAD52` | Accent colour, buttons, links |
| surface | `--color-surface` | `#FFFFFF` | `#363634` | Input/card backgrounds |
| border | `--color-border` | `rgba(38, 38, 36, 0.12)` | `rgba(246, 240, 232, 0.1)` | Borders, dividers |

Tailwind generates utility classes from these: `bg-bg`, `text-text`, `text-muted`, `bg-accent`, `bg-surface`, `border-border`.

## Typography

- Body: DM Sans 400/600 (Google Fonts), fallback `system-ui`
- Headings: DM Sans 700 (Phase 1 locked exception -- loaded via Google Fonts `wght@400;600` but 700 used for bold headings)
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
