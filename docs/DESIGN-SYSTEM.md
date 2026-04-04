# Design System

## Theming

Uses `light-dark()` for automatic theme switching. JS sets `:root.dark` or `:root.light` on the document — `color-scheme` resolves the correct value.

### CSS custom properties

```css
/* ── Accent (theme-aware for WCAG AA contrast) ── */
--acc:        light-dark(#bc3c2c, #ff8070)  /* text accent — 4.7:1 light, 5.6:1 dark */
--acc-btn:    #bc3c2c                       /* button bg — white text 5.5:1 both themes */
--tag-bg:     light-dark(rgba(188,60,44,0.08), rgba(255,128,112,0.1))
--md-lit-bg:  light-dark(rgba(188,60,44,0.10), rgba(255,128,112,0.12))

/* ── Theme-sensitive (light / dark) ── */
--bg:         light-dark(#f5edd8, #262624)       /* page background */
--text:       light-dark(#262624, #f6f0e8)       /* primary text */
--muted:      light-dark(rgba(38,38,36,0.70), rgba(246,240,232,0.6))
--card-bg:    light-dark(#fffdf7, #2e2e2c)       /* card background */
--card-sh:    light-dark(offset shadow light, offset shadow dark)
--surface:    light-dark(#ffffff, #363634)        /* input/key backgrounds */
--border:     light-dark(rgba(38,38,36,0.12), rgba(255,253,247,0.1))
--modal-bg:   light-dark(#ffffff, #1e1e1c)
```

New colours must use `light-dark()` with both values. Use existing accent variables (`--acc`, `--acc-btn`) — don't hardcode hex.

### Typography

- Body: DM Sans via Google Fonts CDN, with `system-ui` fallback
- Monospace (labels/digits): Inconsolata via Google Fonts CDN

### Layout

- Fluid: `max-width: 30rem`, no fixed breakpoints
- Card: offset shadow (`--card-sh`) with solid `--card-bg` background

## Clue display rules

- **Boolean clues** (`type: 'text'`): `[subject] [is [not] predicate]`
  - Affirmative (`= true` or `!= false`): "The first digit **is a prime number**"
  - Negative (`= false` or `!= true`): "The first digit **is not a prime number**"
- **Numeric clues**: `[label] [operator in coral] [value in bold]`
- Operator symbols: `<=` renders as `≤`, `>=` as `≥`, `!=` as `≠`, `=` as `=`
