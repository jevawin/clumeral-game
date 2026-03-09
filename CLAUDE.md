# Clumeral — Claude Instructions

## What This Is

**Clumeral** (clumeral.com) is a daily browser word puzzle game. A seeded random algorithm filters a CSV dataset of 3-digit numbers (100–999) down to one answer using column-based clues. The player reads the clues and guesses the hidden number. New puzzle every day, same answer for everyone.

Tagline: *Crack the three-digit number. New puzzle every day.*

## Project Files

| File | Purpose |
|------|---------|
| `index.html` | Game shell — title, instructions, card, clue list, input, save-row, stats, next-puzzle |
| `app.js` | All game logic — CSV loading (Phase 1), filtering engine (Phase 2), daily puzzle + UI (Phase 3) |
| `style.css` | All visual styling — dark theme, frosted glass card, clue rows, stats, responsive layout |
| `data.csv` | 900 rows (100–999), 23 columns — Number + digit properties (sums, products, differences, means, ranges, special text) |

## Architecture

**No framework, no build step.** Pure HTML/CSS/JS. Deployable to GitHub Pages as-is.

### app.js structure

```
Phase 1: CSV loading via fetch() + PapaParse
Phase 2: runFilterLoop() — filtering engine (seeded RNG)
Phase 3: Daily puzzle logic — makeRng, date helpers, localStorage, renderClues/Feedback/History/Stats, startDailyPuzzle, handleGuess
```

### Key data facts

- `data.csv` row 0 = headers, rows 1+ = data. Column 0 (`Number`) is the answer.
- Columns 1–3: raw digit values (first, second, third digit)
- Columns 4–6: duplicate "special" text columns (PapaParse deduplicates as `_1` — stripped in `renderClues` via `label.replace(/_\d+$/, '')`)
- Columns 7–22: filterable numeric/text ranges used by `RANGE_GROUPS`
- Text values in digit columns: `"a prime number"`, `"a square number"`, `"a cube number"`, `"a square or a cube number"` (digit 0 or 1), `"a triangular number"` — these are **exact strings**, not computed at runtime

### RANGE_GROUPS (column indices, 0-based)

```js
SpecialNumbers:     [4, 5, 6]        // text
Sums:               [7, 8, 9, 10]    // numeric
AbsoluteDifference: [11, 12, 13]     // numeric
Products:           [14, 15, 16, 17] // numeric
Means:              [18, 19, 20, 21] // numeric
Range:              [22]             // numeric
```

### Daily puzzle seeding

- Seed = today's local date as integer (YYYYMMDD)
- RNG = mulberry32
- `runFilterLoop(gameRows, rng)` — always produces the same puzzle for the same day
- Epoch date (`EPOCH_DATE = '2026-03-08'`) = Puzzle #1

### Uniqueness guarantee

After the main filter loop exhausts all 6 range groups, a **tiebreaker** sweeps remaining columns (indices 4–22) with `=` (exact match on `candidates[0]`) until `candidates.length === 1`. This prevents ambiguous puzzles.

### localStorage keys

- `dlng_history` — array of `{ date: "YYYY-MM-DD", tries: N }`, max 60 entries
- `dlng_prefs` — `{ saveScore: boolean }`
- Prefix `dlng_` = original game name "David Lark's Lame Number Game" — do not rename (persisted in existing user browsers)

## Design System

```css
--bg-deep:    #0f0f1a   /* near-black background */
--bg-card:    rgba(255,255,255,0.06)  /* frosted glass — must be rgba for blur to show */
--accent:     #ff6d5a   /* coral — operators, borders, buttons */
--accent-alt: #ff914d   /* hover state */
--text:       #e8e8f0   /* primary text */
--text-muted: #7a7a9a   /* secondary text, labels */
--green:      #4caf88   /* correct feedback, checked save icon */
--red:        #ff6d5a   /* same as accent — incorrect feedback */
```

- Font: Inter (Google Fonts CDN) with system-ui fallback
- Card: frosted glass with **both** `-webkit-backdrop-filter` and `backdrop-filter` (Safari requires the prefixed version)
- Responsive breakpoint: 480px — input/submit stack full-width

## Clue Display Rules

- **Numeric clues**: `[label] [operator in coral] [value in bold]`
- **Text clues**: `[label] [value in bold]` — no operator shown
- Operator symbols: `<=` → `≤`, `>=` → `≥`, `=` → `=`, `!=` → `≠`

## Known Bugs Fixed

1. **`_1` label suffix** — PapaParse deduplicates duplicate CSV headers by appending `_1`. Stripped in `renderClues` with `label.replace(/_\d+$/, '')`. Data lookup keys are unaffected.
2. **Ambiguous puzzles** — The tiebreaker sweep added after `runFilterLoop`'s main loop ensures only one number ever satisfies all displayed clues.

## Dev Server

```bash
python3 -m http.server 8080
# open http://localhost:8080
```

Must use a server — `fetch()` fails over `file://` protocol.

## Conventions

- No framework, no bundler, no TypeScript — plain JS
- All Phase 3 code appended to `app.js` (never modify Phase 1/2 code except the `startDailyPuzzle()` call in `loadData()`)
- DOM IDs are locked: `#status`, `#clues`, `#guess`, `#submit`, `#history`, `#feedback`, `#history-label`
- Event listeners attached at module level — never inside puzzle-start functions
- `gameState`, `gameRows`, `gameHeaders` are module-scoped `let` — not `window` globals
