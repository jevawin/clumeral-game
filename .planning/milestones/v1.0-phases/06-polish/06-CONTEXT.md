# Phase 6: Polish - Context

**Gathered:** 2026-04-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Remove all legacy CSS (style.css), convert remaining old BEM classes to Tailwind utility-first approach, clean up dead code (colours.ts, canvas element, shape elements), and verify no visual regressions across all screens in both themes.

</domain>

<decisions>
## Implementation Decisions

### Background Decorations
- **D-01:** Drop both the canvas dot-grid and geometric shape overlays entirely. Clean bg-colour-only backgrounds match the Wordle-inspired minimal design.
- **D-02:** Delete `src/colours.ts` — it only handles canvas dot rendering and colour swatches, both gone in the new design.
- **D-03:** Remove `<canvas data-canvas>` and `.game__shape` elements from `index.html`.

### Old Class Cleanup
- **D-04:** Convert all old BEM class names (.game, .header, .octo, .digit-box, etc.) to Tailwind utility classes inline in the HTML. Fully utility-first — no mixed approach.
- **D-05:** JS DOM selectors that use old class names must switch to `data-*` attributes (consistent with newer code pattern: data-octo-wrap, data-fb-modal, etc.). Styling fully decoupled from behaviour hooks.

### Regression Checking
- **D-06:** Manual browser walkthrough of every screen (welcome, game with clues + input, completion, modal open, menu open) in both light and dark mode at mobile and desktop viewports. User does final sign-off.
- **D-07:** Extra attention on octo animation (celebration + click-to-replay) — currently styled in style.css with complex positioning and keyframes.
- **D-08:** Extra attention on clue digit indicators — small digit boxes showing which positions a clue applies to have intricate styling.

### Claude's Discretion
- Migration order (which components to convert first) and intermediate testing approach left to planner.
- Whether to batch the HTML class conversion or do it element-by-element — planner decides based on risk.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design System
- `docs/DESIGN-SYSTEM.md` — Semantic colour tokens, spacing, typography rules for the redesigned UI
- `docs/CONVENTIONS.md` — Code patterns, accessibility, DOM conventions

### Current CSS Files
- `src/style.css` — The 1,541-line legacy CSS being removed (reset, tokens, layout, components, utilities layers)
- `src/tailwind.css` — The 102-line Tailwind config to keep and extend (tokens, modal, toast, pill styles)

### Architecture
- `docs/ARCHITECTURE.md` — Module boundaries, data flow, entry points — important for understanding which JS files reference old CSS classes

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/tailwind.css` already has modal dialog styles, toast, category pill selected state, and warn utility — these stay as-is
- Data attribute pattern (`data-octo-wrap`, `data-fb-modal`, `data-fb-cats`, etc.) already established in newer HTML — extend this to remaining old class-based selectors

### Established Patterns
- Tailwind v4 with `@theme` tokens and `@custom-variant dark` — all new styles follow this
- `@layer base` for component-level CSS that can't be pure utilities (dialog transitions, backdrop)
- `@layer utilities` for small reusable rules (`.warn`, `.toast-msg`, `.fb-cat`)

### Integration Points
- `index.html` line 31: `<link rel="stylesheet" href="/src/style.css" />` — remove this link
- `src/colours.ts` — imported by `src/app.ts` or `src/theme.ts` for canvas init; remove import + calls
- `src/app.ts` — DOM cache uses `querySelector` with old class names; update to data-attribute selectors
- `src/octo.ts` — references `.octo`, `.celebrating` classes; needs Tailwind conversion + data attributes
- `src/theme.ts` — may reference old CSS custom properties (`--bg`, `--acc`); verify all replaced by Tailwind tokens

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches for the removal and migration.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 06-polish*
*Context gathered: 2026-04-12*
