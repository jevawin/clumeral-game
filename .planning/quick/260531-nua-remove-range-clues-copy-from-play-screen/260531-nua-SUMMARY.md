---
quick_id: 260531-nua
slug: remove-range-clues-copy-from-play-screen
date: 2026-05-31
status: complete
commit: 7abc418
---

# Quick Task 260531-nua: Summary

## What changed

Removed the static paragraph `Work out the number from 100–999. **Clues:**` from the play screen (`<section data-screen="game">` in `index.html`), plus its now-orphan comment.

## What was kept

- `src/welcome.ts:130` — welcome screen still shows "Work out the number from 100–999".
- `<meta>` description / og / twitter tags in `index.html` — unchanged.
- Clue list `aria-label="Puzzle clues"` provides the accessible label the deleted "Clues:" heading is no longer needed for.

## Verification

- Grep confirms the string now only remains in `src/welcome.ts` and meta tags.
- The removed `<p>` had no `data-*` attribute and no JS referenced it — nothing breaks.
- Single-file copy change — review gates not required per CLAUDE.md.

## Commit

`7abc418` — refactor(260531-nua): remove range + "Clues:" copy from play screen
