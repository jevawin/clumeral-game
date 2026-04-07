# Conventions

## Accessibility (WCAG 2.1 AA)

- Semantic HTML, ARIA only where semantics insufficient
- Contrast: 4.5:1 text, 3:1 large text / UI
- Keyboard nav: Tab / Enter / Escape
- No info by colour alone
- Touch targets ≥ 44px

## Code separation

- `puzzle.ts` — filter/compute only, no UI
- `app.ts` — UI only, no compute logic
- `bubbles.ts` — owns its canvas
- `src/worker/` ↔ client modules: no cross-imports

## UI / stack

- No framework. Vite + TS + ES modules
- Icons: Lucide
- Notifications: auto-dismiss toast (~3s), not modals
- No PII — never collect/store/transmit

## DOM patterns

- Selectors use `data-*` attributes (e.g. `[data-digit]`, `[data-htp-btn]`), NOT IDs. Don't introduce new IDs — use `data-*`.
- Event listeners attached at module level in `app.ts`. Never inside `startDailyPuzzle`.
- `gameState` = module-scoped `let` in `app.ts`. Never on `window`.

## GitHub labels

- Lowercase words: `roadmap`, `gameplay`, `hygiene`, `accessibility`
- Uppercase acronyms: `P1`, `P2`, `P3`, `UI/UX`, `SEO`

## Testing notes

- Safari tab nav requires **Option+Tab**. If user reports tabbing broken, check this first.
