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
--acc:        #ff6d5a   /* coral — operators, borders, buttons */
--tag-bg:     rgba(255, 109, 90, 0.1)
--md-lit-bg:  rgba(255, 109, 90, 0.12)

/* ── Theme-sensitive (light / dark) ── */
--bg:         light-dark(#f5edd8, #262624)       /* page background */
--text:       light-dark(#262624, #fffdf7)       /* primary text */
--muted:      light-dark(rgba(38,38,36,0.55), rgba(255,253,247,0.6))
--card-bg:    light-dark(#fffdf7, #2e2e2c)       /* card background */
--card-sh:    light-dark(offset shadow light, offset shadow dark)
--surface:    light-dark(#ffffff, #363634)        /* input/key backgrounds */
--border:     light-dark(rgba(38,38,36,0.12), rgba(255,253,247,0.1))
--modal-bg:   light-dark(#ffffff, #1e1e1c)
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

## Git Workflow

**`main` is protected — never commit or push to it directly.** Not on GitHub, not locally.

- **Public-facing changes** (features, bug fixes, UI work): create `issue/NUM` branch from `dev` → build there → merge into `dev` → PR from `dev` to `main`
- **Non-public-facing changes** (cleanup, config, docs): commit directly to `dev` → PR from `dev` to `main`
- **PRs can batch multiple issues**: merge several issue branches into `dev`, then one PR covers them all

### Harness branch workaround

The Claude Code harness auto-assigns a `claude/*` branch name per session. **Ignore it.** Instead:

1. Create `issue/NUM` branch off `dev` as normal
2. Do all work on `issue/NUM`
3. After merging into `dev`, delete the local `issue/NUM` branch

The orphan `claude/*` branch and any leftover remote `issue/*` branches can't be deleted by Claude (no permission to push `--delete` or API to delete branches). **Jamie must prune these** — either via the GitHub UI (repo → branches) or locally with `git push origin --delete <branch>`.

### Merging

- **Feature branch → `dev`**: Claude can merge directly (no approval needed)
- **`dev` → `main`**: after pushing, give Jamie the Cloudflare preview URL to review. Wait for explicit "all good merge" before merging the PR via `gh pr merge --squash`. Close the PR after merging if not already closed.

### Review flow

After pushing to a branch, give Jamie the Cloudflare preview URL as a clickable markdown link:
- **`dev` branch**: [https://dev-clumeral-game.jevawin.workers.dev](https://dev-clumeral-game.jevawin.workers.dev)
- **Feature branches**: `https://issue-NUM-clumeral-game.jevawin.workers.dev` (e.g. [https://issue-77-clumeral-game.jevawin.workers.dev](https://issue-77-clumeral-game.jevawin.workers.dev))

## Deployment

Push to `main` → GitHub → Cloudflare Workers auto-deploys. `_worker.js` is picked up automatically. No `wrangler.toml` needed.

- **Production**: [https://clumeral.com](https://clumeral.com)
- **Merge method**: squash only (merge commits disabled on the repo)

## Skills

- `/add-to-roadmap` — when the user says "add to roadmap" or similar, invoke this skill to create a structured GitHub issue labelled `roadmap`, assigned to `jevawin`

## Keeping CLAUDE.md current

When making important decisions, structural changes, new conventions, or architectural choices during a conversation, add them to this file so future sessions have the full picture.

## Conventions

- No framework, no bundler, no TypeScript — plain JS with ES modules
- Icons: use [Lucide](https://lucide.dev/) for any iconography
- Notifications: use toast/snackbar (auto-dismiss ~3s) for transient feedback — not modals
- No PII: never collect, store, or transmit personally identifiable information
- GitHub labels: lowercase for words (`roadmap`, `gameplay`), uppercase for acronyms/codes (`P1`, `P2`, `P3`, `UI/UX`)
- `puzzle.js` is shared; never put UI code in it
- `app.js` is UI only; never put filter/compute logic in it
- DOM IDs are locked: `#cw`, `#cw-canvas`, `#cw-shape`, `#cw-shape2`, `#cw-inner`, `#cw-header`, `#cw-title`, `#cw-sub`, `#cw-card`, `#cw-plabel`, `#cw-digits`, `#d0`, `#d1`, `#d2`, `#cw-hint`, `#cw-keypad-wrap`, `#cw-keypad`, `#cw-submit-wrap`, `#cw-submit`, `#cw-save`, `#cw-ck`, `#cw-feedback`, `#cw-history`, `#cw-history-list`, `#cw-stats`, `#cw-next`, `#cw-next-number`, `#cw-again`, `#cw-foot-links`, `#cw-tog`, `#cw-htp-btn`, `#cw-foot`, `#cw-modal`, `#cw-modal-box`, `#cw-modal-close`, `#cw-modal-gotit`, `#octo-wrap`, `#octo`
- Event listeners attached at module level in `app.js` — never inside `startDailyPuzzle`
- `gameState` is module-scoped `let` in `app.js` — not a `window` global
