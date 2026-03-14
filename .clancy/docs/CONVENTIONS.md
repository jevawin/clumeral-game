# Conventions

## Code Style

Plain JavaScript with ES modules. No TypeScript, no framework, no bundler, no build step.

- `puzzle.js` is an ES module (`export function`, `export const`)
- `app.js` imports from `puzzle.js` via dynamic `import()` in local dev
- `_worker.js` imports from `puzzle.js` via static `import` in Worker context
- No JSDoc, no type annotations

## Naming Conventions

**DOM IDs are locked** — never rename these without a coordinated update across all files:
- `#status`, `#clues`, `#guess`, `#submit`, `#history`, `#feedback`, `#history-label`

**localStorage prefix `dlng_`** — stands for "David Lark's Lame Number Game". Never rename — it is persisted in existing user browsers and renaming would orphan all user data.
- `dlng_history`
- `dlng_prefs`

**`gameState`** — module-scoped `let` in `app.js`. Never attach to `window`.

**Commit types**: `feat`, `fix`, `refactor`, `chore`, `ci`, `docs` — lowercase, colon-separated.

## File Organisation

| File | Contains | Must NOT contain |
|------|----------|-----------------|
| `puzzle.js` | Shared logic: `PROPERTIES`, `PROPERTY_GROUPS`, `runFilterLoop`, `makeRng`, date helpers | Any UI code, DOM access, or browser-only APIs |
| `app.js` | UI only: DOM manipulation, event handling, rendering, localStorage | Filter logic, `compute()` functions, puzzle generation |
| `_worker.js` | Cloudflare Worker: request interception, puzzle injection | UI code |
| `index.html` | Game shell: structure only | Inline scripts beyond what's injected by Worker |
| `style.css` | All visual styling | Logic |

## Component Patterns

No framework. DOM manipulation is imperative:
```javascript
const el = document.createElement('div');
el.className = 'clue-row';
el.textContent = '...';
document.getElementById('clues').appendChild(el);
```

Event listeners are attached at module level in `app.js` — never inside `startDailyPuzzle()` (would create duplicate listeners on re-render).

## Error Handling

Try-catch used for localStorage reads (graceful fallback to defaults):
```javascript
function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_HISTORY)) || [];
  } catch { return []; }
}
```

No error handling for internal/framework calls — trust them.

## Logging

No `console.log` in production code. Debug logging only during development and removed before commit.
