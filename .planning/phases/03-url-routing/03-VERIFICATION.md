---
phase: 03-url-routing
verified: 2026-05-03T13:19:26Z
status: human_needed
score: 10/10 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Refresh on each new client route in browser preview"
    expected: "/welcome, /play, /solved, /archive, /archive/<YYYY-MM-DD> all return the SPA shell (no 404)"
    why_human: "Worker fallback only reproducible against running wrangler/Pages preview"
  - test: "GET /puzzles and /puzzles/123 via curl on a deployed preview"
    expected: "302 with Location: /archive and /archive/<date> respectively"
    why_human: "302 status surface visible only at HTTP layer; needs running Worker"
  - test: "Solve today's puzzle on /play, then press browser Back"
    expected: "Lands on /welcome (skips finished /play); URL bar shows /welcome"
    why_human: "replaceState behaviour is observable only by exercising real history stack"
  - test: "Tab away on /solved, advance system clock past midnight, return"
    expected: "Stale-day check redirects to /welcome via replaceState (mid-interaction state preserved otherwise)"
    why_human: "Real visibility/focus events + clock change cannot be exercised programmatically"
  - test: "Click an archive row for today vs another date, then solve"
    expected: "/archive/<today> solved view shows Show puzzle + Archive (→/archive); /archive/<other> shows Archive only"
    why_human: "Full UI flow including replay completion render; unit-tested but worth a smoke pass"
---

# Phase 3: URL Routing Verification Report

**Phase Goal:** Replace single-route SPA with semantic client routes (/welcome, /play, /solved, /archive, /archive/<YYYY-MM-DD>) using vanilla History API, plus Worker SPA fallback and /puzzles → /archive rename.
**Verified:** 2026-05-03T13:19:26Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #  | Truth (Requirement) | Status | Evidence |
|----|---------------------|--------|----------|
| 1  | RTE-01: Client routing for /welcome, /play, /solved with pushState/replaceState/popstate | VERIFIED | `src/router.ts` `navigate()` (L125), `popstate` listener (L162), `pathFor`/`titleFor`. `welcome.ts:171` Play→navigate('/play'); `app.ts:709,712` solve→`replaceRoute('/solved')` |
| 2  | RTE-02: Worker serves SPA shell for new client routes | VERIFIED | `src/worker/index.ts:279-288` returns `env.ASSETS.fetch(/index.html)` for `/`, `/welcome`, `/play`, `/solved`, `/random`; line 258 covers `/archive/<date>`. `wrangler.jsonc:7-14` lists routes in `run_worker_first` |
| 3  | RTE-03: Redirect rules with replaceState (no-data, solved-today, stale-history, solving, stale-day) | VERIFIED | `src/route-resolver.ts:30-53` pure rules; `app.ts:709,712` solve uses `replaceRoute`; `router.ts:128-129` non-skipResolve mismatched paths use replaceState; stale-day at `router.ts:141-151` skips on midInteraction |
| 4  | ARC-01: /puzzles renamed to /archive with redirect from /puzzles | VERIFIED | `src/worker/index.ts:235-255` /archive serves SSR list; `:263-274` 302 from `/puzzles` and `/puzzles/<num>` to `/archive`/`/archive/<date>` |
| 5  | ARC-02: /archive/<date> serves dated puzzle; today→/solved link, other→/archive link | VERIFIED | `app.ts:634` passes `{activeDate, todayLocal}` to renderCompletion; `completion.ts:154-184` chooses Show puzzle vs Archive-only based on `isArchivedOtherDate`; `tests/completion-links.spec.ts` 4/4 pass |
| 6  | ARC-03: Invalid/future /archive/<date> → /archive via replaceState | VERIFIED | `route-resolver.ts:39-44,47` invalid date or `d > todayLocal` returns `{kind: 'archive'}`; mismatched final path triggers replaceState in `router.ts:128-129` |
| 7  | POL-01: Route-specific document.title | VERIFIED | `router.ts:21-29` `titleFor()` covers all 5 route kinds; `applyRoute` sets `document.title` (L97) |
| 8  | POL-02: route_change analytics event in VALID_EVENTS | VERIFIED | `worker/index.ts:28` `'route_change'` in allowlist; `router.ts:77-93` emits via CustomEvent + sendBeacon; `app.ts:935-938` bridges to `track()` |
| 9  | POL-03: history.scrollRestoration = 'manual' once at boot | VERIFIED | `router.ts:158-160` set inside `initRouter()`, called once at app boot (`app.ts:950`) |
| 10 | POL-04: Stale-day check via visibility/focus, not polling | VERIFIED | `router.ts:169-172` only `visibilitychange` + `focus` listeners; no `setInterval`/`setTimeout` for stale check anywhere in `src/router.ts` or `src/app.ts` |

**Score:** 10/10 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/router.ts` | navigate, replaceRoute, initRouter, popstate, scrollRestoration, stale-day | VERIFIED | 176 lines; all exports present; wired into `src/app.ts:11,950` |
| `src/route-resolver.ts` | Pure resolveRoute + isValidDate | VERIFIED | 54 lines; no DOM/I/O; imported by `router.ts:4` and tests |
| `src/completion.ts` | renderCompletion accepts {activeDate, todayLocal} | VERIFIED | RenderCompletionOpts at L105; date-aware Show puzzle logic at L157-164 |
| `src/welcome.ts` | Play button → navigate('/play') | VERIFIED | L171 listener uses router |
| `src/worker/index.ts` | /archive routes + /puzzles 302 + SPA fallback + VALID_EVENTS update | VERIFIED | L235-288; route_change in VALID_EVENTS L28 |
| `src/worker/puzzles.ts` | renderArchivePage links to /archive/<date> | VERIFIED | L18 `renderArchivePage`; L28 row href `/archive/${p.date}`; play-link L163 and row click L206 use /archive/<date> |
| `wrangler.jsonc` | run_worker_first lists new client routes | VERIFIED | Lines 7-14 include /welcome, /play, /solved, /archive, /archive/* |
| `tests/router.spec.ts` | RTE-01, POL-01..04 unit tests | VERIFIED | 14 tests pass |
| `tests/resolve-route.spec.ts` | RTE-03, ARC-03 unit tests | VERIFIED | 11 tests pass |
| `tests/completion-links.spec.ts` | ARC-02 link tests | VERIFIED | 4 tests pass |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| welcome.ts Play btn | router.navigate | navigate('/play') | WIRED | `welcome.ts:6,171` |
| app.ts correct guess | router.replaceRoute | replaceRoute('/solved') | WIRED | `app.ts:709,712` |
| completion.ts Show puzzle | app.ts handler → router.navigate | CustomEvent('completion:show-puzzle') → navigate('/play', {skipResolve:true}) | WIRED | `completion.ts:170-173`, `app.ts:968-981` |
| router.ts → screens.ts | applyRoute → showScreen | direct call | WIRED | `router.ts:5,113` |
| router.ts route_change | track() helper | CustomEvent 'analytics:track' bridge | WIRED | `router.ts:77-81`, `app.ts:935-938` |
| Worker /puzzles | /archive | 302 Location header | WIRED | `worker/index.ts:263-274` |
| Worker /archive/<date> | index.html SPA shell | env.ASSETS.fetch | WIRED | `worker/index.ts:258-260` |
| app.ts onArchiveDate | startReplayPuzzle | fetch /api/puzzle/:num via puzzleNumber(date) | WIRED | `app.ts:955-963` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|---------------------|--------|
| renderCompletion (ARC-02) | opts.activeDate, opts.todayLocal | Caller passes from gameState.date + `todayLocal()` (`app.ts:634`) | Yes — real date from puzzle replay flow | FLOWING |
| Archive SSR rows | puzzles array | KV `env.PUZZLES.list()` + `getDailyPuzzle` (`worker/index.ts:238-251`) | Yes — real KV-backed | FLOWING |
| Router popstate render | route from resolveRoute(location.pathname, ctx()) | Live `location` + `deps` from app boot | Yes | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All vitest specs pass | `npx vitest run` | 29 passed (3 files) | PASS |
| TypeScript strict clean | `npx tsc --noEmit` | no errors | PASS |
| Production build clean | `npm run build` | ✓ built (worker 11ms, client 84ms) | PASS |
| route_change in worker allowlist | `grep -c "'route_change'" src/worker/index.ts` | ≥1 | PASS |
| No setInterval polling stale-day | `grep -E "setInterval.*stale\|setInterval" src/router.ts` | none | PASS |
| Worker SPA fallback covers all client routes | grep `/welcome\|/play\|/solved\|/archive` in worker/index.ts | all present | PASS |
| Resolver coverage: invalid date → archive | tests/resolve-route.spec.ts | passes | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| RTE-01 | 03-03, 03-04 | Client-side routing for /welcome, /play, /solved | SATISFIED | router.ts; app/welcome wiring |
| RTE-02 | 03-05 | Worker SPA shell for new client routes | SATISFIED | worker/index.ts:279-288 + wrangler |
| RTE-03 | 03-02, 03-03, 03-04 | Redirect rules + replaceState + stale-day skip | SATISFIED | route-resolver + router stale-day; replaceRoute on solve |
| ARC-01 | 03-05 | Rename /puzzles → /archive with 302 redirect | SATISFIED | worker/index.ts:235-274 |
| ARC-02 | 03-05, 03-06 | /archive/<date> + date-aware completion links | SATISFIED | completion.ts opts; app.ts:634; tests |
| ARC-03 | 03-02 | Invalid/future date → /archive replaceState | SATISFIED | route-resolver.ts:39-47 + router replaceState |
| POL-01 | 03-03 | Route-specific titles | SATISFIED | router.titleFor |
| POL-02 | 03-01, 03-03 | route_change analytics + VALID_EVENTS | SATISFIED | worker/index.ts:28; router emit |
| POL-03 | 03-03 | scrollRestoration manual at boot | SATISFIED | router.ts:158-160 |
| POL-04 | 03-03 | Stale-day visibility/focus listeners (no polling) | SATISFIED | router.ts:169-172 |

No orphaned requirements.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (none) | — | — | — | — |

No TODO/FIXME, no `return null` stubs, no console.log, no hardcoded empty render values introduced by this phase.

### Merge Protocol Note (bb65e5b stub)

Confirmed: commit `bb65e5b fix(03-04): add optional opts param to renderCompletion signature` introduced the optional `opts` param signature only (an intentional stub-first per dependency reordering). Commit `ca86a44 feat(03-06): make renderCompletion date-aware` then implemented the body using those opts. The 03-04 contribution (signature shape, optional param, type compatibility for `app.ts:634` call site) is preserved — no functionality lost. The git log confirms 03-04's stub commit is reachable and was extended, not replaced.

### Human Verification Required

5 items need human testing — see frontmatter `human_verification`. Automated checks all pass. Items focus on real browser/Worker behaviour that unit tests cannot exercise: deep-link refresh, 302 status from a running Worker, browser Back after solve, stale-day across system clock change, and a full archive replay smoke.

### Gaps Summary

No automated gaps. All 10 requirements traced to code; all 29 tests green; tsc and build clean; merge protocol stub-then-fill resolved correctly. Phase status pending the human smoke-checks listed above.

---

_Verified: 2026-05-03T13:19:26Z_
_Verifier: Claude (gsd-verifier)_
