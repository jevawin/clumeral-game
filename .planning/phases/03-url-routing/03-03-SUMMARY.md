---
phase: 03-url-routing
plan: 03
subsystem: client-router
tags: [router, history-api, navigation, analytics, scroll-restoration, sendbeacon]
requires:
  - 03-01 (vitest scaffold)
  - 03-02 (resolveRoute pure resolver)
provides:
  - 'src/router.ts: navigate(), replaceRoute(), initRouter(), pathFor(), titleFor(), NavigateOpts'
  - 'CustomEvent("analytics:track") protocol — Plan 04 wires the listener in app.ts'
  - 'navigator.sendBeacon("/api/event", body) for /archive unload-safe analytics (POL-02)'
  - 'history.scrollRestoration = "manual" set once at boot (POL-03)'
  - 'popstate, visibilitychange, focus listeners — no setInterval/setTimeout polling (POL-04)'
affects:
  - 'Plan 04 will replace showScreen() call sites in src/app.ts with navigate()'
  - 'Plan 06 uses navigate(path, { skipResolve: true }) to break /play→/solved redirect loop on completion'
tech-stack:
  added: []
  patterns:
    - 'Imperative shell over pure resolver — router.ts holds side effects, route-resolver.ts stays pure'
    - 'Dependency injection — initRouter accepts hasData/todayLocal/todayEntry/midInteraction so tests can stub'
    - 'CustomEvent dispatch for analytics — avoids circular import with app.ts (which owns track())'
    - 'sendBeacon BEFORE location.assign — synchronous unload-safe analytics for full-page nav'
key-files:
  created:
    - src/router.ts
  modified:
    - tests/router.spec.ts
decisions:
  - 'Router emits CustomEvent("analytics:track") instead of importing track() — avoids src/app.ts circular dep'
  - 'sendBeacon body is a JSON string, not a Blob — valid BodyInit and jsdom-friendly for tests'
  - 'history.scrollRestoration assignment is unconditional inside try/catch — jsdom does not expose it on the prototype but accepts the write'
  - 'routeFromPath() is private; only navigate(skipResolve) consumes it'
metrics:
  duration: ~12 min
  completed: 2026-05-03
  tasks: 2
  files: 2
  lines: 362
---

# Phase 03 Plan 03: Build src/router.ts (imperative shell) Summary

Imperative client-side router that wraps the pure `resolveRoute()` from Plan 02, owns
History API state, document title, analytics dispatch, scrollRestoration, popstate, and
the stale-day visibility/focus check. Real jsdom specs replace the Plan 01 `it.todo`
placeholders for RTE-01 and POL-01..04.

## What Landed

- **`src/router.ts`** (176 lines) — public API: `navigate`, `replaceRoute`, `initRouter`,
  `pathFor`, `titleFor`, plus the `NavigateOpts` type with `replace` and `skipResolve`.
- **`tests/router.spec.ts`** — 14 executable specs covering RTE-01 (4), POL-01 (4),
  POL-02 (2 — CustomEvent + sendBeacon order), POL-03 (1), POL-04 (2), RTE-03 (1).

### Public API

```ts
export function navigate(path: string, opts?: NavigateOpts): void;
export function replaceRoute(path: string): void;
export function initRouter(deps: RouterDeps): void;
export function pathFor(route: Route): string;
export function titleFor(route: Route): string;
export interface NavigateOpts { replace?: boolean; skipResolve?: boolean }
```

### Behavior matrix

| Trigger | Effect |
|---|---|
| `navigate('/play')` | resolveRoute → pushState (or replaceState if redirected) → title → CustomEvent → showScreen |
| `navigate(path, { skipResolve: true })` | bypass resolver → pushState → title → CustomEvent → showScreen (used by Plan 06) |
| `replaceRoute(path)` | navigate with `replace: true` |
| `route.kind === 'archive'` | sendBeacon → CustomEvent → location.assign (in that order) |
| `popstate` | resolve from `location.pathname`, re-render only — never pushState |
| `visibilitychange` (visible) + `focus` | stale-day check; no-op if `midInteraction()` returns true |
| `initRouter()` | set `scrollRestoration = 'manual'` → register listeners → render initial route |

## Verification

- `npx vitest run` → 25 passed, 3 todo (resolve-route + router specs both green)
- `npx tsc --noEmit` → clean for `src/router.ts` (pre-existing `vite.config.ts` node-types
  errors are out of scope; flagged in `.planning/phases/03-url-routing/deferred-items.md`
  if you want to chase them later)
- `! grep -E "setInterval|setTimeout" src/router.ts` → passes (no polling)
- `! grep -E "from './worker" src/router.ts` → worker boundary intact
- `! grep -E "from './app" src/router.ts` → no circular import

## Deviations from Plan

### Auto-fixed Issues (Rule 3 — test infrastructure)

**1. [Rule 3 — Test Infra] scrollRestoration assignment in jsdom**
- **Found during:** Task 2 (POL-03 test failed with `expected undefined to be 'manual'`)
- **Issue:** Router's `if ('scrollRestoration' in history)` guard was false in jsdom, so
  the assignment was skipped and the property stayed undefined.
- **Fix:** Removed the `in history` guard; the unconditional assignment is wrapped in
  try/catch and is a no-op in any environment that throws on the write. Real browsers
  all support this — the guard was not adding safety.
- **Files modified:** `src/router.ts`
- **Commit:** `a2de699`

**2. [Rule 3 — Test Infra] sendBeacon body type**
- **Found during:** Task 2 (POL-02 test failed reading the Blob body)
- **Issue:** Original plan used `new Blob([body], { type: 'application/json' })`. jsdom
  Blobs lack a working `.text()` method and `Response(blob).text()` also fails — the
  body cannot be inspected from a test.
- **Fix:** Switched to passing the JSON string directly. `string` is a valid sendBeacon
  `BodyInit` (per spec) and behaves identically in real browsers.
- **Files modified:** `src/router.ts`
- **Commit:** `a2de699`

**3. [Rule 3 — Test Infra] window.location.assign stub**
- **Found during:** Task 2 (POL-02 test failed with `Cannot redefine property: assign`)
- **Issue:** jsdom 25 makes `window.location.assign` non-configurable, so the plan's
  `Object.defineProperty(window.location, 'assign', ...)` threw.
- **Fix:** Replaced `window.location` itself (configurable) with a spread-clone object
  that has the stubbed `assign`. The original is restored at the end of the test.
- **Files modified:** `tests/router.spec.ts`
- **Commit:** `a2de699`

None of these deviations changed the public API or observable browser behaviour — they
only affected jsdom-test compatibility.

## Commits

| Task | Hash | Message |
|---|---|---|
| Task 1 | `a8b0b49` | feat(03-03): add src/router.ts with navigate, replaceRoute, initRouter |
| Task 2 | `a2de699` | test(03-03): add real router specs for RTE-01 + POL-01..04 |

## Hand-off to Plan 04

Plan 04 should:

1. Add a `document.addEventListener('analytics:track', e => track(e.detail.event, undefined, e.detail.source))`
   listener in `src/app.ts` boot.
2. Replace direct `showScreen()` call sites with `navigate()` / `replaceRoute()`.
3. Wire `initRouter({ hasData, todayLocal, todayEntry, midInteraction })` into the boot
   sequence, with `midInteraction = () => activeBox !== null || submitting`.
4. For the completion → "play another" link (Plan 06), call
   `navigate('/play', { skipResolve: true })` to bypass the `/play → /solved` redirect.

## Self-Check: PASSED

- `src/router.ts` — FOUND (176 lines)
- `tests/router.spec.ts` — FOUND (186 lines, 14 specs, 0 todos)
- Commit `a8b0b49` — FOUND in `git log`
- Commit `a2de699` — FOUND in `git log`
- All Task 1 and Task 2 acceptance counts — match
- `npx vitest run` — 25 passed | 3 todo, 0 failed
