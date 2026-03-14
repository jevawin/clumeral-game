# Clumeral — Claude Instructions

## What This Is

**Clumeral** (clumeral.com) is a daily browser word puzzle game. A seeded random algorithm filters numbers 100–999 down to one answer using column-based clues. The player reads the clues and guesses the hidden number. New puzzle every day, same answer for everyone.

Tagline: *Crack the three-digit number. New puzzle every day.*

## Project Files

| File | Purpose |
|------|---------|
| `index.html` | Game shell — title, instructions, card, clue list, input, save-row, stats, next-puzzle |
| `app.js` | Client UI — fetches puzzle from Worker (or local fallback), renders clues/feedback/history/stats, handles guesses |
| `puzzle.js` | Shared logic — `PROPERTIES`, `PROPERTY_GROUPS`, `runFilterLoop`, `makeRng`, date helpers. Used by Worker and as local dev fallback |
| `_worker.js` | Cloudflare Pages Advanced Mode Worker — intercepts `GET /`, injects `window.PUZZLE_DATA` into HTML, falls through to Pages assets for everything else |
| `style.css` | All visual styling — dark theme, frosted glass card, clue rows, stats, responsive layout |

## Architecture

**No framework, no build step.** Pure HTML/CSS/JS. `puzzle.js` is an ES module (no bundler).

### How it works

1. `index.html` loads `app.js` as `type="module"`
2. `app.js` calls `loadPuzzle()`:
   - **Production**: fetches `WORKER_URL` → receives `{ date, puzzleNumber, answer, clues }` JSON
   - **Local dev** (`localhost`): dynamically imports `puzzle.js` and runs `runFilterLoop` directly in-browser
3. `startDailyPuzzle(puzzleData)` renders clues and initialises game state

### puzzle.js structure

```
PROPERTIES — 28 filterable properties (12 boolean specials + 16 numeric)
PROPERTY_GROUPS — 6 groups (Specials, Sums, Differences, Products, Means, Range)
applyFilter(candidates, propKey, operator, value)
runFilterLoop(rng) — returns { answer, clues }
makeRng(seed) — mulberry32 seeded RNG
todayLocal / dateSeedInt / puzzleNumber — date utilities
```

### Key algorithm facts

- `candidates` starts as integers `[100..999]` — no pre-built data structure
- Each property has a `compute(n)` function that derives the value on-the-fly from digits
- `getDigits(n)` → `[Math.floor(n/100), Math.floor((n%100)/10), n%10]`
- One filter is drawn per `PROPERTY_GROUPS` entry per main loop iteration
- After the main loop, a **tiebreaker** sweeps all properties with `=` (exact match on `candidates[0]`) until `candidates.length === 1`

### PROPERTY_GROUPS

```js
Specials:    12 boolean properties (3 digits × prime/square/cube/triangular)
Sums:        ['sumFS', 'sumFT', 'sumST', 'sumAll']
Differences: ['diffFS', 'diffFT', 'diffST']
Products:    ['prodFS', 'prodFT', 'prodST', 'prodAll']
Means:       ['meanFS', 'meanFT', 'meanST', 'meanAll']
Range:       ['range']
```

### Property types

- `type: 'text'` — boolean value (`true`/`false`); operators: `=` `!=`
- `type: 'numeric'` — number value; operators: `<=` `=` `!=` `>=`

### Daily puzzle seeding

- Seed = today's local date as integer (YYYYMMDD)
- RNG = mulberry32 (`makeRng` in `puzzle.js`)
- `runFilterLoop(rng)` — same seed always produces same puzzle
- Epoch date (`EPOCH_DATE = '2026-03-08'`) = Puzzle #1

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

- **Boolean clues** (`type: 'text'`): `[subject] [**is [not] predicate**]`
  - Affirmative (`= true` or `!= false`): "The first digit **is a prime number**"
  - Negative (`= false` or `!= true`): "The first digit **is not a prime number**"
- **Numeric clues**: `[label] [operator in coral] [value in bold]`
- Operator symbols: `<=` → `≤`, `>=` → `≥`, `=` → `=`, `!=` → `≠`

## Dev Server

```bash
python3 -m http.server 8080
# open http://localhost:8080
# window.PUZZLE_DATA won't be set; app.js falls back to importing puzzle.js directly
```

## Deployment

Push to `main` → GitHub → Cloudflare Pages auto-deploys. `_worker.js` is picked up automatically by Pages Advanced Mode. No `wrangler.toml` needed.

## Conventions

- No framework, no bundler, no TypeScript — plain JS with ES modules
- `puzzle.js` is shared; never put UI code in it
- `app.js` is UI only; never put filter/compute logic in it
- DOM IDs are locked: `#status`, `#clues`, `#guess`, `#submit`, `#history`, `#feedback`, `#history-label`
- Event listeners attached at module level in `app.js` — never inside `startDailyPuzzle`
- `gameState` is module-scoped `let` in `app.js` — not a `window` global

<!-- clancy:start -->
## Clancy — Autonomous Development

This project uses [Clancy](https://github.com/Pushedskydiver/clancy) for autonomous ticket implementation.

### Board
- **Provider:** GitHub Issues
- **Repo:** jevawin/clumeral-game
- **Label flow:** ideas → plan → approve → build → review → done

### Roles enabled
- Implementer (default)
- Planner — refines issues labelled `plan`, posts structured plan as comment

### Status transitions
- Picks up: issues labelled `build`
- On start: re-labels `build` (in-progress)
- On done: re-labels `review`

### Commands
- `/plan` — plan one `plan`-labelled issue
- `/approve` — promote plan comment to description, re-label `build`
- `/run` — implement one `build`-labelled issue
- `/clancy:map-codebase` — rescan codebase into `.clancy/docs/`
- `/clancy:doctor` — test all integrations
- `/clancy:dry-run` — preview next ticket without running

### Config
- Credentials: `.clancy/.env` (gitignored)
- Docs: `.clancy/docs/` (10 context files, populated by map-codebase)
<!-- clancy:end -->
