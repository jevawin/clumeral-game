# Architecture

## Overview

**Clumeral** is a daily browser-based number puzzle game. Players crack a three-digit number using column-based clues generated from a seeded random algorithm. New puzzle every day, same answer for all players. A `/random` route provides on-demand puzzles.

The system operates in two deployment modes:
1. **Production** (Cloudflare Pages): HTTP request → Worker intercepts → generates puzzle data → injects into HTML
2. **Local Dev** (localhost): HTML loads → `app.js` dynamically imports `puzzle.js` → runs filter loop in-browser

---

## File/Module Structure

| File | Purpose |
|------|---------|
| `index.html` | Game shell — semantic markup, title, clue list, input, stats, footer |
| `app.js` | Client-side UI — fetches/renders puzzle, handles guesses, manages history |
| `puzzle.js` | Shared puzzle logic — properties, filter loop, RNG, date helpers |
| `_worker.js` | Cloudflare Pages Advanced Mode Worker — intercepts requests, injects puzzle data |
| `style.css` | All visual styling — dark theme, frosted glass card, responsive layout |
| `wrangler.jsonc` | Cloudflare Worker configuration |
| `.assetsignore` | Excludes `_worker.js` and `wrangler.jsonc` from static Pages assets |

---

## Data Flow

### Production — Daily Puzzle

```
GET /
  → Cloudflare Worker (_worker.js)
    → runFilterLoop(makeRng(dateSeedInt(today)))
    → { date, puzzleNumber, answer, clues }
    → injects window.PUZZLE_DATA into index.html </head>
    → returns modified HTML

Browser renders index.html
  → app.js module loads
  → detects window.PUZZLE_DATA
  → startDailyPuzzle(window.PUZZLE_DATA)
  → renders clues, initialises gameState
```

### Production — Random Puzzle

```
GET /random
  → Cloudflare Worker (_worker.js)
    → seed = Math.floor(Math.random() * 0xFFFFFFFF)
    → runFilterLoop(makeRng(seed))
    → { isRandom: true, answer, clues }
    → injects window.PUZZLE_DATA into index.html
    → returns modified HTML

Browser renders
  → app.js detects isRandom flag
  → startRandomPuzzle()
  → hides puzzle number/date, shows "Random Puzzle" label
  → shows "Play another random puzzle" on solve
```

### Local Development

```
GET /
  → index.html served by Python HTTP server
  → app.js loads, window.PUZZLE_DATA is undefined
  → dynamically: await import('./puzzle.js')
  → runFilterLoop(makeRng(dateSeedInt(today)))
  → startDailyPuzzle(puzzleData)
```

---

## Core Algorithm: Puzzle Generation (`puzzle.js`)

### Overview

`runFilterLoop(rng)` filters `candidates = [100..999]` down to a single unique answer using randomly-selected clues.

### Process

1. **Init**: `candidates = [100, 101, ..., 999]` (900 integers)
2. **Main loop** (one iteration per `PROPERTY_GROUPS` entry):
   - Pick random untried group (Specials, Sums, Differences, Products, Means, Range)
   - Pick random property from that group
   - Compute property value for all candidates
   - Skip if all candidates share the same value (uninformative)
   - Pick a random candidate's value; pick a random operator (`=`, `!=`, `<=`, `>=`)
   - Apply filter; skip if it would eliminate all candidates
   - Record clue; mark group as tried
3. **Tiebreaker** (if `candidates.length > 1`):
   - Sweep remaining properties with `=` (exact match on `candidates[0]`)
   - Continue until `candidates.length === 1`
4. **Return**: `{ answer: candidates[0], clues }`

### PROPERTY_GROUPS

```js
Specials:    [12 boolean properties — digit × prime/square/cube/triangular]
Sums:        ['sumFS', 'sumFT', 'sumST', 'sumAll']
Differences: ['diffFS', 'diffFT', 'diffST']
Products:    ['prodFS', 'prodFT', 'prodST', 'prodAll']
Means:       ['meanFS', 'meanFT', 'meanST', 'meanAll']
Range:       ['range']
```

### Property Types

- `type: 'text'` — boolean (`true`/`false`); operators `=` `!=`
- `type: 'numeric'` — number; operators `<=` `=` `!=` `>=`

### Seeding

- **Daily**: `dateSeedInt(date)` = YYYYMMDD integer
- **Random**: `Math.floor(Math.random() * 0xFFFFFFFF)`
- **RNG**: Mulberry32 — same seed always produces same sequence

```js
// makeRng in puzzle.js
function makeRng(seed) {
  return function() {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    // ... mulberry32 implementation
  }
}
```

- **Epoch**: `EPOCH_DATE = '2026-03-08'` = Puzzle #1

---

## State Management

### Client-Side (`app.js`)

```js
let gameState = {
  answer: null,    // current puzzle answer
  guesses: [],     // array of numeric guesses made
  solved: false,   // has player solved it?
  isRandom: false  // is this a random puzzle?
}

let saveScore = true  // user preference
```

- Module-scoped `let` — not a `window` global
- Mutated only through `handleGuess()`

### localStorage

Prefix `dlng_` (original name "David Lark's Lame Number Game") — do not rename; persisted in existing user browsers.

| Key | Value | Notes |
|-----|-------|-------|
| `dlng_history` | `[{ date: "YYYY-MM-DD", tries: N }]` | Max 60 entries |
| `dlng_prefs` | `{ saveScore: boolean }` | User opt-out preference |

---

## Worker / Edge Layer

### Configuration (`wrangler.jsonc`)

```json
{
  "name": "clumeral-game",
  "compatibility_date": "2026-03-09",
  "main": "_worker.js",
  "assets": {
    "directory": "./",
    "binding": "ASSETS",
    "run_worker_first": true
  }
}
```

### Behaviour

- `run_worker_first: true` — Worker intercepts all requests before Pages serves assets
- Routes handled by Worker: `GET /`, `GET /index.html`, `GET /random`
- All other routes: `env.ASSETS.fetch(request)` (Pages serves static files)

### Injection pattern

```js
// _worker.js
const assetRes = await env.ASSETS.fetch(new Request(new URL('/index.html', request.url)));
const html = await assetRes.text();
const injected = html.replace(
  '</head>',
  `<script>window.PUZZLE_DATA=${JSON.stringify(puzzleData)}</script></head>`
);
```

---

## Module Boundaries

**`puzzle.js`** — shared logic only
- Exports: `runFilterLoop`, `makeRng`, `dateSeedInt`, `todayLocal`, `puzzleNumber`, `PROPERTIES`, `PROPERTY_GROUPS`
- Never contains: DOM manipulation, UI code, event listeners

**`app.js`** — UI only
- Imports `puzzle.js` on localhost fallback only
- Never contains: filter/compute logic
- Event listeners attached at module level, never inside `startDailyPuzzle`

**`_worker.js`** — edge only
- Imports `puzzle.js` for puzzle generation
- Never contains: client-side code, DOM manipulation, localStorage

---

## Deployment

1. Push to `main` → GitHub
2. GitHub → Cloudflare Pages auto-deploys
3. `_worker.js` picked up automatically by Pages Advanced Mode
4. No `wrangler publish` needed
