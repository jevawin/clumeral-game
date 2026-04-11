# Architecture

**Analysis Date:** 2026-04-11

## Pattern Overview

**Overall:** Client-Server with Cloudflare Workers backend and static frontend. The puzzle answer never reaches the client — validation happens server-side only.

**Key Characteristics:**
- Client fetches puzzle clues only (never the answer)
- Server validates guesses deterministically via seed-based RNG
- Deterministic puzzle generation ensures consistency across requests
- Two puzzle modes: daily (date-seeded) and random (token-validated)
- Analytics collected via Cloudflare Analytics Engine
- Client-side state persists to localStorage for game history and preferences

## Layers

**Puzzle Generation (Server):**
- Purpose: Generate 3-digit number puzzles with 5-7 clues via iterative filtering
- Location: `src/worker/puzzle.ts`
- Contains: Property definitions, filter engine, RNG with seeding, clue selection logic
- Depends on: Nothing (pure computation)
- Used by: Worker guess validation and API responses

**Game State Management (Client):**
- Purpose: Track player's guesses, solved status, current digit possibilities
- Location: `src/app.ts` (module-level variables and functions)
- Contains: `gameState` object, `possibles` 3D array, UI state (`activeBox`, `submitting`)
- Depends on: Storage module, DOM
- Used by: Game flow handlers (guess submission, UI updates)

**UI Rendering (Client):**
- Purpose: Render game board, clues, feedback, stats, modals
- Location: `src/app.ts` (render* functions), `src/octo.ts`, `src/bubbles.ts`, `src/modals.ts`
- Contains: DOM mutation, event binding, animations
- Depends on: Game state, Storage
- Used by: Game flow handlers

**API Layer (Server):**
- Purpose: HTTP route handling and response formatting
- Location: `src/worker/index.ts`
- Contains: Route handlers (`handleGetPuzzle`, `handleGuess`, etc.), request validation, response JSON
- Depends on: Puzzle, Crypto, Stats, Puzzles modules
- Used by: Client via fetch

**Crypto/Tokenization (Server):**
- Purpose: Encrypt/decrypt random puzzle seeds to create opaque client-side tokens
- Location: `src/worker/crypto.ts`
- Contains: AES-GCM encryption helpers, seed signing/verification
- Depends on: Web Crypto API
- Used by: Random puzzle routes

**Storage (Client):**
- Purpose: localStorage abstraction for game history, preferences, analytics UID
- Location: `src/storage.ts`
- Contains: `loadHistory`, `recordGame`, `loadPrefs`, `persistPrefs`
- Depends on: localStorage API, types
- Used by: App (tracking history, saving scores)

**Theme/Styling (Client):**
- Purpose: Light/dark mode toggle, accent color picker, canvas background
- Location: `src/theme.ts`, `src/colours.ts`
- Contains: Theme application, canvas dot-grid rendering, color swatches
- Depends on: DOM, localStorage
- Used by: App initialization

**Analytics (Server):**
- Purpose: Aggregate event data into Cloudflare Analytics Engine and render stats dashboard
- Location: `src/worker/stats.ts`
- Contains: SQL query builders, event aggregation, stats dashboard HTML rendering
- Depends on: Cloudflare API
- Used by: Worker stats endpoint

**Puzzle History (Server):**
- Purpose: Render server-side puzzle archive page with sorted list
- Location: `src/worker/puzzles.ts`
- Contains: HTML generation for puzzle list, date formatting
- Depends on: Nothing (pure HTML generation)
- Used by: Worker `/puzzles` route

## Data Flow

**Daily Puzzle Flow:**

1. Client loads `/` → `loadPuzzle()` fetches `/api/puzzle`
2. Server `handleGetPuzzle()` derives `today`, calls `getDailyPuzzle(env, today)`
3. `getDailyPuzzle` checks KV cache, or generates via `runFilterLoop(makeRng(dateSeedInt(today)))`
4. Server returns clues array (no answer) to client
5. Client calls `startDailyPuzzle(date, num, clues)`
6. Client initializes `gameState`, `possibles` array, renders clues
7. Player eliminates digits → client updates `possibles`, rerenders boxes
8. Player submits guess → client POSTs to `/api/guess` with `{ guess, date }`
9. Server looks up puzzle in KV, checks if `guess === answer`
10. Server returns `{ correct: boolean }`
11. If correct, client records game to localStorage, shows stats
12. If incorrect, client adds to `gameState.guesses`, shows feedback, lets player try again

**Random Puzzle Flow:**

1. Client loads `/random` → `loadPuzzle()` fetches `/api/puzzle/random`
2. Server generates random seed, runs `runFilterLoop`, encrypts seed → `token`
3. Server returns `{ clues, token, isRandom: true }`
4. Client stores token in `gameState.token`
5. Player guesses → client POSTs to `/api/guess` with `{ guess, token }`
6. Server verifies token, re-derives RNG and answer, validates guess
7. Server returns `{ correct: boolean }`
8. No score recording (random puzzles don't persist to history)

**Replay Puzzle Flow:**

1. Client navigates to `/puzzles/:num` → `loadPuzzle()` fetches `/api/puzzle/:num`
2. Server converts puzzle number to date, returns clues
3. Client checks localStorage history for that date
4. If already solved, shows completed state with try count
5. If not solved, plays normally; on victory, records to history

**Analytics Flow:**

1. Client calls `track(event, value, source)` → POSTs to `/api/event`
2. Event includes `uid` (persistent UID from localStorage), `newUser` flag
3. Server writes to Analytics Engine via `env.ANALYTICS.writeDataPoint()`
4. Stats dashboard queries Engine via Cloudflare API (SQL queries in `stats.ts`)

**State Management:**

- **Puzzle state:** `gameState` object (answer, guesses, solved, puzzleNum, date, token, isRandom)
- **Game board state:** `possibles` 3D Set array (digits remaining per position), `activeBox` (open keypad)
- **Player preferences:** `saveScore` toggle (read from localStorage, can toggle mid-game)
- **UI state:** Scattered across module scope (`submitting`, `analyticsUid`, etc.)
- **Transient UI state:** DOM classList toggles, modal visibility

## Key Abstractions

**Puzzle Property System:**
- Purpose: Represents 24 filterable digit properties (prime, square, sums, products, etc.)
- Examples: `PROPERTIES` record in `src/worker/puzzle.ts`
- Pattern: Each property has `label`, `type` (text/numeric), `compute(n)` function; grouped in `PROPERTY_GROUPS`

**Filter Engine:**
- Purpose: Iteratively select clues that narrow candidate set to 15–40% of previous size
- Examples: `findGoodClues()`, `applyFilter()` in `src/worker/puzzle.ts`
- Pattern: For each candidate set, scan all operators+values, pick weighted random from valid range

**DOM Cache:**
- Purpose: Cache element references on startup to avoid repeated `querySelector` calls
- Examples: `const dom = { hint: $('[data-hint]'), feedback: [...], ... }` in `src/app.ts`
- Pattern: Maps semantic names to data attribute selectors; populated once at init

**Render Functions:**
- Purpose: Idempotent UI updates tied to state changes
- Examples: `renderBox()`, `renderClues()`, `renderFeedback()`, `renderStats()` in `src/app.ts`
- Pattern: Read from game state, mutate DOM (innerHTML, classList, attributes), no return value

**Route Handlers:**
- Purpose: One handler per API endpoint
- Examples: `handleGetPuzzle()`, `handleGuess()`, `handleGetRandomPuzzle()` in `src/worker/index.ts`
- Pattern: Validate input, call business logic, return JSON response

## Entry Points

**Client:**
- Location: `index.html` → loaded via Vite
- Triggers: Browser requests `/`
- Responsibilities: Loads `src/app.ts` (auto-executed), initializes theme/colors, sets up event listeners

**Worker:**
- Location: `src/worker/index.ts` (default export `fetch` handler)
- Triggers: HTTP requests to Cloudflare Worker
- Responsibilities: Routes requests to handlers, manages KV cache and Analytics Engine access

**Vite Config:**
- Location: `vite.config.ts`
- Triggers: `npm run build` or `npm run dev`
- Responsibilities: Builds client via Vite + Cloudflare plugin, builds worker separately

## Error Handling

**Strategy:** Graceful degradation with user-facing error messages.

**Patterns:**

**Server Validation:**
- Invalid guess format (not 100-999): return 400 with error message
- Invalid date format: return 400
- Future puzzle access: return 400 "Cannot guess future puzzles"
- Token verification fails: return 400 "Invalid token"
- API fetch error (stats): return 503 "Analytics secrets not configured"

**Client Network Errors:**
- Fetch throws or res.ok === false: set feedback to "Something went wrong"
- JSON parse error: silently fail, show generic error
- Missing elements: null coalescing via optional chaining, skip render

**Client Logic Errors:**
- Guard against double-submit: `submitting` flag, disable button during fetch
- Guard against eliminating last digit: `if (s.size === 1) return`
- Guard against submitting with incomplete guess: `checkSubmit()` only enables button when `possibles.every(s => s.size === 1)`

## Cross-Cutting Concerns

**Logging:** console-based via `console.error()` in catch blocks (for dev only)

**Validation:** 
- Client: number format (100-999), date format (YYYY-MM-DD), guess completeness
- Server: guest number range, date format, token structure, event enum membership

**Authentication:** None. UID-based analytics (anonymous tracking). Random puzzle tokens prevent seed enumeration.

**Date Handling:** Consistent use of YYYY-MM-DD strings for dates, UTC epoch ("2026-03-08"), timezone-agnostic calculations

---

*Architecture analysis: 2026-04-11*
