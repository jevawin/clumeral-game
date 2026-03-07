# David Lark's Lame Number Game

## What This Is

A single-page browser game that reads `data.csv` and generates a number-guessing puzzle through progressive data filtering. The player receives clues derived from randomly applied column filters and must guess the 3-digit answer (100–999) that remains after filtering narrows the dataset to one row.

## Core Value

The filtering logic must always converge to exactly one answer row and present clear, readable clues — if the puzzle breaks or gives no answer, the game is broken.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Load and parse `data.csv` client-side on page load
- [ ] Implement 6 named filter ranges matching the Google Sheets logic (SpecialNumbers cols 4-6, Sums cols 7-10, AbsoluteDifference cols 11-13, Products cols 14-17, Means cols 18-21, Range col 22)
- [ ] Filtering loop: pick random untried range, random column, random value from current candidates, random valid operator — skip if filter eliminates all candidates or column is uniform — continue until 1 row remains
- [ ] Operators: numeric supports `<=`, `=`, `!=`, `>=`; text supports `=`, `!=`
- [ ] Display 1–N clues (label, operator, value) once puzzle is solved
- [ ] Player enters a 3-digit guess and receives correct/incorrect feedback
- [ ] "New puzzle" button resets state and generates a fresh puzzle
- [ ] n8n-inspired dark UI: deep charcoal/near-black background, orange/pink accent colors, frosted glass cards with backdrop blur, clean sans-serif typography
- [ ] Deployable as a fully static site (no server — GitHub Pages compatible)

### Out of Scope

- Backend or server-side logic — data stays in the browser
- Score tracking or leaderboard — not requested
- Multiple difficulty modes — single mode only for v1
- Mobile-optimised layout — desktop-first for v1

## Context

- `data.csv` is already in the project root. Row 0 = labels, rows 1+ = data. Column 0 (Number) is the answer (100–999). Columns 1–3 are raw digit values. Columns 4–22 are the filterable ranges.
- The filtering algorithm is directly ported from a working Google Sheets Apps Script. The JS logic is already proven correct.
- Design reference: n8n.io — dark background (`#1a1a2e` range), orange/coral accents (`#ff6d5a`, `#ff914d`), frosted glass panels (`backdrop-filter: blur`), Inter or similar sans-serif.
- Hosted on GitHub Pages — output must be pure HTML/CSS/JS with no build step required.

## Constraints

- **Tech stack**: Vanilla HTML, CSS, JavaScript — no frameworks, no bundler, no dependencies
- **Data**: Must fetch `data.csv` via `fetch()` — works when served (GitHub Pages), not via `file://` protocol directly
- **Compatibility**: Modern browsers only (Chrome, Firefox, Safari latest) — no IE support needed

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Vanilla JS, no framework | Static hosting, no build step, minimal complexity | — Pending |
| fetch() for CSV loading | Works on GitHub Pages; simpler than embedding data in JS | — Pending |
| Port filtering logic 1:1 from Apps Script | Logic is proven correct; no need to redesign | — Pending |

---
*Last updated: 2026-03-07 after initialization*
