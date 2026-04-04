# DA Review Checklist

Structured checklist for the devil's advocate review agent. Walk every item against every changed file. Assume the code is wrong until proven otherwise.

This is a **living document** — when a review catches something the DA should have spotted, add the specific check here immediately.

---

## Architecture & separation

- [ ] No UI code in `puzzle.ts` (filter/compute logic only)
- [ ] No filter/compute logic in `app.ts` (UI only)
- [ ] No direct DOM manipulation outside `app.ts` (except `confetti.ts` for its canvas)
- [ ] Worker code (`src/worker/`) doesn't import client-side modules
- [ ] Client code doesn't import worker-only modules

## DOM & locked IDs

- [ ] No new DOM IDs introduced without updating the locked ID list in `CLAUDE.md`
- [ ] Existing locked IDs not renamed or removed
- [ ] Event listeners attached at module level in `app.ts` — never inside `startDailyPuzzle`
- [ ] `gameState` remains module-scoped `let` — not moved to `window`

## Accessibility (WCAG 2.1 AA)

- [ ] Colour contrast meets minimum ratios (4.5:1 normal text, 3:1 large text / UI components)
- [ ] New interactive elements are keyboard-navigable (Tab, Enter, Escape)
- [ ] Semantic HTML used (buttons for actions, links for navigation — not `<div onclick>`)
- [ ] ARIA attributes present where semantic HTML alone is insufficient
- [ ] Focus management correct after state changes (modals, feedback, game completion)
- [ ] No information conveyed by colour alone — text/icon/pattern alternative provided

## Theming & CSS

- [ ] New colours use `light-dark()` with both light and dark values
- [ ] New CSS variables added to the design system section in `CLAUDE.md`
- [ ] Accent colours use the existing `--acc` / `--acc-btn` variables — not hardcoded hex
- [ ] No fixed breakpoints — fluid layout via `max-width` and relative units
- [ ] No `!important` unless overriding third-party styles

## Clue display rules

- [ ] Boolean clues follow format: `[subject] [is [not] predicate]`
- [ ] Numeric clues follow format: `[label] [operator] [value]`
- [ ] Operator symbols rendered correctly: `<=` as `≤`, `>=` as `≥`, `!=` as `≠`

## Data & privacy

- [ ] No PII collected, stored, or transmitted
- [ ] localStorage keys use existing `dlng_` prefix — no new prefix schemes
- [ ] No new external network requests (analytics, tracking, third-party scripts)

## Puzzle integrity

- [ ] `runFilterLoop` determinism preserved — same seed always produces same puzzle
- [ ] `PROPERTIES` and `PROPERTY_GROUPS` structure unchanged unless intentional
- [ ] `EPOCH_DATE` not modified (would shift all puzzle numbers)
- [ ] RNG (`makeRng`) not modified unless fixing a proven bug

## Security

- [ ] No `innerHTML` with user-controlled or external data (XSS risk)
- [ ] No `eval()`, `new Function()`, or dynamic script injection
- [ ] Worker validates request paths — no open redirects
- [ ] Service worker (`sw.js`) cache strategy doesn't serve stale puzzle data as current

## Completeness

- [ ] Changes work in both light and dark themes
- [ ] Changes tested on mobile viewport (fluid layout, touch targets ≥ 44px)
- [ ] No dead code introduced (unused functions, unreachable branches)
- [ ] No `console.log` left in production code

## Severity handling

- **Medium+ findings:** must be fixed before proceeding
- **Low findings:** can be acknowledged and deferred with explicit justification
- If you disagree with a finding, articulate why — don't silently skip it
