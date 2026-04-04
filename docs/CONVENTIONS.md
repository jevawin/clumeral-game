# Conventions

## Accessibility

All changes must meet WCAG 2.1 AA minimum:
- Semantic HTML, proper ARIA attributes
- Colour contrast: 4.5:1 normal text, 3:1 large text / UI components
- Keyboard navigable (Tab, Enter, Escape)
- No information conveyed by colour alone

## Code separation

- `puzzle.ts` — filter/compute logic only, no UI code
- `app.ts` — UI only, no filter/compute logic
- `confetti.ts` — confetti animation, owns its own canvas
- Worker code (`src/worker/`) must not import client-side modules and vice versa

## UI patterns

- No frontend framework — Vite + TypeScript with ES modules
- Icons: [Lucide](https://lucide.dev/)
- Notifications: toast/snackbar (auto-dismiss ~3s) — not modals
- No PII: never collect, store, or transmit personally identifiable information

## DOM constraints

- Event listeners attached at module level in `app.ts` — never inside `startDailyPuzzle`
- `gameState` is module-scoped `let` in `app.ts` — not a `window` global
- DOM IDs are locked — do not rename or remove existing IDs. New IDs must be added to this list:

`#cw` `#cw-canvas` `#cw-shape` `#cw-shape2` `#cw-inner` `#cw-header` `#cw-title` `#cw-sub` `#cw-card` `#cw-plabel` `#cw-digits` `#d0` `#d1` `#d2` `#cw-hint` `#cw-keypad-wrap` `#cw-keypad` `#cw-submit-wrap` `#cw-submit` `#cw-save` `#cw-ck` `#cw-feedback` `#cw-history` `#cw-history-list` `#cw-stats` `#cw-next` `#cw-next-number` `#cw-again` `#cw-foot-links` `#cw-tog` `#cw-htp-btn` `#cw-foot` `#cw-modal` `#cw-modal-box` `#cw-modal-close` `#cw-modal-gotit` `#octo-wrap` `#octo`

## GitHub labels

- Lowercase for words: `roadmap`, `gameplay`
- Uppercase for acronyms/codes: `P1`, `P2`, `P3`, `UI/UX`

## Testing notes

- **Safari tab navigation**: Safari requires **Option+Tab** to tab through all interactive elements. If the user reports "tabbing is broken", remind them to check Option+Tab before investigating.
