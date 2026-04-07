# Self-Review Checklist

Line-level accuracy check. Runs after DA review, before PR. Read every changed file (`git diff staging...HEAD`).

Complements DA-REVIEW (architecture). This owns line-level details: stale values, wrong strings, copy-paste errors.

## Code accuracy

- [ ] Comments match what the code does (stale comments = #1 miss)
- [ ] Renames updated everywhere including comments
- [ ] Unused function params removed
- [ ] Hardcoded values (dates, counts, versions) match current state

## CSS accuracy

- [ ] New custom props use `light-dark()` for theme-aware values
- [ ] Using existing vars (`--acc`, `--text`, `--muted` etc), not hardcoded hex
- [ ] Works in `color-scheme: light` and `dark`
- [ ] `font-family` uses DM Sans (body) / Inconsolata (mono)
- [ ] No orphaned rules targeting removed/renamed elements

## HTML accuracy

- [ ] Semantic tags (`<button>`, `<a>`, `<header>`, `<section>`), not generic `<div>`/`<span>`
- [ ] `aria-label`, `aria-live`, `role` present where needed
- [ ] New selectors use `data-*`, not IDs
- [ ] Elements inside correct parent container

## Clue & display

- [ ] Boolean clue text matches `is [not] predicate` exactly
- [ ] Operator symbols are Unicode: `≤` `≥` `≠` `=`
- [ ] Rendering handles both `type: 'text'` and `type: 'numeric'`

## localStorage

- [ ] Keys use `dlng_` prefix (or existing `cw-htp-seen`)
- [ ] JSON shape matches existing readers — no breaking schema changes
- [ ] `max 60` history limit still enforced

## Consistency

- [ ] No duplicated constants across files — single source of truth
- [ ] Same fix applied everywhere it's needed (app.ts AND style.css etc)
- [ ] No unused imports

## Worker / SW

- [ ] API responses never leak the answer
- [ ] `sw.js` cache versioning aligned with changed assets
- [ ] No accidental caching of API responses (puzzle data / guess validation must be fresh)
