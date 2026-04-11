# Clumeral — Claude operating rules

Clumeral is a daily number puzzle at [clumeral.com](https://clumeral.com). Project overview and dev setup are in [README.md](README.md).

---

## Rules (non-negotiables)

- **Never commit to `main` or `staging`** — both are protected. Work branches only.
- **Never merge to `main`** — the user does it on GitHub. No exceptions unless explicitly granted with a reason.
- **Never run `wrangler deploy` or `npm run deploy`** — deployment is automatic on merge to `main`.
- **Follow the review gates** — DA review first (fresh-context subagent), then self-review, then PR. Required when a change touches more than one file, adds/removes >30 lines, changes puzzle logic, CSS/theming, or accessibility. Skip only for single-file typo/copy fixes. See [docs/DA-REVIEW.md](docs/DA-REVIEW.md) and [docs/SELF-REVIEW.md](docs/SELF-REVIEW.md).
- **After merging `staging → main`**, run the post-merge sync (below). Skipping this causes divergence.
- **After any PR merge**, run post-merge cleanup: `git remote prune origin` and delete the local branch.

## Workflow

1. **Ask → Plan → Build** for new issues or tasks. Small tweaks inside an ongoing task can skip straight to building.
2. When starting work, committing, pushing, or merging, follow [docs/GIT-WORKFLOW.md](docs/GIT-WORKFLOW.md) — branches, preview URLs, staging/main flow, and recovery paths.

## Context hygiene

Prompt the user to run `/clear` at these trigger points:

- Before starting a new issue or task
- After merging a PR (to staging or main)
- After a big refactor or debugging session

## When working in specific areas, read the relevant doc first

| Working on | Read |
|------------|------|
| Puzzle logic, seeding, storage | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| CSS, theming, clue display | [docs/DESIGN-SYSTEM.md](docs/DESIGN-SYSTEM.md) |
| Code patterns, accessibility, DOM | [docs/CONVENTIONS.md](docs/CONVENTIONS.md) |
| Git workflow, branch strategy, recovery | [docs/GIT-WORKFLOW.md](docs/GIT-WORKFLOW.md) |
| Pre-PR architecture review | [docs/DA-REVIEW.md](docs/DA-REVIEW.md) |
| Pre-PR line-level review | [docs/SELF-REVIEW.md](docs/SELF-REVIEW.md) |
| Adding a roadmap item as a GitHub issue | [docs/ROADMAP-ISSUES.md](docs/ROADMAP-ISSUES.md) |

Update the respective doc if it's incorrect or your work makes it outdated.

<!-- GSD:project-start source:PROJECT.md -->
## Project

**Clumeral Redesign**

Clumeral is a daily number puzzle at clumeral.com. Players get clues about a 3-digit number and eliminate possibilities to find the answer. This project restructures the app from a single busy page into three clean, focused screens — welcome, game, completion — inspired by Wordle's simplicity. The entire UI gets rebuilt from scratch in Tailwind CSS with a minimal colour palette.

**Core Value:** The game screen must work flawlessly — clues, digit elimination, guess submission, and answer validation must all function exactly as they do today, just in a cleaner layout.

### Constraints

- **Tech stack**: Tailwind CSS, existing Vite + Cloudflare Workers setup stays
- **Backend**: No worker/API changes — frontend-only rebuild
- **Compatibility**: Must work on all current browsers (ES2022 target)
- **Performance**: Celebration animation must be skippable and under 3s
- **Design**: Under 15 semantic colour tokens in tailwind.config.ts
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->
## Technology Stack

## Languages
- TypeScript 6.0.2 - Application logic, both client and worker code
- HTML5 - Game shell and server-rendered pages
- CSS3 - Styling with light/dark themes and accent colour system
- JavaScript (ES2022) - Compiled output target
## Runtime
- Cloudflare Workers - Server-side execution for API routes, puzzle generation, analytics queries, cron jobs
- Web Browsers - Client-side application (ES2022 target)
- npm 10+ (inferred from package-lock.json)
- Lockfile: `package-lock.json` present
## Frameworks
- Vite 8.0.3 - Build tool and dev server
- @cloudflare/vite-plugin 1.31.0 - Cloudflare Workers integration for Vite
- Not detected
- TypeScript 6.0.2 - Compiler
- @cloudflare/workers-types 4.20260403.1 - Worker type definitions
- wrangler 4.80.0 - Cloudflare CLI for Worker management and local runtime
## Key Dependencies
- @cloudflare/vite-plugin 1.31.0 - Bridges Vite with Cloudflare Workers build system
- wrangler 4.80.0 - Local Worker runtime (dev environment) and deployment CLI
- @cloudflare/workers-types 4.20260403.1 - TypeScript types for Workers APIs (KV, Analytics Engine, ScheduledEvent, etc.)
## Configuration
- Secrets managed via Cloudflare Workers secrets (environment variables injected at runtime)
- Required secrets: `HMAC_SECRET`, `CF_ACCOUNT_ID`, `CF_API_TOKEN`
- Environment file: Not detected (secrets injected by platform)
- `tsconfig.json` - TypeScript configuration (ES2022 target, strict mode, DOM types)
- `wrangler.jsonc` - Cloudflare Workers configuration including KV bindings, Analytics Engine dataset, cron triggers
- `vite.config.ts` - Vite build configuration with custom cache-busting plugin for Service Worker
## Platform Requirements
- Node.js (version unspecified, but compatible with npm workspaces)
- Cloudflare Workers local runtime (provided by wrangler)
- Cloudflare Workers platform (edge computing)
- Cloudflare Pages (static asset hosting and auto-deployment)
- Cloudflare KV (global key-value store for puzzle caching)
- Cloudflare Analytics Engine (analytics dataset)
- Git repository at GitHub (jevawin/clumeral-game)
- Cloudflare Pages connected to GitHub (builds and deploys on merge to `main`)
- Build command: `npm run build`
- Output directory: `dist/client` (served by Workers)
## Build Process
# Runs Vite dev server + Cloudflare Worker runtime locally
# Worker APIs (KV, Analytics) work identically to production
# Vite bundles src/ into dist/client/ and dist/clumeral_game/ (Worker)
# Cache bust hash generated at build time for Service Worker
# Pushes Worker code to Cloudflare
# Automatic on merge to main via GitHub Actions (in Cloudflare Pages)
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

## Naming Patterns
- kebab-case: `puzzle.ts`, `worker/index.ts`, `bubbles.ts`, `modals.ts`
- No camelCase in filenames
- camelCase: `initTheme()`, `renderClues()`, `getDailyPuzzle()`, `handleGuess()`
- Prefix patterns:
- camelCase: `gameState`, `activeBox`, `possibles`, `analyticsUid`, `submitting`, `octoAnimating`
- Boolean prefixes: `is*`, `has*`, `should*`, `can*` (e.g., `isNewUser`, `isDark`, `isRandom`)
- Module-scoped state: `let` with clear scope comments (e.g., `// ─── Module state ─────`)
- Avoid unnecessary abbreviations; prefer clarity
- Constants in UPPER_CASE: `EPOCH_DATE`, `KEEP_MIN`, `KEEP_MAX`, `TOTAL_MS`, `MIN_COUNT`
- PascalCase interfaces: `GameState`, `ClueData`, `HistoryEntry`, `Prefs`, `StoredPuzzle`, `PropertyDef`, `Env`
- Single-letter generics acceptable in narrow scope: `function applyFilter<T>(arr: T[]): T[]`
## Code Style
- Prettier with `printWidth: 200` and `htmlWhitespaceSensitivity: ignore`
- Lines wrap at 200 characters — verbose assignments and JSX may span multiple lines
- 2-space indentation (Prettier default)
- No linter detected in package.json or config files
- Enforce manually via code review (see `docs/SELF-REVIEW.md`)
- TypeScript `strict: true` catches type errors
- Double blank lines separate logical sections within files
- Section headers marked with `// ─── Section Name ───` (dashes for visual clarity)
- Single blank line between function definitions
- Module initialization and event listeners at end of file
## Import Organization
- No path aliases configured
- Relative imports only: `./storage.ts`, `../worker/puzzle.ts`
- Always include `.ts` extension in imports (required by TypeScript strict module resolution)
## Error Handling
- Try-catch with silent fallback for non-critical operations:
- API error responses: return JSON with `error` field and appropriate HTTP status:
- Network failures: catch and swallow for analytics (never breaks game):
- Validation before mutation — check guards before state updates:
- User-facing: polite and actionable (e.g., "Could not load the puzzle. Please refresh the page.")
- Console/dev: no console errors logged; errors recorded via track() or swallowed
## Logging
- Analytics-only: `track(event, value?, source?)` function posts to `/api/event`
- Valid events defined in allowlist: `VALID_EVENTS` Set in `src/worker/index.ts`
- Common events: `puzzle_start`, `puzzle_complete`, `incorrect_guess`, `htp_opened`, `theme_toggle`, `tooltip_opened`
- No console.log in production code (only dev helpers prefixed with `_dev`)
- DOM state reflects user actions: render functions update UI, UI reflects state
## Comments
- Explain _why_, not _what_: "Disable 0 in hundreds place since numbers are 100–999" (explain constraint)
- Mark non-obvious algorithms: RNG, easing functions, animation math
- Flag breaking assumptions: "DO NOT modify EPOCH_DATE — breaks determinism"
- Document side effects: "This sets the theme AND swaps icons AND redraws canvas"
- Never state what code obviously does: `const x = 5; // set x to 5` ❌
- Minimal — used for public exports
- Example from `crypto.ts`:
- Self-documenting parameter names preferred over extensive @param blocks
## Function Design
- Prefer small, focused functions — most are 10–30 lines
- Large functions only for performance (e.g., animation loops in `octo.ts`)
- If a function needs comments to explain it, it's too complex — refactor
- Explicit parameters over implicit global state where possible
- Single object parameter for functions with multiple configs (e.g., `Env` interface in worker)
- Event handlers: `(e: Event) => void` pattern
- Explicit return type annotations required by TypeScript strict mode
- `void` for side-effect functions: `function renderBox(): void`
- `Promise<Response>` for async handlers: `async function handleGuess(): Promise<Response>`
- Typed discriminated unions for complex returns: use type narrowing in conditionals
## Module Design
- Minimal public API per module
- `storage.ts`: exports only the four functions clients need (load/persist prefs/history)
- `puzzle.ts`: exports only `runFilterLoop` and RNG/date helpers (no implementation details)
- `octo.ts`: exports three public animations (`celebrateOcto()`, `sadOcto()`, `setupOctoClick()`)
- Everything else is module-scoped
- Not used — no `index.ts` re-exports
- Each module directly imported where needed
- `puzzle.ts` → compute/filter only; zero DOM access
- `app.ts` → UI & game flow only; uses puzzle logic via import
- `worker/` files → backend only; no browser APIs
- Strict boundary: `src/worker/` and `src/` never cross-import (worker can't access DOM; client can't access server-only crypto)
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

## Pattern Overview
- Client fetches puzzle clues only (never the answer)
- Server validates guesses deterministically via seed-based RNG
- Deterministic puzzle generation ensures consistency across requests
- Two puzzle modes: daily (date-seeded) and random (token-validated)
- Analytics collected via Cloudflare Analytics Engine
- Client-side state persists to localStorage for game history and preferences
## Layers
- Purpose: Generate 3-digit number puzzles with 5-7 clues via iterative filtering
- Location: `src/worker/puzzle.ts`
- Contains: Property definitions, filter engine, RNG with seeding, clue selection logic
- Depends on: Nothing (pure computation)
- Used by: Worker guess validation and API responses
- Purpose: Track player's guesses, solved status, current digit possibilities
- Location: `src/app.ts` (module-level variables and functions)
- Contains: `gameState` object, `possibles` 3D array, UI state (`activeBox`, `submitting`)
- Depends on: Storage module, DOM
- Used by: Game flow handlers (guess submission, UI updates)
- Purpose: Render game board, clues, feedback, stats, modals
- Location: `src/app.ts` (render* functions), `src/octo.ts`, `src/bubbles.ts`, `src/modals.ts`
- Contains: DOM mutation, event binding, animations
- Depends on: Game state, Storage
- Used by: Game flow handlers
- Purpose: HTTP route handling and response formatting
- Location: `src/worker/index.ts`
- Contains: Route handlers (`handleGetPuzzle`, `handleGuess`, etc.), request validation, response JSON
- Depends on: Puzzle, Crypto, Stats, Puzzles modules
- Used by: Client via fetch
- Purpose: Encrypt/decrypt random puzzle seeds to create opaque client-side tokens
- Location: `src/worker/crypto.ts`
- Contains: AES-GCM encryption helpers, seed signing/verification
- Depends on: Web Crypto API
- Used by: Random puzzle routes
- Purpose: localStorage abstraction for game history, preferences, analytics UID
- Location: `src/storage.ts`
- Contains: `loadHistory`, `recordGame`, `loadPrefs`, `persistPrefs`
- Depends on: localStorage API, types
- Used by: App (tracking history, saving scores)
- Purpose: Light/dark mode toggle, accent color picker, canvas background
- Location: `src/theme.ts`, `src/colours.ts`
- Contains: Theme application, canvas dot-grid rendering, color swatches
- Depends on: DOM, localStorage
- Used by: App initialization
- Purpose: Aggregate event data into Cloudflare Analytics Engine and render stats dashboard
- Location: `src/worker/stats.ts`
- Contains: SQL query builders, event aggregation, stats dashboard HTML rendering
- Depends on: Cloudflare API
- Used by: Worker stats endpoint
- Purpose: Render server-side puzzle archive page with sorted list
- Location: `src/worker/puzzles.ts`
- Contains: HTML generation for puzzle list, date formatting
- Depends on: Nothing (pure HTML generation)
- Used by: Worker `/puzzles` route
## Data Flow
- **Puzzle state:** `gameState` object (answer, guesses, solved, puzzleNum, date, token, isRandom)
- **Game board state:** `possibles` 3D Set array (digits remaining per position), `activeBox` (open keypad)
- **Player preferences:** `saveScore` toggle (read from localStorage, can toggle mid-game)
- **UI state:** Scattered across module scope (`submitting`, `analyticsUid`, etc.)
- **Transient UI state:** DOM classList toggles, modal visibility
## Key Abstractions
- Purpose: Represents 24 filterable digit properties (prime, square, sums, products, etc.)
- Examples: `PROPERTIES` record in `src/worker/puzzle.ts`
- Pattern: Each property has `label`, `type` (text/numeric), `compute(n)` function; grouped in `PROPERTY_GROUPS`
- Purpose: Iteratively select clues that narrow candidate set to 15–40% of previous size
- Examples: `findGoodClues()`, `applyFilter()` in `src/worker/puzzle.ts`
- Pattern: For each candidate set, scan all operators+values, pick weighted random from valid range
- Purpose: Cache element references on startup to avoid repeated `querySelector` calls
- Examples: `const dom = { hint: $('[data-hint]'), feedback: [...], ... }` in `src/app.ts`
- Pattern: Maps semantic names to data attribute selectors; populated once at init
- Purpose: Idempotent UI updates tied to state changes
- Examples: `renderBox()`, `renderClues()`, `renderFeedback()`, `renderStats()` in `src/app.ts`
- Pattern: Read from game state, mutate DOM (innerHTML, classList, attributes), no return value
- Purpose: One handler per API endpoint
- Examples: `handleGetPuzzle()`, `handleGuess()`, `handleGetRandomPuzzle()` in `src/worker/index.ts`
- Pattern: Validate input, call business logic, return JSON response
## Entry Points
- Location: `index.html` → loaded via Vite
- Triggers: Browser requests `/`
- Responsibilities: Loads `src/app.ts` (auto-executed), initializes theme/colors, sets up event listeners
- Location: `src/worker/index.ts` (default export `fetch` handler)
- Triggers: HTTP requests to Cloudflare Worker
- Responsibilities: Routes requests to handlers, manages KV cache and Analytics Engine access
- Location: `vite.config.ts`
- Triggers: `npm run build` or `npm run dev`
- Responsibilities: Builds client via Vite + Cloudflare plugin, builds worker separately
## Error Handling
- Invalid guess format (not 100-999): return 400 with error message
- Invalid date format: return 400
- Future puzzle access: return 400 "Cannot guess future puzzles"
- Token verification fails: return 400 "Invalid token"
- API fetch error (stats): return 503 "Analytics secrets not configured"
- Fetch throws or res.ok === false: set feedback to "Something went wrong"
- JSON parse error: silently fail, show generic error
- Missing elements: null coalescing via optional chaining, skip render
- Guard against double-submit: `submitting` flag, disable button during fetch
- Guard against eliminating last digit: `if (s.size === 1) return`
- Guard against submitting with incomplete guess: `checkSubmit()` only enables button when `possibles.every(s => s.size === 1)`
## Cross-Cutting Concerns
- Client: number format (100-999), date format (YYYY-MM-DD), guess completeness
- Server: guest number range, date format, token structure, event enum membership
<!-- GSD:architecture-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd:quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd:debug` for investigation and bug fixing
- `/gsd:execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd:profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
