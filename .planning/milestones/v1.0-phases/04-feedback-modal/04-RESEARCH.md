# Phase 4: Feedback Modal - Research

**Researched:** 2026-04-12
**Domain:** Tailwind CSS v4 modal markup, dialog element, toast notification, Google Apps Script submission
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Category pills are rounded-full capsule buttons — accent fill on selected, border-only when unselected.
- **D-02:** Modal card uses the surface token with rounded corners and subtle shadow, over a semi-transparent dark backdrop.
- **D-03:** Open/close animation is fade + slight scale (95% to 100%), ~200ms. Matches the cross-fade transition feel from Phase 1.
- **D-04:** Keep the existing toast pattern — restyle `showToast()` in Tailwind. Small notification auto-dismisses.
- **D-05:** Toast positioned at bottom centre of the viewport.
- **D-06:** Full markup rewrite — rebuild the dialog HTML from scratch with Tailwind utility classes. Don't just swap classes on old markup.
- **D-07:** Keep the same `data-fb-*` attribute names (data-fb-modal, data-fb-msg, data-fb-send, data-fb-counter, data-fb-meta, data-fb-cats, data-fb-modal-close, data-fb-btn, data-fb-header-btn) to minimise JS changes in modals.ts.

### Claude's Discretion
- Exact spacing and padding values within the modal
- Responsive adjustments for mobile vs desktop modal sizing
- Toast styling details (colours, border radius, shadow)
- Toast auto-dismiss timing
- Backdrop opacity value
- Whether the close button is an X icon or text

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FBK-01 | Feedback modal accessible from both completion screen and game menu | `[data-fb-btn]` already wired in game menu (Phase 3). `[data-fb-header-btn]` in markup, Phase 5 adds its trigger. Modal must exist now so Phase 5 can bind to it. |
| FBK-02 | Feedback modal has category pills (General, Bug, Idea, Praise) | Existing `initFeedbackModal` in modals.ts selects `.fb-cat` elements by class. New markup keeps this class; ARIA pattern (`role="radiogroup"` / `role="radio"` / `aria-checked`) is preserved. |
| FBK-03 | Feedback modal has textarea with character counter (warns at 400/500) | `updateCounter()` in modals.ts uses `counterEl.classList.add("warn")` and `counterEl.classList.add("hidden")`. New markup must be compatible with both class names. |
| FBK-04 | Feedback modal shows metadata line (puzzle number, date, device, browser) | `renderMeta()` in modals.ts writes to `[data-fb-meta]` via `textContent`. No markup change needed inside the element. |
| FBK-05 | Feedback submits to existing Google Apps Script endpoint with retry logic | `submitFeedback()` in modals.ts is untouched. Logic, URL, retry behaviour, and toast messages are preserved exactly. |
</phase_requirements>

---

## Summary

Phase 4 is a markup-and-styling migration, not a logic change. The feedback modal already works end-to-end in modals.ts. The job is to replace the 24-line HTML block (index.html lines 48–71) with Tailwind v4 utility classes, restyle the dynamically-created toast element in `showToast()`, and make sure the `[data-toast]` container has the right fixed positioning.

The critical risk is the class-name contract between modals.ts and the new markup. The JS file uses two kinds of selectors: data-attribute selectors (`[data-fb-modal]`, `[data-fb-msg]`, etc.) and a class selector (`.fb-cat`). The data attributes are locked by D-07. The `.fb-cat` class must also survive the rewrite — it is the only CSS class used as a JS hook. The `hidden` and `warn` classes toggled on `[data-fb-counter]` must also be handled, because Tailwind v4's `hidden` utility class (`display: none`) will satisfy the `hidden` toggle if the legacy `.hidden` utility in style.css is removed, but `warn` is not a Tailwind utility and must be a custom rule or an inline Tailwind class applied by JS.

The existing animation pattern (opacity + translateY via `open` class toggled after `requestAnimationFrame`) is already proven by the HTP modal in the same file. Phase 4 reuses that identical approach.

**Primary recommendation:** Rewrite index.html lines 48–71 with Tailwind utility classes, keep `.fb-cat` as a utility class for JS targeting, and add a `warn` variant rule in tailwind.css for the counter colour change. Update `showToast()` to use Tailwind classes instead of `toast__msg`.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Tailwind CSS v4 | 4.x (already in project) | Utility classes for modal, pills, textarea, toast | Project-mandated (STY-01), already set up in src/tailwind.css |
| Native `<dialog>` | Web standard | Modal container with `showModal()` / `close()` | Already used by HTP modal in this project |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| public/sprites.svg | in-project | Icon for close button (optional) | If close button uses an SVG × icon instead of the ✕ character |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Native `<dialog>` + `showModal()` | Custom div overlay | Native dialog gives free focus trapping, Escape key, `::backdrop` — no reason to roll custom |
| Tailwind `hidden` utility for counter | Inline `display:none` style | Tailwind utility is cleaner; style.css already defines a `.hidden` rule that satisfies the same toggle |

**Installation:** No new packages needed. Stack is already installed.

---

## Architecture Patterns

### Files Changed

```
index.html                    — Replace lines 48–71 (feedback modal dialog block)
src/modals.ts (lines 50-62)  — Replace toast__msg class in showToast()
src/tailwind.css              — Add warn variant rule for counter
```

No new files. No new modules.

### Pattern 1: Dialog open/close with requestAnimationFrame
**What:** `showModal()` makes the element visible; the `open` class is added on the next animation frame to trigger CSS transitions.
**When to use:** Same approach used for the HTP modal. The `::backdrop` is animated separately because it doesn't inherit the dialog's transition.

```typescript
// Source: src/modals.ts — existing HTP modal (same pattern for feedback)
function openFeedback() {
  modal.showModal();
  requestAnimationFrame(() => modal.classList.add("open"));
}

function closeFeedback() {
  modal.classList.remove("open");
  modal.addEventListener("transitionend", () => modal.close(), { once: true });
}
```

### Pattern 2: Tailwind v4 dialog base styles
**What:** The `<dialog>` element needs explicit `max-w-full`, `max-h-screen`, `w-full`, `h-full`, `border-none`, `bg-transparent`, `p-4` utilities. Its `[open]` state needs `flex items-center justify-center`. Its `open` class triggers `opacity-100`; without it, `opacity-0`.

Because Tailwind v4 targets `[open]` via attribute selectors but the animation requires an `open` *class* toggle (not the attribute), CSS transitions must be written as:

```css
/* In src/tailwind.css @layer base or as Tailwind arbitrary group */
[data-fb-modal] { opacity: 0; transition: opacity 200ms ease; }
[data-fb-modal][open] { display: flex; align-items: center; justify-content: center; opacity: 0; }
[data-fb-modal].open { opacity: 1; }
[data-fb-modal]::backdrop { background: rgba(0,0,0,0.55); opacity: 0; transition: opacity 200ms ease; }
[data-fb-modal].open::backdrop { opacity: 1; }
```

This is identical to the existing style.css pattern. The approach that best fits the project's Tailwind v4 setup is to keep these dialog-specific rules in a `@layer base` block inside tailwind.css rather than fighting Tailwind's utility layer with arbitrary values.

### Pattern 3: Counter warn class
**What:** `updateCounter()` in modals.ts adds `warn` and `hidden` to the counter element. `hidden` is satisfied by Tailwind's built-in `hidden` utility (`display: none`). `warn` is not a Tailwind utility — it needs a custom rule.

Add to `src/tailwind.css`:
```css
@layer utilities {
  .warn { color: var(--color-accent); }
}
```

This keeps the JS unchanged (no class name change) and uses the existing accent token.

### Pattern 4: Toast dynamic element
**What:** `showToast()` creates a `div` with `el.className = "toast__msg"`. To migrate, change that one line to Tailwind utilities. The `show` class toggle stays — just needs a CSS transition pair.

```typescript
// Modified showToast in modals.ts
el.className = "px-4 py-3 rounded-md bg-text text-bg font-[DM_Sans] text-base font-semibold shadow-[0_4px_16px_rgba(0,0,0,0.2)] opacity-0 translate-y-2 transition-[opacity,transform] duration-250 ease pointer-events-auto";
```

The `show` class still toggles `opacity-100` and `translate-y-0`. Either add `.show { opacity: 1; transform: translateY(0); }` as a custom utility, or switch the JS to add/remove a `!opacity-0` override — but the cleanest approach matching project conventions is to keep the `show` class and add a two-rule block in `tailwind.css`.

### Anti-Patterns to Avoid
- **Adding `data-fb-header-btn` to game screen HTML:** This trigger lives on the completion screen (Phase 5). Do NOT add it in Phase 4 — `modals.ts` checks for it with a null guard (`if (headerBtn)`), so it silently no-ops when absent.
- **Changing `.fb-cat` to a data attribute selector:** modals.ts queries by class (`modal.querySelectorAll(".fb-cat")`). Rename would require a modals.ts change. Keep the class.
- **Removing the `hidden` utility from style.css before Phase 6 cleanup:** style.css `.hidden` and Tailwind `.hidden` are identical (`display: none`) — both work during the migration period.
- **Using `light-dark()` in the new modal markup:** REQUIREMENTS.md STY-04 explicitly forbids `light-dark()`. Use Tailwind dark: variants and the CSS variable overrides in tailwind.css.
- **Using `color-mix()` for the metadata background:** STY-04 forbids this too. Use the raw `rgba(10,133,10,0.08)` value as an arbitrary Tailwind value or a CSS variable, not `color-mix()`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Focus trapping in modal | Custom JS focus trap loop | Native `<dialog>` + `showModal()` | Browser handles it; already in use for HTP modal |
| Escape key dismiss | Custom keydown listener | Native `<dialog>` cancel event (already handled in modals.ts) | Already wired: `modal.addEventListener("cancel", ...)` |
| ARIA for radio group | Custom ARIA management | `role="radiogroup"` / `role="radio"` / `aria-checked` (existing pattern) | Already implemented in modals.ts category toggle |
| Character limit enforcement | Custom JS block | `maxlength="500"` on `<textarea>` | Browser enforces it; modals.ts shows the counter but doesn't block |

---

## Common Pitfalls

### Pitfall 1: `::backdrop` doesn't inherit dialog transitions
**What goes wrong:** The `::backdrop` pseudo-element cannot be targeted by Tailwind utility classes on the `<dialog>`. If you try to animate backdrop with Tailwind's `opacity-0` / `opacity-100` classes on the dialog element, the backdrop ignores them.
**Why it happens:** `::backdrop` is a separate layer in the stacking context and doesn't inherit classes from its parent.
**How to avoid:** Write `::backdrop` rules directly in `tailwind.css` under `[data-fb-modal]` (identical to the existing style.css approach). Don't attempt to use Tailwind variants for it.
**Warning signs:** Backdrop appears/disappears instantly with no transition, or stays visible after modal closes.

### Pitfall 2: Tailwind `hidden` vs inline display:none
**What goes wrong:** `updateCounter()` adds the class `hidden`. If Tailwind's `hidden` utility is present, it works. But if `!important` is somewhere on the element's display rule (e.g., from an explicit `flex` utility on the counter element), `hidden` won't override it.
**Why it happens:** CSS specificity — `display: none` without `!important` can be overridden by a more specific `display: flex` rule.
**How to avoid:** Don't apply display utility classes directly to `[data-fb-counter]`. Let it be a plain block element; `hidden` will then work correctly.

### Pitfall 3: `warn` class colour conflict with Tailwind
**What goes wrong:** If `warn` is defined only in style.css's component layer but style.css is removed in Phase 6, the counter warn colour breaks.
**Why it happens:** Phase 6 removes legacy CSS. If `warn` isn't ported to tailwind.css before that, the feature silently breaks.
**How to avoid:** Define `.warn { color: var(--color-accent); }` in tailwind.css during Phase 4 so it survives Phase 6 cleanup.

### Pitfall 4: `showToast()` class string is hard to read and error-prone
**What goes wrong:** A 200-character string of Tailwind utilities in a JS file is hard to maintain and easy to mistype.
**Why it happens:** Dynamic element creation in JS can't use HTML class attribute authoring tools.
**How to avoid:** Consider a named CSS class (e.g., `.toast-msg`) in tailwind.css using `@apply`, assigned via `el.className = "toast-msg show"`. This keeps the JS clean and the styles in one place. This is a Claude's Discretion call — either approach works.

### Pitfall 5: Missing `[data-fb-header-btn]` doesn't break anything, but Phase 5 must not change modals.ts
**What goes wrong:** Phase 5 adds `[data-fb-header-btn]` to the completion screen HTML. If that button is added but `initFeedbackModal` is not re-called, it won't bind. If Phase 5 adds a new `initFeedbackModal` call, it will double-bind.
**Why it happens:** `initFeedbackModal` is called once at app init. `headerBtn` is queried once at that time. If the element doesn't exist yet when `initFeedbackModal` runs, the listener never attaches.
**How to avoid:** Phase 5 must add `[data-fb-header-btn]` to the *static* HTML (not dynamically inject it). Since the completion screen section already exists in the DOM at init time (just hidden via screens.ts), the `querySelector` will find the button.

---

## Code Examples

### Feedback modal dialog shell (Tailwind v4)
```html
<!-- Source: index.html lines 48–71 — rewrite target -->
<dialog data-fb-modal
        class="border-none bg-transparent p-4 max-w-full max-h-screen w-full h-full m-0 opacity-0 transition-opacity duration-200 [&[open]]:flex [&[open]]:items-center [&[open]]:justify-center"
        aria-labelledby="cw-fb-modal-title">
  <div data-fb-modal-box
       class="relative w-full max-w-[26rem] max-h-[90vh] overflow-y-auto rounded-md bg-surface shadow-[0_8px_40px_rgba(26,24,48,0.18)] dark:shadow-[0_8px_40px_rgba(0,0,0,0.5)] pt-7 px-6 pb-6 translate-y-3 transition-transform duration-200">
    <!-- content -->
  </div>
</dialog>
```

Note: The `open` class toggling and `::backdrop` animation must be in `tailwind.css` `@layer base` as shown in Pattern 2 above, not as Tailwind utilities on the element.

### Category pill (Tailwind v4)
```html
<!-- Source: index.html — current fb-cat pattern adapted to Tailwind -->
<button class="fb-cat rounded-full border-[1.5px] border-border bg-surface text-text px-4 py-2 text-base transition-[background-color,color,border-color] duration-150
               aria-checked:bg-[#0A850A] aria-checked:border-[#0A850A] aria-checked:text-white"
        data-cat="general" role="radio" aria-checked="true">
  General
</button>
```

Alternatively (and more maintainably): keep `.fb-cat` as a CSS class in tailwind.css with `@apply` directives, and add a `.fb-cat[aria-checked="true"]` rule for the selected state. This avoids the long class string on each button.

### Counter warn rule in tailwind.css
```css
/* src/tailwind.css — add to @layer utilities */
@layer utilities {
  .warn { color: var(--color-accent); }
}
```

### Toast element classes in showToast()
```typescript
// src/modals.ts — line 54 replacement
el.className = "toast-msg";
// then in tailwind.css:
// .toast-msg { @apply px-4 py-3 rounded-md bg-text text-bg text-base font-semibold pointer-events-auto opacity-0 translate-y-2 transition-[opacity,transform] duration-250 ease; }
// .toast-msg.show { @apply opacity-100 translate-y-0; }
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Custom ARIA modal | Native `<dialog>` + `showModal()` | ~2022 broad browser support | Focus trap, Escape key, `::backdrop` all free |
| CSS-only `::backdrop` animation | Requires explicit transition on `::backdrop` | Always | Can't use JS class on `::backdrop` — must write CSS directly |
| `light-dark()` CSS function | Tailwind dark: variants + CSS variable override | Phase 1 decision (STY-04) | `light-dark()` is forbidden in this project |

---

## Open Questions

1. **`[data-fb-header-btn]` — static vs dynamic**
   - What we know: `initFeedbackModal` queries `[data-fb-header-btn]` once at app start. The completion screen section exists in the DOM but is hidden.
   - What's unclear: Whether the completion screen section is in the static HTML at app load, or dynamically rendered by screens.ts only when the screen is shown.
   - Recommendation: Check screens.ts — if the section is always in the DOM (just toggled visible), the query works. If it's injected on first show, Phase 5 will need to expose `openFeedback` and call it from a click listener added at injection time. This is a Phase 5 concern but worth flagging.

2. **`@apply` in Tailwind v4**
   - What we know: Tailwind v4 changed the way `@apply` works with custom CSS layers.
   - What's unclear: Whether `@apply` with transition utilities works cleanly in Tailwind v4's layer system.
   - Recommendation: If `@apply` causes issues, use raw CSS property values inside `@layer utilities` instead. The project already uses raw CSS variables throughout.

---

## Environment Availability

Step 2.6: SKIPPED (no external dependencies beyond the existing Vite + Tailwind build pipeline, which is already confirmed working from Phases 1–3).

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None detected — manual browser testing only |
| Config file | none |
| Quick run command | `npm run dev` and open browser |
| Full suite command | n/a |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FBK-01 | Clicking feedback button in game menu opens the modal | manual | — | n/a |
| FBK-02 | Clicking a category pill selects it (accent fill, aria-checked="true") | manual | — | n/a |
| FBK-03 | Typing 400+ characters shows counter; 500 chars blocks further input | manual | — | n/a |
| FBK-04 | Metadata line shows puzzle number, date, device, browser | manual | — | n/a |
| FBK-05 | Submitting posts to GAS endpoint; success shows toast; failure retries and shows error toast | manual | — | n/a |

### Sampling Rate
- **Per task commit:** Visual inspection in dev browser (dark and light mode)
- **Per wave merge:** Full manual walkthrough of modal open → fill → submit flow
- **Phase gate:** All 5 FBK requirements visually confirmed before `/gsd:verify-work`

### Wave 0 Gaps
None — no automated test infrastructure exists or is expected for this phase.

---

## Project Constraints (from CLAUDE.md)

| Directive | Impact on Phase 4 |
|-----------|-------------------|
| Never commit to `main` or `staging` | Work on branch `192-redesign-three-screens` |
| Follow review gates (DA review + self-review before PR) | Required — touches index.html, modals.ts, tailwind.css (3 files, >30 lines) |
| Read docs/DESIGN-SYSTEM.md before CSS/theming work | Must be read before implementing modal tokens |
| Read docs/CONVENTIONS.md before DOM/accessibility work | Must be read before writing ARIA attributes |
| Under 15 semantic colour tokens in tailwind.config.ts | Modal uses existing 6 tokens + raw rgba values where needed. No new tokens. |
| Tailwind CSS, existing Vite + Cloudflare Workers setup stays | No new build tools, no new dependencies |
| Frontend-only rebuild — no worker/API changes | Google Apps Script URL stays hardcoded in modals.ts |
| ES2022 target, all current browsers | `<dialog>` is supported in all current browsers; `showModal()` is safe |
| Celebration animation must be skippable and under 3s | Not applicable to this phase |

---

## Sources

### Primary (HIGH confidence)
- Direct inspection of `src/modals.ts` (lines 50–242) — complete feedback modal and toast implementation
- Direct inspection of `src/style.css` (lines 1455–1714) — existing modal and toast CSS being replaced
- Direct inspection of `src/tailwind.css` — Tailwind v4 token definitions, dark mode approach
- Direct inspection of `index.html` (lines 48–71, 282, 314) — markup being replaced, toast container, game menu trigger
- Direct inspection of `.planning/phases/04-feedback-modal/04-UI-SPEC.md` — visual and interaction contract

### Secondary (MEDIUM confidence)
- CONTEXT.md D-01 through D-07 — locked implementation decisions
- REQUIREMENTS.md FBK-01 through FBK-05 — requirement definitions

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies, all tools already in project
- Architecture: HIGH — modals.ts is fully readable; the class/attribute contract is explicit
- Pitfalls: HIGH — derived from direct code inspection, not speculation

**Research date:** 2026-04-12
**Valid until:** Until Phase 5 or Phase 6 changes modals.ts or tailwind.css
