# Phase 3: Game Screen + Menu - Context

**Gathered:** 2026-04-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the complete game screen inside the `[data-screen="game"]` shell — clues, digit boxes, number pad, submit button, feedback, guess history, and stats — all rebuilt from scratch in Tailwind CSS. Add a sticky header with logo, puzzle number, and hamburger dropdown menu (light/dark toggle, archive, feedback trigger, how-to-play). Remove old game markup from `index.html`. No gameplay regressions — clue rendering, digit elimination, guess submission, and server-side validation must all work exactly as before.

</domain>

<decisions>
## Implementation Decisions

### Clue Presentation
- **D-01:** Keep the current clue format — property type label, highlighted digit box indicators showing which positions the clue applies to, clue text, and operator+value on a second line in bold accent colour.
- **D-02:** No card wrapper around the clue list — clues render directly on the background (GAM-01).
- **D-03:** Keep skeleton loaders while the puzzle fetches — placeholder shapes matching the clue layout.

### Game Header
- **D-04:** Sticky header bar with three elements: "Clumeral" logo text (left), puzzle number (centre or beside logo), hamburger menu trigger (right).
- **D-05:** Subtle bottom border (border token colour) separating header from content.
- **D-06:** Header stays pinned at the top when scrolling on small screens.

### Menu Style
- **D-07:** Hamburger icon in header opens a dropdown/popover with four items: light/dark toggle, archive link, feedback trigger, how-to-play link.
- **D-08:** Menu closes on tap outside AND has a close button (both dismissal methods).
- **D-09:** Menu uses existing SVG icons from `public/sprites.svg` (moon/sun, archive, feedback, help).

### Migration Approach
- **D-10:** Rebuild game markup from scratch inside `[data-screen="game"]` — new HTML, Tailwind classes, new data attributes.
- **D-11:** Remove old game markup from `index.html` (the `<div id="puzzle" class="card">` block and surrounding elements) — don't just hide it.
- **D-12:** Update `app.ts` DOM cache and render functions to target the new elements.
- **D-13:** Drop the hint text ("Tap a box to eliminate possible numbers") — players get guidance from the welcome screen how-to-play.

### Claude's Discretion
- Digit elimination visual treatment (cross-out, fade, strikethrough — pick what fits the new layout)
- Dark mode toggle style in dropdown (labelled switch vs icon swap)
- Spacing, padding, and responsive adjustments
- Exact header layout proportions (logo/puzzle/hamburger sizing)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design & Styling
- `docs/DESIGN-SYSTEM.md` — Current token definitions, clue display rules. Clue format is preserved; card wrapper is dropped.
- `src/tailwind.css` — Tailwind v4 entry point with @theme tokens (created in Phase 1).
- `src/style.css` — Legacy CSS. Reference for current clue, keypad, digit box, and feedback styling.

### Architecture & Conventions
- `docs/ARCHITECTURE.md` — App structure, data flow, module boundaries. Game logic lives in `app.ts`.
- `docs/CONVENTIONS.md` — Code patterns, naming, DOM cache pattern with data attributes, accessibility.

### Game Logic (the core being rewired)
- `src/app.ts` — Main game logic: DOM cache, render functions (`renderClues`, `renderBox`, `renderFeedback`), event handlers (`handleGuess`), module state (`gameState`, `possibles`, `activeBox`).
- `src/modals.ts` — How-to-play modal (reference for menu "Guide" link), feedback modal (reference for menu "Feedback" trigger).
- `src/theme.ts` — Theme toggle logic. Menu needs to call this.

### Screen State Machine
- `src/screens.ts` — `showScreen()`, `initScreens()`, `getCurrentScreen()`. Game screen transitions from welcome.

### Existing Markup (being replaced)
- `index.html` (lines 294–390) — Current game markup inside `<div id="puzzle" class="card">`. This entire block gets removed and rebuilt in the new screen shell.
- `index.html` (lines 392–432) — Current footer with Guide/Feedback/Archive/Theme links. These items move into the hamburger dropdown.

### Assets
- `public/sprites.svg` — SVG sprite sheet with icons: help, feedback, archive, moon, sun, heart, check, etc.

### Codebase Maps
- `.planning/codebase/STRUCTURE.md` — Directory layout and file purposes.
- `.planning/codebase/CONVENTIONS.md` — Naming patterns, code style, module design.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/screens.ts` — `showScreen("game")` handles transition. Game screen just needs content.
- `public/sprites.svg` — All icons needed for the menu (help, feedback, archive, moon, sun) already exist.
- `src/theme.ts` — `initTheme()` and toggle logic. Menu's dark mode toggle calls into this.
- `src/app.ts:89` — `puzzleNumber()` function computes puzzle number from date. Needed for header display.

### Established Patterns
- DOM cache: `const dom = { ... }` with `querySelector('[data-*]')` at module init. New game elements follow this.
- Render functions: `renderClues()`, `renderBox()`, `renderFeedback()` — these get rewritten to target new markup.
- Section headers: `// --- Section Name ---` for visual separation.
- Data attributes for DOM selection, not class names.

### Integration Points
- `index.html` `[data-screen="game"]` — empty shell at line 443, content goes here.
- `app.ts` initialization — `loadPuzzle()` runs on page load, fetches puzzle data, calls render functions.
- `app.ts` DOM cache — must be updated to query new data attributes inside the game screen shell.
- `modals.ts` — feedback modal trigger needs wiring from the new menu.
- `theme.ts` — toggle needs wiring from the new menu.

</code_context>

<specifics>
## Specific Ideas

- Clue format preserved exactly: property type label, digit box indicators, clue text, operator+value in bold accent. Only the surrounding card is removed.
- "Clumeral" branding in the game header — keeps brand visible during gameplay.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 03-game-screen-menu*
*Context gathered: 2026-04-12*
