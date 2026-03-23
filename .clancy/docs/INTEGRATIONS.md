# External Integrations

## Third-Party Services

### Google Fonts (CDN)

**Service:** Google Fonts

**Endpoints used:**
- `https://fonts.googleapis.com/css2?family=Forum&family=Inter:wght@400;500;600&display=swap`
- Preconnect: `https://fonts.gstatic.com` (crossorigin)

**Purpose:** Load Inter and Forum typefaces

**HTML references:** `index.html` lines 11–13

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Forum&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
```

## APIs Called

### Cloudflare Pages ASSETS Binding (Internal)

**Endpoint:** `env.ASSETS.fetch(request)` (Cloudflare Worker environment)

**Usage:** `_worker.js` fetches static assets (`index.html`, `app.js`, `puzzle.js`, `style.css`) to inject puzzle data before serving

```javascript
// _worker.js
const assetRes = await env.ASSETS.fetch(new Request(new URL('/index.html', request.url)));
```

**Type:** Internal environment binding; not an external API

## Client-Side Data Injection

**Method:** Script injection into HTML at runtime

- `_worker.js` injects `window.PUZZLE_DATA` JSON object into `</head>` before serving HTML
- Payload: `{ date, puzzleNumber, answer, clues }` (daily) or `{ isRandom: true, answer, clues }` (random)

```javascript
// _worker.js
const injected = html.replace(
  '</head>',
  `<script>window.PUZZLE_DATA=${JSON.stringify(puzzleData)}</script></head>`
);
```

**Detection in app.js:**

```javascript
if (window.PUZZLE_DATA) {
  // Production: injected by _worker.js
}
```

## Environment Variables

None in production code. No secrets required to run the game.

**Development environment** (`.clancy/.env`):
- Used by Clancy tooling only, not by Clumeral game code
- Not exposed to frontend or worker

## Auth Mechanisms

None. No authentication required.

- Public, read-only puzzle data
- Player history stored in browser `localStorage` (unprivileged storage)
- No user accounts, API keys, or credentials

## External Links (Marketing/Branding)

All links in footer are external navigation (not API calls):

- GitHub: `https://github.com/jevawin/clumeral-game`
- Claude.ai: `https://claude.ai`
- LinkedIn: `https://www.linkedin.com/in/jevawin`

**No data sent to these destinations** from the game.
