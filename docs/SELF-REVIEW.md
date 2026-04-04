# Self-Review Checklist

Line-level accuracy check performed after DA review but before creating a PR. Read every changed file (`git diff staging...HEAD`) and check for detail-level issues that the DA misses.

This checklist complements DA-REVIEW.md — DA owns architectural checks (separation, accessibility, security). Self-review owns line-level accuracy (stale values, wrong strings, copy-paste errors).

This is a **living document** — when a review catches something the self-review should have spotted, add the specific check here immediately.

---

## Code accuracy

- Do comments match what the code actually does? (stale comments are the #1 review catch)
- After renaming a variable or function, are all references updated — including comments?
- Are all function parameters used? Remove unused params
- Do hardcoded values (dates, counts, version strings) match the actual current state?

## CSS accuracy

- Do new CSS custom properties follow the `light-dark()` pattern for theme-aware values?
- Are colour values using existing variables (`--acc`, `--text`, `--muted`, etc.) instead of hardcoded hex?
- Do new styles work with both `color-scheme: light` and `color-scheme: dark`?
- Are `font-family` values using the existing stacks (DM Sans for body, Inconsolata for monospace)?
- No orphaned CSS rules targeting removed/renamed elements

## HTML accuracy

- Do new elements use semantic tags (`<button>`, `<a>`, `<header>`, `<section>`) not generic `<div>`/`<span>`?
- Are `aria-label`, `aria-live`, and `role` attributes present where needed?
- Do IDs match what the JS expects? (check locked ID list in CLAUDE.md)
- Are new elements inside the correct parent container?

## Clue & display logic

- Boolean clue text follows the `is [not] predicate` pattern exactly
- Operator symbols use Unicode: `≤` `≥` `≠` `=` — not ASCII `<=` `>=` `!=`
- Clue rendering matches both `type: 'text'` and `type: 'numeric'` formats

## localStorage

- Keys use the `dlng_` prefix (or existing `cw-htp-seen` key)
- JSON shapes match what existing code reads — no breaking schema changes
- `max 60 entries` limit on history still enforced

## Consistency

- Are constants duplicated across files? (single source of truth)
- Was the same fix applied everywhere it's needed? (don't fix `app.ts` but miss `style.css`)
- Are imports unused?

## Worker / service worker

- Does the Worker still inject `window.PUZZLE_DATA` correctly for both `/` and `/random` routes?
- Does `sw.js` cache versioning align with any changed assets?
- No accidental caching of puzzle data (daily puzzles must be fresh)
