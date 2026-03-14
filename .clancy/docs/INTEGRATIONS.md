# Integrations

## External APIs

**Cloudflare Pages / Workers**

The app uses the Cloudflare Workers `fetch` API and the Pages `env.ASSETS` object to serve static content. See `/home/jevawin/clumeral-game/_worker.js`:

```javascript
export default {
  async fetch(request, env) {
    // ... puzzle generation ...
    const assetRes = await env.ASSETS.fetch(new Request(new URL('/index.html', request.url)));
    // ...
    return env.ASSETS.fetch(request);  // fall through to Pages assets
  },
};
```

No external data APIs (no REST endpoints, webhooks, or third-party data sources). All puzzle data is generated deterministically from the date seed.

## Authentication

None. The app has no user authentication, login system, or access control.

Puzzle data is public and seeded only by the current date — all users see the same puzzle each day.

## Data Storage

All user data is stored client-side in browser `localStorage` with the prefix `dlng_` (legacy name: "David Lark's Lame Number Game").

**Storage keys and schemas** (from `/home/jevawin/clumeral-game/CLAUDE.md` lines 74–77 and confirmed in `/home/jevawin/clumeral-game/app.js`):

### `dlng_history`
**Type**: JSON array of game records

**Schema**:
```javascript
[
  { date: "YYYY-MM-DD", tries: N },
  { date: "YYYY-MM-DD", tries: N },
  ...
]
```

**Purpose**: Tracks completed puzzles and attempt counts for stats display.

**Limits**: Max 60 entries (oldest entries pruned). See `/home/jevawin/clumeral-game/app.js` lines 56–60:
```javascript
function recordGame(dateStr, tries) {
  const history = loadHistory().filter((h) => h.date !== dateStr);
  history.unshift({ date: dateStr, tries });
  localStorage.setItem(STORAGE_HISTORY, JSON.stringify(history.slice(0, 60)));
}
```

### `dlng_prefs`
**Type**: JSON object

**Schema**:
```javascript
{ saveScore: boolean }
```

**Purpose**: User preference for whether to persist game history in localStorage.

**Default**: `{ saveScore: true }`

**Location**: Set/read by `/home/jevawin/clumeral-game/app.js` lines 36–46 and lines 269–272.

**Migration note**: The prefix `dlng_` is **never** to be renamed; it is persisted in existing user browsers and renaming would orphan user data.

## Third-party Services

**Google Fonts CDN**
- Serves `Forum` and `Inter` typefaces
- Loaded via preconnect headers in `/home/jevawin/clumeral-game/index.html` lines 11–13

**GitHub** (deployment trigger, not runtime integration)
- Pushes to `main` trigger Cloudflare Pages auto-deploy
- No GitHub API integration at runtime

**Cloudflare Pages + Workers** (production hosting)
- Automatic deployment on git push to `main`
- Worker runs puzzle generation on each request to `/` or `/index.html`

## Environment Variables Required

None. The app requires no environment variables, API keys, secrets, or configuration files.

**Cloudflare Worker context** (`env` parameter in `_worker.js`):
- `env.ASSETS` — Built-in Pages API for fetching static assets (no manual configuration needed)

**Deterministic seeding**: All puzzle generation uses the current UTC date as the seed, computed locally in the browser or Worker. See `/home/jevawin/clumeral-game/puzzle.js` lines 166–168:
```javascript
export function dateSeedInt(dateStr) {
  return parseInt(dateStr.replace(/-/g, ''), 10);
}
```

No external configuration, secrets, or environment variables are required for the app to function.
