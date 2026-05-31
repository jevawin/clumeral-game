---
quick_id: 260531-nua
slug: remove-range-clues-copy-from-play-screen
date: 2026-05-31
---

# Quick Task 260531-nua: Remove range + "Clues:" copy from play screen

## Description

Remove the "Work out the number from 100–999. **Clues:**" paragraph from the play (game) screen. Keep the equivalent copy on the home/welcome screen.

## Task

- **Files:** `index.html`
- **Action:** Delete the static `<p>` inside `<section data-screen="game">` (was line 198) plus its descriptive comment.
- **Keep:** `src/welcome.ts:130` ("Work out the number from 100–999") and the `<meta>` description tags — untouched.
- **Verify:** Copy gone from game screen; clue list still renders (it has its own `aria-label="Puzzle clues"`); no JS referenced the removed element (no `data-*` hook).
- **Done:** Game screen no longer shows the range/Clues line; welcome screen still does.
