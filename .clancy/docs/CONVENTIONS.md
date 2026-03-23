# Conventions

## Module System

ES modules throughout — `type="module"` in HTML, `import`/`export` in JS. No bundler, no transpilation.

```html
<!-- index.html -->
<script type="module" src="app.js"></script>
```

```js
// app.js
import { runFilterLoop, makeRng, ... } from './puzzle.js';
```

---

## Naming

### Files

- `kebab-case.js` for source files
- Prefix `_` for Cloudflare Worker entry: `_worker.js`

### JavaScript

| Pattern | Convention |
|---------|-----------|
| Variables / functions | `camelCase` |
| Constants | `SCREAMING_SNAKE_CASE` |
| DOM element refs | `camelCase` + `El` suffix (e.g. `guessEl`, `submitEl`) |

### CSS Classes

BEM-like, hyphenated:

```
.clue-row
.clue-op
.history-item
.stats-bubble
.save-toggle
.save-row
.input-row
.feedback--correct
.feedback--incorrect
.puzzle-label
.footer-line
.footer-tech
```

---

## DOM IDs (Locked)

These IDs are referenced by `app.js` and must not be renamed:

```
#status          #clues           #guess          #submit
#history         #feedback        #history-label  #next-puzzle
#next-number     #save-toggle     #save-row       #stats
#random-label    #puzzle-label    #puzzle-number  #puzzle-date
#input-area      #random-again
```

---

## CSS Custom Properties

All design tokens in `:root` with `--` prefix. See `DESIGN-SYSTEM.md` for full list.

---

## Comment Style

- `//` inline comments for non-obvious logic
- ASCII divider lines (`───`) to separate logical sections within files
- No JSDoc

---

## Code Structure

- Module-level constants at top of file
- Helper functions before usage
- Event listeners attached at module level (never inside `startDailyPuzzle`)
- No classes or constructors — functional style throughout
- `gameState` is module-scoped `let`, not a `window` global

---

## localStorage Key Prefix

`dlng_` prefix on all keys (original game name "David Lark's Lame Number Game"). Do not rename — these keys are persisted in existing user browsers.

---

## No Lint / Format Config

No ESLint, Prettier, or editorconfig present. Style is consistent by convention.
