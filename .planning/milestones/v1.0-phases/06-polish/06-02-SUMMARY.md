---
phase: 06-polish
plan: 02
subsystem: ui
tags: [tailwind, css, dark-mode, design-system]

requires:
  - phase: 06-01
    provides: All style.css rules migrated to tailwind.css
provides:
  - Legacy style.css fully removed
  - All HTML uses Tailwind utilities or data-attribute selectors
  - Updated DESIGN-SYSTEM.md with Tailwind v4 token documentation
affects: []

tech-stack:
  added: []
  patterns:
    - "Dark mode tokens in @layer theme (not @layer base) to beat @theme cascade"
    - "CSS sibling combinator for conditional element visibility"

key-files:
  created: []
  modified:
    - index.html
    - src/tailwind.css
    - src/app.ts
    - docs/DESIGN-SYSTEM.md

key-decisions:
  - "Moved dark mode overrides to @layer theme — @layer base loses to @theme in Tailwind v4 cascade"
  - "Converted .tlt class to data-tlt attribute — octo.ts queries it for letter reveal animation"
  - "Save score visibility via CSS sibling rule [data-submit-wrap]:not(.hidden) + [data-save] — matches old style.css pattern"

patterns-established:
  - "Dark token overrides must live in @layer theme to beat @theme :root declarations"

requirements-completed: [STY-06]

duration: 15min
completed: 2026-04-15
---

# Phase 6 Plan 02: Remove legacy CSS and convert wrapper HTML to Tailwind

**Deleted style.css, converted all BEM wrapper classes to Tailwind utilities, fixed dark mode cascade bug and save score checkbox visibility**

## Performance

- **Duration:** ~15 min
- **Tasks:** 2 (1 auto + 1 human-verify checkpoint)
- **Files modified:** 4

## Accomplishments
- Removed style.css entirely — only Tailwind-generated styles in build
- Converted wrapper/header BEM classes (game, game__inner, header, octo-slot, title) to Tailwind utilities
- Fixed dark mode regression: token overrides moved from @layer base to @layer theme
- Restored save score checkbox with cookie icon, SVG toggle, and CSS sibling visibility
- Updated DESIGN-SYSTEM.md to reflect Tailwind v4 token system

## Task Commits

1. **Task 1: Convert legacy wrapper HTML and remove style.css** - `c66e24f` (feat)
2. **Task 2: Visual regression fixes (dark mode + checkbox)** - `b9da450` (fix)

## Files Created/Modified
- `index.html` - BEM classes replaced with Tailwind utilities, style.css link removed, save row restored
- `src/tailwind.css` - Dark overrides moved to @layer theme, save visibility sibling rule added
- `src/app.ts` - Removed manual save?.classList.add("hidden") calls
- `docs/DESIGN-SYSTEM.md` - Updated token documentation for Tailwind v4

## Decisions Made
- Dark mode overrides moved to @layer theme because Tailwind v4's cascade ordering (base < theme < utilities) means @layer base can't override @theme tokens
- .tlt SVG class converted to data-tlt attribute instead of removal — octo.ts uses it for letter reveal animation
- Save score row uses CSS sibling rule rather than JS toggle — cleaner, matches original style.css approach

## Deviations from Plan

### Auto-fixed Issues

**1. [Bug] Dark mode tokens not applying**
- **Found during:** Task 2 (visual regression check)
- **Issue:** html.dark overrides in @layer base lost to @theme's :root in @layer theme
- **Fix:** Moved dark overrides to @layer theme where html.dark specificity beats :root
- **Files modified:** src/tailwind.css
- **Verification:** Dark mode fully applies — background, text, accent, surface all change
- **Committed in:** b9da450

**2. [Bug] Save score checkbox not visible**
- **Found during:** Task 2 (visual regression check)
- **Issue:** Save row had Tailwind `hidden` class, JS never removed it, CSS sibling rule from style.css wasn't migrated
- **Fix:** Removed hidden class, added CSS [data-save] default display:none with sibling override, restored cookie icon and full label
- **Files modified:** index.html, src/tailwind.css, src/app.ts
- **Verification:** Checkbox appears when submit button visible, SVG toggle works
- **Committed in:** b9da450

---

**Total deviations:** 2 auto-fixed (2 bugs found during human verification)
**Impact on plan:** Both were regressions from the CSS migration. Fixed during checkpoint review.

## Issues Encountered
None beyond the two regressions caught during visual review.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All legacy CSS removed, Tailwind-only styling
- Backlog items added to ROADMAP.md for post-milestone fixes (tooltip positioning, letter reveal, recurring overdot verification, animation replay)

---
*Phase: 06-polish*
*Completed: 2026-04-15*
