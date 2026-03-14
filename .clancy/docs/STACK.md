# Stack

## Runtime

**Browser** — Pure client-side ES module execution. No server-side Node.js, only Cloudflare Workers for static asset serving.

- **Development**: Python 3 local HTTP server (`python3 -m http.server 8080`)
- **Production**: Cloudflare Pages + Workers

## Package Manager

None. No `package.json` or npm dependencies. Pure HTML/CSS/JavaScript with no build step.

## Frameworks

None. Plain HTML/CSS/JavaScript. No React, Vue, Angular, or any framework dependencies.

**ES Modules**: `puzzle.js` is loaded as a module via `import()` in development, and as a shared module in Cloudflare Workers. See `/home/jevawin/clumeral-game/app.js` lines 255–256.

## Key Libraries

**Google Fonts** (two typefaces via CDN):
- `Forum` — serif typeface for the game title (`.game-title`)
- `Inter` (weights 400, 500, 600) — sans-serif for body text and UI

Loaded at `/home/jevawin/clumeral-game/index.html` lines 11–13:
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Forum&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
```

## Build Tools

None. No bundler (webpack, Vite, esbuild, etc.).

**Deployment**: Git push to `main` triggers Cloudflare Pages auto-deploy. The Pages platform picks up `_worker.js` automatically (Pages Advanced Mode). See `/home/jevawin/clumeral-game/CLAUDE.md` line 113–114.

## Dev Servers

**Local development** (from `/home/jevawin/clumeral-game/CLAUDE.md` lines 105–110):
```bash
python3 -m http.server 8080
# open http://localhost:8080
# window.PUZZLE_DATA won't be set; app.js falls back to importing puzzle.js directly
```

On `localhost`, `app.js` (lines 254–260) skips the Worker and imports `puzzle.js` directly as an ES module:
```javascript
const { runFilterLoop, makeRng, dateSeedInt, todayLocal: tl, puzzleNumber: pn } =
  await import("./puzzle.js");
```

## Environment

**Production**: Cloudflare Pages + Workers
- Static assets (HTML, CSS, JS) served from Pages
- `_worker.js` (Cloudflare Pages Advanced Mode Worker) intercepts `GET /` to inject daily puzzle data
- Compatibility date: `2026-03-09` (from `/home/jevawin/clumeral-game/wrangler.jsonc`)

**How the Worker works** (`/home/jevawin/clumeral-game/_worker.js`):
1. Intercepts HTTP `GET /` or `GET /index.html` requests
2. Fetches static `index.html` from Pages assets
3. Runs puzzle generation server-side: `runFilterLoop(makeRng(dateSeedInt(today)))`
4. Injects puzzle data as `window.PUZZLE_DATA` JSON before `</head>`
5. Passes all other requests through to Pages assets (CSS, JS, fonts, etc.)

See lines 18–22:
```javascript
const injected = html.replace(
  '</head>',
  `<script>window.PUZZLE_DATA=${JSON.stringify(puzzleData)}</script></head>`
);
```

**No configuration files needed**: `wrangler.toml` is not required; Pages Advanced Mode auto-detects `_worker.js`.
