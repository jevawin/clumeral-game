# Architecture

Vite + TypeScript. Cloudflare Worker via `@cloudflare/vite-plugin`. REST API — answer never sent to client.

## Files

```
src/
  app.ts         Client UI, guess handling, game flow
  storage.ts     localStorage helpers (prefs, history)
  modals.ts      How-to-Play, toast, feedback modals
  theme.ts       Light/dark toggle, dot-grid canvas bg
  colours.ts     Accent colour picker, icon swap
  octo.ts        Octopus mascot animations
  confetti.ts    Confetti on correct answer (owns canvas)
  types.ts       Shared types (GameState, ClueData, HistoryEntry, Prefs)
  global.d.ts    Ambient types
  style.css      All styling
  worker/
    index.ts     Entry — API routes + HTML serving
    puzzle.ts    Filter/compute logic, RNG, seeding (server-only)
    puzzles.ts   /puzzles history page (SSR)
    stats.ts     /stats dashboard, Analytics Engine queries
    crypto.ts    AES-GCM token signing for random puzzles
public/          Static (icons, manifest, sw.js)
index.html       Shell
```

## Worker API

- `GET /api/puzzle` — today's clues (no answer)
- `GET /api/puzzle/random` — random puzzle + signed token
- `GET /api/puzzle/:num` — specific puzzle clues
- `GET /api/puzzle/:num/solution` — answer for PAST puzzles only
- `POST /api/guess` — server validates, returns correct/incorrect
- `POST /api/event` — analytics
- `GET /api/stats` — stats data
- `GET /api/dev/answer` — dev only
- `GET /stats`, `/puzzles`, `/puzzles/:num` — SSR HTML
- `GET /`, `/index.html`, `/random` — app shell

Client fetches puzzle data on load. Never has the answer.

## Puzzle algorithm (puzzle.ts)

- Candidates = `[100..999]`, filtered live via `compute(n)` — no prebuilt data
- 28 properties across 6 groups: 12 boolean specials (3 digits × prime/square/cube/triangular) + 16 numeric (4 sums, 3 diffs, 4 products, 4 means, 1 range)
- Main loop: one filter per group per iteration
- Tiebreaker: `=` sweep on remaining candidate until length 1
- Seed = YYYYMMDD local, RNG = mulberry32 (`makeRng`)
- `EPOCH_DATE = '2026-03-08'` = Puzzle #1

**DO NOT modify** `EPOCH_DATE`, `makeRng`, `PROPERTIES`, or `PROPERTY_GROUPS` unless fixing a proven bug. Breaks determinism / shifts puzzle numbers.

## localStorage keys

- `dlng_history` — `[{date, tries}]`, max 60
- `dlng_prefs` — `{saveScore}`
- `dlng_theme` — `"light"|"dark"`
- `dlng_colour` — accent colour id
- `dlng_uid` — anonymous analytics id
- `cw-htp-seen` — `"1"` once How-to-Play shown

`dlng_` prefix = legacy name. **Never rename** — persisted in user browsers.
