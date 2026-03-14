# Definition of Done

## Code Quality

- No framework, no bundler — plain JS only
- `puzzle.js` contains only shared logic, no UI code
- `app.js` contains only UI code, no filter/compute logic
- Locked DOM IDs unchanged: `#status`, `#clues`, `#guess`, `#submit`, `#history`, `#feedback`, `#history-label`
- `gameState` remains module-scoped (not a `window` global)
- Event listeners attached at module level, not inside `startDailyPuzzle()`
- localStorage prefix `dlng_` unchanged

## Testing

- Manual browser test: `python3 -m http.server 8080` → `http://localhost:8080`
- Puzzle loads, clues render correctly, guess submission works, stats update
- If Worker-related change: verify on staging branch deploy

## Documentation

- Update `CLAUDE.md` if architecture, file roles, or conventions change
- Update `.clancy/docs/` if the change significantly alters what's documented

## Design

- Dark theme preserved (`--bg-deep: #0f0f1a`)
- Frosted glass card uses `rgba` background (required for `backdrop-filter` blur)
- Both `-webkit-backdrop-filter` and `backdrop-filter` present (Safari requires prefixed)
- Responsive breakpoint at 480px maintained
- CSS variable names from design system used — no hardcoded colours

## Accessibility

- Interactive elements have appropriate ARIA attributes (`role`, `aria-checked` etc.)
- Keyboard navigation preserved for input and submit

## Review

- Changes committed with correct commit type prefix
- PR opened and merged via GitHub
- Cloudflare Pages deployment confirmed post-merge
