# Phase 1: Foundation - Context

**Gathered:** 2026-04-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Install Tailwind v4, define the semantic colour token palette, build the screen state machine with cross-fade transitions, and add the simplified footer. No visible features — this is the architectural skeleton that all later screens build on.

</domain>

<decisions>
## Implementation Decisions

### Colour Token Palette
- **D-01:** Use a minimal 6-token semantic palette: `bg`, `text`, `muted`, `accent`, `surface`, `border` — each with light and dark variants defined in CSS `@theme`.
- **D-02:** Background values are locked: light #FAFAFA, dark #121213.
- **D-03:** Shadows, tints, and overlays are NOT separate tokens — use Tailwind opacity modifiers (e.g., `bg-accent/10`, `text-muted/60`) instead.
- **D-04:** No `light-dark()` or `color-mix()` in new code — Tailwind `dark:` variants only.

### Screen Transitions
- **D-05:** Cross-fade at 250ms with ease timing — smooth but not slow.
- **D-06:** Use View Transition API where supported; CSS opacity transition as fallback for unsupported browsers. Same visual result either way.

### CSS Coexistence
- **D-07:** Tailwind styles go in a new CSS entry point (e.g., `src/tailwind.css` with `@import 'tailwindcss'`). Old `style.css` stays untouched and loads in parallel. New screens use Tailwind classes; old markup keeps old classes.
- **D-08:** Old `style.css` is removed in Phase 6, not before.

### Font & Typography
- **D-09:** Keep both fonts: DM Sans (body) and Inconsolata (digits/labels).
- **D-10:** Trim Google Fonts load to weights actually used: DM Sans 400+600, Inconsolata 400+700. Drop unused light/medium/variable-width ranges.

### Claude's Discretion
- Exact accent green hex values for light and dark mode — must pass WCAG AA on the decided backgrounds. Current values (#0A850A light, #1EAD52 dark) are a good starting point.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design & Styling
- `docs/DESIGN-SYSTEM.md` — Current token definitions, theming approach, clue display rules. New tokens replace these but the clue display format stays.
- `src/style.css` — Legacy CSS (~1400 lines) that coexists with Tailwind until Phase 6. Reference for what the current tokens do.

### Architecture
- `docs/ARCHITECTURE.md` — App structure, data flow, module boundaries. Screen state machine must fit within the existing client architecture.
- `docs/CONVENTIONS.md` — Code patterns, naming, error handling, accessibility requirements.

### Codebase Structure
- `.planning/codebase/STRUCTURE.md` — Directory layout and file purposes.
- `.planning/codebase/STACK.md` — Technology stack details (Vite 8, TypeScript 6, Cloudflare Workers).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/theme.ts` — Already toggles `.dark`/`.light` classes on `<html>`. Tailwind's `dark:` variant can hook into the existing class-based toggle with minimal wiring.
- `src/storage.ts` — localStorage helpers for prefs and history. Screen state machine may need to check game state on load to decide which screen to show.

### Established Patterns
- DOM cache pattern in `app.ts` — `const dom = { ... }` caches `querySelector` results at init. New screen code should follow this pattern.
- Module-scoped state with section headers (`// --- Section Name ---`).
- Data attributes for DOM selection (`data-*`), not class names.

### Integration Points
- `index.html` — Currently has all markup inline. The screen state machine will need to either restructure this markup or add new screen containers alongside existing content.
- `vite.config.ts` — Needs Tailwind v4 plugin/config added. Currently only has Cloudflare plugin + SW cache bust.
- Theme toggle in `theme.ts` needs to work with both old and new CSS during coexistence.

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches for Tailwind v4 setup and screen state management.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 01-foundation*
*Context gathered: 2026-04-11*
