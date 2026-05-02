# Phase 6: Polish - Research

**Researched:** 2026-04-12
**Domain:** CSS migration — legacy style.css removal, Tailwind v4 conversion, JS selector cleanup
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Drop both the canvas dot-grid and geometric shape overlays entirely. Clean bg-colour-only backgrounds match the Wordle-inspired minimal design.
- **D-02:** Delete `src/colours.ts` — it only handles canvas dot rendering and colour swatches, both gone in the new design.
- **D-03:** Remove `<canvas data-canvas>` and `.game__shape` elements from `index.html`.
- **D-04:** Convert all old BEM class names (.game, .header, .octo, .digit-box, etc.) to Tailwind utility classes inline in the HTML. Fully utility-first — no mixed approach.
- **D-05:** JS DOM selectors that use old class names must switch to `data-*` attributes (consistent with newer code pattern: data-octo-wrap, data-fb-modal, etc.). Styling fully decoupled from behaviour hooks.
- **D-06:** Manual browser walkthrough of every screen (welcome, game with clues + input, completion, modal open, menu open) in both light and dark mode at mobile and desktop viewports. User does final sign-off.
- **D-07:** Extra attention on octo animation (celebration + click-to-replay) — currently styled in style.css with complex positioning and keyframes.
- **D-08:** Extra attention on clue digit indicators — small digit boxes showing which positions a clue applies to have intricate styling.

### Claude's Discretion

- Migration order (which components to convert first) and intermediate testing approach left to planner.
- Whether to batch the HTML class conversion or do it element-by-element — planner decides based on risk.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| STY-06 | Old CSS fully removed once replacement is complete | Full audit of what must move: style.css link tag, canvas/shape elements, colours.ts, old BEM classes in HTML, old CSS custom properties referenced by JS, and keyframes for octo animation that must move into tailwind.css |
</phase_requirements>

---

## Summary

Phase 6 is a cleanup phase, not a feature phase. Every new screen's HTML was written in Tailwind v4 utility classes during Phases 1–5. The legacy `src/style.css` (1,541 lines) is still loaded alongside `src/tailwind.css`, so some style.css rules still apply — particularly the reset layer, CSS tokens, and the component styles for elements that haven't been fully converted yet.

The audit reveals that most of `index.html` is already utility-first. The remaining old BEM structure lives in two places: the legacy outer wrapper (`<div class="game">` → `<main class="game__inner">`) and the octo/header section at the top of the file that predates the Phase 1 screens refactor. The JS files (`app.ts`, `octo.ts`, `theme.ts`, `colours.ts`) are the other surface — `colours.ts` sets old CSS custom properties (`--acc`, `--acc-btn`, `--tag-bg`, etc.) that only exist in style.css tokens, and `theme.ts` calls `drawCanvas()` which depends on the canvas element being present.

The migration must happen in a safe order: (1) remove the canvas + shape elements and drawCanvas/initColours calls, (2) convert the legacy outer wrapper HTML to Tailwind, (3) migrate the octo/header section including keyframes, (4) remove the style.css link tag, (5) verify the reset layer is replaced (Tailwind v4 preflight does this), (6) fix any fallout. Removing style.css too early will break the octo keyframes and token-dependent components still using old var names.

**Primary recommendation:** Convert the HTML legacy wrapper first, then migrate octo keyframes into tailwind.css, then delete colours.ts and drawCanvas, then remove the style.css link. Never remove the link until every CSS class and custom property it provides has a Tailwind equivalent.

---

## What style.css Still Provides (Full Audit)

This is the most critical research output for planning. style.css has five layers.

### Layer: reset

Provides box-sizing, margin/padding reset, `font-family: DM Sans`, `min-block-size: 100vh`, link reset, and `:focus-visible` outline.

**Tailwind v4 status:** Tailwind v4 ships preflight which handles box-sizing, margin/padding reset, and font-family baseline. However, tailwind.css does not currently import `tailwindcss/preflight`. It only imports `@import "tailwindcss/theme"` and `@import "tailwindcss/utilities"`. Without preflight, removing style.css loses the CSS reset.

**Action required:** Either add `@import "tailwindcss/preflight"` to tailwind.css, or manually replicate the few critical reset rules in `@layer base`.

### Layer: tokens

Defines all `--acc`, `--acc-btn`, `--tag-bg`, `--md-lit-bg`, `--dig-sh-act`, `--bg`, `--sh1`, `--sh2`, `--text`, `--muted`, `--card-bg`, `--card-sh`, `--surface`, `--border`, `--dig-sh`, `--k-bg-elim`, `--k-txt-elim`, `--k-sh`, `--modal-bg`, `--modal-sh` using `light-dark()` and `:root.dark`/`:root.light` overrides.

**Tailwind v4 status:** tailwind.css defines only 6 tokens in `@theme`: `--color-bg`, `--color-text`, `--color-muted`, `--color-accent`, `--color-surface`, `--color-border`. The new HTML exclusively uses these (bg-bg, text-text, text-accent, bg-surface, border-border). The old token names (`--acc`, `--dig-sh`, `--k-sh`, `--modal-bg`, etc.) are NOT used anywhere in the new screen HTML.

**Exception — bubbles.ts:** `bubbles.ts` reads `--acc` via `getComputedStyle(root).getPropertyValue("--acc")` (line 121) as a fallback for bubble colour. Once colours.ts is removed, `--acc` won't exist. bubbles.ts must switch to reading `--color-accent` instead.

**Exception — octo keyframes:** The `@keyframes octo-colours` in style.css uses `light-dark(#0a850a, #1ead52)` — the old accent values. When this keyframe migrates to tailwind.css, it should reference `var(--color-accent)` instead.

**Action required:** Delete the entire tokens layer from style.css (it's replaced by `@theme` in tailwind.css). Fix bubbles.ts to read `--color-accent`. Rework octo-colours keyframe to use `var(--color-accent)`.

### Layer: layout

Provides `.game` (min-height wrapper), `.game__canvas` (fixed canvas), `.game__shape`/`.game__shape--alt` (background blobs), `.game__inner` (inner column max-width wrapper).

**HTML status:** `index.html` still has `<div class="game">` wrapping everything, `<canvas class="game__canvas">`, two `.game__shape` divs, and `<main class="game__inner">`. These are the old outer structure — decisions D-03 and D-04 require removing the canvas/shapes and replacing `.game` / `.game__inner` with Tailwind utilities.

**Action required:** Remove canvas + shape divs. Replace `.game` with Tailwind wrapper (`min-h-screen bg-bg` etc.). Replace `.game__inner` — but note: this element wraps the legacy header (`.header`, `.octo`, `.title`) which is SEPARATE from the new `data-screens` architecture. After Phase 1–5, the old `<main class="game__inner">` inside `<div class="game">` contains only the legacy header and octo. The new screens (`data-screens`) are siblings of `<div class="game">`. This legacy header section is what needs converting.

### Layer: components

This is the bulk of style.css. Contains:

- `.header`, `.octo`, `.octo-slot`, `.title`, `.tlt`, `.subtitle` — legacy header section still in index.html
- `.octo.celebrating` — toggled by octo.ts (line 317/325), drives the fly animation
- `@keyframes octo-fly`, `@keyframes octo-colours` — celebration animation
- `.card`, `.card__label`, `.card__archive-label`, `.card__hint` — NOT in new HTML, safe to delete
- `.clue-list`, `.clue`, `.clue__tag-cell`, `.clue__tag`, `.clue__tag-icon`, `.clue__digits`, `.clue__digit`, `.clue__lines`, `.clue__line1`, `.clue__line2` — NOT in new HTML (renderClues() uses Tailwind). Safe to delete.
- `.clue-skeleton__*` — NOT in new HTML (new skeletons use animate-pulse). Safe to delete.
- `.recurring` — STILL USED in app.ts renderClues() (line 116/118): `<span class="recurring">`. This class must move to tailwind.css or be converted inline.
- `.digits.digit-correct`, `.digit-box`, `.digit-box__*` — NOT in new HTML. app.ts adds `digit-correct` class via `classList.add` but the new digit elements are styled with Tailwind. Check if `digit-correct` is still applied and what it does.
- `.keypad`, `.keypad__btn`, `.submit`, `.submit__btn`, `.save`, `.feedback`, `.history`, `.stats` — NOT in new HTML. app.ts now uses Tailwind classes for all these.
- `@keyframes shimmer` — only used by `.clue-skeleton__*` classes, which are gone. Safe to delete.
- `[data-modal]`, `.modal__box`, `.modal__close` — How-to-play modal. Check if this modal is still in index.html or was converted.
- `.swatch-*`, `.dev-links`, `.text-link`, `.text-link--*` — colours.ts uses `text-link text-link--muted` (line 74) for dev buttons. Once colours.ts is deleted, these classes go with it.
- `.footer`, `.footer__links`, `.foot-icon-link`, `.foot-avatar`, `.footer-heart` — check if old footer HTML is still present.
- `.theme-icon`, `.icon-sun`, `.icon-moon` — check if still used.

**octo.ts class dependencies (CRITICAL for D-07):**
- `octoWrapEl.classList.add('celebrating')` — drives `@keyframes octo-fly` via `.octo.celebrating { animation: octo-fly ... }`
- `octoEl.classList.add('celebrate')` — drives `@keyframes octo-colours` via `[data-octo].celebrate > path`
- `digitsEl.classList.add('digit-correct')` — applied to `[data-digits]` element; Tailwind `.dark:shadow-[...]` classes on digit boxes are toggled by app.ts, NOT by digit-correct. But `digit-correct` in style.css sets `pointer-events: none` and green backgrounds. This styling needs migration.

**Action required for octo:**
1. Move `@keyframes octo-fly` and `@keyframes octo-colours` into tailwind.css `@layer base` or as a CSS `@keyframes` block.
2. Move `.octo.celebrating { animation: octo-fly ... }` into tailwind.css.
3. Move `[data-octo].celebrate > path:first-of-type { animation: octo-colours ... }` into tailwind.css.
4. Move `.octo { filter: drop-shadow...; opacity: 0; ... }` — octo.ts reads/sets style.transform directly via JS, not via class. The initial opacity:0 on `.octo` is used by the entry animation (revealOcto sets opacity via style). Replace class-based initial state with `data-octo-wrap` attribute selector in tailwind.css `@layer base`.
5. `digit-correct` pointer-events and colour — migrate to tailwind.css or switch app.ts to add Tailwind classes directly instead.

### Layer: utilities

- `.hidden`, `.sr-only`, `.text-link`, `.text-link--*`, `.text-link--muted` — `.hidden` is used by `classList.add("hidden")` throughout app.ts, modals.ts, etc. Tailwind has `hidden` as a utility (display:none). This works identically.
- `.sr-only` — Tailwind has `sr-only`. Works identically.
- `.text-link` — only used in colours.ts dev buttons. Gone with colours.ts.

---

## Architecture Patterns

### What Is and Isn't in the New HTML

Understanding the two parallel structures is critical for migration planning.

**Old structure (still in index.html, uses style.css classes):**
```
<div class="game">                        ← layout layer
  <canvas class="game__canvas">          ← DELETE (D-03)
  <div class="game__shape">              ← DELETE (D-03)
  <div class="game__shape game__shape--alt">  ← DELETE (D-03)
  <dialog data-fb-modal>                 ← already Tailwind
  <main class="game__inner">             ← convert to Tailwind wrapper
    <header class="header">              ← convert (still has .octo, .tlt, .title)
    ...octo + title SVG...
    </header>
  </main>
  <div data-toast>                       ← already Tailwind
</div>
```

**New structure (sibling, already Tailwind):**
```
<main data-screens>
  <section data-screen="welcome">        ← Phase 2 (Tailwind)
  <section data-screen="game">           ← Phase 3 (Tailwind)
  <section data-screen="completion">     ← Phase 5 (Tailwind)
</main>
<footer data-footer>                     ← already Tailwind
```

The octo + title in the old `<main class="game__inner">` — this is important. The octo lives here and is grabbed by `[data-octo-wrap]` selectors in octo.ts. The welcome screen (Phase 2) may have its own octo, or it may reference the same one. **Check before converting** whether the welcome screen reuses the `data-octo-wrap` element from the old header or has its own.

### CSS Custom Property Compatibility

The new Tailwind tokens use `--color-*` prefix. The old tokens use bare names (`--acc`, `--bg`, etc.). The `DESIGN-SYSTEM.md` doc (last updated pre-redesign) still documents old tokens — it needs updating as part of this phase.

| Old token | New equivalent | Notes |
|-----------|---------------|-------|
| `--acc` | `--color-accent` | bubbles.ts reads old name |
| `--bg` | `--color-bg` | welcome.ts uses `var(--acc)` in SVG fill |
| `--text` | `--color-text` | — |
| `--muted` | `--color-muted` | — |
| `--surface` | `--color-surface` | — |
| `--border` | `--color-border` | — |
| `--dig-sh`, `--k-sh`, `--card-sh`, `--modal-sh`, `--modal-bg`, `--card-bg`, `--k-bg-elim`, `--k-txt-elim` | No equivalent yet | Must add to tailwind.css `@layer base` if any new HTML uses them, or confirm unused |

**welcome.ts finding:** welcome.ts (line 37) uses `fill="var(--acc)"` in inline SVG. This must change to `fill="var(--color-accent)"`.

### Tailwind v4 Preflight

Tailwind v4 preflight replaces style.css's reset layer. It handles:
- `box-sizing: border-box`
- Margin/padding reset
- Font inheritance
- Link colour reset

Current `tailwind.css` does NOT import preflight (only imports `tailwindcss/theme` and `tailwindcss/utilities`). Add `@import "tailwindcss/preflight" layer(base)` before removing style.css.

### DESIGN-SYSTEM.md: Stale and Misleading

The current `docs/DESIGN-SYSTEM.md` still documents `light-dark()`, `--acc`, `--acc-btn` and the old token system. This conflicts with the Tailwind v4 approach. It also still lists multiple accent colours and `colours.ts`. After this phase, update it to reflect the new reality: 6 Tailwind semantic tokens, no accent picker, no `light-dark()`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CSS reset after removing style.css | Manual property-by-property reset rules | `@import "tailwindcss/preflight"` | Tailwind's preflight is the authoritative Tailwind v4 reset |
| Dark mode keyframe colours | JS-toggled animation classes | CSS `@custom-variant dark` + Tailwind dark: variants | Already wired in tailwind.css |
| `sr-only` utility | Copy-paste style.css version | Tailwind's built-in `sr-only` class | Identical behaviour, no custom CSS needed |
| `hidden` utility | Keep in style.css or add to tailwind.css | Tailwind's built-in `hidden` class | `display: none` — already available |

---

## Common Pitfalls

### Pitfall 1: Removing style.css before keyframes migrate

**What goes wrong:** The octo-fly and octo-colours animations stop working. The celebration plays but the octopus doesn't move.
**Why it happens:** `@keyframes octo-fly` is defined in style.css components layer. octo.ts adds `.celebrating` class which triggers `animation: octo-fly`. If the keyframe definition is gone, no animation runs.
**How to avoid:** Move all `@keyframes` into tailwind.css `@layer base` BEFORE removing the style.css `<link>` tag.
**Warning signs:** Celebration silently falls through to completion with no animation. Check browser DevTools → Animations panel.

### Pitfall 2: `digit-correct` class applied with no styles

**What goes wrong:** After a correct guess, digit boxes don't turn green.
**Why it happens:** app.ts and octo.ts both call `digitsEl.classList.add('digit-correct')`. The styles are in style.css `.digits.digit-correct .digit-box { background-color: ... }`. Remove style.css → styling disappears.
**How to avoid:** Either add `digit-correct` styles to tailwind.css, or rewrite app.ts/octo.ts to add Tailwind classes directly (`bg-[rgba(46,139,87,0.12)] border-[rgba(46,139,87,0.4)] pointer-events-none`) to the digit box elements instead of using the class-based approach.
**Recommendation:** Switch to direct Tailwind class addition to stay consistent with the rest of app.ts pattern (lines 505, 526, 657 already do this for individual digit elements). Remove `digit-correct` as a concept.

### Pitfall 3: bubbles.ts reads `--acc` which no longer exists

**What goes wrong:** Bubbles render in the fallback colour (hardcoded green) instead of matching the theme accent. Silent failure.
**Why it happens:** bubbles.ts line 121 reads `getComputedStyle(root).getPropertyValue("--acc")`. Once colours.ts is removed, `--acc` is never set.
**How to avoid:** Change bubbles.ts to read `--color-accent` instead.
**Warning signs:** Bubbles always appear as `rgb(10, 133, 10)` even in dark mode.

### Pitfall 4: welcome.ts SVG fill uses `var(--acc)`

**What goes wrong:** The logo/SVG on the welcome screen loses its accent colour in dark mode.
**Why it happens:** welcome.ts line 37 uses `fill="var(--acc)"`. The old --acc token is light-dark()-aware. After it's removed, the property resolves to empty and fill is black.
**How to avoid:** Change welcome.ts to `fill="var(--color-accent)"` (the Tailwind token is single-value per theme mode, so also add dark mode handling if needed — check how the welcome screen SVG renders).

### Pitfall 5: theme.ts calls drawCanvas after canvas is removed

**What goes wrong:** JS error: `Cannot read properties of null (reading 'getContext')` on every theme toggle and resize.
**Why it happens:** `drawCanvas()` in theme.ts calls `document.querySelector('[data-canvas]')` which returns null after the canvas is removed. The function has an early return guard (`if (!canvas) return`) so it fails silently — but theme toggling itself still works. The real issue is the `window.addEventListener("resize", () => drawCanvas(...))` call remains even when canvas is null.
**How to avoid:** Remove the `drawCanvas` function entirely from theme.ts. Remove the resize listener that calls it. Remove the `drawCanvas` export. Also remove any import of `drawCanvas` in other files.

### Pitfall 6: colours.ts exposes `window._swapIcons` and `window._currentColour`

**What goes wrong:** theme.ts calls `window._swapIcons` on every theme toggle (line 36 of theme.ts). If colours.ts is deleted without removing this call, `window._swapIcons` is undefined and the call silently fails. Icons don't swap on theme change — probably fine since there's only one accent now, but needs confirmation.
**How to avoid:** Remove `if (window._swapIcons && window._currentColour) window._swapIcons(window._currentColour)` from theme.ts after deleting colours.ts. Remove the TypeScript window extension types if present.

### Pitfall 7: `.recurring` class has no Tailwind equivalent

**What goes wrong:** Recurring decimal notation breaks — the overdot above the number disappears.
**Why it happens:** `.recurring::after` in style.css creates the overdot pseudo-element. app.ts line 116/118 renders `<span class="recurring">`. This class must move somewhere.
**How to avoid:** Add the `.recurring` styles to tailwind.css `@layer utilities` (it's a small component-level rule that can't be expressed as pure utilities because it requires `::after`). Or generate the HTML differently in renderClues().

### Pitfall 8: The `[data-modal]` HTP modal still uses style.css

**What goes wrong:** The how-to-play modal loses its open/close animation and backdrop.
**Why it happens:** style.css defines `[data-modal]`, `.modal__box`, `.modal__close` etc. Check if the HTP modal (`data-modal`) is separate from the feedback modal (`data-fb-modal`) — feedback modal already has Tailwind styles in tailwind.css. The HTP modal may still rely on style.css.
**How to avoid:** Audit which modal elements are in the current HTML and which selectors they depend on. Migrate HTP modal styles to tailwind.css `@layer base` alongside the feedback modal styles.

---

## Code Examples

### Moving keyframes to tailwind.css

```css
/* In tailwind.css — add to @layer base */

@layer base {
  /* Octo animation keyframes — used by octo.ts via .celebrating/.celebrate classes */
  @keyframes octo-fly {
    0%   { transform: translate(-50%, -50%) translateY(-55vh) scale(1) rotate(0deg); }
    10%  { transform: translate(-50%, -50%) scale(2) rotate(15deg); }
    30%  { transform: translate(-50%, -50%) translate(35vw, -18vh) scale(1.8) rotate(-20deg); }
    50%  { transform: translate(-50%, -50%) translate(-35vw, 18vh) scale(2.2) rotate(25deg); }
    70%  { transform: translate(-50%, -50%) translate(30vw, 15vh) scale(1.6) rotate(-15deg); }
    85%  { transform: translate(-50%, -50%) translate(-30vw, -15vh) scale(1.3) rotate(10deg); }
    100% { transform: translate(-50%, -50%) scale(1) rotate(0deg); }
  }

  @keyframes octo-colours {
    0%, 100% { fill: var(--color-accent); }
    25%       { fill: light-dark(#de1f46, #ea6c85); }
    50%       { fill: light-dark(#376ddb, #6393f2); }
    75%       { fill: light-dark(#9a44ea, #b679f0); }
  }

  [data-octo-wrap].celebrating {
    z-index: 9999;
    animation: octo-fly 2s cubic-bezier(0.4, 0, 0.6, 1) forwards;
  }

  [data-octo].celebrate > path:first-of-type {
    animation: octo-colours 4s ease-in-out 0.5s infinite;
  }

  @media (prefers-reduced-motion: reduce) {
    [data-octo].celebrate > path:first-of-type,
    [data-octo-wrap].celebrating { animation: none; }
  }
}
```

Note: octo.ts uses `octoWrapEl.classList.add('celebrating')` where `octoWrapEl` is `[data-octo-wrap]`. The style.css selector is `.octo.celebrating` — `.octo` is the same element as `[data-octo-wrap]`. The selector can switch to `[data-octo-wrap].celebrating` without changing the JS.

### Adding preflight to tailwind.css

```css
/* tailwind.css — add FIRST, before @import "tailwindcss/theme" */
@import "tailwindcss/preflight" layer(base);
@import "tailwindcss/theme" layer(theme);
@import "tailwindcss/utilities" layer(utilities);
```

### Migrating `.recurring` to tailwind.css

```css
/* In tailwind.css @layer utilities */
@layer utilities {
  .recurring {
    display: inline-block;
    position: relative;
  }
  .recurring::after {
    content: "·";
    position: absolute;
    inset-inline-start: 50%;
    inset-block-start: -0.55em;
    transform: translateX(-50%);
    font-size: 1.4em;
    line-height: 1;
  }
}
```

### Fixing bubbles.ts to use new token name

```typescript
// bubbles.ts — change line 121
// Old:
getComputedStyle(root).getPropertyValue("--acc")
// New:
getComputedStyle(root).getPropertyValue("--color-accent")
```

---

## Migration Order (Recommended)

Based on risk and dependency analysis, this is the safest sequence:

1. **Prep:** Add preflight import to tailwind.css. Migrate keyframes + `.celebrating` + `.recurring` + `[data-modal]` HTP modal styles into tailwind.css. Keep style.css link active.
2. **Remove canvas/shapes:** Delete `<canvas data-canvas>` and both `.game__shape` divs from index.html. Remove `drawCanvas()` from theme.ts and resize listener.
3. **Remove colours.ts:** Delete the file, remove `import { initColours }` from app.ts, remove `initColours()` call, remove `window._swapIcons` call from theme.ts, fix welcome.ts `var(--acc)` → `var(--color-accent)`, fix bubbles.ts `--acc` → `--color-accent`.
4. **Convert legacy wrapper HTML:** Replace `<div class="game">` and `<main class="game__inner">` and `<header class="header">` with Tailwind. Convert octo-slot, octo-wrap, title, tlt elements.
5. **Fix digit-correct:** Remove the class-based approach from octo.ts/app.ts, add Tailwind classes directly to digit elements.
6. **Remove style.css link tag** from index.html.
7. **Build and verify:** `npm run build`, then manual browser walkthrough per D-06.
8. **Update DESIGN-SYSTEM.md** to reflect new token names and removed features.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None (manual only) |
| Config file | n/a |
| Quick run command | `npm run dev` and visual inspection |
| Full suite command | Manual browser walkthrough per D-06 |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| STY-06 | No old CSS files imported in build | build check | `npm run build && grep -r 'style.css' dist/ \|\| echo "CLEAN"` | ❌ Wave 0 |
| STY-06 | Built CSS contains only Tailwind output | build check | `wc -l dist/client/assets/*.css` (should be Tailwind-generated only) | ❌ Wave 0 |
| D-06 | All 5 views correct in light + dark, mobile + desktop | manual | Manual browser walkthrough | n/a |

### Sampling Rate

- **Per task commit:** `npm run dev` and spot-check the converted element visually
- **Per wave merge:** Build check — `npm run build` succeeds with no errors
- **Phase gate:** Full manual walkthrough per D-06 before `/gsd:verify-work`

### Wave 0 Gaps

No automated tests to write for this phase — it is a visual migration with build-output verification. The build check grep is a shell one-liner, not a test file.

---

## Environment Availability

Step 2.6: SKIPPED (no external dependencies — this is a frontend-only CSS/HTML/JS migration)

---

## Runtime State Inventory

Step 2.5: SKIPPED (this is not a rename/refactor phase involving stored state)

---

## Open Questions

1. **Does the welcome screen have its own octo, or does it reuse the one in `<main class="game__inner">`?**
   - What we know: Phase 2 was `<section data-screen="welcome">` but the content inside it shows only `<!-- Phase 2 content -->` placeholder. The welcome screen content was deferred or partially implemented.
   - What's unclear: Whether the Phase 2 implementation added an octo inside data-screen="welcome" or whether it references the one in the legacy outer structure.
   - Recommendation: Read `src/welcome.ts` fully before converting the legacy header. If welcome screen uses the legacy octo slot, the legacy header must stay until welcome screen is re-homed.

2. **Is the how-to-play modal (`[data-modal]`) still in use?**
   - What we know: Phase 4 (feedback modal) is not yet complete. The HTP modal may still be in the old modal format using `[data-modal]` selectors from style.css.
   - What's unclear: Current index.html does not show an HTP modal element in the portion visible — it may have been removed or moved.
   - Recommendation: Search index.html for `data-modal` (not `data-fb-modal`) to confirm whether the HTP modal still exists and what class selectors it uses.

---

## Sources

### Primary (HIGH confidence)

- Direct code audit of `src/style.css` (all 1,541 lines)
- Direct code audit of `src/app.ts`, `src/octo.ts`, `src/theme.ts`, `src/colours.ts`, `src/bubbles.ts`
- Direct audit of `index.html` current state
- `src/tailwind.css` — confirmed current Tailwind imports and token definitions
- `06-CONTEXT.md` — locked decisions D-01 through D-08

### Secondary (MEDIUM confidence)

- Tailwind v4 preflight behaviour inferred from Tailwind v4 documentation patterns (standard `@import "tailwindcss/preflight"` inclusion)

---

## Metadata

**Confidence breakdown:**
- Migration audit (what must move): HIGH — direct code reading, no inference
- Pitfalls: HIGH — each pitfall traced to specific code lines
- Tailwind v4 preflight: MEDIUM — standard v4 pattern, consistent with import structure observed in tailwind.css

**Research date:** 2026-04-12
**Valid until:** This is a code-specific audit. Valid until code changes.
