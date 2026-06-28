# Playwright QA Regression Suite — Design

Date: 2026-05-31
Status: Implemented 2026-06-08 (branch `qa/playwright-regression-suite`)

## Implementation notes (2026-06-08)

Built per this design. 38 specs across `e2e/specs/`, green on the full 5-engine
matrix (chromium/webkit/firefox desktop + mobile chromium/webkit): 175 passed,
0 failed. Existing ad-hoc specs kept under a `legacy-chromium` project.

Deviations from the design, all deliberate:
- **a11y scope:** axe runs on Chromium desktop + mobile only (DOM/ARIA/contrast
  are engine-independent); behavioral specs cover all 5 engines.
- **Countdown:** asserted as a clock-derived static value — the countdown renders
  once, it does not tick live (design assumed a live tick).
- **Brand "home":** dropped — the brand is a no-nav bounce since 260601-auy, not a
  home link.
- **Deferred (fragile, lower value):** the /archive SSR-handoff analytics beacon
  assertion and the visibility/focus stale-day rollover test. Tracked here for a
  later pass.
- **Console guard** allowlists external Google-Fonts/SW noise (offline hosts).

## Coverage review — 2026-06-28 (PR 2)

Post-redesign coverage map: every screen × flow against the real specs in `e2e/` and
`tests/` (not the intended inventory below). Built during PR 2 of the post-redesign
stabilisation program ([design](2026-06-28-post-redesign-stabilisation-design.md)).

**Well covered** (screen × flow → spec): daily solve (`game-solve`), wrong guess + retry
(`game-fail`), random load + solve (`random`, `ssr-pages`), archive replay + back
(`archive`), midnight/local-date rollover (`midnight-rollover`, `welcome`, unit `date`),
first-play walkthrough (`octopus-walkthrough`), menu burger/feedback/theme/swatch (`menu`),
completion stats/countdown/links (`completion`, unit `completion-stats`/`completion-links`/
`archive-stats`), a11y axe + skip-link (`a11y`), PWA single-screen + precache (`pwa-render`,
unit `sw-precache`), routing scrollRestoration + popstate (`routing`, unit `router`).

**Gaps filled in PR 2:**
- **Random play-again** — clicking the `/random` entry link → load + solve a second puzzle.
  Was only `href`-checked, never followed (`random.spec`, `helpers/random.ts`).
- **Dark-mode active shadow** — PR 1 shipped dark `--shadow-*` overrides with no test; added
  a dark-mode mirror of the light shadow assertion (`shadow-theme.spec`).
- **Completion popstate** — back/forward after solving stays on completion, the terminal
  post-solve state (`routing.spec`).
- **How-to-play menu link** — closes the menu and shows the help (welcome) screen via
  `skipResolve` (`menu.spec`).
- **Mid-game reload restore** — reloading keeps eliminations; the probe for the "phone
  refresh restarts the puzzle" report (`restore.spec`). Passes → same-day restore works.

**Tracked remaining gaps** (documented, not yet specced — low value / fragile / platform):
- [ ] **Random completion links e2e** — assert random completion shows only Archive (no
  "Show puzzle"). Already unit-covered (`completion-links`); e2e is low marginal value.
- [ ] **Day-rollover mid-interaction (live gameplay e2e)** — unit-covered (`router`); the
  visibility/focus variant was deferred here as fragile.
- [ ] **/archive SSR-handoff analytics beacon e2e** — unit-covered (`router`); deferred as
  fragile (document-unload beacon timing across the matrix).
- [ ] **Analytics events fire** — `route_change` + archive beacon are unit-tested; per-event
  e2e assertions (`puzzle_start`, `htp_opened`, …) are low value and flaky against the local
  Analytics Engine binding.
- [ ] **Dark-mode a11y (axe)** — axe runs light theme only; dark-theme contrast pass.
- [ ] **iOS reload / storage eviction** — platform behaviour, not reproducible in Playwright.
  Tracked as [#237](https://github.com/jevawin/clumeral-game/issues/237).

**Stability note:** `random.spec` runs `mode: "serial"` and its readiness waits use a
load-tolerant timeout; the WebKit-only `/api/dev/answer … access control checks` pageerror is
allowlisted in `helpers/console.ts` (test-only endpoint, app already catches it). The full
matrix is green in CI mode (retries:1); WebKit random tests can flake once under max local
single-process concurrency and recover on retry, per the WebKit-flake policy below.

---

## Goal

A full automated Playwright regression suite covering every user-reachable flow in
Clumeral, run against the **production build** (`vite preview` + local Worker). This
catches build-only bugs (the reason the existing #210 octo test runs against preview)
and gives a safety net for upcoming roadmap work.

## Non-goals

- Unit-level logic — already covered by vitest in `tests/`.
- Real external writes. Feedback (external Apps Script URL) and analytics are stubbed
  or observed at the network boundary; no production data is written.
- Visual screenshot snapshots — out of scope for v1 (can be added later per screen).

## Constraints

- Runs against `npm run preview` (`vite build && vite preview --port 4173`). Never reuse
  a stale preview server — the suite exists to test built output. (`reuseExistingServer: false`.)
- ES2022 target; no backend/API changes for the suite itself.
- Standing directive: every UI task ships with a Playwright e2e against the production build.

---

## Architecture

```
e2e/
  fixtures.ts            # custom `test` — seeds localStorage, stubs externals, exposes axe
  helpers/
    solve.ts            # solvePuzzle(page, opts?) — fetch /api/dev/answer, drive keypad + submit
    clock.ts            # freezeDate(page, iso) / advanceDay(page) via page.clock
    storage.ts          # seedHistory(), seedPrefs(), seedUid() localStorage writers
    console.ts          # attachConsoleGuard(page) — fail on console.error / pageerror
  pages/
    welcome.page.ts
    game.page.ts
    completion.page.ts
    archive.page.ts
    menu.page.ts        # header burger + menu items
    feedback.page.ts    # feedback modal
  specs/
    smoke.spec.ts
    welcome.spec.ts
    game-solve.spec.ts
    game-fail.spec.ts
    completion.spec.ts
    archive.spec.ts
    menu.spec.ts
    routing.spec.ts
    ssr-pages.spec.ts
    a11y.spec.ts
  octo-celebration.spec.ts   # EXISTING — unchanged
```

Page objects are thin: a constructor taking `page`, locators by `data-*` attribute, and
action methods (`open()`, `solve()`, `tapDigit()`). No assertions inside page objects —
assertions live in specs so failures point at intent.

### Selector strategy

Use the existing `data-*` attributes as the stable selector contract:
`data-play-btn`, `data-digit`, `data-keypad`, `data-submit`, `data-clue-list`,
`data-menu-btn`, `data-menu`, `data-fb-btn`, `data-htp-btn`, `data-theme-toggle`,
`data-swatches`, `data-completion-stats`, `data-completion-countdown`,
`data-archive-row`, `data-archive-back`, `data-octo`. Avoid text/class selectors except
where copy IS the thing under test.

---

## Determinism & isolation

### Solving a puzzle — `helpers/solve.ts`

1. `GET /api/dev/answer` (today) or `/api/dev/answer?token=<t>` (archive replay) to read
   the real 3-digit answer. Endpoint is already 404'd on `clumeral.com`, so it only works
   against the local preview Worker — safe.
2. Drive the real UI: eliminate digits / tap the answer's digits on the keypad, then
   `data-submit`. This exercises the genuine guess → validation → completion flow, not a
   shortcut.

### External calls — stub at the network boundary

- **Feedback** → as of #213, no network stub. The client POSTs same-origin to
  `/api/feedback`, served by the real preview Worker writing to a **local** miniflare D1
  (seeded by `npm run e2e:db`). Nothing leaves the machine and the actual route + insert
  get exercised. (An active service worker also makes `page.route` interception unreliable
  on WebKit, which is the other reason to hit the real local endpoint rather than stub it.)
- **Analytics** → the local preview Worker already isolates `/api/event` writes (local
  Analytics Engine binding, not prod). No code change. Where a test asserts an event fired,
  `page.route('**/api/event')` to count/inspect the POST, then `continue` or `fulfil`.

No "testing mode" branch is added to production code — that would stop exercising the real
path and give false confidence.

### Time control — `helpers/clock.ts`

Use Playwright `page.clock` to freeze "now" for:
- Completion countdown ticking toward next puzzle.
- Day-rollover redirect (`dlng_last_visit_date` older than today → /welcome).

### State isolation

Fresh `localStorage` per test (Playwright default new context). Seed helpers write known
state for "returning user" cases: `seedHistory()` (history entries), `seedPrefs()`
(theme/colour/save), `seedUid()` (`dlng_uid` for analytics + beacon paths).

---

## Browser / project matrix

Everything automatable without human interaction:

| Project | Device | Notes |
|---|---|---|
| `chromium-desktop` | Desktop Chrome | primary |
| `webkit-desktop` | Desktop Safari | Safari-only CSS/JS bugs |
| `firefox-desktop` | Desktop Firefox | Gecko coverage |
| `mobile-chromium` | Pixel-class, ~390px | game is 390px-max, mobile-first |
| `mobile-webkit` | iPhone-class | iOS Safari |

`fullyParallel: true` stays. `reducedMotion: 'no-preference'` stays (the octo test depends
on it). CI may shard by project.

---

## Test inventory (full regression)

### smoke.spec.ts
- `/`, `/play`, `/solved`, `/archive`, `/stats`, `/puzzles` each load with HTTP 200 and the
  primary element present; console guard clean.

### welcome.spec.ts
- First-visit: welcome screen visible, app header hidden, Play CTA present.
- Click Play (`data-play-btn`) → `/play`, game screen visible, header shown.
- Deep-link rollover: seed stale `dlng_last_visit_date`, visit `/play` cold → redirect to
  `/welcome`.

### game-solve.spec.ts
- `solvePuzzle()` today → completion screen; history record written; octo celebrate class.
- Digit elimination: eliminating down to one digit locks the box; cannot eliminate the last.
- Keypad entry path and submit enablement (`data-submit` enabled only when all three boxes
  resolved).
- Clue tooltip: tapping a clue info icon opens its explanation.

### game-fail.spec.ts
- Wrong guess → sad octo + feedback message, NOT completion, still on `/play`.
- Submit button re-enables after a wrong guess (no stuck `submitting` state).

### completion.spec.ts
- Stats render from seeded history (values match seed).
- Countdown ticks toward next puzzle (clock-driven).
- Links work: play-again, `/random`, next-number, share/feedback links present and routed.

### archive.spec.ts
- `/archive` SSR list loads, rows present, ordering correct.
- Click a dated row → game screen with replay banner (`data-archive-row`) + back button.
- Solve a replay via token answer → completion.
- `data-archive-back` returns to `/archive`.

### menu.spec.ts
- Header home/brand icon → `/welcome`.
- Burger toggles menu; `aria-expanded` flips; outside-click / Esc closes.
- Feedback modal: open, fill, send (stubbed) → success toast; counter + categories work.
- How-to-play modal opens and closes.
- Theme toggle flips `html` class and persists across reload (`dlng_theme`).
- Colour swatch select persists across reload.

### routing.spec.ts
- Back/forward `popstate` re-renders correct screen without double-push.
- `/archive` SSR handoff (`location.assign`) fires analytics beacon (intercept asserts it).
- Stale-day rollover on visibility/focus while on `/solved` with no today entry → `/welcome`.
- `history.scrollRestoration === 'manual'` set at boot.

### ssr-pages.spec.ts
- `/stats` loads (or graceful 503 if secrets absent — assert the documented behaviour).
- `/puzzles` and `/puzzles/:date` replay pages load with key elements.
- `/random` serves the app shell and starts a random puzzle.

### a11y.spec.ts
- Run `@axe-core/playwright` on welcome, game, completion, archive — zero serious/critical
  violations.
- Keyboard: Tab reaches Play, digit boxes, submit, menu; skip-link (`#main`) works.

### Cross-cutting (folded into specs above)
- Console guard (`helpers/console.ts`) attached in fixtures → any test fails on
  `console.error` / uncaught `pageerror`.
- Theme + colour persistence across reload.
- Responsive: mobile projects assert the 390px game layout doesn't overflow.

---

## CI integration

- Entry point unchanged: `npm run test:e2e` (Playwright builds + previews via `webServer`).
- New dev dep: `@axe-core/playwright` for the a11y spec.
- `forbidOnly` + `retries: 1` on CI stay. Optionally shard by project for wall-clock.

---

## Risks / edge cases

- **`/api/dev/answer` availability** — works only off the prod hostname. The suite runs on
  localhost preview, so it's available. If a test ever runs against prod, solve helpers fail
  loudly (good — they should never run there).
- **Feedback migration (#213)** — one intercept pattern changes; designed for it.
- **Stats secrets** — `/stats` may 503 without analytics secrets locally; spec asserts the
  documented fallback rather than a hard 200.
- **Clock control** — `page.clock` must be installed before navigation for rollover tests.
- **WebKit/Firefox flake** — keep animations real (no reducedMotion override) but allow the
  standard `retries: 1` on CI.

---

## Implementation order (for the plan)

1. Config: add 5 projects to `playwright.config.ts`; add `@axe-core/playwright`.
2. Fixtures + helpers (`solve`, `clock`, `storage`, `console`).
3. Page objects.
4. Specs, smoke first, then per-area.
5. Wire console guard + a11y last.
