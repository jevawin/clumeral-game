# Phase 4: Feedback Modal - Context

**Gathered:** 2026-04-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Restyle the existing feedback modal in Tailwind CSS. Same functionality (category pills, textarea with character counter, metadata line, Google Apps Script submission with retry) — new markup and styling. The modal must be openable from the game menu (already wired in Phase 3) and from the completion screen (Phase 5 wires the trigger, but the modal must be available). Restyle the toast notification in Tailwind too.

</domain>

<decisions>
## Implementation Decisions

### Modal Visual Style
- **D-01:** Category pills are rounded-full capsule buttons — accent fill on selected, border-only when unselected.
- **D-02:** Modal card uses the surface token with rounded corners and subtle shadow, over a semi-transparent dark backdrop.
- **D-03:** Open/close animation is fade + slight scale (95% to 100%), ~200ms. Matches the cross-fade transition feel from Phase 1.

### Toast / Success Feedback
- **D-04:** Keep the existing toast pattern — restyle `showToast()` in Tailwind. Small notification auto-dismisses.
- **D-05:** Toast positioned at bottom centre of the viewport.

### Markup Migration
- **D-06:** Full markup rewrite — rebuild the dialog HTML from scratch with Tailwind utility classes. Don't just swap classes on old markup.
- **D-07:** Keep the same `data-fb-*` attribute names (data-fb-modal, data-fb-msg, data-fb-send, data-fb-counter, data-fb-meta, data-fb-cats, data-fb-modal-close, data-fb-btn, data-fb-header-btn) to minimise JS changes in modals.ts.

### Claude's Discretion
- Exact spacing and padding values within the modal
- Responsive adjustments for mobile vs desktop modal sizing
- Toast styling details (colours, border radius, shadow)
- Toast auto-dismiss timing
- Backdrop opacity value
- Whether the close button is an X icon or text

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design & Styling
- `docs/DESIGN-SYSTEM.md` — Token definitions, theming approach. Modal uses the 6 semantic tokens.
- `src/tailwind.css` — Tailwind v4 entry point with @theme tokens (created in Phase 1).
- `src/style.css` — Legacy CSS. Reference for current modal styling (fb-modal__box, fb-cat, fb-counter classes) to understand what's being replaced.

### Feedback Logic (preserved, not rewritten)
- `src/modals.ts` (lines 66-242) — Full feedback modal JS: open/close, category toggle, char counter, metadata collection, retry submission. Data attribute selectors here must match the new markup.
- `src/modals.ts` (lines 50-62) — Toast implementation (`showToast`). Gets restyled but logic stays.

### Existing Markup (being replaced)
- `index.html` (lines 48-71) — Current feedback modal dialog. Full rewrite of this block.

### Game Menu Integration
- `index.html` (line 314) — `[data-fb-btn]` trigger in the game menu dropdown. Already wired in Phase 3.

### Architecture & Conventions
- `docs/ARCHITECTURE.md` — App structure, module boundaries.
- `docs/CONVENTIONS.md` — Code patterns, naming, DOM cache pattern with data attributes, accessibility.

### Codebase Maps
- `.planning/codebase/STRUCTURE.md` — Directory layout and file purposes.
- `.planning/codebase/CONVENTIONS.md` — Naming patterns, code style, module design.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/modals.ts` `initFeedbackModal()` — Takes `todayLocal`, `puzzleNumber`, `formatDate` callbacks. All logic (open, close, category toggle, counter, metadata, retry submit) is preserved. Only the DOM elements it queries change.
- `src/modals.ts` `showToast()` — Creates toast elements dynamically. Needs Tailwind classes instead of `toast__msg` CSS class.
- `public/sprites.svg` — Icons available if needed for the close button or category pills.

### Established Patterns
- DOM cache with `querySelector('[data-*]')` at module init.
- `<dialog>` element with `showModal()` / `close()` for modal behaviour.
- `requestAnimationFrame` + classList for open/close transitions.
- Category pills use `role="radiogroup"` / `role="radio"` with `aria-checked` for accessibility.

### Integration Points
- `[data-fb-btn]` in game menu — already calls `openFeedback()` via modals.ts listener.
- `[data-fb-header-btn]` — secondary open trigger (for completion screen in Phase 5).
- `[data-toast]` container — toast elements appended here dynamically.
- `index.html` lines 48-71 — markup block being replaced.

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches for Tailwind dialog styling and toast presentation.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 04-feedback-modal*
*Context gathered: 2026-04-12*
