---
slug: restore-accent-picker
created: 2026-05-10
phase: 04-pre-ship-polish
roadmap-item: 5
---

# Restore accent-colour picker in top-corner menu

Restores the v1.0 accent picker (Berry/Blue/Lime/Violet) inline as 4 swatches under the theme toggle in the burger menu. Default Lime. Persists via `dlng_colour`. Fires icon swap and accent refresh on theme toggle.

## Files
- `src/colours.ts` (new)
- `src/theme.ts` — call `window._refreshAccent?.()` after applyTheme
- `src/app.ts` — import + `initColours()` after `initTheme()`
- `src/global.d.ts` — declare `_refreshAccent`, `_currentColour`
- `index.html` — `[data-swatches]` row in `#app-menu`
- `src/tailwind.css` — `.swatch-btn` + active ring
- `.planning/PROJECT.md` — relax "green accent only" line

## Acceptance
- 4 swatches visible in menu, dot ~24px.
- Active swatch shows 2px ring.
- Tap updates `--color-accent`, octo colour-cycle anchor, favicon.
- Theme toggle keeps accent in sync (light/dark variant).
- Reload preserves choice.
- ARIA `role=radiogroup` / `role=radio aria-checked`.
