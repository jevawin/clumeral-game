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
  bubbles.ts     Rising bubbles on correct answer (owns canvas)
  types.ts       Shared types (GameState, ClueData, HistoryEntry, Prefs)
  global.d.ts    Ambient types
  tailwind.css   All styling (Tailwind v4 @theme tokens + component CSS)
  worker/
    index.ts     Entry — API routes + HTML serving
    puzzle.ts    Filter/compute logic, RNG, seeding (server-only)
    puzzles.ts   /puzzles history page (SSR)
    stats.ts     /stats dashboard, Analytics Engine queries
    feedback.ts  /feedback admin dashboard renderer (reads D1)
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
- `POST /api/feedback` — store player feedback (public)
- `GET /api/stats` — stats data
- `GET /api/dev/answer` — dev only
- `GET /stats`, `/puzzles`, `/puzzles/:num` — SSR HTML
- `GET /feedback` — admin feedback dashboard (private, gated by Cloudflare Access)
- `GET /`, `/index.html`, `/random` — app shell

Client fetches puzzle data on load. Never has the answer.

## Feedback

Player feedback is stored in **Cloudflare D1** (`clumeral-feedback`, binding `FEEDBACK_DB`), written by `POST /api/feedback` and read via the private `/feedback` dashboard. Full reference — schema, access, migrations, process: [FEEDBACK.md](FEEDBACK.md).

## Puzzle algorithm (puzzle.ts)

- Candidates = `[100..999]`, filtered live via `compute(n)` — no prebuilt data
- 28 properties across 6 groups: 12 boolean specials (3 digits × prime/square/cube/triangular) + 16 numeric (4 sums, 3 diffs, 4 products, 4 means, 1 range)
- Main loop: one filter per group per iteration
- Tiebreaker: `=` sweep on remaining candidate until length 1
- Seed = YYYYMMDD local, RNG = mulberry32 (`makeRng`)
- `EPOCH_DATE = '2026-03-08'` = Puzzle #1

**DO NOT modify** `EPOCH_DATE`, `makeRng`, `PROPERTIES`, or `PROPERTY_GROUPS` unless fixing a proven bug. Breaks determinism / shifts puzzle numbers.

## localStorage keys

- `dlng_history` — `[{date, tries, answer?, archived?}]` (`archived: true` = a past/archive solve, excluded from daily stats)
- `dlng_prefs` — `{saveScore}`
- `dlng_active` — in-progress puzzle state (mid-game restore; validated on load)
- `dlng_theme` — `"light"|"dark"`
- `dlng_colour` — accent colour name (e.g. `"Lime"`)
- `dlng_uid` — anonymous analytics id
- `dlng_last_visit_date` — last-seen local date key, drives the midnight rollover

`dlng_` prefix = legacy name. **Never rename** — persisted in user browsers.
