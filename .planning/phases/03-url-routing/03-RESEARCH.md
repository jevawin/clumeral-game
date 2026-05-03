# Phase 3: URL routing — Research

**Researched:** 2026-05-03
**Domain:** Client-side routing (vanilla History API) + Cloudflare Worker SPA fallback
**Confidence:** HIGH

## Summary

Phase 3 swaps the single-route SPA shell for semantic client routes (`/welcome`, `/play`, `/solved`, `/archive`, `/archive/<YYYY-MM-DD>`) without adding a router library. The current stack already has all the primitives: a working three-screen state machine in `src/screens.ts`, a Worker that serves `index.html` for the existing client-aware paths, and a tiny analytics helper. The change is a thin layer of vanilla History API code plus a one-line Worker rename of `/puzzles` → `/archive`.

The right shape is a single `src/router.ts` module that owns one function (`navigate(path, opts)`) and one event listener (`popstate`). Every existing call site that flips screens (welcome → game in `welcome.ts`, game → completion in `app.ts`'s correct-guess branch, completion → game via the `completion:show-puzzle` event) routes through it. A pure resolver function (`resolveRoute(path, ctx)`) decides the final route from input path + storage state, so redirect rules are testable in isolation.

**Primary recommendation:** Build a vanilla History API router (~150 LOC) in `src/router.ts`. Keep `screens.ts` unchanged — the router calls `showScreen()`. Centralise redirect logic in a pure `resolveRoute()` function. Rename `/puzzles` → `/archive` on the Worker with a 301 from the old path. Replay path becomes `/archive/<YYYY-MM-DD>` — switch from puzzle-number to date so URLs are human-readable and stable across the EPOCH.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| RTE-01 | Client-side routing for /welcome, /play, /solved | History API + popstate; new `src/router.ts` |
| RTE-02 | Worker serves SPA shell for new client routes | `wrangler.jsonc` `assets.run_worker_first` + Worker `env.ASSETS.fetch(/index.html)` fallback |
| RTE-03 | Redirect rules (onboarding, solved-today, stale-day, replaceState) | Pure `resolveRoute()` resolver; `visibilitychange` + `focus` listeners; mid-interaction guard |
| ARC-01 | Rename /puzzles → /archive with 301 from /puzzles | Worker route rename + `Response` 301 with `Location` header |
| ARC-02 | /archive/<YYYY-MM-DD> serves dated puzzle; today links to /solved, others link to /archive | Switch replay path from puzzle number to date; reuse `/api/puzzle/:num` after `puzzleNumber()` conversion, OR add date-based API route |
| ARC-03 | Invalid/future /archive/<date> → /archive (replaceState) | Date validation in `resolveRoute()` + replaceState |
| POL-01 | Route-specific `<title>` | `document.title` set in router on each navigate |
| POL-02 | `route_change` analytics event | Add to `VALID_EVENTS` in `src/worker/index.ts`; client `track('route_change', undefined, path)` |
| POL-03 | `history.scrollRestoration = 'manual'` once at boot | Single line at top of `app.ts` init block |
| POL-04 | Stale-day check on focus, not polling | `visibilitychange` + `focus` listeners only |

## User Constraints

No CONTEXT.md exists for this phase yet — Phase 3 was added 2026-05-03 directly to the roadmap. The constraints below are derived from CLAUDE.md, the roadmap goal text, and v1.0/v1.1 decisions in PROJECT.md / STATE.md.

### Locked from project rules

- No new dependencies — vanilla History API only.
- No worker / API logic changes beyond the `/puzzles` → `/archive` rename and back-compat redirect (per roadmap goal text and "Out of Scope" in REQUIREMENTS.md).
- `/random` unchanged — keep its current behaviour and URL.
- Do not commit to `main` or `staging`. Work on a feature branch.
- TypeScript strict, ES2022, kebab-case filenames, no path aliases, relative imports with `.ts` extension.
- No `console.log` in production code; all logging via `track()`.
- No new IDs in DOM — use `data-*` attributes.
- `dlng_*` localStorage keys are legacy and must not be renamed.
- Preserve all v1.0 puzzle-determinism rules (`EPOCH_DATE`, `puzzle.ts`, etc.).

### Claude's discretion

- Resolver shape and module split (one `router.ts`, or split into `router.ts` + `routes.ts`).
- Whether the dated archive replay endpoint stays as `/api/puzzle/:num` (with client-side date→num conversion via `puzzleNumber()`) or adds a new `/api/puzzle/by-date/:date` route. **Recommendation:** keep `/api/puzzle/:num` and convert in the client — this honours "no API logic changes" most strictly.
- Whether the SSR `/archive` page (renamed from `/puzzles`) updates its row links to `/archive/<date>` (recommended) or keeps `/puzzles/:num` shape.
- Whether to keep the legacy client matcher for `/puzzles/<num>` so old bookmarks still work after the 301 (cheap, 5 lines — recommended).

### Deferred ideas (out of scope)

- Server-side rendering of the dated archive pages.
- Pre-rendering / SEO for individual dated puzzle URLs.
- Sharing UX (copy-link button) — could exploit the new URL shape but not in this phase.
- Any visual changes — the goal text says "no new visuals — pure routing/structure change."

## Project Constraints (from CLAUDE.md)

- GSD entry only — start through a `/gsd:*` command.
- Branch off `main`; work on feature branches; never push to `main` or `staging`.
- Run DA review (fresh-context subagent) then self-review before opening a PR. Required: this phase touches >1 file and >30 lines.
- After any PR merge: `git remote prune origin` and delete local branch.
- Read `docs/ARCHITECTURE.md`, `docs/CONVENTIONS.md`, `docs/GIT-WORKFLOW.md` before working in their domains.
- Touch tokens / colour rules: under 15 semantic tokens (no impact this phase).
- `gameState` stays module-scoped in `app.ts`, never on `window`.
- `src/worker/` and `src/` (client) never cross-import.

## Standard Stack

### Core (already installed — no installs needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Browser History API | n/a | `pushState`, `replaceState`, `popstate`, `scrollRestoration` | Built into every supported browser. ES2022 target. No runtime cost. |
| TypeScript | 6.0.2 | Type safety for resolver and route table | Already strict. Matches project. |
| Cloudflare Worker (`@cloudflare/vite-plugin`) | 1.31.0 | SPA fallback + `/archive` rename | Already wired. `env.ASSETS.fetch(/index.html)` is the existing SPA-fallback pattern (see `src/worker/index.ts:267`). |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `track()` (existing) | n/a | Emit `route_change` event | Inside `navigate()` after `pushState` / `replaceState` |
| `screens.ts` `showScreen()` | n/a | Cross-fade between screens | Called by router after URL update |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Vanilla History API | `navigation.navigate()` (Navigation API) | Cleaner API, but Safari support landed only in 18.x — too new for our compatibility floor. Skip. |
| Vanilla History API | `page.js` / `navigo` / similar micro-router | Adds a dep for ~5 functions of value. Goal explicitly says no library. Skip. |
| Hash routing (`#/welcome`) | — | Defeats the goal: address bar must show real paths so deep links and Pages cache work. Skip. |

**Installation:** none required.

**Version verification:** no new packages — skipped.

## Architecture Patterns

### Recommended file changes

```
src/
├── router.ts         # NEW — navigate(), popstate, resolveRoute(), titleFor()
├── app.ts            # MODIFY — replace screen-flip call sites with router.navigate()
├── welcome.ts        # MODIFY — Play button → router.navigate('/play')
├── completion.ts     # MODIFY — Archive link → '/archive'; Show puzzle → router.navigate('/play')
├── screens.ts        # UNCHANGED — router calls showScreen() internally
└── worker/
    ├── index.ts      # MODIFY — add /archive routes, 301 from /puzzles, add VALID_EVENTS entry
    └── puzzles.ts    # MODIFY — rename file? keep as puzzles.ts (filename mirrors data, not URL); update internal anchor hrefs
```

`src/worker/puzzles.ts` keeps its filename (it's the SSR archive renderer — filename describes the data, not the URL). The exported function name and rendered link hrefs change. Optional: rename file to `archive.ts` for clarity. **Recommendation:** rename to `archive.ts` to match the URL — single rename, no ambiguity later.

### Pattern 1: Pure route resolver

**What:** A pure function that takes the requested path and a context snapshot (history, today, mid-interaction flag) and returns the final route. No DOM, no side effects.

**When to use:** Every `navigate()` call passes through it. Also called once at boot to pick the initial screen.

**Example:**
```typescript
// src/router.ts
export type Route =
  | { kind: 'welcome' }
  | { kind: 'play' }
  | { kind: 'solved' }
  | { kind: 'archive' }
  | { kind: 'archive-date'; date: string };

export interface ResolveCtx {
  hasData: boolean;            // any dlng_* key present
  todayEntry: HistoryEntry | null;
  todayLocal: string;
  midInteraction: boolean;     // activeBox !== null || submitting
}

export function resolveRoute(path: string, ctx: ResolveCtx): Route {
  // /play → /welcome if no data
  if (path === '/play' && !ctx.hasData) return { kind: 'welcome' };
  // /play → /solved if today already solved
  if (path === '/play' && ctx.todayEntry) return { kind: 'solved' };
  // /solved → /welcome if no/stale history
  if (path === '/solved' && !ctx.todayEntry) return { kind: 'welcome' };

  const archiveDate = path.match(/^\/archive\/(\d{4}-\d{2}-\d{2})$/);
  if (archiveDate) {
    const d = archiveDate[1];
    if (!isValidDate(d) || d > ctx.todayLocal) return { kind: 'archive' };
    return { kind: 'archive-date', date: d };
  }

  if (path === '/archive') return { kind: 'archive' };
  if (path === '/welcome') return { kind: 'welcome' };
  if (path === '/play') return { kind: 'play' };
  if (path === '/solved') return { kind: 'solved' };

  // Unknown path — fall back to /welcome
  return { kind: 'welcome' };
}
```

### Pattern 2: pushState vs replaceState

| Action | Method | Reason |
|--------|--------|--------|
| User clicks Play, link, etc. | `pushState` | New history entry — back goes to previous screen |
| Solving today's puzzle (game → solved) | `replaceState` | Back from `/solved` skips the finished puzzle, lands on `/welcome` (RTE-03) |
| Redirect resolves to a different route than the requested one | `replaceState` | Wrong URL must not pollute history (RTE-03) |
| Stale-day redirect (`/solved` → `/welcome` on focus) | `replaceState` | User did not navigate intentionally |
| `popstate` (browser back/forward) | NEITHER — read URL, render | The browser already updated `location` |

### Pattern 3: popstate-aware boot

```typescript
// src/router.ts (sketch)
window.addEventListener('popstate', () => {
  const route = resolveRoute(location.pathname, getCtx());
  // Don't pushState here — browser already moved.
  applyRoute(route);
});

export function navigate(path: string, opts: { replace?: boolean } = {}): void {
  const route = resolveRoute(path, getCtx());
  const finalPath = pathFor(route);
  const method = opts.replace || finalPath !== path ? 'replaceState' : 'pushState';
  if (location.pathname !== finalPath) history[method](null, '', finalPath);
  applyRoute(route);
}

function applyRoute(route: Route): void {
  document.title = titleFor(route);
  track('route_change', undefined, pathFor(route));
  switch (route.kind) {
    case 'welcome':      showScreen('welcome'); initWelcome(); break;
    case 'play':         showScreen('game');    loadPuzzleForToday(); break;
    case 'solved':       showScreen('completion'); /* renderCompletion already ran */ break;
    case 'archive':      window.location.assign('/archive'); break;  // SSR page
    case 'archive-date': showScreen('game');    loadPuzzleForDate(route.date); break;
  }
}
```

Note: `/archive` is an SSR page (renamed from `/puzzles`), so navigating to it is a real document load via `location.assign`. Not a client route in the screen-machine sense — the router just hands off to the browser.

### Pattern 4: Stale-day check (POL-04)

```typescript
let lastKnownDate = todayLocal();

function checkStaleDay(): void {
  // RTE-03: don't fire mid-interaction
  if (activeBox !== null || submitting) return;
  const real = todayLocal();
  if (real === lastKnownDate) return;
  lastKnownDate = real;
  // If the user is on /solved with a now-stale entry, bounce to /welcome.
  if (location.pathname === '/solved' && !todayEntry()) {
    navigate('/welcome', { replace: true });
  }
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') checkStaleDay();
});
window.addEventListener('focus', checkStaleDay);
```

### Anti-Patterns to Avoid

- **Wrapping `showScreen()` in the View Transition API and `pushState` in the same tick** — `document.startViewTransition()` already wraps the DOM mutation. Call `pushState` first, then `showScreen()`. Order: update URL → set title → emit analytics → flip screen. Never the reverse.
- **Listening for `hashchange`** — we don't use hashes. Wrong event.
- **Calling `pushState` inside the `popstate` handler** — creates infinite or duplicate entries. `popstate` only reads.
- **Polling the date** — POL-04 explicitly forbids it. Listener only.
- **Cross-importing from `src/worker/`** — strict boundary in `docs/ARCHITECTURE.md`. Router lives in client only.
- **Storing the route in a `window` global** — `gameState` rule applies to all module state.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| URL parsing | Custom regex tree | `URL` constructor + targeted regex per route | Browser parser handles edge cases (encoding, query, hash). |
| Date validation | Brittle string compare | `new Date(d + 'T00:00:00')` + `isNaN(getTime())` plus regex shape check | Already used in `app.ts` and `worker/index.ts`. |
| SPA fallback | DIY `try { fetch } catch { /index.html }` | `env.ASSETS.fetch(new Request(new URL('/index.html', request.url)))` | Already the project's pattern (`worker/index.ts:261, 268`). |
| Screen state machine | A second one in router | Reuse `screens.ts` `showScreen()` | One source of truth. Router only decides; screens only animate. |
| Title management | DOM manipulation in each screen | Single `titleFor(route)` map called once per `applyRoute` | Centralised; testable. |

**Key insight:** The Worker already supports the exact pattern needed. `wrangler.jsonc` lists `run_worker_first` for the paths that need Worker logic; everything else hits Pages assets directly. Add the new client routes to that list and add a Worker handler that returns `index.html` — done.

## Common Pitfalls

### Pitfall 1: Cloudflare Pages 404 on deep link refresh

**What goes wrong:** User refreshes `/welcome` and gets a 404 because Pages can't find `welcome.html`.
**Why it happens:** Pages serves static files; unknown paths 404 unless a fallback is configured.
**How to avoid:** Worker handles the fallback. Add `/welcome`, `/play`, `/solved`, `/archive`, `/archive/*` to `wrangler.jsonc` `assets.run_worker_first`, and add `if (path matches client route) return env.ASSETS.fetch(new URL('/index.html', request.url))` in `src/worker/index.ts`. The existing `/random` and `/puzzles/:num` blocks are the template (lines 260-269).
**Warning signs:** Refresh on a deep link 404s in `npm run dev` or in preview.

### Pitfall 2: `popstate` fires on initial load in some browsers

**What goes wrong:** Old WebKit emits an initial `popstate` with `event.state === null`, double-rendering the boot screen.
**Why it happens:** Historical Safari/iOS behaviour. Mostly fixed but worth guarding.
**How to avoid:** Don't rely on `event.state`; always read `location.pathname`. The handler is idempotent — re-resolving the current path returns the same route — so an extra fire is harmless. Make sure `applyRoute` is idempotent (no analytics double-emit; add a `lastEmittedPath` guard inside `track('route_change')` if measured drift appears).

### Pitfall 3: `replaceState` lost when `View Transitions` is in flight

**What goes wrong:** Calling `pushState` inside `document.startViewTransition()` callback can race with the browser's snapshot capture, leaving the URL out of sync with the visible screen.
**Why it happens:** View Transitions takes a synchronous DOM snapshot; URL change should land before the snapshot.
**How to avoid:** Update URL **before** calling `showScreen()` (which is the View Transition trigger in `screens.ts`). The order in `applyRoute` above already does this.
**Warning signs:** URL bar reads `/solved` but screen shows game (or vice versa) on the celebrate→solved transition.

### Pitfall 4: Service worker caches `/index.html` and breaks new client routes

**What goes wrong:** SW serves stale shell to `/welcome`, missing whatever the new bootstrap needs.
**Why it happens:** `vite.config.ts` cache-busts SW with `__BUILD_HASH__`, but the SW route table may not include new paths.
**How to avoid:** Inspect `public/sw.js` (not in this read set) before merging. If it explicitly lists routes, add the new ones. If it falls through to network for unknown paths, no change needed. Verify with a hard refresh on each new path.
**Warning signs:** New routes work in dev but ship stale in production after deploy.

### Pitfall 5: Title set in HTML overrides router on first paint

**What goes wrong:** `<title>Clumeral</title>` shows briefly before router sets `Clumeral · Play`.
**Why it happens:** Title is in static HTML. Router runs after parse.
**How to avoid:** Acceptable — the flash is < 100ms and the requirements only mandate route-specific title, not zero-flash. If unwanted, set `document.title` synchronously at the top of `app.ts` (before `loadPuzzle()`) based on `location.pathname`.

### Pitfall 6: `history.scrollRestoration = 'manual'` set too late

**What goes wrong:** Browser's default scroll-restore fires on bfcache restore before our code runs.
**Why it happens:** Setting must precede any navigation event after page load.
**How to avoid:** Set as the very first line of the module body in `app.ts` (or even in an inline `<script>` in `index.html` head, before the module loads, since it's safe and synchronous). Check `'scrollRestoration' in history` first to avoid old-browser exception.

### Pitfall 7: 301 redirect cached forever

**What goes wrong:** Browser caches `/puzzles → /archive` 301 indefinitely. If you ever need to change it, users with cached 301s won't see the change.
**Why it happens:** 301 is "permanent" by spec; browsers treat it as long-cached.
**How to avoid:** Use **302** (or 307) for the back-compat redirect. Spec-wise this is "temporary," browsers don't aggressively cache. Old links still resolve. Roadmap text says "redirect" without specifying status — 302 is safer.
**Recommendation:** 302, with `Location: /archive` and the request's pathname suffix preserved (`/puzzles/123` → `/archive/<date-from-num>` ideally, or just `/archive` as a graceful fallback).

### Pitfall 8: `/puzzles/<num>` deep links stop working

**What goes wrong:** Existing bookmarks and shared links to `/puzzles/123` 404 after rename.
**How to avoid:** Keep the Worker route for `/puzzles/<num>`; redirect (302) to `/archive/<YYYY-MM-DD>` using `puzzleDate(num)` from `src/worker/puzzle.ts`. ~6 lines.

### Pitfall 9: Solved-view link target depends on date (ARC-02)

**What goes wrong:** On `/archive/<today>`, the solved-screen "back" link should go to `/solved`, but for `/archive/<other-date>` it should go to `/archive`.
**How to avoid:** `completion.ts` already takes `isRandom` to vary links. Add a third state — pass the active date or route kind to `renderCompletion` so it can pick the right target.

## Runtime State Inventory

This is a rename + routing change with persisted state implications.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `dlng_history` localStorage holds `{date, tries, answer?}` keyed by date — unchanged by rename. Date-based archive replay continues to read it. No migration. | None |
| Live service config | None — the `/puzzles` route lives only in code (Worker), not in any external service config. Cloudflare Pages auto-rebuilds from git. KV bindings (`PUZZLES`) are content keyed by date; binding name is internal and doesn't depend on the URL. | None |
| OS-registered state | Cron in `wrangler.jsonc` (`"0 0 * * *"`) runs `scheduled` which calls `getDailyPuzzle`. URL change does not affect it. | None |
| Secrets / env vars | `HMAC_SECRET`, `CF_ACCOUNT_ID`, `CF_API_TOKEN` — unchanged. | None |
| Build artifacts / installed packages | `dist/` is rebuilt by Vite on every build. Service worker (`public/sw.js`) gets new `__BUILD_HASH__` on build — should auto-bust correctly. **Verify** the SW route allowlist is either route-agnostic or includes new paths. | Audit `public/sw.js` during planning |
| External backlinks | Anyone with bookmarked `/puzzles` or `/puzzles/<num>` links — preserve via 302 redirects. | Add 302 handlers in Worker |

**Canonical question — what runtime systems hold the old string after the file edits land?** Only the user's browser (cached redirect, bookmarks, possibly SW cache). All addressed above.

## Code Examples

Verified patterns from official MDN / Cloudflare docs and existing project code.

### Set `scrollRestoration` once at boot

```typescript
// src/app.ts (top of module body)
if ('scrollRestoration' in history) {
  history.scrollRestoration = 'manual';
}
```
Source: MDN — History.scrollRestoration. Standard since ~2018; widely supported.

### Worker SPA fallback (existing project pattern)

```typescript
// src/worker/index.ts:267 (current code)
if (request.method === 'GET' &&
    (url.pathname === '/' || url.pathname === '/index.html' || url.pathname === '/random')) {
  return env.ASSETS.fetch(new Request(new URL('/index.html', request.url)));
}
```
Extend the condition to include `/welcome`, `/play`, `/solved`, and `/archive/<YYYY-MM-DD>`. The bare `/archive` route stays as the SSR archive list (renamed from `/puzzles`).

### 302 redirect from `/puzzles` to `/archive`

```typescript
// src/worker/index.ts (new handler)
if (request.method === 'GET' && url.pathname === '/puzzles') {
  return new Response(null, { status: 302, headers: { Location: '/archive' } });
}
const oldReplay = url.pathname.match(/^\/puzzles\/(\d+)$/);
if (request.method === 'GET' && oldReplay) {
  const num = parseInt(oldReplay[1], 10);
  const date = puzzleDate(num);
  return new Response(null, { status: 302, headers: { Location: `/archive/${date}` } });
}
```

### Add `route_change` to VALID_EVENTS

```typescript
// src/worker/index.ts:24
const VALID_EVENTS = new Set([
  'puzzle_start', 'puzzle_complete', 'incorrect_guess',
  'htp_opened', 'htp_dismissed', 'feedback_submitted',
  'theme_toggle', 'colour_change', 'tooltip_opened',
  'route_change',  // NEW (POL-02)
]);
```

### Wrangler asset routing

```jsonc
// wrangler.jsonc
"assets": {
  "binding": "ASSETS",
  "run_worker_first": [
    "/", "/index.html",
    "/welcome", "/play", "/solved",
    "/archive", "/archive/*",
    "/random",
    "/puzzles", "/puzzles/*",   // keep for back-compat 302 redirects
    "/api/*", "/stats"
  ]
}
```
Source: `wrangler.jsonc` (current) + Cloudflare Workers Static Assets docs. Paths in `run_worker_first` always hit the Worker; the Worker decides whether to call `env.ASSETS.fetch`.

## State of the Art

| Old approach | Current approach | When changed | Impact |
|--------------|------------------|--------------|--------|
| Hash routing | Path-based History API | Mid-2010s | Required for SEO and Pages compatibility |
| Single shell + `display:none` screens | Path-driven screens | This phase | URLs reflect state; deep links work |
| `pushState` everywhere | `replaceState` for redirects + auto-transitions | Always — but easy to forget | Cleaner history stack; back button works as users expect |
| Library router for SPAs (page.js, navigo) | Vanilla History API for small apps | n/a | One file under 200 LOC for a 3-screen app |

**Deprecated/outdated:**
- Navigation API (`navigation.navigate()`) — newer and nicer but Safari support too recent.
- Hash routing — fine for static sites but breaks Pages caching and SEO.

## Open Questions

1. **Should `/archive` row links target `/archive/<date>` or keep `/puzzles/<num>`?**
   - What we know: rename is mandated; SSR page can render either.
   - What's unclear: do we want puzzle-number-stable URLs (debugging-friendly) or date-stable URLs (human-friendly)?
   - Recommendation: date-based (`/archive/<YYYY-MM-DD>`). Matches the requirements text exactly. Single source of truth.

2. **Does `public/sw.js` whitelist routes?**
   - What we know: `vite.config.ts` injects `__BUILD_HASH__` for cache-busting.
   - What's unclear: SW source not in the read set.
   - Recommendation: planner must `grep` the SW for hard-coded paths. If found, add new ones. If route-agnostic, no change.

3. **`/archive/<today>` — does the Worker pre-generate today's puzzle on first hit, or rely on cron?**
   - What we know: cron runs at UTC midnight; `getDailyPuzzle` lazy-generates on miss.
   - What's unclear: whether dated-archive client load needs a date-aware API endpoint.
   - Recommendation: client computes `puzzleNumber(date)` (via the existing helper) and hits `/api/puzzle/:num` — zero new server endpoints.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Browser History API | RTE-01, RTE-03 | ✓ | All ES2022 browsers | — |
| `document.startViewTransition` | Smooth crossfade | ✓ on Chrome/Edge/Safari 18+; falls back to opacity in `screens.ts:46` | — | Already handled in `screens.ts` |
| `visibilitychange` event | POL-04 | ✓ | universal | `focus` event (already added as belt+braces) |
| Cloudflare Workers `env.ASSETS.fetch` | RTE-02 | ✓ | `@cloudflare/vite-plugin@1.31.0` | — |
| `node` / `npm` for `npm run dev` | local verification | ✓ assumed | — | — |
| Test framework (vitest, jest, etc.) | Validation Architecture | ✗ | none in `package.json` | Manual validation; install vitest in Wave 0 if automated tests required |

**Missing dependencies with no fallback:** none.

**Missing dependencies with fallback:** vitest is not installed — see Validation Architecture and Wave 0 below.

## Validation Architecture

### Test framework

| Property | Value |
|----------|-------|
| Framework | None installed. Recommend `vitest@^2.x` (Vite-native, zero config beyond `vitest.config.ts`). |
| Config file | none — Wave 0 must add `vitest.config.ts` (or rely on shared `vite.config.ts`) |
| Quick run command | `npx vitest run tests/router.spec.ts` (after install) |
| Full suite command | `npx vitest run` |
| Manual smoke | `npm run dev` then exercise each route in browser |

### Phase requirements → test map

| Req ID | Behavior | Test type | Automated command | File exists? |
|--------|----------|-----------|-------------------|--------------|
| RTE-01 | `navigate('/play')` updates `location.pathname` and shows game screen | unit | `npx vitest run tests/router.spec.ts -t "navigate"` | ❌ Wave 0 |
| RTE-01 | `popstate` re-renders the right screen | unit (jsdom) | `npx vitest run tests/router.spec.ts -t "popstate"` | ❌ Wave 0 |
| RTE-02 | Worker returns `index.html` for `/welcome`, `/play`, `/solved`, `/archive/2026-04-01` | integration (miniflare / `wrangler dev` + curl) | manual: `curl -I http://localhost:5173/welcome` | manual |
| RTE-03 | `resolveRoute('/play', { hasData: false, … })` → `welcome` | unit (pure fn) | `npx vitest run tests/resolve-route.spec.ts` | ❌ Wave 0 |
| RTE-03 | `resolveRoute('/play', { todayEntry: {…} })` → `solved` | unit | same | ❌ Wave 0 |
| RTE-03 | `resolveRoute('/solved', { todayEntry: null })` → `welcome` | unit | same | ❌ Wave 0 |
| RTE-03 | Solving uses `replaceState` not `pushState` | unit (spy on `history`) | `npx vitest run tests/router.spec.ts -t "replaceState on solve"` | ❌ Wave 0 |
| RTE-03 | Stale-day guard skips when mid-interaction | unit | `npx vitest run tests/router.spec.ts -t "mid-interaction"` | ❌ Wave 0 |
| ARC-01 | `GET /puzzles` → 302 to `/archive` | integration | `curl -I http://localhost:5173/puzzles \| grep -i location` | manual |
| ARC-01 | `GET /puzzles/123` → 302 to `/archive/<date>` | integration | `curl -I http://localhost:5173/puzzles/123` | manual |
| ARC-02 | `/archive/<today>` solved view links to `/solved` | unit (DOM after `renderCompletion`) | `npx vitest run tests/completion-links.spec.ts` | ❌ Wave 0 |
| ARC-02 | `/archive/<other-date>` solved view links to `/archive` | unit | same | ❌ Wave 0 |
| ARC-03 | `resolveRoute('/archive/2099-01-01', { todayLocal: '2026-05-03' })` → `archive` | unit | unit | ❌ Wave 0 |
| ARC-03 | `resolveRoute('/archive/not-a-date', …)` → `archive` | unit | unit | ❌ Wave 0 |
| POL-01 | `document.title` matches `titleFor(route)` after navigate | unit | `npx vitest run tests/router.spec.ts -t "title"` | ❌ Wave 0 |
| POL-02 | `track('route_change', undefined, '/play')` fires once per nav | unit (spy on `track`) | unit | ❌ Wave 0 |
| POL-02 | `route_change` is in `VALID_EVENTS` allowlist | grep | `grep -c route_change src/worker/index.ts` (expect ≥1) | ✅ test-by-grep |
| POL-03 | `history.scrollRestoration === 'manual'` after boot | unit | unit | ❌ Wave 0 |
| POL-04 | Stale-day check fires on `visibilitychange`, not on a timer | unit (no `setInterval` registered) + grep | `! grep -E "setInterval.*stale" src/router.ts` | grep |

### Sampling rate

- **Per task commit:** `npx vitest run tests/<file>.spec.ts` for the touched module (< 5 s).
- **Per wave merge:** `npx vitest run` (full suite, < 30 s expected at this size).
- **Phase gate:** Full suite green, plus the integration `curl` checks for Worker fallback and 302s, plus the manual deep-link refresh smoke (table below), before `/gsd:verify-work`.

### Manual smoke matrix (browser, must pass before gate)

| Scenario | URL bar after | Screen shown |
|----------|---------------|--------------|
| Fresh install, hit `/` | `/welcome` | welcome (HTP-first layout) |
| Returning unsolved, hit `/` | `/welcome` | welcome (HTP-after layout) |
| Returning solved-today, hit `/` | `/solved` | completion |
| Hit `/play` cold | `/welcome` (no data) | welcome |
| Hit `/play` with data, unsolved | `/play` | game |
| Hit `/play` after solving | `/solved` | completion |
| Solve puzzle on `/play` | `/solved` | completion → back skips to `/welcome` |
| Hit `/solved` cold | `/welcome` | welcome |
| Hit `/archive` | `/archive` | SSR list |
| Click row in `/archive` | `/archive/<YYYY-MM-DD>` | game (replay) |
| Hit `/archive/2099-01-01` | `/archive` | SSR list (replaced) |
| Hit `/archive/banana` | `/archive` | SSR list (replaced) |
| Hit `/puzzles` | `/archive` (302) | SSR list |
| Hit `/puzzles/5` | `/archive/<date>` (302) | game (replay) |
| Refresh on each new route | unchanged | correct screen |
| Browser back from `/solved` after solving | `/welcome` | welcome (skips finished `/play`) |
| Tab away, system clock advances, return | `/welcome` if was on `/solved`; mid-interaction state preserved otherwise | per RTE-03 |

### Wave 0 gaps

- [ ] `package.json` — add `vitest` (and `@vitest/coverage-v8` if desired) as devDependency; add `"test": "vitest run"` script.
- [ ] `vitest.config.ts` — minimal config; reuse `vite.config.ts` plugins; set `environment: 'jsdom'` for DOM-dependent tests; install `jsdom`.
- [ ] `tests/resolve-route.spec.ts` — pure-function tests for `resolveRoute()` covering RTE-03, ARC-03.
- [ ] `tests/router.spec.ts` — DOM tests using jsdom: navigate, popstate, replaceState on solve, title, analytics emission, scrollRestoration, mid-interaction guard.
- [ ] `tests/completion-links.spec.ts` — assert solved-view link target depends on date.
- [ ] `tests/setup.ts` — shared mocks (localStorage, `track`, `history` spies).
- [ ] If Wave 0 install is rejected by reviewer (the project ships zero test infra today), fall back to manual smoke matrix above as the gate; keep `resolveRoute` deliberately pure so it can be smoke-tested via a `_devResolve()` window helper in dev builds.

## Sources

### Primary (HIGH)

- `src/app.ts` (current bootstrap, screen wiring, mid-interaction state) — read in this research
- `src/screens.ts`, `src/welcome.ts`, `src/completion.ts` (existing screen state machine) — read
- `src/worker/index.ts` (current routes, SPA fallback pattern, VALID_EVENTS) — read
- `src/worker/puzzles.ts` (SSR archive page) — read
- `src/storage.ts` (history / prefs API) — read
- `index.html`, `vite.config.ts`, `wrangler.jsonc` — read
- `docs/ARCHITECTURE.md`, `docs/CONVENTIONS.md`, `CLAUDE.md` — read
- `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, `.planning/STATE.md` — read

### Secondary (MEDIUM)

- MDN — History API (`pushState`, `replaceState`, `popstate`, `scrollRestoration`): well-established, browser-supported.
- Cloudflare Workers Static Assets docs — `run_worker_first` + `env.ASSETS.fetch` (the existing project usage is the verified reference).

### Tertiary (LOW)

- General SPA-routing folklore (302 vs 301 caching, View Transitions race) — flagged in pitfalls; verify in browser during plan execution.

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — vanilla History API, all primitives already in project.
- Architecture: HIGH — existing screen machine, Worker fallback, and analytics layers all support the change with no library additions.
- Pitfalls: MEDIUM-HIGH — most are well-known History API and Pages routing gotchas; SW caching pitfall (#4) is project-specific and unverified (need to read `public/sw.js` during planning).
- Validation Architecture: MEDIUM — no test framework currently installed; recommendation requires Wave 0 install or fallback to manual smoke.

**Research date:** 2026-05-03
**Valid until:** 2026-06-03 (30 days — stable domain, no fast-moving deps)
