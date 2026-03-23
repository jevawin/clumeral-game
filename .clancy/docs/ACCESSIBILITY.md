# Accessibility

## ARIA Usage

### Save Toggle

The score-saving checkbox uses a custom ARIA role rather than a native `<input type="checkbox">`:

```html
<span id="save-toggle" role="checkbox" aria-checked="true" aria-label="Save score">
```

- `aria-checked` is updated programmatically when the user toggles it
- `aria-label` provides a text description

### SVG Icons

SVG icons (save icon, heart) use `aria-hidden="true"` to prevent screen readers from announcing them.

---

## Keyboard Navigation

- **Enter key** on `#guess` input triggers guess submission (event listener in `app.js`)
- `#guess` receives `focus()` on puzzle load and after each guess attempt
- Submit button is a native `<button>` — keyboard-activatable by default
- Save toggle responds to click; no explicit `keydown` handler for Space/Enter (gap)

---

## Focus Management

- `guessEl.focus()` called in `startDailyPuzzle()` and after each guess
- Focus is intentionally kept on the input for rapid guessing
- No focus trap or skip links

---

## Semantic HTML

- `<h1>` for game title
- `<ul>` / `<li>` for clue list and history list
- `<button>` for submit action
- `<footer>` for credits
- `<a>` tags with descriptive text for external links

---

## Colour Contrast

| Element | Foreground | Background | Notes |
|---------|-----------|------------|-------|
| Body text | `#e8e8f0` | `#0f0f1a` | High contrast |
| Muted text | `#7a7a9a` | `#0f0f1a` | May be marginal at small sizes |
| Accent (coral) | `#ff6d5a` | `#0f0f1a` | Used for operators and borders |
| Correct feedback | `#4caf88` | `#0f0f1a` | Green on dark |
| Button text | white | `#ff6d5a` | Needs verification |

---

## Known Gaps

- **Save toggle keyboard**: Custom `role="checkbox"` does not handle Space/Enter key activation — only responds to click
- **No skip link**: No "skip to main content" link for keyboard users
- **No visible focus ring on card**: Focus styles only on `#guess` input and `#submit` button
- **Screen reader clue announcements**: Clue list updates are not announced via `aria-live` — screen reader users may not know new clues have appeared
- **Muted text contrast**: `--text-muted: #7a7a9a` on `#0f0f1a` may not meet WCAG AA at 12px–14px sizes
