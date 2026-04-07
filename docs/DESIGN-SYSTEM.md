# Design System

## Theming

- `light-dark()` everywhere. JS sets `:root.light` / `:root.dark`.
- Accent is user-selectable via `colours.ts` — `--acc` / `--acc-btn` are dynamic. Never hardcode the accent hex.
- New colours MUST use `light-dark(lightVal, darkVal)` with both values.
- Use existing vars — don't hardcode hex.

## Core CSS variables

```
--acc          theme-aware accent (text)
--acc-btn      solid accent (button bg, white text)
--tag-bg       subtle accent tint (clue tag bg)
--md-lit-bg    lit modal/accent bg
--bg           page bg (derived from --acc)
--text         primary text
--muted        secondary text
--card-bg      card bg
--card-sh      card offset shadow
--surface      input/key bg
--border       borders
--modal-bg     modal bg
--modal-sh     modal shadow
```

## Typography

- Body: DM Sans (Google Fonts), fallback `system-ui`
- Mono (labels/digits): Inconsolata (Google Fonts)

## Layout

- Fluid. `max-width: 30rem`. No fixed breakpoints.
- Card = solid `--card-bg` + offset `--card-sh`
- No `!important` unless overriding third-party

## Clue display

- **Boolean** (`type: 'text'`): `[subject] [is [not] predicate]`
  - Affirmative (`= true` / `!= false`): "The first digit **is a prime number**"
  - Negative (`= false` / `!= true`): "The first digit **is not a prime number**"
- **Numeric**: `[label] [operator in accent] [value in bold]`
- Operator rendering: `<=` → `≤`, `>=` → `≥`, `!=` → `≠`, `=` → `=`
