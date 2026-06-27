# Coding Conventions

**Analysis Date:** 2026-04-11

## Naming Patterns

**Files:**
- kebab-case: `puzzle.ts`, `worker/index.ts`, `bubbles.ts`, `modals.ts`
- No camelCase in filenames

**Functions:**
- camelCase: `initTheme()`, `renderClues()`, `getDailyPuzzle()`, `handleGuess()`
- Prefix patterns:
  - `render*`: Functions that mutate DOM (e.g., `renderClues()`, `renderFeedback()`, `renderBox()`, `renderStats()`)
  - `init*`: Setup functions (e.g., `initTheme()`, `initModal()`, `initColours()`)
  - `handle*`: Event handlers (e.g., `handleGuess()`)
  - `get*` / `load*`: Fetch/retrieve operations (e.g., `getDailyPuzzle()`, `loadHistory()`)
  - `format*`: Data transformation (e.g., `formatDate()`, `formatClueValue()`)
  - `apply*`: Apply a state or mutation (e.g., `applyTheme()`, `applyFilter()`)
  - `toggle*`: DOM state toggles (e.g., `toggleDigit()`)
  - `show*` / `close*`: UI visibility (e.g., `showTagTip()`, `closeTagTip()`, `closeKeypad()`)
  - `make*`: Create/construct (e.g., `makeRng()`)

**Variables:**
- camelCase: `gameState`, `activeBox`, `possibles`, `analyticsUid`, `submitting`, `octoAnimating`
- Boolean prefixes: `is*`, `has*`, `should*`, `can*` (e.g., `isNewUser`, `isDark`, `isRandom`)
- Module-scoped state: `let` with clear scope comments (e.g., `// ─── Module state ─────`)
- Avoid unnecessary abbreviations; prefer clarity
- Constants in UPPER_CASE: `EPOCH_DATE`, `KEEP_MIN`, `KEEP_MAX`, `TOTAL_MS`, `MIN_COUNT`

**Types:**
- PascalCase interfaces: `GameState`, `ClueData`, `HistoryEntry`, `Prefs`, `StoredPuzzle`, `PropertyDef`, `Env`
- Single-letter generics acceptable in narrow scope: `function applyFilter<T>(arr: T[]): T[]`

## Code Style

**Formatting:**
- Prettier with `printWidth: 200` and `htmlWhitespaceSensitivity: ignore`
- Lines wrap at 200 characters — verbose assignments and JSX may span multiple lines
- 2-space indentation (Prettier default)

**Linting:**
- No linter detected in package.json or config files
- Enforce manually via code review (see `docs/SELF-REVIEW.md`)
- TypeScript `strict: true` catches type errors

**Whitespace:**
- Double blank lines separate logical sections within files
- Section headers marked with `// ─── Section Name ───` (dashes for visual clarity)
- Single blank line between function definitions
- Module initialization and event listeners at end of file

## Import Organization

**Order:**
1. Relative imports from same module: `./types.ts`, `./storage.ts`
2. Grouped by layer (client imports in client files, worker imports in worker files)
3. Type imports at top: `import type { GameState } from './types.ts'`
4. Concrete imports follow: `import { loadHistory } from './storage.ts'`

**Path Aliases:**
- No path aliases configured
- Relative imports only: `./storage.ts`, `../worker/puzzle.ts`

**Extensions:**
- Always include `.ts` extension in imports (required by TypeScript strict module resolution)

## Error Handling

**Patterns:**
- Try-catch with silent fallback for non-critical operations:
  ```typescript
  try {
    return JSON.parse(localStorage.getItem(STORAGE_PREFS) || "{}");
  } catch {
    return { saveScore: true };
  }
  ```
- API error responses: return JSON with `error` field and appropriate HTTP status:
  ```typescript
  if (!valid) return json({ error: 'Invalid format' }, 400);
  ```
- Network failures: catch and swallow for analytics (never breaks game):
  ```typescript
  track("event", value).catch(() => {});
  ```
- Validation before mutation — check guards before state updates:
  ```typescript
  if (gameState.solved || submitting) return;
  if (!possibles.every((s) => s.size === 1)) return;
  ```

**Error messages:**
- User-facing: polite and actionable (e.g., "Could not load the puzzle. Please refresh the page.")
- Console/dev: no console errors logged; errors recorded via track() or swallowed

## Logging

**Framework:** No external logging library. Uses Cloudflare Analytics Engine for events.

**Patterns:**
- Analytics-only: `track(event, value?, source?)` function posts to `/api/event`
- Valid events defined in allowlist: `VALID_EVENTS` Set in `src/worker/index.ts`
- Common events: `puzzle_start`, `puzzle_complete`, `incorrect_guess`, `htp_opened`, `theme_toggle`, `tooltip_opened`
- No console.log in production code (only dev helpers prefixed with `_dev`)
- DOM state reflects user actions: render functions update UI, UI reflects state

## Comments

**When to Comment:**
- Explain _why_, not _what_: "Disable 0 in hundreds place since numbers are 100–999" (explain constraint)
- Mark non-obvious algorithms: RNG, easing functions, animation math
- Flag breaking assumptions: "DO NOT modify EPOCH_DATE — breaks determinism"
- Document side effects: "This sets the theme AND swaps icons AND redraws canvas"
- Never state what code obviously does: `const x = 5; // set x to 5` ❌

**JSDoc/TSDoc:**
- Minimal — used for public exports
- Example from `crypto.ts`:
  ```typescript
  /** Encrypt a random seed into an opaque token string. */
  export async function signToken(seed: number, secret: string): Promise<string>
  ```
- Self-documenting parameter names preferred over extensive @param blocks

## Function Design

**Size:**
- Prefer small, focused functions — most are 10–30 lines
- Large functions only for performance (e.g., animation loops in `octo.ts`)
- If a function needs comments to explain it, it's too complex — refactor

**Parameters:**
- Explicit parameters over implicit global state where possible
- Single object parameter for functions with multiple configs (e.g., `Env` interface in worker)
- Event handlers: `(e: Event) => void` pattern

**Return Values:**
- Explicit return type annotations required by TypeScript strict mode
- `void` for side-effect functions: `function renderBox(): void`
- `Promise<Response>` for async handlers: `async function handleGuess(): Promise<Response>`
- Typed discriminated unions for complex returns: use type narrowing in conditionals

## Module Design

**Exports:**
- Minimal public API per module
- `storage.ts`: exports only the four functions clients need (load/persist prefs/history)
- `puzzle.ts`: exports only `runFilterLoop` and RNG/date helpers (no implementation details)
- `octo.ts`: exports three public animations (`celebrateOcto()`, `sadOcto()`, `setupOctoClick()`)
- Everything else is module-scoped

**Barrel Files:**
- Not used — no `index.ts` re-exports
- Each module directly imported where needed

**Module Separation:**
- `puzzle.ts` → compute/filter only; zero DOM access
- `app.ts` → UI & game flow only; uses puzzle logic via import
- `worker/` files → backend only; no browser APIs
- Strict boundary: `src/worker/` and `src/` never cross-import (worker can't access DOM; client can't access server-only crypto)

---

*Convention analysis: 2026-04-11*
