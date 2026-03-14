# Concerns

## Security

### Answer visible in page source
**Severity: Low**
**File:** `_worker.js:22,41`

`window.PUZZLE_DATA` is injected into the HTML including the `answer` field. Any player who views source or inspects `window.PUZZLE_DATA` in the console can see today's answer. This is an intentional trade-off (no separate API), but worth knowing. If cheating prevention ever matters, the answer would need to be server-side only.

---

### Stack trace exposed on /random error
**Severity: Low**
**File:** `_worker.js:48`

```js
return new Response(`/random error: ${err.message}\n${err.stack}`, { status: 500 });
```

Error responses include the full stack trace, which could expose internal implementation details to end users. Recommendation: return a generic 500 message in production; log the detail server-side.

---

### `innerHTML` used with localStorage data
**Severity: Low**
**File:** `app.js:145–153`

`statsEl.innerHTML` is built from `history` data read from `localStorage`. The `h.tries` values are numeric (saved as integers), so XSS risk is low in practice — but if the storage format ever changes to include strings, this becomes a vector. Recommendation: use `textContent` assignments or `document.createElement` for user-derived data where possible.

---

### GitHub PAT in .clancy/.env
**Severity: Low (Clancy tooling only)**
**File:** `.clancy/.env`

A GitHub personal access token is stored in `.clancy/.env`. This file is not committed (it's in `.gitignore` / `.clancy/`), so it won't appear in git history. However, it has full access to the repo — if the file is ever leaked, rotate the token immediately. Recommendation: use a fine-grained PAT scoped to only the permissions Clancy needs.

---

## Performance

### Google Fonts is render-blocking
**Severity: Low**
**File:** `index.html:11–13`

Google Fonts stylesheet is loaded synchronously in `<head>`. This can delay first render (FOUT — flash of unstyled text). Recommendation: add `font-display: swap` (already included via `&display=swap` in the URL — this is correctly handled). The preconnects are also present. This is as optimised as it can be without self-hosting fonts.

---

### No caching headers for static assets
**Severity: Low**

Cloudflare Pages applies default caching. No custom cache-control headers are set in `_worker.js` for passthrough assets. This is fine for a small static site — Pages CDN handles caching — but worth noting if cache invalidation becomes an issue after deploys.

---

## Maintainability

### No automated tests
**Severity: Medium**
**File:** (project-wide)

There are no unit or integration tests. The puzzle generation algorithm (`runFilterLoop` in `puzzle.js`) is non-trivial — it involves RNG, filtering, and a tiebreaker sweep. A regression in the algorithm could silently produce unsolvable or inconsistent puzzles. Recommendation: add unit tests for `applyFilter`, `runFilterLoop`, and `makeRng` at minimum.

---

### `puzzleNumber` defined in both app.js and puzzle.js
**Severity: Low**
**File:** `app.js:22`, `puzzle.js`

`app.js` defines its own `puzzleNumber` function locally rather than importing it from `puzzle.js`. If the epoch date or calculation ever changes in `puzzle.js`, `app.js` could drift out of sync. Recommendation: export `puzzleNumber` from `puzzle.js` and import it in `app.js`.

---

### localStorage history is trimmed to 60 but never validated
**Severity: Low**
**File:** `app.js:49–51`, `app.js:59`

History is read with `JSON.parse` inside a try/catch (good), but the structure of each entry is trusted without validation. A manually corrupted `dlng_history` entry could cause rendering errors in `renderStats`. Recommendation: validate entry shape (`date`, `tries`) before use.

---

### `dlng_` prefix is undocumented in code
**Severity: Low**
**File:** `app.js:7–8`

The localStorage key prefix `dlng_` is documented in `CLAUDE.md` but not commented in `app.js` itself. A new developer reading the code would not understand why this prefix exists. Recommendation: add an inline comment referencing the origin (already done in CLAUDE.md — just mirror it in the code).

---

## Browser Compatibility

### Backdrop-filter on older browsers
**Severity: Low**
**File:** `style.css`

`backdrop-filter: blur(12px)` is present alongside `-webkit-backdrop-filter`. Both are required for Safari. On browsers that support neither (very old Chrome, Firefox < 103), the card background falls back gracefully to the semi-transparent `rgba` value — this is handled correctly.

---

### ES module dynamic import in local dev
**Severity: Low**
**File:** `app.js:290`

Local dev uses `await import('./puzzle.js')` — dynamic import. This requires a reasonably modern browser and a proper HTTP server (not `file://`). Using `file://` will fail with CORS errors. Documented in CLAUDE.md but could surprise a developer who opens `index.html` directly.

---

## Edge Cases & Fragile Logic

### Tiebreaker could theoretically loop indefinitely
**Severity: Low**
**File:** `puzzle.js`

The tiebreaker sweep iterates all properties looking for one that eliminates candidates. If all remaining properties are uninformative for the remaining candidates (theoretically possible in pathological RNG states), the tiebreaker won't converge. In practice this hasn't occurred, but there is no loop limit or fallback on the tiebreaker. Recommendation: add a safeguard iteration cap with a console warning.

---

### `/random` route detection is path-string comparison
**Severity: Low**
**File:** `app.js:277`, `_worker.js`

```js
const isRandomRoute = window.location.pathname === "/random";
```

This is a simple string equality check — works correctly for the current routing. If the site ever adds a router or sub-paths, this could break. Low risk given the project's minimal scope.

---

### Stats `innerHTML` with no played history renders nothing
**Severity: Low**
**File:** `app.js:140–141`

If `history.length === 0`, stats are hidden — this is correct. But the condition uses the full `history` array (all 60 entries), not just wins. If a player has played but all entries aged out, stats would show nothing. The 60-entry cap is generous, but worth knowing.
