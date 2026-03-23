# Clumeral — Claude Instructions

## What This Is

**Clumeral** (clumeral.com) is a daily browser word puzzle game. A seeded random algorithm filters numbers 100–999 down to one answer using column-based clues. The player reads the clues and guesses the hidden number. New puzzle every day, same answer for everyone.

Tagline: *Work out the number from 100–999. New puzzle every day.*

## Project Files

| File | Purpose |
|------|---------|
| `index.html` | Game shell — title, instructions, card, clue list, input, save-row, stats, next-puzzle |
| `app.js` | Client UI — fetches puzzle from Worker (or local fallback), renders clues/feedback/history/stats, handles guesses |
| `puzzle.js` | Shared logic — `PROPERTIES`, `PROPERTY_GROUPS`, `runFilterLoop`, `makeRng`, date helpers. Used by Worker and as local dev fallback |
| `_worker.js` | Cloudflare Pages Advanced Mode Worker — intercepts `GET /`, injects `window.PUZZLE_DATA` into HTML, falls through to Pages assets for everything else |
| `style.css` | All visual styling — light/dark theme via `light-dark()`, card with offset shadow, clue rows, digit boxes, keypad, stats, modal |

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
- `dlng_theme` — `"light"` or `"dark"` (user's theme preference)
- `cw-htp-seen` — `"1"` if How to Play modal has been shown
- Prefix `dlng_` = original game name "David Lark's Lame Number Game" — do not rename (persisted in existing user browsers)

## Design System

Uses `light-dark()` for automatic theme switching. JS sets `:root.dark` or `:root.light` → `color-scheme` resolves the correct value.

```css
/* ── Constants (same in both themes) ── */
--acc:          #ff6d5a   /* coral — operators, borders, buttons */
--tag-bg:       rgba(255, 109, 90, 0.1)
--md-lit-bg:    rgba(255, 109, 90, 0.12)
--dig-sh-act:   0.1875rem 0.1875rem 0 rgba(255, 109, 90, 0.3)

/* ── Theme-sensitive (light / dark) ── */
--bg:           light-dark(#f5edd8, #262624)       /* page background */
--sh1:          light-dark(#e8a87c, #ff6d5a)       /* octopus shape colour 1 */
--sh2:          light-dark(#c0543a, #c0543a)       /* octopus shape colour 2 */
--text:         light-dark(#262624, #fffdf7)       /* primary text */
--muted:        light-dark(rgba(38,38,36,0.55), rgba(255,253,247,0.6))
--card-bg:      light-dark(#fffdf7, #2e2e2c)       /* card background */
--card-sh:      light-dark(0.25rem 0.25rem 0 …, 0.25rem 0.25rem 0 …)
--surface:      light-dark(#ffffff, #363634)        /* input/key backgrounds */
--border:       light-dark(rgba(38,38,36,0.12), rgba(255,253,247,0.1))
--dig-sh:       light-dark(…)                       /* digit box shadow */
--k-bg-elim:    light-dark(#ffffff, #262624)        /* eliminated key bg */
--k-txt-elim:   light-dark(…)                       /* eliminated key text */
--k-sh:         light-dark(…)                       /* key shadow */
--div-col:      light-dark(…)                       /* divider colour */
--modal-bg:     light-dark(#ffffff, #1e1e1c)
--modal-sh:     light-dark(…)                       /* modal shadow */
```

- Font: DM Sans (body) + Inconsolata (monospace labels/digits) via Google Fonts CDN, with system-ui fallback
- Card: offset shadow (`--card-sh`) with solid `--card-bg` background
- Responsive: no fixed breakpoint — fluid layout via `max-width: 30rem`

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
- DOM IDs are locked: `#cw`, `#cw-canvas`, `#cw-shape`, `#cw-shape2`, `#cw-inner`, `#cw-header`, `#cw-title`, `#cw-sub`, `#cw-card`, `#cw-plabel`, `#cw-digits`, `#d0`, `#d1`, `#d2`, `#cw-hint`, `#cw-keypad-wrap`, `#cw-keypad`, `#cw-submit-wrap`, `#cw-submit`, `#cw-save`, `#cw-ck`, `#cw-feedback`, `#cw-history`, `#cw-history-label`, `#cw-history-list`, `#cw-stats`, `#cw-next`, `#cw-next-number`, `#cw-again`, `#cw-again-link`, `#cw-foot-links`, `#cw-tog`, `#cw-tog-icon`, `#cw-htp-btn`, `#cw-fl`, `#cw-gh`, `#cw-foot`, `#cw-modal`, `#cw-modal-box`, `#cw-modal-close`, `#cw-modal-gotit`, `#cw-modal-title`, `#octo-wrap`, `#octo`, `#octo-mask`, `#octo-placeholder`, `#eyeL-r`, `#eyeL-s`, `#eyeL-x`, `#eyeR-r`, `#eyeR-s`, `#eyeR-x`, `#mouth-h`, `#mouth-s`, `#mouth-sad`, `#cookie-icon`, `#footer-heart`, `#demo-keypad`
- Event listeners attached at module level in `app.js` — never inside `startDailyPuzzle`
- `gameState` is module-scoped `let` in `app.js` — not a `window` global
