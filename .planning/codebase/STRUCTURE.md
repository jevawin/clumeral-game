# Codebase Structure

**Analysis Date:** 2026-04-11

## Directory Layout

```
clumeral-game/
├── src/                    # TypeScript source (client + worker)
│   ├── app.ts              # Client main: game flow, UI rendering (815 lines)
│   ├── worker/             # Cloudflare Worker code
│   │   ├── index.ts        # Worker entry: route handlers (279 lines)
│   │   ├── puzzle.ts       # Puzzle generation & filtering (204 lines)
│   │   ├── crypto.ts       # Token encryption/decryption (56 lines)
│   │   ├── stats.ts        # Analytics queries & dashboard (259 lines)
│   │   └── puzzles.ts      # Puzzle archive page HTML (212 lines)
│   ├── octo.ts             # Octopus animations (457 lines)
│   ├── bubbles.ts          # Celebration bubble effects (192 lines)
│   ├── modals.ts           # How-to-Play, feedback, toast modals (242 lines)
│   ├── theme.ts            # Light/dark mode, canvas background (52 lines)
│   ├── colours.ts          # Accent color picker (94 lines)
│   ├── storage.ts          # localStorage helpers (33 lines)
│   ├── types.ts            # TypeScript interfaces (26 lines)
│   ├── style.css           # All styling (1 file, ~1400 lines)
│   └── global.d.ts         # Global type declarations
├── public/                 # Static assets
│   ├── icons/              # Theme-specific app icons (4 themes × 2 modes)
│   ├── manifest.json       # PWA manifest
│   ├── apple-touch-icon.png
│   └── sprites.svg         # Icon sprite sheet
├── index.html              # HTML entry point
├── vite.config.ts          # Vite + Cloudflare build config
├── wrangler.jsonc          # Cloudflare Worker config
├── tsconfig.json           # TypeScript config
├── package.json            # Dependencies (Vite, Wrangler, TS)
├── docs/                   # Project documentation
└── .planning/              # GSD analysis output
```

## Directory Purposes

**src/:**
- Purpose: All TypeScript source code (client + server)
- Contains: Game logic, UI rendering, API routes, utilities
- Key files: `app.ts` (main game), `worker/index.ts` (API), `worker/puzzle.ts` (generation)

**src/worker/:**
- Purpose: Cloudflare Worker code (server-side)
- Contains: API route handlers, puzzle generation, crypto, analytics queries
- Key files: `index.ts` (routes), `puzzle.ts` (generation algorithm)

**public/:**
- Purpose: Static assets served by Cloudflare
- Contains: Theme icons (4 colors × 2 light/dark modes), SVG sprites, manifest
- Key files: `icons/lime/dark/icon-192.png` (default), `sprites.svg` (SVG icons)

**docs/:**
- Purpose: Project documentation (README, architecture, conventions, etc.)
- Contains: Developer guides, git workflow, design system, architecture notes
- Key files: `ARCHITECTURE.md`, `DESIGN-SYSTEM.md`, `CONVENTIONS.md`, `GIT-WORKFLOW.md`

**.planning/codebase/:**
- Purpose: GSD analysis output (this directory)
- Contains: Automated codebase documentation
- Generated: Not committed (except docs you write)

## Key File Locations

**Entry Points:**

- `index.html`: Main HTML document; loads Vite client bundle and defines DOM structure
- `src/app.ts`: Client execution starts here; runs on page load, calls `loadPuzzle()`
- `src/worker/index.ts`: Worker execution; exports default `fetch` handler that routes requests

**Configuration:**

- `vite.config.ts`: Vite build config; integrates Cloudflare plugin for worker build
- `wrangler.jsonc`: Worker runtime config; defines KV namespace, Analytics Engine, environment variables
- `tsconfig.json`: TypeScript config; ES2020 target, ES modules
- `package.json`: Dependencies (Vite 8, Wrangler 4, TypeScript 6)

**Core Logic:**

- `src/app.ts`: Game state machine, UI rendering, event handling (all client-side gameplay)
- `src/worker/puzzle.ts`: Puzzle generation algorithm, property definitions, RNG
- `src/worker/index.ts`: API route definitions and validation
- `src/worker/crypto.ts`: Token encryption for random puzzles

**Styling:**

- `src/style.css`: Single CSS file; CSS variables for theming (--acc, --tag-bg, etc.), component classes (.clue, .keypad, .feedback, etc.)

**Supporting Modules:**

- `src/types.ts`: Shared interfaces (ClueData, GameState, HistoryEntry, Prefs)
- `src/storage.ts`: localStorage helpers (loadHistory, recordGame, loadPrefs, persistPrefs)
- `src/theme.ts`: Theme toggle (light/dark) and canvas background
- `src/colours.ts`: Accent color picker and icon swapping
- `src/octo.ts`: Octopus mascot animations (eye tracking, blink, celebrate, sad)
- `src/bubbles.ts`: Canvas-based bubble animations on correct answer
- `src/modals.ts`: How-to-Play modal, feedback modal, toast notifications

**Testing & Quality:**

- No test files committed (testing not used in this project)

## Naming Conventions

**Files:**

- `camelCase.ts` for source files
- `kebab-case` for CSS class names (e.g., `.tag-tip`, `.clue-list`)
- Underscores in file names when part of compound concept (e.g., no underscores used; keep camelCase)

**Directories:**

- `lowercase` for directories (src/, worker/, public/icons/)
- Theme color names: `berry`, `blue`, `lime`, `violet` (lowercase in paths)

**HTML Elements:**

- Data attributes: `data-semantic-name` for DOM caching (e.g., `data-modal`, `data-hint`, `data-octo`)
- ARIA attributes: `aria-label`, `aria-labelledby`, `aria-hidden`, `aria-busy` for accessibility

**TypeScript:**

- Type names: `PascalCase` (ClueData, GameState, HistoryEntry)
- Const variables: `UPPER_SNAKE_CASE` for constants (EPOCH_DATE, KEEP_MIN, PROPERTIES, PROPERTY_GROUPS)
- Function names: `camelCase` (loadPuzzle, renderClues, handleGuess)
- Private/internal functions: No prefix convention; rely on module-level scope

**CSS:**

- Custom properties: `--property-name` (--acc, --tag-bg, --dig-sh-act)
- Class naming: BEM-like convention with double dash (`.clue__tag-cell`, `.feedback__icon`)
- State classes: `.hidden`, `.open`, `.elim`, `.digit-correct`, `.show` (lowercase)

## Where to Add New Code

**New Puzzle Property:**
- File: `src/worker/puzzle.ts`
- Location: Add to `PROPERTIES` record (define label, type, compute function)
- Then add property key to appropriate group in `PROPERTY_GROUPS`
- Pattern: Match existing property structure (label string, type 'text' or 'numeric', pure compute function)

**New Client Feature (e.g., new setting):**
- File: `src/app.ts` for core logic and state
- Additional: Update `src/types.ts` if new interface needed
- Additional: Update `src/storage.ts` if persisting to localStorage
- Update `index.html` if adding new DOM element
- Update `src/style.css` for styling

**New API Endpoint:**
- File: `src/worker/index.ts`
- Location: Add route check in `fetch()` handler, create new handler function
- Pattern: Check URL path and method, validate input, return `json()` response
- Example: `if (request.method === 'GET' && url.pathname === '/api/new-endpoint') { return handleNewEndpoint(); }`

**New Modal or Dialog:**
- Files: `src/modals.ts` (init and show functions)
- Update: `index.html` (dialog element structure)
- Update: `src/style.css` (dialog styling)
- Pattern: Export init function from modals.ts, call from app.ts initialization

**Utility Functions:**
- Shared helpers: `src/storage.ts` (for data persistence)
- Theme-related: `src/theme.ts` or `src/colours.ts`
- Animation-related: `src/octo.ts` or `src/bubbles.ts`
- Inline in `src/app.ts` if only used in one place

**Worker Utilities:**
- Crypto helpers: `src/worker/crypto.ts`
- Analytics queries: `src/worker/stats.ts`
- HTML rendering: `src/worker/puzzles.ts`
- Generic utils: Add to appropriate worker file (no separate utils module)

## Special Directories

**dist/:**
- Purpose: Build output
- Generated: Yes (by Vite build)
- Committed: No
- Contents: `dist/clumeral_game/` (client assets), `dist/clumeral_game/` (Worker bundle)

**.wrangler/:**
- Purpose: Wrangler local development state
- Generated: Yes (by `npm run dev`)
- Committed: No
- Contents: KV storage, Analytics Engine cache, deployment history

**node_modules/:**
- Purpose: npm dependencies
- Generated: Yes
- Committed: No

**.vite/:**
- Purpose: Vite dependency optimization cache
- Generated: Yes
- Committed: No

## Build & Development Files

**vite.config.ts:**
- Configures Vite for both client and worker builds
- Plugins: Cloudflare plugin, custom service worker cache-busting plugin
- Outputs: Client to `dist/client`, Worker to `dist/clumeral_game`

**wrangler.jsonc:**
- Defines Worker config: name, main entry, KV bindings, environment variables, routes
- Env-specific configs for staging and production

**tsconfig.json:**
- Target: ES2020
- Module: ES modules
- Lib: ES2020, DOM

**package.json:**
- Dev dependencies: vite, @cloudflare/vite-plugin, typescript, wrangler
- Scripts: `dev` (local dev), `build` (production), `preview` (preview build), `deploy` (wrangler deploy)

## Path Aliases

No path aliases configured; all imports use relative paths (`./`, `../`).

---

*Structure analysis: 2026-04-11*
