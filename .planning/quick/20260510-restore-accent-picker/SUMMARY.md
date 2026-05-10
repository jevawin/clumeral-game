---
slug: restore-accent-picker
status: complete
phase: 04-pre-ship-polish
roadmap-item: 5
completed: 2026-05-10
---

# Restore accent-colour picker — complete

Inline 4-swatch picker (Lime/Berry/Blue/Violet) added under theme toggle in burger menu. Default Lime. Persists in `dlng_colour`. Theme toggle re-applies accent for current mode. Favicon swaps per colour+mode. Menu reordered: Feedback → How to play → Light/Dark → swatches.

## Files
- `src/colours.ts` (new)
- `src/theme.ts` (`window._refreshAccent` hook)
- `src/app.ts` (`initColours()` after `initTheme()`)
- `src/global.d.ts` (window types)
- `index.html` (menu order + `[data-swatches]`)
- `src/tailwind.css` (`.swatch-btn` + active ring)
- `.planning/PROJECT.md` (constraint relaxed)

## Verified
- 4 swatches, ~24px dots, 2px ring on active.
- Click updates `--color-accent`, persists, swaps favicon.
- Theme toggle keeps accent in sync (light↔dark variant).
- Reload preserves choice.
- ARIA radiogroup/radio.
