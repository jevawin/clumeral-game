---
name: da-build
description: Use as a fresh-context subagent to devil's-advocate review changed code, after human review and before pushing
---

# DA — Build

Devil's advocate. Fresh context. Assume the code is wrong until proven otherwise. Walk
every item against every changed file.

You run **after** the human review and **before** the push, so you are the QA pass ahead of
CI smoke testing.

## Against the brief — check this first

Read `docs/work/*-brief.md` and `docs/work/*-plan.md` on this branch.

- [ ] Does the code do what the brief's numbered items say, item by item?
- [ ] Anything built that the brief does not contain?
- [ ] Anything in §2 out-of-scope that got built anyway?
- [ ] §10 analytics: are the agreed events actually fired, with the agreed properties?
- [ ] §11 done/test plan: does a test exist for each stated criterion?
- [ ] §5 state and persistence: does the implementation use what was agreed — the exact
      storage mechanism, not a convenient substitute?

## If you find a Medium+ after the human review

Say so plainly. It is fixed, re-reviewed by a fresh `da-build` subagent, and the change
reported to Jamie — it does NOT go back for a full second human review. Making the human
re-review the whole diff every time the bot finds its own mistake makes them the bottleneck
on it.

## Architecture & separation

- [ ] `puzzle.ts`: no UI code
- [ ] `app.ts`: no filter/compute logic
- [ ] DOM manipulation only in `app.ts` (except `bubbles.ts` for its canvas)
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

- [ ] New colours use `light-dark(lightVal, darkVal)` with both values — **except** in SVG `fill`/`stroke` keyframes, where Lightning CSS rewrites `light-dark()` to two concatenated `var()`s (invalid paint → falls back to black). There, use paired custom props swapped per theme on `:root` / `html.dark`. See `@keyframes octo-colours` (#210).
- [ ] Accent never hardcoded — uses `--color-accent`
- [ ] No fixed breakpoints — fluid via `max-width` + relative units
- [ ] No `!important` unless overriding third-party
- [ ] Works in both light and dark

## Clue display

- [ ] Boolean: `[subject] [is [not] predicate]`
- [ ] Numeric: `[label] [operator] [value]`
- [ ] Operators rendered: `≤` `≥` `≠` `=` (not ASCII)

## Data & privacy

- [ ] No PII collected/stored/transmitted
- [ ] localStorage uses `dlng_` prefix
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
