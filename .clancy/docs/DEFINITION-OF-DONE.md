# Definition of Done

A feature or fix is done when all of the following are true:

## Code

- [ ] Implemented in the correct file per module boundaries (`puzzle.js` = logic only, `app.js` = UI only, `_worker.js` = edge only)
- [ ] No new `window` globals introduced — state stays in `gameState` or module scope
- [ ] DOM IDs not renamed (locked list in `CLAUDE.md`)
- [ ] `localStorage` keys still use `dlng_` prefix
- [ ] Event listeners attached at module level, not inside `startDailyPuzzle`

## Visual / UX

- [ ] Works on desktop and mobile (test at 480px breakpoint)
- [ ] Dark theme contrast maintained
- [ ] Frosted glass card has both `-webkit-backdrop-filter` and `backdrop-filter`
- [ ] Operator symbols display correctly (≤ ≥ = ≠) in coral
- [ ] No layout breakage in Chrome, Firefox, Safari

## Puzzle Integrity

- [ ] Same date seed still produces same puzzle (determinism preserved)
- [ ] `runFilterLoop` still terminates with exactly one candidate
- [ ] Daily and random puzzle flows both work

## Deployment

- [ ] Pushed to `main` branch
- [ ] Cloudflare Pages build passes (check Pages dashboard)
- [ ] `window.PUZZLE_DATA` present in production HTML source
- [ ] `/random` route works in production

## Process

- [ ] PR created with descriptive title and `Closes #N` if applicable
- [ ] Squash merged to `main`
- [ ] GitHub issue closed
