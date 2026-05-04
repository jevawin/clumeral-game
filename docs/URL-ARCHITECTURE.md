# URL architecture

The semantic URL scheme and routing rules for Clumeral. Read this before
touching the router, completion screen, archive flow, or anything that
calls `navigate()` / `replaceRoute()`.

---

## Routes

| URL                       | Screen        | Owner        | Notes                                                                  |
|---------------------------|---------------|--------------|------------------------------------------------------------------------|
| `/`                       | (redirect)    | client       | Cold-load → resolved to `/welcome` via `routeFromPath` fallback.       |
| `/welcome`                | welcome       | SPA          | Self-contained landing — logo, octo, puzzle # / date, Play, HTP.       |
| `/play`                   | game          | SPA          | Today's puzzle. Either playable, or solved-replay (see below).         |
| `/solved`                 | completion    | SPA          | Today's solved view — celebratory, full stats, countdown.              |
| `/archive`                | (worker SSR)  | worker       | Archive list page. Renamed from `/puzzles`.                            |
| `/archive/<YYYY-MM-DD>`   | game          | SPA          | Archive puzzle for that date. Replayable if not solved, view-only if so. |
| `/random`                 | game          | SPA + worker | Random puzzle. Bypasses the router; played via `/api/puzzle/random`.   |

**Legacy redirects (worker, `308`-equivalent `302`):**

| Pattern                       | →                          |
|-------------------------------|----------------------------|
| `/puzzles`                    | `/archive`                 |
| `/puzzles/<digits>`           | `/archive/<YYYY-MM-DD>`    |
| `/puzzles/<YYYY-MM-DD>`       | `/archive/<YYYY-MM-DD>`    |
| `/puzzles/<other>`            | `/archive`                 |

---

## Resolver rules

`resolveRoute(path, ctx)` runs on cold load and on every `popstate`.
`ctx` carries `hasData`, `todayEntry`, `todayLocal`, `midInteraction`.

| Input path                              | Condition                          | Resolves to        |
|-----------------------------------------|------------------------------------|--------------------|
| `/play`                                 | `!hasData` (no `dlng_history`)     | `welcome`          |
| `/play`                                 | `todayEntry` (already solved)      | `solved`           |
| `/play`                                 | otherwise                          | `play`             |
| `/welcome`                              | `todayEntry` (already solved)      | `solved`           |
| `/solved`                               | `!todayEntry`                      | `welcome`          |
| `/solved`                               | otherwise                          | `solved`           |
| `/archive/<YYYY-MM-DD>`                 | invalid date or future date        | `archive`          |
| `/archive/<YYYY-MM-DD>`                 | otherwise                          | `archive-date`     |
| `/archive` or `/archive/<garbage>`      | —                                  | `archive`          |
| `/welcome`, `/`, anything else          | —                                  | `welcome`          |

**The home rule.** Pre-solve, `/welcome` is the homepage; `/play` and `/solved`
are reachable but redirect to `/welcome` if state is missing. Post-solve,
`/solved` is the homepage; `/welcome` and `/play` both redirect to `/solved`.
The only way to reach `/play` after solving is the explicit Show-puzzle link
on `/solved` (which uses `skipResolve` to bypass the redirect).

`hasData` is `localStorage.getItem('dlng_history')` only — `dlng_uid` (analytics
UID, set unconditionally at boot) does NOT count. Otherwise a stranger sharing
`/play` with someone who's never played would skip the redirect.

`navigate(path, { skipResolve: true })` bypasses the resolver — used for the
Play button (user explicitly chose to play, deep-link gate doesn't apply) and
the Show-puzzle link (target route is intentional).

---

## Cross-day rollover

When the puzzle day rolls over (user left a tab open overnight, refreshes in
the morning), the prior `/play` or `/solved` reflects yesterday's state.

`initRouter` reads `cw-last-visit-date` from localStorage on cold load. If it
exists, is `< todayLocal`, and the requested path is **not** `/welcome` and
**not** an `/archive/...` deep-link, the router replaces history to `/welcome`
before the first paint. `cw-last-visit-date` is then updated to today.

Archive deep-links (`/archive`, `/archive/<date>`) are excluded — they're
date-anchored on purpose; rolling them to `/welcome` would break shareable
links.

---

## Cold-load decision matrix

| Stored state              | Path                       | Lands on                        |
|---------------------------|----------------------------|---------------------------------|
| nothing                   | `/welcome`                 | `/welcome`                      |
| nothing                   | `/play`                    | `/welcome` (RTE-03)             |
| nothing                   | `/solved`                  | `/welcome` (RTE-03)             |
| nothing                   | `/archive`                 | `/archive`                      |
| nothing                   | `/archive/<past-date>`     | game screen, replay-able        |
| nothing                   | `/archive/<future-date>`   | `/archive` (ARC-03)             |
| nothing                   | `/archive/<garbage>`       | `/archive` (ARC-03)             |
| solved today              | `/welcome`                 | `/solved` (post-solve home)     |
| solved today              | `/play`                    | `/solved` (post-solve home)     |
| solved today              | `/solved`                  | `/solved`                       |
| solved past date          | `/archive/<that-date>`     | game screen, solved-replay UI   |
| `cw-last-visit-date < today` | `/play` or `/solved`    | `/welcome` (rollover)           |

---

## Navigation transitions

| From                                       | Action               | Goes to                                    | URL change       |
|--------------------------------------------|----------------------|--------------------------------------------|------------------|
| `/welcome`                                 | click Play           | `/play` (game)                             | `pushState`      |
| `/play` (today)                            | submit correct guess | `/solved` (completion)                     | `replaceState`   |
| `/solved`                                  | click Show puzzle    | `/play` (solved-replay)                    | `pushState`      |
| `/solved`                                  | click Archive        | `/archive`                                 | full nav         |
| `/play` (solved-replay)                    | click Show stats     | `/solved`                                  | `pushState`      |
| `/archive` (list)                          | click puzzle row     | `/archive/<date>`                          | full nav (worker) |
| `/archive/<date>` (replay-able)            | submit correct guess | stays on `/archive/<date>`, solved-replay  | none             |
| `/archive/<date>` (replay-able or solved)  | click Back to archive| `/archive`                                 | full nav         |
| `/archive/<date>` (replay-able or solved)  | click Latest puzzle  | `/`                                        | full nav         |
| any                                        | back button          | previous history entry, re-resolves        | popstate         |

Today's solve uses `replaceState` so the `/play` entry is replaced by `/solved`
in history. Combined with the "/welcome with todayEntry → /solved" redirect,
back from `/solved` goes to `/welcome` which re-resolves to `/solved` —
making `/solved` the effective post-solve home. From `/solved`, Show puzzle
pushes `/play` so back from `/play` (solved-replay) → `/solved`.

Archive solves never enter the `/solved` flow; they stay on `/archive/<date>`
the whole way, so the URL always reflects the puzzle being viewed.

---

## Solved-replay view (the `/play`-style minimal completion)

`/play` and `/archive/<date>` share one rendered surface: the game screen.
When the puzzle for that path is solved, the screen renders identically
regardless of how the user got there (cold load, Show-puzzle from /solved,
back from /solved, fresh archive solve):

1. App header (top, not sticky)
2. Clue list
3. Digit boxes — revealed answer, no input state
4. ✓ "Solved in N try/ies!" feedback line
5. Context links:
   - **Today's `/play`:** `Show stats` → `/solved`
   - **Archive `/archive/<date>`:** `Back to archive` → `/archive`, `Latest puzzle` → `/`
6. Footer (bottom, in flow)

No stats panel ever appears on `/play`. Stats live on `/solved` only.

`showCompletedState(tries, replayDate?)` writes this view. The
`screens:enter` listener re-applies it whenever the game screen activates
with `gameState.solved`, so the Show-puzzle and back-button paths stay
consistent with cold-load.

---

## You cannot replay a solved puzzle

A solved puzzle (today or any archive date) lands on the minimal view
above. The submit button is hidden, the digit boxes have the
`pointer-events-none` correct state, and the keypad never opens. There's
no input path. URL hand-fiddling can't bypass this — the resolver and
`startDailyPuzzle` / `startReplayPuzzle` both branch on history before
showing input UI.

---

## Layout invariants

- **Single `<main>`** (HTML spec). Offscreen octo measurement host is a
  plain `<div aria-hidden="true">`.
- **`<body class="min-h-screen flex flex-col">`** — natural document
  flow. Page scrolls on long content. Footer pushes to bottom on short
  content.
- **App header** is a top-level `<header data-app-header>` — hidden on
  `/welcome` (welcome is self-contained), shown on game and completion
  screens. Not sticky.
- **Toast** uses `position: fixed` — the only intentional fixed element.
  Required so it hovers above scroll on long pages.
- **Octo celebration** uses `position: fixed` during the ~2.6s animation
  only. Animation-time positioning, not layout.
- **Cold-load loader overlay** (`[data-app-loading]`) covers the screens
  area at `bg-bg opacity-100` until the first `showScreen` call lands,
  then fades out (300ms) and is removed from the DOM.
- **Screens use `display: none/flex` toggling** (not stacked
  `position: absolute`) — inactive screens contribute nothing to layout.
- **Sequential fade**: outgoing screen fades to 0 (200ms), then
  display: none, then incoming gets display: flex + opacity-0, then
  fades to 1 (250ms). No cross-fade bleed. Pending transitions are
  cancelled on a new `showScreen` call to handle rapid back↔forward.

---

## Analytics

- `route_change` event fires on every `applyRoute` (pushState, replaceState,
  popstate). Carries the resolved path in `source`.
- `puzzle_start`, `puzzle_complete`, `incorrect_guess`, `theme_toggle`,
  `htp_opened`, `feedback_submitted`, `tooltip_opened` — already in
  `VALID_EVENTS`.

---

## Open questions

*(none currently — pre-solve home is `/welcome`, post-solve home is `/solved`,
archive views stay on `/archive/<date>`. See the "home rule" above.)*

---

## Surfaced from session 2026-05-04

- "You already solved today's puzzle in N tries!" was a v1.0 banner from
  the old design. Removed in favour of the minimal solved-replay view.
- The full stats panel on `/play` was a v1.0 leftover that flashed during
  Welcome → Play. Removed; stats only on `/solved`.
- `cw-htp-seen` localStorage key was retired — its only writer (the
  Play button) and its only reader (the unreachable first-visit welcome
  layout branch) were both deleted.
