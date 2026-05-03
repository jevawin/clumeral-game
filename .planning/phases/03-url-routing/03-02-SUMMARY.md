---
phase: 03-url-routing
plan: 02
subsystem: client-routing
tags: [route-resolver, pure-fn, rte-03, arc-03, wave-1]
requires:
  - vitest-runner
  - jsdom-env
provides:
  - resolve-route-module
  - route-type
  - resolve-ctx-type
  - is-valid-date-helper
affects:
  - tests/resolve-route.spec.ts (it.todo → real assertions)
tech-stack:
  added: []
  patterns:
    - "Pure resolver function — no DOM, history, or storage access"
    - "Discriminated union Route type for downstream router consumption"
key-files:
  created:
    - src/route-resolver.ts
  modified:
    - tests/resolve-route.spec.ts
decisions:
  - "Treat any /archive/<garbage> subpath as kind: 'archive' (not 'welcome' fallback) so users with malformed deep links land on the archive list rather than the welcome screen."
  - "isValidDate uses ISO round-trip to reject e.g. 2026-02-31, matching docs/CONVENTIONS.md date-validation pattern."
  - "Resolver imports HistoryEntry from src/types.ts only — strict client/worker boundary preserved."
metrics:
  duration: ~2 minutes
  completed: 2026-05-03
  tasks: 2
  commits: 2
---

# Phase 03 Plan 02: Pure Route Resolver Summary

Built a pure `resolveRoute(path, ctx)` in `src/route-resolver.ts` and replaced the 10 Wave 0 `it.todo` placeholders in `tests/resolve-route.spec.ts` with 11 passing assertions, encoding RTE-03 redirect rules and ARC-03 invalid/future date handling.

## Tasks Completed

| Task | Name                                              | Commit  | Files                                              |
| ---- | ------------------------------------------------- | ------- | -------------------------------------------------- |
| 1    | Create src/route-resolver.ts (pure resolver)      | 3687165 | src/route-resolver.ts                              |
| 2    | Replace it.todo with real assertions              | 847b31b | tests/resolve-route.spec.ts, src/route-resolver.ts |

## Verification Results

- `npx tsc --noEmit` → exit 0 (no type errors)
- `npx vitest run tests/resolve-route.spec.ts` → 11 passed / 0 failed
- `npm run build` → built in 74ms (49.92 kB JS, 38.94 kB CSS)
- `grep -c "export function resolveRoute" src/route-resolver.ts` → 1
- `grep -c "export function isValidDate" src/route-resolver.ts` → 1
- `grep -c "export type Route" src/route-resolver.ts` → 1
- `grep -c "export interface ResolveCtx" src/route-resolver.ts` → 1
- `grep -E "from './worker" src/route-resolver.ts` → no matches (worker boundary intact)
- `grep -E "document\.|window\.|localStorage|history\." src/route-resolver.ts` → no matches (zero side-effect API references)
- `! grep -E "it\.todo" tests/resolve-route.spec.ts` → no todos remain
- `grep -c "RTE-03:" tests/resolve-route.spec.ts` → 5 (≥ 5 required)
- `grep -c "ARC-03:" tests/resolve-route.spec.ts` → 6 (≥ 5 required)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] `/archive/<malformed-date>` resolved to `welcome` instead of `archive`**
- **Found during:** Task 2 (initial vitest run — the `ARC-03: /archive/not-a-date → archive` spec failed).
- **Issue:** The plan's reference resolver only matched `/archive/<YYYY-MM-DD>` shape; any other `/archive/*` subpath fell through to the final unknown-path fallback returning `welcome`. The acceptance test (and ARC-03 intent) requires malformed dates to land on the archive list.
- **Fix:** Added `path.startsWith('/archive/')` to the bare-archive check. After regex match for valid dates, any other `/archive/*` subpath returns `{ kind: 'archive' }`.
- **Files modified:** `src/route-resolver.ts`
- **Commit:** 847b31b (folded into Task 2)

### Process Deviation (not code)

**Rebased worktree onto local `new-design`** — the worktree was created from `main` (78d2206), which lacks `.planning/phases/03-url-routing/`. Rebased `worktree-agent-afdd5d6c42b67aabd` onto local `new-design` (eb3de40, includes Plan 01) before executing. Clean fast-forward, no conflicts. Identical pattern to Plan 01's process deviation.

**Header comment softened** — original plan-supplied header read "NO DOM, NO history, NO localStorage" which tripped the `grep -E "document\.|window\.|localStorage|history\."` purity check on its own comment text. Reworded to "No side effects, no I/O." Behaviour unchanged.

## Authentication Gates

None.

## Threat Flags

None — pure function, zero new network surface, zero auth paths, zero schema changes.

## Known Stubs

None — `tests/router.spec.ts` and `tests/completion-links.spec.ts` still hold `it.todo` placeholders, but those belong to Plans 03 and 06 respectively, per the Wave plan. They are tracked in 03-VALIDATION.md.

## Next Steps

- Plan 03 (router DOM module) imports `resolveRoute` and `Route` from this module, fills the 12 `tests/router.spec.ts` todos.
- Plan 06 (completion links) consumes `Route` for the dated-archive link target logic.

## Self-Check: PASSED

- src/route-resolver.ts → FOUND
- tests/resolve-route.spec.ts → FOUND (no todos, 11 passing tests)
- Commit 3687165 → FOUND in `git log`
- Commit 847b31b → FOUND in `git log`
