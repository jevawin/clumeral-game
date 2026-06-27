# Phase 2: Welcome + How-to-Play - Context

**Gathered:** 2026-04-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the complete welcome screen inside the existing `[data-screen="welcome"]` shell. Players land here on every visit and see the logo, octopus mascot, subtitle, puzzle number, how-to-play steps, and a play button. How-to-play placement adapts based on first vs return visit. Tapping Play transitions to the game screen (Phase 3 content).

</domain>

<decisions>
## Implementation Decisions

### Welcome Screen Layout
- **D-01:** Top-weighted vertical stack — logo and octopus pinned near the top, content flows down, play button sits in the bottom third. More breathing room on larger screens.
- **D-02:** Octopus is a larger standalone mascot element (80–120px), scaled up from the existing 53x52px inline SVG. Sits between title and subtitle as the visual centrepiece.
- **D-03:** Logo stays as a styled `<h1>` text element (DM Sans or Inconsolata — Claude's discretion on font choice). No separate logo asset.
- **D-04:** Subtitle text: "A daily number puzzle".
- **D-05:** Puzzle number displayed as "Puzzle #142" format — simple label, no date.
- **D-06:** Footer ("Made with heart by Jamie & Dave. (c) 2026.") appears on the welcome screen, consistent with Phase 1 FTR-01 requirement.

### How-to-Play Content
- **D-07:** Condensed 3-step summary displayed inline as numbered plain text in muted colour. No example clue, no cards, no dividers. One line per step.
- **D-08:** First visit (no `dlng_history` in localStorage): how-to-play steps appear ABOVE the play button.
- **D-09:** Return visit (`dlng_history` exists): how-to-play steps appear BELOW the play button, always visible (not collapsed or hidden).

### First-Visit Detection
- **D-10:** Use the existing `isNewUser` pattern — check whether `dlng_history` exists in localStorage. No game history = first visit. Matches existing code in `app.ts:25`.

### Play Button
- **D-11:** Filled accent button — solid green (accent token) background, white text, rounded corners. The most prominent element on screen.
- **D-12:** Button text: "Play" — single word, no puzzle number.
- **D-13:** Puzzle pre-fetches on page load (existing behaviour). Tapping Play calls `showScreen("game")` immediately — no loading state needed.

### Claude's Discretion
- Exact font choice for the logo heading (DM Sans vs Inconsolata)
- Exact octopus size within the 80–120px range
- Spacing and padding values between elements
- Responsive adjustments for mobile vs desktop
- The 3 how-to-play step texts (should match current content spirit: read clues, eliminate digits, guess the number)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design & Styling
- `docs/DESIGN-SYSTEM.md` — Current token definitions, theming approach. New welcome screen uses the 6 semantic tokens from Phase 1.
- `src/tailwind.css` — Tailwind v4 entry point with @theme tokens (created in Phase 1).

### Architecture
- `docs/ARCHITECTURE.md` — App structure, module boundaries. Welcome screen integrates with existing screen state machine.
- `docs/CONVENTIONS.md` — Code patterns, naming, DOM cache pattern with data attributes.

### Screen State Machine
- `src/screens.ts` — Screen state machine created in Phase 1. Exports `showScreen()`, `initScreens()`, `getCurrentScreen()`. Welcome is the default screen.

### Existing HTP & Detection
- `src/modals.ts` — Current how-to-play modal implementation (lines 8–42). Reference for the 3-step content that gets condensed.
- `src/app.ts` (line 25) — `isNewUser` detection pattern: `!localStorage.getItem("dlng_history")`.

### HTML Shell
- `index.html` (line 440) — The `[data-screen="welcome"]` section where content goes. Currently empty with "Phase 2 content" comment.

### Codebase Maps
- `.planning/codebase/STRUCTURE.md` — Directory layout and file purposes.
- `.planning/codebase/CONVENTIONS.md` — Naming patterns, code style, module design.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/screens.ts` — `showScreen("game")` transitions from welcome to game with cross-fade. Ready to wire to play button.
- Octopus SVG in `index.html` (lines 148–170) — Inline SVG that can be copied and scaled for the welcome screen mascot.
- `src/app.ts:25` — `isNewUser` boolean already computed on load. Can be imported or replicated for HTP placement logic.
- `src/app.ts:88` — `puzzleNumber()` function computes puzzle number from date string. Needed for "Puzzle #142" display.
- `public/sprites.svg` — Icon sprite sheet with heart icon (used in footer).

### Established Patterns
- DOM cache pattern: `const dom = { ... }` with `querySelector('[data-*]')` at module init.
- Section headers: `// --- Section Name ---` for visual separation.
- Data attributes for DOM selection, not class names.
- Render functions: `render*()` prefix for DOM-mutating functions.

### Integration Points
- `index.html` `[data-screen="welcome"]` section — empty shell, content goes here.
- `src/app.ts` initialization — needs to call welcome screen setup and wire play button.
- `src/screens.ts` — `initScreens()` already shows welcome as default screen.
- Puzzle fetch happens in `app.ts` `loadPuzzle()` on page load — no change needed for pre-fetch.

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches for layout and HTP presentation.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 02-welcome-how-to-play*
*Context gathered: 2026-04-11*
