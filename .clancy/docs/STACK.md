# Technology Stack

## Languages

- **JavaScript (ES2020+)** — Pure vanilla JS with ES module syntax
  - No TypeScript, no transpilation, no bundler
  - Browser-native ES modules (`type="module"` in HTML)
  - Cloudflare Worker runtime (V8 engine)

## Runtime Environment

- **Client:** Modern browsers (ES2020+ support)
  - Local dev: Python 3 HTTP server (`python3 -m http.server 8080`)
  - Tested path: `http://localhost:8080`

- **Server:** Cloudflare Pages with Advanced Mode Worker
  - Worker entrypoint: `_worker.js`
  - Compatibility date: 2026-03-09 (via wrangler.jsonc)
  - Binding: `env.ASSETS` (Cloudflare Pages asset handler)

## Dependencies

No external npm packages in production code.

- **Frontend libraries** (loaded via CDN):
  - **Inter font (400, 500, 600)** — Google Fonts CDN
  - **Forum font** — Google Fonts CDN (serif fallback for titles)
  - Preconnect to `https://fonts.gstatic.com` for optimized font loading

## Build Tools

None. No build step, no bundler, no compiler.

- **Configuration:** `wrangler.jsonc` (Cloudflare Pages Worker config)
  - `main: "_worker.js"`
  - `assets.directory: "./"`
  - `assets.binding: "ASSETS"`
  - `assets.run_worker_first: true`

- **Asset filtering:** `.assetsignore` (excludes `_worker.js` and `wrangler.jsonc` from static assets)

## Dev Server Setup

```bash
python3 -m http.server 8080
open http://localhost:8080
```

**Behavior:**
- `app.js` detects `localhost` and falls back to importing `puzzle.js` directly (no `window.PUZZLE_DATA` available)
- `puzzle.js` runs in-browser via ES module import
- `/random` route works locally; navigates via `window.location.pathname === "/random"`

## Deployment Target

**Cloudflare Pages** with Advanced Mode (Worker)

- Triggered by: `git push` to `main` branch → GitHub → Cloudflare Pages auto-deploys
- No `wrangler publish` needed; Pages picks up `_worker.js` automatically
- `_worker.js` intercepts:
  - `GET /` and `GET /index.html` → injects `window.PUZZLE_DATA` into HTML
  - `GET /random` → generates random puzzle, injects `window.PUZZLE_DATA`
  - All other requests → passthrough to Pages assets

## Notable Absences

- **No framework** — no React, Vue, Angular, Svelte
- **No TypeScript** — plain JavaScript
- **No build step** — no Webpack, Vite, Parcel, Rollup, Esbuild
- **No runtime package manager** — no Node.js server code; Cloudflare Worker is V8-based
- **No database** — puzzles are computed on-the-fly; history stored in `localStorage`
- **No API layer** — Worker directly computes and injects puzzle data
