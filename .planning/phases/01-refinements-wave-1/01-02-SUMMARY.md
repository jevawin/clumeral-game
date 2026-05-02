---
phase: 01-refinements-wave-1
plan: 02
subsystem: ui
tags: [tailwind, css, header, menu, accessibility]

requires:
  - phase: 01-refinements-wave-1
    provides: Phase 1 CSS layer + tailwind v4 token surface (already in place pre-plan)
provides:
  - Game header reduced to title + burger only (no puzzle #/date subline)
  - 3-item burger menu (Archive removed)
  - menu-item class hook + accent-green hover/focus-visible rule
affects: [01-03, future header/menu work]

tech-stack:
  added: []
  patterns:
    - "menu-item class hook in [data-menu] for hover/focus-visible color transitions"

key-files:
  created: []
  modified:
    - index.html
    - src/tailwind.css

key-decisions:
  - "Leave dom.plabel cache + writers in src/app.ts intact — null-safe writes silently no-op; deferred dead-code cleanup avoids unrelated diff in this plan."
  - "Set inner svg class to text-text (was text-muted) so icons inherit menu-item color and follow accent on hover (sprites.svg already uses currentColor — verified 8 occurrences)."

patterns-established:
  - "Menu item hover: change color only, never background — applied via [data-menu] .menu-item rule."

requirements-completed: [HDR-01, MNU-01, MNU-02, MNU-03]

duration: 1 min
completed: 2026-05-02
---

# Phase 01 Plan 02: Header Trim + Burger Menu Polish Summary

**Stripped puzzle-# subline from the game header and rebuilt the burger menu hover behaviour — Archive removed, no hover background, text/icon transition to accent green via a new `menu-item` class hook.**

## Performance

- **Duration:** 1 min
- **Started:** 2026-05-02T20:13:32Z
- **Completed:** 2026-05-02T20:14:39Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- HDR-01: `<span data-plabel>` removed from `index.html` game header. Header now contains only the inline-SVG octopus, "Clumeral" wordmark, and the burger button.
- MNU-01: Archive `<a href="/puzzles">` item (with `icon-archive` svg) deleted. Worker `/puzzles` SSR route untouched per backend-untouched constraint.
- MNU-02: `hover:bg-bg` utility removed from the three remaining menu items. New `menu-item` class hook added to each.
- MNU-03: New CSS rule in `src/tailwind.css` `@layer base`: `[data-menu] .menu-item` keeps background transparent on hover/focus-visible and switches `color` to `var(--color-accent)`. Inner `<svg>` uses `class="text-text"` and the rule sets `color: inherit` on the svg, so icons follow the parent color (sprite paths use `currentColor` — confirmed via `grep -c 'currentColor' public/sprites.svg` = 8). `prefers-reduced-motion` disables the color transition.

## Task Commits

Each task was committed atomically:

1. **Task 1: Drop puzzle # from game header (HDR-01)** — `3fc2110` (feat)
2. **Task 2: Polish burger menu (MNU-01/02/03)** — `753e757` (feat)

**Plan metadata:** _pending_ (this SUMMARY commit)

## Files Created/Modified

- `index.html` — Removed `<span data-plabel>` from game header; removed Archive menu item; replaced `hover:bg-bg` with `menu-item` class on the 3 remaining items; swapped inner svg `text-muted` to `text-text`.
- `src/tailwind.css` — Added `[data-menu] .menu-item` block in `@layer base`: transparent background, `color: var(--color-accent)` on `:hover` / `:focus-visible`, `color: inherit` on inner svg, reduced-motion guard.

## Decisions Made

- **Keep `src/app.ts` plabel code intact.** The DOM cache (`plabel: $('[data-plabel]') as HTMLElement | null`) plus the four writer sites are already null-guarded; once the markup is gone, `dom.plabel` resolves to `null` and writes silently no-op. Removing them now would expand the diff surface and risk breakage in random-puzzle / daily-puzzle flows. Treat as dead-code cleanup for a future v1.1 plan.
- **Use `text-text` (not `currentColor`) on menu item svgs.** With the `[data-menu] .menu-item svg { color: inherit }` rule, the svg inherits the parent's text color whether the element is hovered or resting — keeps the rule local to `[data-menu]` and avoids a global svg cascade.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- **Plan acceptance criterion mismatch (cosmetic, not a deviation):** Task 1's spec said `grep -c 'data-plabel' src/app.ts` should return ≥3. Actual result is 1 (only the cache-line selector contains the literal string `data-plabel`; the four writer sites reference `dom.plabel`, not `data-plabel`). Plan author miscounted. Intent ("cache + writer code stays") is satisfied — `app.ts` is unchanged, build passes, runtime is null-safe.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 01-03 already merged ahead of this one in the wave (commit `e71473f`); the next outstanding plan in this phase will be picked up by `/gsd:execute-phase`.
- Header and menu surface area is now clean for any future v1.1 menu/header items (theme polish, share button, etc.).

## Self-Check

- [x] `index.html` exists and contains no `data-plabel` (`grep -c 'data-plabel' index.html` = 0).
- [x] `index.html` contains no `icon-archive` and no `hover:bg-bg` (both = 0); `menu-item` count = 3; interactive children of `[data-menu]` = 3.
- [x] `src/tailwind.css` contains `[data-menu] .menu-item:hover` rule (count = 1) and `color: var(--color-accent)` (count = 8 across file).
- [x] `npm run build` exits 0.
- [x] Commits `3fc2110` and `753e757` present in `git log --oneline`.

## Self-Check: PASSED

---
*Phase: 01-refinements-wave-1*
*Completed: 2026-05-02*
