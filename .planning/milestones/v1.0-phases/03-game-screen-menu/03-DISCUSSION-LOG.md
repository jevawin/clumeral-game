# Phase 3: Game Screen + Menu - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-12
**Phase:** 03-game-screen-menu
**Areas discussed:** Clue presentation, Menu style, Game header, Migration wiring

---

## Clue Presentation

| Option | Description | Selected |
|--------|-------------|----------|
| Simple text rows | Each clue is a single line of text — clue number in muted colour, then text | |
| Subtle dividers | Text rows with thin muted border between clues | |
| Pill badges | Small accent-coloured pill for number, then clue text | |
| Other (free text) | Keep current format: label, digit indicators, clue text, operator+value | ✓ |

**User's choice:** Keep the current clue format — property type label, highlighted digit box indicators showing which positions apply, clue text, and operator+value on second line in bold primary colour. Just drop the card wrapper.

**Notes:** User wants the clue format preserved exactly. The only change is removing the surrounding card container.

### Follow-up: Skeleton loaders

| Option | Description | Selected |
|--------|-------------|----------|
| Skeleton loaders | Keep current pattern — placeholder shapes replaced when data arrives | ✓ |
| Simple spinner/text | "Loading puzzle..." or small spinner | |
| You decide | Claude picks | |

### Follow-up: Elimination visual

| Option | Description | Selected |
|--------|-------------|----------|
| Same as current | Tapped digits cross out or fade — restyle in Tailwind | |
| You decide | Claude picks best visual treatment | ✓ |

---

## Menu Style

| Option | Description | Selected |
|--------|-------------|----------|
| Hamburger dropdown | Hamburger icon opens small dropdown with four items. Clean game screen. | ✓ |
| Icon row in header | All four icons visible in header bar. No extra tap needed. | |
| Side drawer | Hamburger opens slide-in panel from right. | |

### Follow-up: Theme toggle style

| Option | Description | Selected |
|--------|-------------|----------|
| Labelled switch | Text label with toggle switch | |
| Icon swap | Sun/moon icon that swaps on tap | |
| You decide | Claude picks what fits dropdown best | ✓ |

### Follow-up: Dismissal

| Option | Description | Selected |
|--------|-------------|----------|
| Tap outside closes | Standard dropdown behaviour | |
| Both | Tap outside closes AND close button | ✓ |

---

## Game Header

| Option | Description | Selected |
|--------|-------------|----------|
| Puzzle label + hamburger | Left: "Puzzle #142". Right: hamburger. | |
| Logo + puzzle + hamburger | Left: "Clumeral" logo. Centre/beside: puzzle number. Right: hamburger. | ✓ |
| Just hamburger | Only menu trigger, maximum clean space. | |

### Follow-up: Sticky behaviour

| Option | Description | Selected |
|--------|-------------|----------|
| Sticky header | Stays pinned at top when scrolling | ✓ |
| Scrolls with content | Moves off screen as you scroll | |
| You decide | Claude picks | |

### Follow-up: Header edge

| Option | Description | Selected |
|--------|-------------|----------|
| Subtle border | Thin line in border token colour | ✓ |
| No border | Blends into background | |
| You decide | Claude picks | |

---

## Migration Wiring

| Option | Description | Selected |
|--------|-------------|----------|
| Move markup across | Move existing elements, restyle in Tailwind | |
| Rebuild from scratch | Write entirely new HTML, rewrite render functions | ✓ |
| You decide | Claude picks to minimise regression risk | |

### Follow-up: Old markup

| Option | Description | Selected |
|--------|-------------|----------|
| Hide it | Add hidden/display:none, remove in Phase 6 | |
| Remove it now | Delete old game markup from index.html | ✓ |
| You decide | Claude picks | |

### Follow-up: Hint text

| Option | Description | Selected |
|--------|-------------|----------|
| Between clues and digits | Keep hint in muted text, restyled | |
| Drop it | Players get guidance from welcome screen HTP | ✓ |
| You decide | Claude decides based on value | |

---

## Claude's Discretion

- Digit elimination visual treatment
- Dark mode toggle style in dropdown menu
- Spacing, padding, responsive adjustments
- Header layout proportions

## Deferred Ideas

None.
