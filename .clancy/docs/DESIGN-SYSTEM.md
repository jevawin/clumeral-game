# Design System

## CSS Custom Properties (Design Tokens)

Defined in `:root` in `style.css`:

```css
--bg-deep:    #0f0f1a          /* near-black background */
--bg-card:    rgba(255,255,255,0.06)  /* frosted glass card — must be rgba for blur to work */
--accent:     #ff6d5a          /* coral — operators, borders, buttons, error feedback */
--accent-alt: #ff914d          /* coral hover state */
--text:       #e8e8f0          /* primary text */
--text-muted: #7a7a9a          /* secondary text, labels */
--green:      #4caf88          /* correct feedback, checked save icon */
--red:        #ff6d5a          /* same as accent — incorrect feedback */
```

---

## Typography

| Usage | Font | Weight | Size |
|-------|------|--------|------|
| Game title (`h1`) | Forum (serif) | 400 | `clamp(2rem, 8vw, 3rem)` |
| Body / UI | Inter | 400, 500, 600 | 0.7rem–1.1rem |
| Clue text | Inter | 400/600 | 0.95rem |
| Input | Inter | 600 | 1.5rem |
| Submit button | Inter | 600 | 1rem |

Loaded via Google Fonts CDN:
```html
<link href="https://fonts.googleapis.com/css2?family=Forum&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
```

Fallback stack: `Inter, system-ui, sans-serif`

---

## Components

### Background

```css
body {
  background: var(--bg-deep);
  background-image: radial-gradient(ellipse at top, #1a1a3e 0%, #0f0f1a 70%);
}
```

### Frosted Glass Card

```css
.card {
  background: var(--bg-card);
  -webkit-backdrop-filter: blur(12px);  /* Safari required */
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 16px;
}
```

Both `-webkit-backdrop-filter` and `backdrop-filter` are always present (Safari compatibility).

### Clue Rows

```css
.clue-row {
  border-left: 3px solid var(--accent);
  padding: 0.4rem 0.6rem;
  /* operator rendered in coral, value in bold */
}
.clue-op { color: var(--accent); }
```

### Input Field

```css
#guess {
  border: 2px solid rgba(255,255,255,0.15);
  border-radius: 8px;
  font-size: 1.5rem;
  font-weight: 600;
  text-align: center;
}
#guess:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px rgba(255,109,90,0.2);
}
```

### Submit Button

```css
#submit {
  background: var(--accent);
  border-radius: 8px;
  font-weight: 600;
  transition: background 0.2s;
}
#submit:hover { background: var(--accent-alt); }
```

### Save Toggle (Checkbox)

Custom checkbox using `role="checkbox"` with coral/green colour states.

### History Items

```css
.history-item { /* individual guess attempt rows */ }
.feedback--correct { color: var(--green); }
.feedback--incorrect { color: var(--red); }
```

### Stats Bubbles

```css
.stats-bubble {
  background: rgba(255,255,255,0.05);
  border-radius: 12px;
  /* displays play count, win rate, avg tries */
}
```

### Heart Animation

```css
.heart {
  animation: heartbeat 1.6s ease-in-out infinite;
}
@keyframes heartbeat { /* bounce scale animation */ }
```

Used in the footer credit line.

---

## Responsive Design

Single breakpoint at **480px**:

```css
@media (max-width: 480px) {
  .input-row { flex-direction: column; }
  #guess, #submit { width: 100%; }
}
```

Desktop: input and submit button side-by-side.
Mobile: input and submit stack full-width.

---

## Dark Theme

The entire design is dark-only — no light mode. Background is near-black (`#0f0f1a`) with a subtle blue-tinted radial gradient. Card uses low-opacity white with backdrop blur for a frosted glass effect.

---

## Operator Symbols

Numeric clue operators are rendered with Unicode symbols in coral (`var(--accent)`):

| Code | Display |
|------|---------|
| `<=` | `≤` |
| `>=` | `≥` |
| `=`  | `=` |
| `!=` | `≠` |
