# Architecture Research

**Domain:** Static vanilla JS single-page puzzle game
**Researched:** 2026-03-07
**Confidence:** HIGH

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Presentation Layer                    │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │  ClueDisplay │  │  GuessInput  │  │  NewPuzzleButton │   │
│  └──────┬───────┘  └──────┬───────┘  └────────┬─────────┘   │
│         │                 │                   │              │
├─────────┴─────────────────┴───────────────────┴─────────────┤
│                        Game Controller                       │
│  ┌───────────────────────────────────────────────────────┐   │
│  │  startNewPuzzle() · checkGuess() · renderState()      │   │
│  └───────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│                        Logic Layer                           │
│  ┌─────────────────────┐  ┌──────────────────────────────┐   │
│  │   FilteringEngine   │  │        CSVLoader             │   │
│  │  runFilterLoop()    │  │  fetch() → parse → rows[]    │   │
│  │  applyFilter()      │  │                              │   │
│  └─────────────────────┘  └──────────────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│                        Data Layer                            │
│  ┌──────────────────┐  ┌──────────────────────────────────┐  │
│  │   data.csv       │  │   Game State (plain JS object)   │  │
│  │  (static file)   │  │  { rows, candidates, clues,      │  │
│  │                  │  │    answer, phase }               │  │
│  └──────────────────┘  └──────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Boundary |
|-----------|----------------|----------|
| CSVLoader | Fetch `data.csv`, parse text into row objects, expose `loadData()` returning a Promise of rows | Owns all I/O; nothing else touches fetch() |
| FilteringEngine | Run the filter loop: pick column/operator/value, apply filter, accumulate clues until 1 candidate remains | Pure logic; no DOM access, no fetch; receives rows[], returns { answer, clues } |
| GameState | Single plain JS object holding current puzzle state: full dataset, candidate rows, clues array, answer, phase (loading / ready / solved / wrong) | Mutated only by GameController; never touched by UI components directly |
| GameController | Orchestrates startup, new puzzle generation, guess checking; calls CSVLoader and FilteringEngine; writes to GameState; calls render | The only place that wires everything together |
| Renderer | Reads GameState and writes to DOM; no logic, no side effects; called by GameController after every state change | Pure DOM update functions; reads state, produces HTML |
| UI Event Handlers | Thin wrappers on DOM events that call GameController methods | No logic; only translate user actions into controller calls |

## Recommended Project Structure

For a no-build-step project that must deploy as static files, two valid structures exist:

**Option A: Single-file (simplest)**
```
/
├── index.html       # All HTML, CSS, and JS in one file
└── data.csv         # Static data
```

**Option B: Multi-file with script modules (recommended)**
```
/
├── index.html       # HTML skeleton + <script type="module" src="main.js">
├── data.csv         # Static data
├── main.js          # Entry point: imports all modules, wires together
├── csvLoader.js     # CSVLoader module
├── filterEngine.js  # FilteringEngine module
├── renderer.js      # All DOM rendering functions
└── style.css        # Stylesheet (linked from index.html)
```

### Structure Rationale

**Option B is recommended** because:
- `<script type="module">` works natively in all modern browsers and GitHub Pages — no bundler needed
- Each file has one clear job; the filtering engine can be tested in isolation by importing it in a browser console
- `data.csv` is a sibling of `index.html` so `fetch('./data.csv')` resolves correctly in both GitHub Pages and local dev (via `npx serve` or similar)
- If the project ever grows, splitting into modules is free — no refactor cost

**Single-file (Option A)** is acceptable only if the total codebase is small enough that a single scroll covers everything. Once the filtering engine exceeds ~100 lines, readability collapses.

## Architectural Patterns

### Pattern 1: Unidirectional State Flow

**What:** State is a single plain object. Every user action calls a controller function. The controller mutates state and then calls `render(state)`. The renderer never mutates state.

**When to use:** Always, for any app with more than one screen phase. Prevents "the DOM is the state" bugs.

**Trade-offs:** Slightly more code than direct DOM manipulation; dramatically easier to debug because state at any point is a single inspectable object.

**Example:**
```javascript
// gameState.js (or inline in main.js)
const state = {
  phase: 'loading',   // 'loading' | 'ready' | 'solved' | 'wrong'
  allRows: [],
  candidates: [],
  clues: [],
  answer: null,
};

// GameController
function startNewPuzzle() {
  state.phase = 'ready';
  state.candidates = [...state.allRows];
  state.clues = [];
  const result = runFilterLoop(state.candidates);
  state.answer = result.answer;
  state.clues = result.clues;
  render(state);
}

// Renderer — only reads state, only writes DOM
function render(state) {
  document.getElementById('clues').innerHTML = buildClueHTML(state.clues);
  document.getElementById('phase-label').textContent = state.phase;
}
```

### Pattern 2: Pure Function Filtering Engine

**What:** The filter loop is a self-contained function that takes the full dataset and returns `{ answer, clues }`. It has no side effects, no DOM access, and no global state.

**When to use:** Always. The existing Google Sheets Apps Script logic maps directly to this pattern.

**Trade-offs:** Requires passing data in; in exchange it is trivially testable and portable.

**Example:**
```javascript
// filterEngine.js
export function runFilterLoop(rows) {
  let candidates = [...rows];
  const clues = [];
  const RANGE_GROUPS = { /* column metadata */ };

  while (candidates.length > 1) {
    // pick random range group, random column, random value, random operator
    // skip if column is uniform or filter eliminates all candidates
    // apply filter, push clue
  }

  return {
    answer: candidates[0][0],  // column 0 = Number
    clues,
  };
}
```

### Pattern 3: Fail-Fast CSV Validation

**What:** After parsing `data.csv`, assert that the expected column count is present and that column 0 values are all integers in 100–999. Throw a visible error if not.

**When to use:** On page load, before any puzzle is generated.

**Trade-offs:** Adds 10 lines of code; saves hours of silent wrong-answer bugs if the CSV is ever edited.

**Example:**
```javascript
function validateRows(rows) {
  if (rows.length === 0) throw new Error('data.csv is empty');
  const EXPECTED_COLS = 23; // columns 0–22
  rows.forEach((row, i) => {
    if (row.length !== EXPECTED_COLS)
      throw new Error(`Row ${i + 1} has ${row.length} columns, expected ${EXPECTED_COLS}`);
    const num = parseInt(row[0], 10);
    if (isNaN(num) || num < 100 || num > 999)
      throw new Error(`Row ${i + 1} column 0 is not a valid 3-digit number: ${row[0]}`);
  });
}
```

## Data Flow

### Startup Flow

```
Page Load
    ↓
CSVLoader.loadData()
    ↓  fetch('./data.csv') → text → parse lines → parse fields
rows[] (array of string arrays)
    ↓
validateRows(rows)         ← throws visible error if CSV is malformed
    ↓
state.allRows = rows
    ↓
startNewPuzzle()
```

### New Puzzle Flow

```
startNewPuzzle() called (on load or "New Puzzle" click)
    ↓
state.candidates = [...state.allRows]    ← fresh copy every time
    ↓
FilteringEngine.runFilterLoop(candidates)
    ↓  iterates: pick column → pick operator → pick value
    ↓  skip if: all candidates eliminated OR column is uniform
    ↓  apply filter → update candidates → push clue
    ↓  repeat until candidates.length === 1
{ answer, clues }
    ↓
state.answer = answer
state.clues = clues
state.phase = 'ready'
    ↓
render(state)
```

### Guess Flow

```
Player types in input → clicks Submit (or presses Enter)
    ↓
UI event handler reads input.value
    ↓
GameController.checkGuess(value)
    ↓
parseInt(value) === state.answer ?
    YES → state.phase = 'solved'
    NO  → state.phase = 'wrong'
    ↓
render(state)
```

### State Transitions

```
loading → ready       (CSV loaded, first puzzle generated)
ready   → solved      (correct guess)
ready   → wrong       (incorrect guess)
wrong   → ready       (player tries again — same puzzle)
*       → ready       (New Puzzle button — fresh filter run)
```

## Build Order (What Depends on What)

Build bottom-up — lower layers have no dependencies on upper layers:

1. **`data.csv` validation** — confirm the CSV is present and well-formed before writing any code. Everything else depends on it.
2. **`csvLoader.js`** — `fetch` + text parsing. No dependencies. Can be tested by opening DevTools and calling `loadData()`.
3. **`filterEngine.js`** — pure function, depends only on the row schema understood from step 1. This is the highest-risk component; build and stress-test it first.
4. **`main.js` (GameState + GameController)** — wires CSVLoader and FilteringEngine together, manages state object. Depends on steps 2 and 3.
5. **`renderer.js`** — DOM update functions. Depends on knowing what state looks like (step 4) but not on logic being complete.
6. **`index.html` + `style.css`** — HTML skeleton and styling. Can be developed in parallel with steps 4–5 once the DOM shape is decided.
7. **UI event handlers** — thin wiring in `main.js` or inline in `index.html`. Last because they depend on all of the above.

## Single HTML File vs Multiple Files

| Criterion | Single file | Multiple files (modules) |
|-----------|-------------|--------------------------|
| Deployment | Simpler — one file to upload | Equally simple for GitHub Pages |
| Local dev (file://) | Works without a server | Requires a local server (module CORS) |
| Readability | Degrades past ~300 lines | Each file stays focused |
| Testability | Difficult — no imports | FilteringEngine can be imported and called independently |
| Recommendation | Only if keeping total JS under ~150 lines | Preferred for this project |

**Decision: Use multiple files.** The filtering engine alone will exceed 100 lines. Separating it into `filterEngine.js` allows manual testing in the browser console without touching the UI. The `file://` limitation is minor — `npx serve .` or `python3 -m http.server` resolves it during development.

## Anti-Patterns

### Anti-Pattern 1: DOM as State

**What people do:** Store the answer and clue list only in the DOM (e.g., as `data-*` attributes or hidden inputs). Read them back from the DOM when needed.

**Why it's wrong:** The DOM is a rendering target, not a data store. Reading state from the DOM couples logic to HTML structure and makes "New Puzzle" resets brittle — you have to remember every DOM node that holds state.

**Do this instead:** Keep all state in a plain JS object. Render is always `render(state)` — a one-way write to the DOM.

### Anti-Pattern 2: Mutating the Full Dataset During Filtering

**What people do:** Filter `state.allRows` in place, shrinking it as the puzzle runs. On "New Puzzle", there are no rows left to re-filter.

**Why it's wrong:** The full dataset must survive across puzzles. Mutating it means the second puzzle has fewer rows than the first.

**Do this instead:** Always copy before filtering: `let candidates = [...state.allRows]`. The engine works on `candidates`; `allRows` is read-only after initial load.

### Anti-Pattern 3: Fetching CSV on Every New Puzzle

**What people do:** Call `fetch('data.csv')` each time the player clicks "New Puzzle".

**Why it's wrong:** Unnecessary network round-trips, adds latency, and fails gracefully only if the developer remembers to handle the Promise every time.

**Do this instead:** Fetch once on page load, store in `state.allRows`. "New Puzzle" re-slices from the in-memory array.

### Anti-Pattern 4: Inline Event Handlers in HTML

**What people do:** `<button onclick="startNewPuzzle()">` — logic coupled into the HTML.

**Why it's wrong:** When using `<script type="module">`, module-scope functions are not on `window` and `onclick=""` can't reach them. Also mixes presentation and behavior.

**Do this instead:** Add listeners in JS: `document.getElementById('new-puzzle').addEventListener('click', startNewPuzzle)`.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| data.csv | `fetch('./data.csv')` on page load | Relative path works on GitHub Pages; fails on `file://` — use a local server for dev |
| GitHub Pages | Push to `main` (or configured branch) | No build step required; repo root is web root |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| CSVLoader → GameController | Promise resolving to rows[] | Controller awaits; handles rejection with visible error |
| GameController → FilteringEngine | Direct function call with candidates[] | Synchronous; no async needed |
| GameController → Renderer | Direct function call with state object | Renderer is stateless; call after every state mutation |
| UI Events → GameController | addEventListener callbacks | Events call controller methods; never manipulate DOM directly |

## Sources

- Project constraints are explicit in PROJECT.md — no external research needed for core structural decisions
- `<script type="module">` browser support: baseline since 2018 across Chrome, Firefox, Safari (HIGH confidence — well-established platform feature)
- `fetch()` same-origin CSV loading on GitHub Pages: standard pattern, no special headers required (HIGH confidence)
- Unidirectional state flow (Flux pattern) applied without a framework: established pattern for small vanilla JS apps (HIGH confidence)

---
*Architecture research for: Static vanilla JS single-page puzzle game*
*Researched: 2026-03-07*
