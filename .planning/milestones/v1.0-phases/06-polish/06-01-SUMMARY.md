---
phase: 06-polish
plan: 01
subsystem: ui
tags: [tailwind, css-migration, dead-code-removal]

# Dependency graph
requires:
  - phase: 05-celebration-completion
    provides: octo celebration animation, completion screen
provides:
  - All style.css rules duplicated in tailwind.css with --color-* tokens
  - Canvas, shapes, and colours.ts dead code removed
  - JS files using --color-accent instead of --acc
affects: [06-02]

# Tech tracking
tech-stack:
  added: [tailwindcss/preflight]
  patterns: [data-attribute selectors for component styles in tailwind.css]

key-files:
  created: []
  modified:
    - src/tailwind.css
    - src/theme.ts
    - src/bubbles.ts
    - src/welcome.ts
    - src/app.ts
    - src/global.d.ts
    - index.html

key-decisions:
  - "Used data-attribute selectors ([data-octo-wrap]) instead of class selectors (.octo) for migrated rules"
  - "Kept light-dark() only inside @keyframes octo-colours mid-frames per UI-SPEC"

patterns-established:
  - "CSS migration pattern: duplicate rules in tailwind.css first, remove old CSS link in next plan"

requirements-completed: [STY-06]

# Metrics
duration: 3min
completed: 2026-04-15
---

# Phase 6 Plan 1: CSS Migration and Dead Code Removal Summary

**Migrated all style.css rules to tailwind.css with --color-* tokens, removed canvas/shapes/colours.ts dead code**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-15T20:09:28Z
- **Completed:** 2026-04-15T20:12:45Z
- **Tasks:** 2
- **Files modified:** 8 (7 modified, 1 deleted)

## Accomplishments
- All CSS rules style.css provides now have Tailwind equivalents in tailwind.css
- Canvas element, shape divs, and colours.ts colour picker removed
- All JS files reference --color-accent instead of --acc
- Tailwind preflight imported so CSS reset survives style.css removal

## Task Commits

Each task was committed atomically:

1. **Task 1: Migrate CSS rules and add preflight to tailwind.css** - `4c64d9a` (feat)
2. **Task 2: Remove dead code and fix JS token references** - `c6111a3` (feat)

## Files Created/Modified
- `src/tailwind.css` - Added preflight import, octo styles/keyframes, digit-correct, skip-link, checkbox toggle, HTP clue/worked example styles, recurring overdot, digit-box styles
- `src/theme.ts` - Removed drawCanvas function, _swapIcons reference, resize listener
- `src/bubbles.ts` - Changed --acc to --color-accent
- `src/welcome.ts` - Changed fill="var(--acc)" to fill="var(--color-accent)"
- `src/app.ts` - Removed initColours import and call
- `src/global.d.ts` - Removed _swapIcons and _currentColour declarations
- `index.html` - Removed canvas/shapes, changed octo SVG fill to --color-accent
- `src/colours.ts` - Deleted

## Decisions Made
- Used data-attribute selectors ([data-octo-wrap]) instead of class selectors (.octo) for migrated component rules — aligns with the new screen architecture's data-attribute pattern
- Kept light-dark() only inside @keyframes octo-colours mid-frames — these are intentional animation-only colours per UI-SPEC

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Pre-existing TypeScript errors in vite.config.ts (missing @types/node) surfaced during tsc --noEmit check. Not caused by this plan's changes. Out of scope.

## Known Stubs

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- style.css link is still in index.html (intentional — Plan 02 removes it)
- All Tailwind equivalents are in place, so Plan 02 can safely remove the style.css link tag

---
*Phase: 06-polish*
*Completed: 2026-04-15*
