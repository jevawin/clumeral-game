# Architecture

## Overview

**Clumeral** is a daily browser word puzzle game where players guess a three-digit number (100–999) based on constraint clues. A seeded random algorithm generates the puzzle: it starts with all candidates and applies filters from 28 numeric/boolean properties, removing numbers until one remains. The same seed (today's date) produces the same puzzle for everyone, every day.

**Core principle:** No framework, no build step, no TypeScript. Pure HTML, CSS, and JavaScript with ES modules. `puzzle.js` contains all filter logic and is shared between the browser and Cloudflare Worker.

**Flow:** `index.html` → `app.js` (loads puzzle via Worker or local fallback) → `startDailyPuzzle()` (renders clues, game UI) → Player guesses → Score saved to `localStorage`.

---

## Directory Structure

```
/home/jevawin/clumeral-game/
├── index.html           # Game shell — title, card, clue list, input, stats
├── app.js               # Client UI — puzzle loading, clue rendering, guess handling
├── puzzle.js            # Shared algorithm — properties, filters, RNG, date helpers
├── _worker.js           # Cloudflare Worker — intercepts GET /, injects puzzle data
├── style.css            # All styling — dark theme, frosted glass, responsive
├── wrangler.jsonc       # Cloudflare Pages config (minimal)
├── CLAUDE.md            # Project instructions
├── BRIEFING.md          # Development notes
└── .clancy/docs/        # Autonomous development docs (10 files)
```

---

## Key Modules

### `index.html` (5.3 KB)
**Purpose:** Game container and DOM structure.

**Key elements:**
- `<h1 class="game-title">Clumeral</h1>` — Main title (Forum font)
- `.card` — Frosted glass container (all game UI)
- `#clues` — Unordered list of clue rows
- `#guess`, `#submit` — Number input (3 digits, disabled until puzzle loads)
- `#save-row` — Checkbox to persist score to `localStorage`
- `#stats`, `#history`, `#feedback` — Rendered dynamically by `app.js`
- `<script type="module" src="app.js">` — Loads the client as ES module

**Constraints:**
- DOM IDs are locked: `#status`, `#clues`, `#guess`, `#submit`, `#history`, `#feedback`, `#history-label`, `#stats`, `#next-puzzle`
- Must serve via HTTP (ES modules block over `file://`)

---

### `app.js` (10.3 KB)
**Purpose:** Client UI — fetch puzzle, render clues, handle guesses, manage local state.

**Module-level variables:**
```javascript
const EPOCH_DATE = "2026-03-08";  // Puzzle #1 launch date
let gameState = { answer: null, guesses: [], solved: false };
let saveScore = true;  // Preference from localStorage
```

**Key functions:**

| Function | Purpose |
|----------|---------|
| `loadPuzzle()` | Async bootstrap: check `window.PUZZLE_DATA` (Worker injection) or import `puzzle.js` (local dev) |
| `startDailyPuzzle(puzzleData)` | Render clues, initialize game state, check if already solved today |
| `handleGuess()` | Validate guess (3-digit integer), check answer, update history, save score |
| `renderClues(clues)` | Build HTML list with formatted clue rows (operator symbols, bold values) |
| `renderFeedback(type, answer, tries)` | Show "correct" / "incorrect" / empty message |
| `renderHistory(guesses)` | List all guesses made this puzzle |
| `renderStats()` | Calculate and display: games played, avg tries, last 5 attempts |
| `loadHistory()` / `recordGame()` | Read/write `localStorage[dlng_history]` |
| `loadPrefs()` / `persistPrefs()` | Read/write `localStorage[dlng_prefs]` |

**Event listeners (attached at module level):**
```javascript
document.getElementById("submit").addEventListener("click", handleGuess);
document.getElementById("guess").addEventListener("keydown", e => {
  if (e.key === "Enter") handleGuess();
});
document.getElementById("save-toggle").addEventListener("click", () => {
  updateCheckbox(!saveScore);
  persistPrefs();
});
```

**Clue rendering (boolean vs. numeric):**
- **Boolean clues:** "The first digit **is** a prime number" or "is **not** a prime number"
- **Numeric clues:** "The sum of the first and second digits **≤ 5**" (operator symbol in `<span class="clue-op">`, value in `<strong>`)

**Operator symbol map:**
```javascript
const OPERATOR_SYMBOLS = { "<=": "≤", ">=": "≥", "=": "=", "!=": "≠" };
```

---

### `puzzle.js` (9.6 KB)
**Purpose:** Shared puzzle generation logic (used by both browser and Worker).

**No UI code here.** Only computation, not rendering.

**Core data structures:**

```javascript
PROPERTIES = {
  // 12 boolean specials (3 digits × 4 traits: prime, square, cube, triangular)
  firstIsPrime:  { label: '...', type: 'text', compute: n => ... },
  secondIsPrime: { label: '...', type: 'text', compute: n => ... },
  // ...
  
  // 16 numeric properties
  sumFS:  { label: 'The sum of the first and second digits is', type: 'numeric', compute: n => ... },
  sumFT:  { label: 'The sum of the first and third digits is', type: 'numeric', compute: n => ... },
  // ... (sums, differences, products, means, range)
};

PROPERTY_GROUPS = {
  Specials:    [12 boolean properties],
  Sums:        ['sumFS', 'sumFT', 'sumST', 'sumAll'],
  Differences: ['diffFS', 'diffFT', 'diffST'],
  Products:    ['prodFS', 'prodFT', 'prodST', 'prodAll'],
  Means:       ['meanFS', 'meanFT', 'meanST', 'meanAll'],
  Range:       ['range'],
};
```

**Algorithm:**

```javascript
export function runFilterLoop(rng = Math.random) {
  let candidates = [100, 101, ..., 999];  // 900 integers
  const clues = [];
  const triedGroups = new Set();
  
  // Main loop: pick random untried group, property, value, operator
  while (candidates.length > 1 && triedGroups.size < 6) {
    const group = pick(untried groups);
    const propKey = pick(random property from group);
    const val = pick(random value from candidate pool);
    const operator = pick(appropriate operators for property type);
    
    // Apply filter: eliminate candidates that don't match
    const filtered = applyFilter(candidates, propKey, operator, val);
    if (filtered.length === 0) continue;  // Skip if eliminates everything
    
    candidates = filtered;
    clues.push({ label, operator, value: val });
  }
  
  // Tiebreaker: sweep all properties with exact match (=) until unique
  while (candidates.length > 1) {
    const val = compute(candidates[0]);
    const filtered = applyFilter(candidates, propKey, '=', val);
    if (filtered.length > 0 && filtered.length < candidates.length) {
      candidates = filtered;
      clues.push({ label, operator: '=', value: val });
    }
  }
  
  return { answer: candidates[0], clues };
}
```

**Exported functions:**
```javascript
runFilterLoop(rng)      // → { answer, clues }
makeRng(seed)           // → seeded RNG function (Mulberry32)
dateSeedInt(dateStr)    // → "2026-03-14" → 20260314
todayLocal()            // → "YYYY-MM-DD"
puzzleNumber(dateStr)   // → puzzle # (days since EPOCH_DATE)
```

**Property computation:** Each property's `compute(n)` function derives its value on-the-fly from the three digits.
```javascript
function getDigits(n) {
  return [Math.floor(n/100), Math.floor((n%100)/10), n%10];
}
// Example: sumFS for 345 → [3, 4, 5] → 3 + 4 = 7
```

---

### `_worker.js` (1.3 KB)
**Purpose:** Cloudflare Pages Advanced Mode Worker — intercepts GET `/`, injects puzzle data.

**How it works:**
1. Check if request is `GET /` or `GET /index.html`
2. Calculate today's puzzle: `runFilterLoop(makeRng(dateSeedInt(today)))`
3. Fetch static `index.html` from Pages assets
4. Inject puzzle data as global script before `</head>`:
   ```html
   <script>window.PUZZLE_DATA={...}</script></head>
   ```
5. Return injected HTML; all other requests (`style.css`, `app.js`, `puzzle.js`) are served from Pages assets

**Key import:**
```javascript
import { runFilterLoop, makeRng, dateSeedInt, todayLocal, puzzleNumber } from './puzzle.js';
```

The Worker and browser both use the same `puzzle.js` — ensuring identical puzzle generation.

---

### `style.css` (8.4 KB)
**Purpose:** All visual styling — dark theme, frosted glass card, responsive layout.

**Design tokens:**
```css
--bg-deep:    #0f0f1a     /* Near-black background */
--bg-card:    rgba(255,255,255,0.06)  /* Frosted glass (must be rgba) */
--accent:     #ff6d5a     /* Coral — buttons, operators, borders */
--accent-alt: #ff914d     /* Hover state */
--text:       #e8e8f0     /* Primary text */
--text-muted: #7a7a9a     /* Secondary text, labels */
--green:      #4caf88     /* Correct feedback, save icon */
--red:        #ff6d5a     /* Incorrect feedback (same as accent) */
```

**Key styles:**
- **Title:** Forum font (serif), 2.25rem, centered outside card
- **Card:** Frosted glass with `backdrop-filter: blur(10px)` and `-webkit-backdrop-filter` (Safari)
- **Input/Submit:** Stack full-width on screens < 480px
- **Clue rows:** `.clue-row` with text, bold value, operator in coral
- **Stats:** Grid layout (played, avg tries) + bubbles for last 5 attempts
- **Footer:** Icons + text credits

---

## Data Flow

### Loading Puzzle

#### Production (Cloudflare Pages)
```
Browser requests GET /
↓
_worker.js intercepts
↓
Calculate puzzle: runFilterLoop(makeRng(dateSeedInt(today)))
↓
Fetch index.html from Pages assets
↓
Inject <script>window.PUZZLE_DATA={...}</script></head>
↓
Return modified HTML to browser
↓
app.js detects window.PUZZLE_DATA ✓
↓
startDailyPuzzle(PUZZLE_DATA)
```

#### Local Dev (python -m http.server 8080)
```
Browser requests index.html
↓
Server returns unmodified index.html
↓
app.js: window.PUZZLE_DATA undefined
↓
Dynamically import puzzle.js in-browser
↓
runFilterLoop(makeRng(dateSeedInt(todayLocal())))
↓
startDailyPuzzle({ date, puzzleNumber, answer, clues })
```

### Guess Handling
```
Player enters 3-digit number, clicks Submit or presses Enter
↓
handleGuess() validates input (Number.isInteger, length === 3)
↓
Compare guess to gameState.answer
↓
If correct:
  - Set gameState.solved = true
  - Call renderFeedback("correct", answer, tries)
  - If saveScore: recordGame(today, tries) → localStorage[dlng_history]
  - Show stats, next puzzle number
↓
If incorrect:
  - Push guess to gameState.guesses
  - Call renderFeedback("incorrect")
  - Call renderHistory(guesses)
  - Clear input, refocus
```

### First Visit vs. Return Visit
```
loadPuzzle() → startDailyPuzzle(puzzleData)
↓
Check todayEntry() — find entry in localStorage[dlng_history] for today
↓
If found (already solved):
  - Display "You already solved today's puzzle in N tries"
  - Disable input/submit
  - Show stats & next puzzle
↓
If not found (new puzzle):
  - Initialize gameState = { answer, guesses: [], solved: false }
  - Enable input/submit, focus input
  - Load saveScore preference from localStorage[dlng_prefs]
```

---

## API Design

### Worker POST Response
The Worker does not expose an HTTP API. Instead, it injects the puzzle payload directly into the HTML as a global script variable.

**Injection point:** Before `</head>` in `index.html`
```html
<script>window.PUZZLE_DATA={"date":"2026-03-14","puzzleNumber":8,"answer":317,"clues":[...]}</script>
```

**Payload shape:**
```typescript
interface PuzzleData {
  date: string;        // "YYYY-MM-DD"
  puzzleNumber: number;  // Days since EPOCH_DATE (2026-03-08)
  answer: number;      // The hidden number (100–999)
  clues: Clue[];
}

interface Clue {
  label: string;       // Human-readable property description
  operator: "=" | "!=" | "<=" | ">=";  // Comparison operator
  value: boolean | number;  // Clue value (boolean for specials, number for numeric)
}
```

**Example:**
```json
{
  "date": "2026-03-14",
  "puzzleNumber": 8,
  "answer": 317,
  "clues": [
    { "label": "The first digit is a prime number", "operator": "=", "value": true },
    { "label": "The sum of all three digits is", "operator": "<=", "value": 12 },
    { "label": "The product of the first and second digits is", "operator": "!=", "value": 6 }
  ]
}
```

---

## State Management

### Module-Scoped Variables (app.js)
```javascript
let gameState = { 
  answer: null,        // The correct answer (100–999)
  guesses: [],         // Array of guesses made this session
  solved: boolean      // true if player guessed correctly
};
let saveScore = true;  // Preference: persist score to localStorage
```

**gameState** is **not** a window global — scoped to the `app.js` module.

### localStorage Keys
**Prefix:** `dlng_` (original game name: David Lark's Lame Number Game; do not rename — persisted in user browsers)

#### `dlng_history`
Stores game attempts across all puzzles.
```javascript
[
  { date: "2026-03-14", tries: 3 },
  { date: "2026-03-13", tries: 2 },
  { date: "2026-03-12", tries: 1 },
  // ... max 60 entries
]
```

**Managed by:**
- `loadHistory()` — Parse JSON from `localStorage[dlng_history]` (returns `[]` if missing/invalid)
- `recordGame(dateStr, tries)` — Prepend new entry, keep top 60, save to storage

#### `dlng_prefs`
User preferences (currently just `saveScore`).
```javascript
{ saveScore: boolean }
```

**Managed by:**
- `loadPrefs()` — Parse JSON, default to `{ saveScore: true }`
- `persistPrefs()` — Stringify and save to storage
- `updateCheckbox(checked)` — Update UI toggle + module variable

### Lifecycle
1. **Module load:** `loadPrefs()` → `saveScore` variable
2. **Puzzle load:** `startDailyPuzzle()` → `gameState` initialized
3. **Each guess:** `handleGuess()` → push to `gameState.guesses`, update history render
4. **Win:** `recordGame()` → write to `dlng_history`, `renderStats()` reads from storage
5. **Preference change:** Click save toggle → `persistPrefs()` → `localStorage`

---

## Seeding & Puzzle Uniqueness

### Date-Based Seed
- **Seed = YYYYMMDD as integer**
  ```javascript
  dateSeedInt("2026-03-14") → 20260314
  ```
- **Same date → same seed → same puzzle** for all users
- **Different date → different seed → different puzzle**

### RNG Algorithm
**Mulberry32** (seeded pseudo-random number generator):
```javascript
export function makeRng(seed) {
  let s = seed >>> 0;
  return function() {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
```

This RNG is **deterministic** — same seed always produces the same sequence of random numbers, and thus the same puzzle.

### Epoch Date
```javascript
const EPOCH_DATE = '2026-03-08';  // Puzzle #1 launch date
```

**Puzzle number calculation:**
```javascript
puzzleNumber(dateStr) {
  const ms = new Date(dateStr + 'T00:00:00') - new Date(EPOCH_DATE + 'T00:00:00');
  return Math.max(1, Math.floor(ms / 86400000) + 1);
}
// puzzleNumber('2026-03-08') = 1
// puzzleNumber('2026-03-09') = 2
// puzzleNumber('2026-03-14') = 8
```

---

## Conventions & Constraints

- **No framework, no bundler, no TypeScript** — plain ES modules
- **puzzle.js is shared** — never put UI code in it; used by both Worker and browser
- **app.js is UI-only** — never put filter/compute logic in it
- **DOM IDs are locked** — `#status`, `#clues`, `#guess`, `#submit`, `#history`, `#feedback`, `#history-label`, `#stats`, `#next-puzzle`
- **Event listeners at module level** — never inside `startDailyPuzzle()` (would re-attach on return visit)
- **gameState is module-scoped** — not a `window` global
- **localStorage prefix `dlng_` must never change** — existing users' data depends on it
- **HTTP only for local dev** — ES module imports block over `file://`
