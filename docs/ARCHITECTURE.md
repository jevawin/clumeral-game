# Architecture

**Vite + TypeScript.** ES modules in dev, bundled for production. Cloudflare Worker runs via `@cloudflare/vite-plugin`.

## Project structure

```
src/
  worker/index.ts      Cloudflare Worker — intercepts GET /, injects PUZZLE_DATA
  worker/puzzle.ts     Puzzle generation logic (server-only)
  app.ts               Client UI — renders clues/feedback/history/stats, handles guesses
  confetti.ts          Confetti animation on correct answer
  style.css            All visual styling
public/                Static assets copied as-is (icons, images, manifest, sw.js)
index.html             Game shell (Vite entry point)
vite.config.ts         Vite + Cloudflare plugin config
wrangler.jsonc         Cloudflare Worker config
```

## How it works

1. Worker intercepts `GET /` and `/random`, generates puzzle, injects `window.PUZZLE_DATA` into HTML
2. `index.html` loads `src/app.ts` as `type="module"`
3. `app.ts` reads `window.PUZZLE_DATA` and calls `startDailyPuzzle()`

## Puzzle algorithm

- `candidates` starts as integers `[100..999]` — no pre-built data structure
- Each property has a `compute(n)` function that derives the value on-the-fly from digits
- One filter is drawn per `PROPERTY_GROUPS` entry per main loop iteration
- After the main loop, a **tiebreaker** sweeps all properties with `=` (exact match on `candidates[0]`) until `candidates.length === 1`
- 28 filterable properties: 12 boolean specials + 16 numeric, across 6 groups

### Daily puzzle seeding

- Seed = today's local date as integer (YYYYMMDD)
- RNG = mulberry32 (`makeRng` in `puzzle.ts`)
- `runFilterLoop(rng)` — same seed always produces same puzzle
- Epoch date (`EPOCH_DATE = '2026-03-08'`) = Puzzle #1

**Do not modify** `EPOCH_DATE`, `makeRng`, or `PROPERTIES`/`PROPERTY_GROUPS` structure unless fixing a proven bug — changes break puzzle determinism or shift all puzzle numbers.

## localStorage keys

- `dlng_history` — array of `{ date: "YYYY-MM-DD", tries: N }`, max 60 entries
- `dlng_prefs` — `{ saveScore: boolean }`
- `dlng_theme` — `"light"` or `"dark"` (user's theme preference)
- `cw-htp-seen` — `"1"` if How to Play modal has been shown
- Prefix `dlng_` = original game name "David Lark's Lame Number Game" — do not rename (persisted in existing user browsers)
