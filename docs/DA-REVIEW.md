# DA Review Checklist

Devil's advocate review. Fresh-context subagent. Assume code is wrong until proven otherwise. Walk every item against every changed file.

## Architecture & separation

- [ ] `puzzle.ts`: no UI code
- [ ] `app.ts`: no filter/compute logic
- [ ] DOM manipulation only in `app.ts` (except `confetti.ts` for its canvas)
- [ ] `src/worker/` doesn't import client modules; client doesn't import worker modules

## DOM

- [ ] New selectors use `data-*` attributes, not IDs
- [ ] Event listeners at module level in `app.ts`, never inside `startDailyPuzzle`
- [ ] `gameState` stays module-scoped `let`, not on `window`

## Accessibility (WCAG 2.1 AA)

- [ ] Contrast: 4.5:1 text, 3:1 large text / UI
- [ ] New interactive elements keyboard-navigable (Tab/Enter/Escape)
- [ ] Semantic HTML (buttons for actions, links for nav — no `<div onclick>`)
- [ ] ARIA only where semantic HTML is insufficient
- [ ] Focus management correct after state changes (modals, feedback, completion)
- [ ] No info by colour alone — text/icon/pattern alternative present
- [ ] Touch targets ≥ 44px

## Theming & CSS

- [ ] New colours use `light-dark(lightVal, darkVal)` with both values
- [ ] Accent never hardcoded — uses `--acc` / `--acc-btn`
- [ ] No fixed breakpoints — fluid via `max-width` + relative units
- [ ] No `!important` unless overriding third-party
- [ ] Works in both light and dark

## Clue display

- [ ] Boolean: `[subject] [is [not] predicate]`
- [ ] Numeric: `[label] [operator] [value]`
- [ ] Operators rendered: `≤` `≥` `≠` `=` (not ASCII)

## Data & privacy

- [ ] No PII collected/stored/transmitted
- [ ] localStorage uses `dlng_` prefix (or existing `cw-htp-seen`)
- [ ] No new external network requests (analytics, tracking, third-party scripts)

## Puzzle integrity

- [ ] `runFilterLoop` determinism preserved
- [ ] `PROPERTIES` / `PROPERTY_GROUPS` unchanged unless intentional
- [ ] `EPOCH_DATE` not modified
- [ ] `makeRng` not modified unless fixing proven bug

## Security

- [ ] No `innerHTML` with user-controlled or external data (XSS)
- [ ] No `eval`, `new Function`, dynamic script injection
- [ ] Worker validates paths — no open redirects
- [ ] Answer never sent to client (check API responses)
- [ ] `sw.js` cache doesn't serve stale puzzle data as current

## Completeness

- [ ] Works in both themes
- [ ] Mobile viewport tested (fluid, touch targets)
- [ ] No dead code (unused functions, unreachable branches)
- [ ] No `console.log` in production code

## Severity

- **Medium+**: must fix before proceeding
- **Low**: can defer with explicit justification
- Disagree with a finding? Articulate why. Don't silently skip.
