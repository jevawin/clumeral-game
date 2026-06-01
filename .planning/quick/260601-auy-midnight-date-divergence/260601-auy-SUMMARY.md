---
quick_id: 260601-auy
slug: midnight-date-divergence
date: 2026-06-01
status: complete
branch: fix/midnight-date-divergence
---

# Quick Task 260601-auy — Summary

Fixed two bugs reported by a friend testing `new-design` on Cloudflare.

## Root causes

**A — client LOCAL vs worker UTC date divergence (bugs 1-3).** The worker keyed
the daily puzzle on UTC (`handleGetPuzzle`/`todayUTC`); the client keys
completion and streak on LOCAL date (`date.ts` `todayKey`). For a UK BST (UTC+1)
player between 00:00–01:00 local, the worker still served yesterday's UTC puzzle
while the solve was recorded under that worker date — but `todayEntry()` looked
it up under the LOCAL date and found nothing. Symptoms: already-solved puzzle
shown as not-completed; Stats link (`/solved`) bouncing to the welcome/how-to
screen; a midnight-window solve mis-dated, holing the run and resetting the
streak (the "5"). The archive-testing theory was a red herring — incomplete
games never call `recordGame`.

**B — stale SSR archive brand (bug 4).** Quick task 260531-vwi made the SPA brand
a no-nav bounce button but missed the worker-rendered `/archive` page, which
still shipped `<a href="/" class="brand">` → full nav to `/` → resolved to the
welcome (how-to) screen.

## Fix

Made the LOCAL date canonical end-to-end:
- `src/app.ts` — `loadPuzzle()` sends `?date=${todayKey()}` to `/api/puzzle`.
- `src/worker/index.ts` — `handleGetPuzzle(env, url)` honours an in-range
  `?date=` (guarded by `isFuturePuzzleDate`, which allows today+1 for
  ahead-of-UTC players, #205) and falls back to `todayUTC()` for
  missing/future/malformed values. Response now sends `Cache-Control: no-store`.
- `src/worker/puzzles.ts` — archive brand is now a no-nav `<button>` with a
  reduced-motion-aware CSS bounce + a `:focus-visible` ring.

Now the served puzzle, `recordGame`, `todayEntry`, and streak all key on the
same local day.

## Commits
- `fix(260601-auy): /api/puzzle honours client local ?date= (in-range)`
- `fix(260601-auy): client sends local date to /api/puzzle`
- `fix(260601-auy): archive logo bounces in place, no nav to how-to`
- `test(260601-auy): regression suite for midnight date divergence + archive brand`
- `fix(260601-auy): address DA review — focus ring, no-store, mirror test`

## QA / gates
- Unit: `npm test` → 104/104.
- E2E (production build): `npx playwright test` → 16/16, incl. the new
  `e2e/midnight-rollover.spec.ts` (8 cases: worker in-range/future/malformed,
  client local-date request, negative-offset mirror, solved recognition, stats
  link, archive bounce).
- DA review (fresh-context subagent): no Medium+ findings. Low items resolved:
  focus ring, `no-store`, mirror test. Deferred (justified): brand-as-button
  a11y semantics — kept for SPA parity.
- Self-review: passed (comments match code, rename propagated, no schema/answer
  leak, sw.js network-only for `/api/*` unchanged).

## Deferred
- `/api/puzzle` button-with-no-action a11y semantic — inherited SPA pattern; keep
  for parity, revisit if the brand interaction is reconsidered.

## Branch / merge
Branch `fix/midnight-date-divergence` off `new-design`. PR opened; NOT merged
(user merges on GitHub).
