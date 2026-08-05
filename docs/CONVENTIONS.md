# Conventions

## Accessibility (WCAG 2.1 AA)

- Semantic HTML, ARIA only where semantics insufficient
- Contrast: 4.5:1 text, 3:1 large text / UI
- Keyboard nav: Tab / Enter / Escape
- **A control that can become unavailable while focused uses `aria-disabled`, not the native
  `disabled` attribute** — and the handler no-ops instead. Browsers blur a natively-disabled
  element, so disabling one in response to its own press throws the user's focus to the top of
  the document. Announce the state and let the user move focus themselves; never move it for
  them. Used by the keypad's hundreds-box `0` and the undo/reset controls (#251).
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
  - **One exception:** ARIA relationship attributes (`aria-describedby`, `aria-labelledby`, `aria-controls`) take an IDREF, so their targets must carry an `id`. Add a `data-*` hook alongside it and query *that* — the `id` exists for ARIA, not for JavaScript. See `[data-undo-desc]` / `#undo-shortcut-desc`.
- Event listeners attached at module level in `app.ts`. Never inside `startDailyPuzzle`.
- `gameState` = module-scoped `let` in `app.ts`. Never on `window`.

## GitHub labels

- Lowercase words: `roadmap`, `gameplay`, `hygiene`, `accessibility`
- Uppercase acronyms: `P1`, `P2`, `P3`, `UI/UX`, `SEO`

## Testing notes

- Safari tab nav requires **Option+Tab**. If user reports tabbing broken, check this first.
