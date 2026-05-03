---
phase: 03-url-routing
plan: 05
subsystem: worker-routing
tags: [worker, routing, ssr, redirects, analytics]
requires:
  - 03-01
provides:
  - /archive (SSR list, renamed from /puzzles)
  - /archive/<YYYY-MM-DD> (SPA shell)
  - /welcome, /play, /solved (SPA shells)
  - 302 redirects from /puzzles and /puzzles/<num>
  - route_change analytics event allowlisted
affects:
  - src/worker/index.ts
  - src/worker/puzzles.ts
  - wrangler.jsonc
tech-stack:
  added: []
  patterns:
    - 302 redirect for renamed canonical paths
    - SPA fallback for client-router-owned paths
key-files:
  created: []
  modified:
    - src/worker/puzzles.ts
    - src/worker/index.ts
    - wrangler.jsonc
decisions:
  - 302 (not 301) for /puzzles -> /archive to avoid permanent browser caching while the rename settles.
  - /puzzles/<num> redirects via puzzleDate(num) so old links resolve to date-keyed URLs.
  - Kept /puzzles and /puzzles/* in run_worker_first so the redirect handler fires instead of Pages 404ing.
metrics:
  duration: ~12 min
  completed: 2026-05-03
---

# Phase 03 Plan 05: Worker rename, redirects, SPA fallback Summary

Worker now serves the renamed `/archive` SSR list, treats `/welcome`, `/play`, `/solved`, and `/archive/<YYYY-MM-DD>` as SPA shells, and 302-redirects the legacy `/puzzles` and `/puzzles/<num>` paths to their `/archive` equivalents. `route_change` is allowlisted in `VALID_EVENTS` so the client router can post navigation analytics without the Worker rejecting them.

## Tasks

| # | Task | Commit |
|---|------|--------|
| 1 | Rename `renderPuzzlesPage` to `renderArchivePage`; rewire SSR row + play + click links to `/archive/<date>` | 65aea05 |
| 2 | Worker: `/archive` route, `/puzzles` 302s, SPA fallback for new client routes, `route_change` in `VALID_EVENTS` | b965e94 |
| 3 | Extend `wrangler.jsonc` `run_worker_first` with new client routes | 8620259 |

## Verification

- `npm run build` exits 0.
- `npx vitest run` exits 0 (25 passed, 3 todo, 1 skipped).
- `npx tsc --noEmit` shows zero errors in `src/worker/*` (see Deferred Issues for unrelated `vite.config.ts` warnings).
- Plan acceptance greps all pass:
  - `renderArchivePage` present in `src/worker/puzzles.ts` (1) and `src/worker/index.ts` (import + call).
  - `renderPuzzlesPage` removed from both files.
  - 3 occurrences of `status: 302` in worker (one literal-Location for `/puzzles`, two for `/puzzles/<num>`).
  - `'route_change'` present once in `VALID_EVENTS`.
  - `/welcome`, `/play`, `/solved`, `/random`, `/archive` all matched as path equality checks.
  - `wrangler.jsonc` lists `/welcome`, `/play`, `/solved`, `/archive`, `/archive/*`, `/puzzles`, `/puzzles/*`, `/random`.

## Deviations from Plan

None — plan executed exactly as written.

## Deferred Issues

- **Pre-existing `vite.config.ts` TS errors:** `npx tsc --noEmit` reports `Cannot find name 'fs'` and `Cannot find name 'path'` in `vite.config.ts` (missing `@types/node`). These are unrelated to this plan's scope (worker routing) and existed before the change — `npm run build` succeeds via Vite's own type handling. Out of scope per the executor scope-boundary rule.

## Self-Check: PASSED

- FOUND: src/worker/puzzles.ts (renamed export, /archive links)
- FOUND: src/worker/index.ts (renamed import, /archive route + 302s + SPA fallback + route_change)
- FOUND: wrangler.jsonc (extended run_worker_first)
- FOUND commit: 65aea05
- FOUND commit: b965e94
- FOUND commit: 8620259
