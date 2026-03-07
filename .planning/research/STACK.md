# Stack Research

**Domain:** Static browser puzzle game, vanilla JS, no build step
**Researched:** 2026-03-07
**Confidence:** HIGH

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| HTML5 | Living standard | Structure, single `index.html` entry point | GitHub Pages serves `index.html` from repo root by default; no configuration needed |
| CSS3 with custom properties | Living standard | Styling, theming, frosted glass effects | CSS variables (`--*`) are runtime-mutable, enabling the dark theme token system without a preprocessor; `backdrop-filter` has 95%+ global browser support as of 2025 |
| Vanilla JavaScript (ES2022+) | ES2022 | Game logic, DOM manipulation, CSV loading | Project constraint; modern browsers support all needed APIs natively — `fetch`, `async/await`, `Array` methods, destructuring, optional chaining |
| Native ES Modules (`type="module"`) | ES2015+ | Code organisation across files | All modern browsers support `<script type="module">` natively; enables `import`/`export` without a bundler; file-level scoping prevents global namespace collisions |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| PapaParse | 5.4.1 (current as of 2025) | Robust RFC 4180 CSV parsing | Use this instead of hand-rolled split() because the project's `data.csv` may contain quoted fields or Windows-style `\r\n` line endings — PapaParse handles both transparently. Load via CDN `<script>` tag, no npm required. |
| Google Fonts (Inter) | CDN | Typography matching n8n design reference | Inter is the exact typeface used by n8n; load via `<link>` in `<head>`. Single weight (400, 600) only to minimise render-blocking. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `python3 -m http.server` or `npx serve` | Local development server | `fetch()` is blocked on `file://` protocol by browsers; you MUST serve files over HTTP even locally. `python3 -m http.server 8080` requires zero install. `npx serve .` works if Node is available. |
| GitHub Actions (optional) | Auto-deploy on push | Not required — GitHub Pages can deploy directly from the `main` branch root with zero CI config. Only add Actions if you need a pre-deploy step. |

## Installation

No npm install required. All dependencies are loaded via `<script>` and `<link>` CDN tags.

```html
<!-- In <head> -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap" rel="stylesheet">

<!-- PapaParse — before your module scripts -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.4.1/papaparse.min.js"></script>

<!-- Your game entry point -->
<script type="module" src="js/main.js"></script>
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| PapaParse via CDN | Hand-rolled `split('\n').split(',')` | Only if the CSV is guaranteed simple (no quoted fields, no `\r\n`, no empty trailing lines). The project's data.csv comes from Google Sheets which does produce `\r\n` line endings — hand-rolled parsing will silently corrupt values. |
| PapaParse via CDN | `vanillaes/csv` (npm) | If you want RFC 4180 compliance and already have a build step. Not relevant here — adds complexity for no gain. |
| Native ES Modules | Single-file `index.html` with inline `<script>` | Acceptable if the codebase stays under ~200 lines. For anything larger, modules prevent debugging nightmares. |
| GitHub Pages (branch deploy) | GitHub Actions workflow deploy | Use Actions only if you need a pre-processing step (e.g., minification). For pure static files, branch deploy is simpler and faster to set up. |
| CSS custom properties for theming | Sass/Less variables | Use a preprocessor only if the project scales to many components. For a single-page game, native CSS variables are sufficient and eliminate the build step entirely. |
| `fetch()` + PapaParse | Embedding CSV data as a JS object | Embedding data is a valid fallback but defeats the purpose of the CSV-driven design and makes data updates harder. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| React, Vue, Svelte, or any component framework | All require either a build step or significant CDN weight. The project is explicitly constrained to vanilla JS. A framework adds ~40–300 KB of overhead for a game with a single screen. | Vanilla DOM manipulation with `document.createElement`, `innerHTML`, `classList` |
| Webpack, Vite, Rollup, Parcel | Build tools violate the "no build step" constraint and add `node_modules` that break GitHub Pages direct deploy | Native ES modules with `type="module"` |
| `XMLHttpRequest` (XHR) | Superseded by `fetch`. More verbose, callback-based, harder to reason about. No advantage in modern browsers. | `fetch()` with `async/await` |
| `text.split('\n').split(',')` for CSV parsing | Google Sheets exports use `\r\n` line endings. A naive split on `\n` leaves `\r` at the end of every field value, silently corrupting numeric comparisons (e.g., `"999\r" !== "999"`). | PapaParse — handles `\r\n`, quoted fields, and type coercion |
| `backdrop-filter` with `-webkit-` prefix as the only declaration | Safari 9–17 required the prefix, but Safari 18+ supports the unprefixed property. Chrome/Firefox never needed the prefix. | Write both: `-webkit-backdrop-filter: blur(12px); backdrop-filter: blur(12px);` for maximum coverage, but the unprefixed property alone covers 95%+ of users in 2025. |
| `file://` protocol for local testing | Browsers block `fetch()` on `file://` for security reasons. The game will silently fail to load `data.csv`. | Run a local HTTP server (`python3 -m http.server 8080`) |
| `defer` + classic scripts for module organisation | Classic scripts share global scope; if two scripts define the same variable name, the second silently overwrites the first. | `<script type="module">` — modules are always deferred automatically and have their own scope |

## Stack Patterns by Variant

**CSS for frosted glass cards (n8n design reference):**
```css
:root {
  --bg-primary: #1a1a2e;
  --bg-card: rgba(255, 255, 255, 0.06);
  --accent-orange: #ff914d;
  --accent-coral: #ff6d5a;
  --blur-radius: 12px;
}

.card {
  background: var(--bg-card);
  -webkit-backdrop-filter: blur(var(--blur-radius));
  backdrop-filter: blur(var(--blur-radius));
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
}
```
Use `rgba` for background alpha — `opacity` on the element itself would also blur the card's text content, which is not the frosted glass effect. `backdrop-filter` blurs what is **behind** the element; the element itself stays opaque.

**GitHub Pages deployment (simplest path):**
- Repo must be public (free tier)
- Settings → Pages → Source: "Deploy from branch" → Branch: `main`, folder: `/(root)`
- `index.html` must be in the repo root
- `data.csv` must also be in the repo root (or adjust the fetch path)
- First deploy takes ~1–2 minutes; subsequent pushes to `main` auto-redeploy

**Fetching and parsing CSV on page load:**
```javascript
// js/data.js
export async function loadData(csvPath = './data.csv') {
  return new Promise((resolve, reject) => {
    Papa.parse(csvPath, {
      download: true,
      header: true,        // Uses row 0 as column names
      dynamicTyping: true, // Converts numeric strings to numbers automatically
      skipEmptyLines: true,
      complete: ({ data }) => resolve(data),
      error: (err) => reject(err),
    });
  });
}
```
`dynamicTyping: true` is critical — it converts `"450"` to `450` so numeric filter operators (`<=`, `>=`) work without manual `parseInt` on every value.

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| PapaParse 5.4.1 | Chrome 80+, Firefox 103+, Safari 14+, Edge 80+ | No dependencies; works with native `fetch` or its own XHR download mode |
| `backdrop-filter` (unprefixed) | Chrome 76+, Firefox 103+, Safari 18+, Edge 17+ | For Safari 9–17 compatibility add `-webkit-` prefix; project targets "latest browsers" so unprefixed is sufficient |
| `<script type="module">` | Chrome 61+, Firefox 60+, Safari 10.1+, Edge 16+ | Universally supported in "latest" modern browsers; no polyfill needed |
| CSS custom properties | Chrome 49+, Firefox 31+, Safari 9.1+, Edge 15+ | Universally safe for this project's compatibility target |

## Sources

- [Papa Parse official docs](https://www.papaparse.com/docs) — version, CDN usage, `download` mode, `dynamicTyping` option — HIGH confidence
- [PapaParse on cdnjs](https://cdnjs.com/libraries/PapaParse) — CDN availability confirmed — HIGH confidence
- [caniuse.com — backdrop-filter](https://caniuse.com/css-backdrop-filter) — 95.75% global support, full list of browser versions — HIGH confidence
- [Josh W. Comeau — backdrop-filter](https://www.joshwcomeau.com/css/backdrop-filter/) — implementation patterns, rgba vs opacity distinction — MEDIUM confidence
- [MDN — Using ES Modules](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules) — `type="module"` behaviour, automatic defer, scoping — HIGH confidence
- [Playful Programming — Modern JS without bundler](https://playfulprogramming.com/posts/modern-js-bundleless/) — buildless ES module patterns — MEDIUM confidence
- [GitHub Pages official docs](https://pages.github.com/) — deploy from branch, index.html requirement — HIGH confidence
- WebSearch: CSS custom properties dark theme 2025 — multiple corroborating sources — HIGH confidence
- WebSearch: fetch CORS GitHub Pages same-origin — GitHub Pages sets `Access-Control-Allow-Origin: *` for public repos; same-origin fetches (game page + CSV in same repo) have no CORS issue — HIGH confidence

---
*Stack research for: Static vanilla JS browser puzzle game with CSV data*
*Researched: 2026-03-07*
