# Clumeral

**Work out the number from 100–999. New puzzle every day.**

[clumeral.com](https://clumeral.com)

Clumeral is a daily browser puzzle game. A seeded random algorithm filters numbers 100–999 down to one answer using mathematical clues about each digit. Every player gets the same puzzle each day.

## How it works

Each puzzle gives you clues about a hidden three-digit number. Clues are based on properties of the digits — whether they're prime, square, triangular, or cube numbers, plus sums, differences, products, means, and ranges of digit pairs. You read the clues, narrow down the possibilities, and guess the number.

## Tech stack

- **Vite + TypeScript** — ES modules in dev, bundled for production
- **Cloudflare Workers** — `@cloudflare/vite-plugin` runs the Worker in dev (same runtime as production)
- **Cloudflare KV** — daily puzzles cached by date key
- **Cloudflare Pages** — auto-deploy on merge to `main`

### Project structure

```
src/
  worker/
    index.ts     Worker entry — API routes, static page handlers, cron
    puzzle.ts    Puzzle generation (server-only)
    crypto.ts    AES-GCM token signing for random puzzles
    puzzles.ts   Worker-rendered /puzzles archive page
    stats.ts     Analytics Engine queries for /stats dashboard
  app.ts         Client UI — fetches puzzle, renders clues, handles guesses
  style.css      All styling (light-dark themes, accent-colour system)
  storage.ts     localStorage helpers
  theme.ts       Light/dark toggle
  colours.ts     Accent colour picker
  modals.ts      How-to-play + feedback modals
  bubbles.ts     Correct-answer effect
  octo.ts        Mascot animations
public/          Static assets (icons, sprites.svg, manifest.json, sw.js)
index.html       Game shell (Vite entry)
```

### Puzzle generation

- Candidates start as all integers 100–999
- Each property has a `compute(n)` function that derives the value from digits on the fly
- A seeded RNG (mulberry32) draws filters from six property groups per iteration
- A tiebreaker phase sweeps exact-match filters until one candidate remains
- Same date seed = same puzzle for everyone

Deep dive: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

### Design system

Light and dark themes via CSS `light-dark()`. Four accent colours (Berry, Blue, Lime, Violet) chosen by the player, driving all borders, operators, tags, and highlights.

Deep dive: [docs/DESIGN-SYSTEM.md](docs/DESIGN-SYSTEM.md).

## Getting started

```bash
# Clone
git clone https://github.com/jevawin/clumeral-game.git
cd clumeral-game

# Install
npm install

# Dev server (Vite + Worker runtime)
npm run dev
```

The dev server runs the Worker in Cloudflare's local runtime, so API endpoints and KV behave the same as production.

## API endpoints

| Route | Purpose |
|-------|---------|
| `GET /api/puzzle` | Today's puzzle clues (no answer) |
| `GET /api/puzzle/random` | Random puzzle clues + HMAC-signed token |
| `GET /api/puzzle/:num` | Archived puzzle clues by puzzle number |
| `GET /api/puzzle/:num/solution` | Answer for a past puzzle (not today) |
| `POST /api/guess` | Validate a guess server-side |

The answer is never sent to the client for today's puzzle. Full validation happens in the Worker.

## Deployment

Push to `main` → GitHub → Cloudflare Pages builds with `npm run build` → auto-deploys from `dist/client`.

- **Production**: [clumeral.com](https://clumeral.com)
- **Build command**: `npm run build`
- **Output directory**: `dist/client`
- **Merge method**: squash only (merge commits disabled on the repo)

## Contributing

Issues and ideas tracked on [GitHub Issues](https://github.com/jevawin/clumeral-game/issues) with the `roadmap` label. Workflow and review process in [docs/GIT-WORKFLOW.md](docs/GIT-WORKFLOW.md).

## Trademark

"Clumeral" is a trademark of Jamie Evawin. The MIT License grants rights to the source code, not to the Clumeral name, branding, or visual identity. You're welcome to use the code to build your own thing — just don't call it Clumeral.

## License

[MIT](LICENSE) — see LICENSE file for details.
