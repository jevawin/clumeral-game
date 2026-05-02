# Phase 1: Foundation — Research

**Researched:** 2026-04-11
**Domain:** Tailwind CSS v4 setup, CSS @theme tokens, View Transition API, screen state machine
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Use a minimal 6-token semantic palette: `bg`, `text`, `muted`, `accent`, `surface`, `border` — each with light and dark variants defined in CSS `@theme`.
- **D-02:** Background values are locked: light #FAFAFA, dark #121213.
- **D-03:** Shadows, tints, and overlays are NOT separate tokens — use Tailwind opacity modifiers (e.g., `bg-accent/10`, `text-muted/60`) instead.
- **D-04:** No `light-dark()` or `color-mix()` in new code — Tailwind `dark:` variants only.
- **D-05:** Cross-fade at 250ms with ease timing — smooth but not slow.
- **D-06:** Use View Transition API where supported; CSS opacity transition as fallback for unsupported browsers. Same visual result either way.
- **D-07:** Tailwind styles go in a new CSS entry point (e.g., `src/tailwind.css` with `@import 'tailwindcss'`). Old `style.css` stays untouched and loads in parallel. New screens use Tailwind classes; old markup keeps old classes.
- **D-08:** Old `style.css` is removed in Phase 6, not before.
- **D-09:** Keep both fonts: DM Sans (body) and Inconsolata (digits/labels).
- **D-10:** Trim Google Fonts load to weights actually used: DM Sans 400+600, Inconsolata 400+700. Drop unused light/medium/variable-width ranges.

### Claude's Discretion

- Exact accent green hex values for light and dark mode — must pass WCAG AA on the decided backgrounds. Current values (#0A850A light, #1EAD52 dark) are a good starting point.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| STY-01 | Built from scratch with Tailwind CSS v4 | Tailwind v4.2.2 install via `npm install tailwindcss @tailwindcss/vite` |
| STY-02 | Semantic colour tokens defined in CSS @theme (~7 tokens with light/dark variants) | `@theme` directive generates utility classes from CSS custom properties |
| STY-03 | Dark mode uses near-black background (#121213), light mode uses off-white (#FAFAFA) | Locked in D-02; implemented via `@theme` token values |
| STY-04 | Dark mode via Tailwind `dark:` variants, not `light-dark()` or `color-mix()` | `@custom-variant dark (&:where(.dark, .dark *))` hooks into existing `theme.ts` class toggle |
| STY-05 | Green accent only — no colour theme picker | Single `--color-accent` token in `@theme`; colours.ts colour picker is out of scope |
| SCR-01 | App shows three distinct screens: welcome, game, completion | Three `<section data-screen="...">` elements inside `<main>` |
| SCR-02 | Screens are state-driven on a single page (no URL routes) | Module-scoped `currentScreen` variable in new `src/screens.ts` |
| SCR-03 | Smooth cross-fade transitions using View Transition API with fallback | `document.startViewTransition` with CSS opacity transition fallback |
| FTR-01 | Simplified footer: "Made with heart by Jamie & Dave. © 2026." on all screens | Static `<footer>` outside screen containers, always visible |
| FTR-02 | No GitHub link, no "AI experiment" copy | Content constraint — no research needed |
</phase_requirements>

---

## Summary

Phase 1 installs Tailwind CSS v4 alongside the existing CSS without touching any existing code. The key challenges are: correct plugin ordering in `vite.config.ts`, wiring Tailwind's `dark:` variant to the existing class-based theme toggle in `theme.ts`, and defining `@theme` tokens so Tailwind generates `bg-bg`, `text-text`, `bg-surface` etc. as real utility classes rather than raw CSS variables.

The screen state machine is straightforward: three `<section data-screen="...">` elements in a new `<main>` block added to `index.html`, toggled via opacity/pointer-events in a new `src/screens.ts` module. The View Transition API cross-fade is a progressive enhancement — same visual result with or without it.

The only coexistence risk is CSS cascade order. `style.css` uses `@layer` with named layers (`reset, tokens, layout, components, utilities`). Tailwind v4 also uses `@layer`. Both files load in the browser simultaneously, so layer name collisions or reset conflicts are possible. The mitigation is to keep Tailwind screen elements (`[data-screen]`) completely separate from existing class-based elements.

**Primary recommendation:** Install `tailwindcss` + `@tailwindcss/vite`, add plugin before `cloudflare()` in `vite.config.ts`, create `src/tailwind.css` with `@import "tailwindcss"` and `@theme { ... }`, and import it from `index.html` alongside `style.css`.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| tailwindcss | 4.2.2 | CSS framework | Locked decision; v4 is current stable |
| @tailwindcss/vite | 4.2.2 | Vite plugin integration | Replaces PostCSS approach in v4; first-class Vite support |

### No Additional Supporting Libraries

Tailwind v4 with the Vite plugin handles vendor prefixing and imports internally. No `postcss`, `autoprefixer`, or `tailwind.config.js` file needed — configuration lives entirely in CSS.

**Already present:**
- `postcss` 8.5.8 — already installed (dependency of something else); not needed for Tailwind v4 Vite plugin

### Installation

```bash
npm install tailwindcss @tailwindcss/vite
```

**Verified versions (2026-04-11):** `tailwindcss@4.2.2`, `@tailwindcss/vite@4.2.2`

---

## Architecture Patterns

### Recommended File Structure

```
src/
├── tailwind.css        # NEW — Tailwind entry point (@import + @theme + @custom-variant)
├── style.css           # EXISTING — untouched until Phase 6
├── screens.ts          # NEW — screen state machine (showScreen, currentScreen)
├── theme.ts            # EXISTING — no changes needed; already toggles .dark/.light on <html>
└── app.ts              # EXISTING — import screens.ts at init; no other changes in Phase 1
```

### Pattern 1: Vite Plugin Configuration

**What:** `@tailwindcss/vite` must come before `@cloudflare/vite-plugin` in the plugins array.

**When to use:** Always — plugin order matters in Vite; Tailwind needs to process CSS before Cloudflare's build step.

```typescript
// src: tailwindcss.com/docs/installation (verified 2026-04-11)
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  plugins: [
    tailwindcss(),   // BEFORE cloudflare()
    cloudflare(),
    // existing sw-cache-bust plugin stays
  ],
});
```

### Pattern 2: CSS Entry Point with @theme

**What:** Single CSS file that imports Tailwind, declares the dark variant, and defines all semantic tokens.

```css
/* src/tailwind.css */
@import "tailwindcss";

/* Wire dark: variant to existing class-based theme toggle in theme.ts */
/* theme.ts sets html.dark — this makes dark: utilities respond to that class */
@custom-variant dark (&:where(.dark, .dark *));

/* Semantic colour tokens — generates bg-bg, text-text, bg-surface, etc. */
@theme {
  --color-bg: #FAFAFA;
  --color-text: #262624;
  --color-muted: rgba(38, 38, 36, 0.7);
  --color-accent: #0A850A;
  --color-surface: #FFFFFF;
  --color-border: rgba(38, 38, 36, 0.12);
}

/* Dark mode overrides via dark: variant pattern */
/* NOTE: @theme cannot contain dark: variants — dark values are applied */
/* by using dark: utility classes in HTML, not by overriding @theme */
```

**Critical detail:** `@theme` defines the *base* (light) values. Dark values are applied per-element via `dark:bg-[#121213]` or by defining a second set of tokens. The recommended approach for this project: define `--color-bg-dark`, `--color-text-dark` etc. in a `.dark` selector inside `@layer base`, then reference them in utility classes.

**Simpler approach (recommended):** Use inline `dark:` classes on the root element or use CSS to set the token values under `.dark`:

```css
/* In src/tailwind.css, after @theme */
@layer base {
  html.dark {
    --color-bg: #121213;
    --color-text: #FAF8F4;
    --color-muted: rgba(246, 240, 232, 0.6);
    --color-accent: #1EAD52;
    --color-surface: #363634;
    --color-border: rgba(246, 240, 232, 0.1);
  }
}
```

This pattern keeps `@theme` for light mode defaults and overrides CSS variables under `.dark` — which Tailwind picks up automatically when rendering `bg-bg`, `text-muted`, etc.

### Pattern 3: Screen State Machine

**What:** Module-scoped state, DOM cache pattern, data attributes for selection.

```typescript
// src/screens.ts
// Source: DOM cache pattern from existing app.ts (CONTEXT.md code insights)

type ScreenId = "welcome" | "game" | "completion";

const dom = {
  welcome: document.querySelector('[data-screen="welcome"]') as HTMLElement,
  game: document.querySelector('[data-screen="game"]') as HTMLElement,
  completion: document.querySelector('[data-screen="completion"]') as HTMLElement,
};

let currentScreen: ScreenId = "welcome";

function updateScreenDOM(next: ScreenId): void {
  (["welcome", "game", "completion"] as ScreenId[]).forEach((id) => {
    const el = dom[id];
    const active = id === next;
    el.classList.toggle("opacity-0", !active);
    el.classList.toggle("pointer-events-none", !active);
    el.setAttribute("aria-hidden", active ? "false" : "true");
  });
  currentScreen = next;
}

export function showScreen(next: ScreenId): void {
  if (next === currentScreen) return;

  if (!document.startViewTransition) {
    // Fallback: CSS opacity transition handles the visual fade
    updateScreenDOM(next);
    return;
  }

  document.startViewTransition(() => updateScreenDOM(next));
}

export function initScreens(): void {
  // All screens start hidden; showScreen("welcome") activates the first
  showScreen("welcome");
}
```

### Pattern 4: HTML Screen Containers

**What:** Three `<section>` elements inside a new `<main>`, added to `index.html` alongside existing content. Existing `.game` div stays untouched.

```html
<!-- Added to index.html inside <body>, after existing .game div -->
<main data-screens>
  <section data-screen="welcome" class="opacity-0 pointer-events-none transition-opacity duration-[250ms] ease-in-out" aria-hidden="true">
    <!-- Phase 2 content goes here -->
  </section>
  <section data-screen="game" class="opacity-0 pointer-events-none transition-opacity duration-[250ms] ease-in-out" aria-hidden="true">
    <!-- Phase 3 content goes here -->
  </section>
  <section data-screen="completion" class="opacity-0 pointer-events-none transition-opacity duration-[250ms] ease-in-out" aria-hidden="true">
    <!-- Phase 5 content goes here -->
  </section>
</main>

<footer class="text-center py-4 text-muted text-sm">
  Made with heart by Jamie &amp; Dave. &copy; 2026.
</footer>
```

### Anti-Patterns to Avoid

- **Don't add a `tailwind.config.js`:** Tailwind v4 does not use a config file — all configuration is in CSS via `@theme` and `@custom-variant`. Creating a config file does nothing.
- **Don't use `@tailwind base/components/utilities` directives:** These are v3 syntax. In v4, `@import "tailwindcss"` replaces all three.
- **Don't put `dark:` variant inside `@theme`:** The `@theme` block only takes static values. Dark overrides go in `@layer base` under an `.dark` selector.
- **Don't use the `darkMode: 'class'` JS config key:** That's v3. In v4, use `@custom-variant dark (&:where(.dark, .dark *))` in CSS.
- **Don't apply Tailwind classes to existing `.game` markup:** Old HTML keeps old CSS classes. Mixing creates cascade conflicts.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CSS custom property generation | Manual `--color-*` vars in `:root` | `@theme { --color-* }` | `@theme` generates utility classes automatically (`bg-bg`, `text-muted`) — manual vars don't |
| Dark variant wiring | JS class checks in CSS | `@custom-variant dark (...)` | One-line declaration; Tailwind handles all variant permutations |
| View Transition API polyfill | Custom animation library | Vanilla JS + CSS opacity fallback | The API is available in all current browsers (Chrome/Edge 111+, Firefox 130+, Safari 18+); opacity fallback covers the rest |
| Screen visibility toggle | JS `display` toggling | Tailwind `opacity-0 pointer-events-none` | `display: none` prevents transitions; opacity lets cross-fade work |

**Key insight:** Tailwind v4's `@theme` directive is the correct abstraction for design tokens — it generates utility classes from CSS variables automatically. Any hand-rolled approach loses this.

---

## Common Pitfalls

### Pitfall 1: `@theme` values don't update in dark mode

**What goes wrong:** You define `--color-bg: #FAFAFA` in `@theme`, but the background never changes when switching to dark mode.

**Why it happens:** `@theme` registers the *initial* value of each token. To override a token in dark mode, you must reassign the CSS variable under a `.dark` selector in `@layer base`.

**How to avoid:** After `@theme`, add:
```css
@layer base {
  html.dark { --color-bg: #121213; /* etc */ }
}
```

**Warning signs:** Dark mode classes appear to work in dev tools but `bg-bg` always shows the light value.

### Pitfall 2: CSS layer collision between `style.css` and `tailwind.css`

**What goes wrong:** Tailwind's built-in `base` layer resets conflict with the existing `reset` layer in `style.css`, or Tailwind's generated utilities are overridden by existing component styles.

**Why it happens:** Both files declare `@layer` rules. Browser merges all layers with the same name. If `style.css` declares `@layer reset, tokens, layout, components, utilities` and Tailwind also inserts into named layers, order-of-declaration determines precedence.

**How to avoid:** Keep Tailwind classes only on new elements (`[data-screen]`, `[data-screens]`, `footer`). Never apply Tailwind classes to existing `.game *` elements.

**Warning signs:** Existing game UI changes appearance after Tailwind is installed.

### Pitfall 3: `@tailwindcss/vite` plugin after `cloudflare()`

**What goes wrong:** Tailwind classes don't appear in the production build.

**Why it happens:** Plugin order in Vite matters. If `cloudflare()` runs before `tailwindcss()`, the CSS is bundled before Tailwind processes it.

**How to avoid:** Always put `tailwindcss()` first in the plugins array.

**Warning signs:** Works in `npm run dev` but fails on `npm run build`.

### Pitfall 4: `index.html` loads `tailwind.css` but Vite doesn't process it

**What goes wrong:** Tailwind utility classes don't generate — you get an unstyled page.

**Why it happens:** Vite only processes CSS that is either imported in JS/TS or linked in `index.html` as a stylesheet. If the CSS file isn't referenced anywhere Vite can see, it skips it.

**How to avoid:** Add `<link rel="stylesheet" href="/src/tailwind.css" />` to `index.html`, or import it in `app.ts` with `import './tailwind.css'`. Either works.

**Warning signs:** No `bg-bg` or other custom utility classes appear in the dev server CSS output.

### Pitfall 5: View Transition API fires but produces no animation

**What goes wrong:** `document.startViewTransition` is called, the callback runs, but there's no cross-fade.

**Why it happens:** The default View Transition cross-fade happens automatically only if the browser can diff the old and new snapshots. If screen elements are toggled via `display: none` rather than opacity, the snapshot diff may be empty or instant.

**How to avoid:** Use `opacity-0`/`opacity-100` with `pointer-events-none` for visibility. Never use `display: none` on screen containers.

**Warning signs:** `startViewTransition` returns a promise that resolves immediately with no visual transition.

---

## Code Examples

### Full `src/tailwind.css`

```css
/* Source: tailwindcss.com/docs + @custom-variant docs (verified 2026-04-11) */
@import "tailwindcss";

/* Wire dark: variant to existing .dark class on <html> (set by theme.ts) */
@custom-variant dark (&:where(.dark, .dark *));

/* Light mode token defaults — Tailwind generates bg-bg, text-text, etc. */
@theme {
  --color-bg:      #FAFAFA;
  --color-text:    #262624;
  --color-muted:   rgba(38, 38, 36, 0.7);
  --color-accent:  #0A850A;
  --color-surface: #FFFFFF;
  --color-border:  rgba(38, 38, 36, 0.12);
}

/* Dark mode overrides — reassign the same CSS variables under .dark */
@layer base {
  html.dark {
    --color-bg:      #121213;
    --color-text:    #FAF8F4;
    --color-muted:   rgba(246, 240, 232, 0.6);
    --color-accent:  #1EAD52;
    --color-surface: #363634;
    --color-border:  rgba(246, 240, 232, 0.1);
  }
}
```

### Trimmed Google Fonts URL (D-10)

```html
<!-- Replace existing Google Fonts link in index.html -->
<!-- Before: DM Sans 300..700 + Inconsolata 75..125,300..700 (full ranges) -->
<!-- After: exact weights only -->
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600&family=Inconsolata:wght@400;700&display=swap" rel="stylesheet" />
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `tailwind.config.js` + `@tailwind base/components/utilities` | `@theme` in CSS + `@import "tailwindcss"` | Tailwind v4 (Jan 2025) | No config file; all customisation in CSS |
| `darkMode: 'class'` in `tailwind.config.js` | `@custom-variant dark (...)` in CSS | Tailwind v4 | More explicit, supports any selector |
| `@tailwindcss/postcss` plugin | `@tailwindcss/vite` plugin | Tailwind v4 | No `postcss.config.js` needed; faster builds |
| `autoprefixer` dependency | Built into Tailwind v4 | Tailwind v4 | Remove from `devDependencies` if present |

**Deprecated/outdated:**
- `tailwind.config.js`: Not used in v4. Don't create one.
- `@tailwind base`: v3 directive. Use `@import "tailwindcss"` instead.
- `darkMode: 'class'` in config: v3 only. Use `@custom-variant` in CSS.

---

## Open Questions

1. **WCAG AA verification for accent greens**
   - What we know: #0A850A on #FAFAFA and #1EAD52 on #121213 are the starting values from `style.css`.
   - What's unclear: Exact contrast ratios haven't been checked in this research session. WCAG AA requires 4.5:1 for normal text, 3:1 for large text/UI.
   - Recommendation: Verify with a contrast checker before Phase 2 ships interactive elements (the UI-SPEC notes this too). In Phase 1 the accent is only used on focus rings, so this can be confirmed during Phase 2 work.

2. **`@layer base` interaction with existing `style.css` reset layer**
   - What we know: `style.css` declares `@layer reset` which zeros margins/paddings via `:where()`. Tailwind v4's `@import "tailwindcss"` also injects `@layer base` styles.
   - What's unclear: Whether Tailwind's base layer and the existing reset layer will conflict on shared selectors (e.g., `html`, `body`, `*`).
   - Recommendation: Test after installation. If conflicts appear, add `@layer base { /* empty — skip Tailwind base */ }` before the `@import` to deprioritise Tailwind's base relative to existing reset.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Vite build | ✓ | v24.14.0 | — |
| tailwindcss | STY-01 | ✗ (not installed) | — | None — must install |
| @tailwindcss/vite | STY-01 | ✗ (not installed) | — | None — must install |
| postcss | Already present | ✓ | 8.5.8 | — |
| View Transition API | SCR-03 | ✓ (Chrome 111+, Firefox 130+, Safari 18+) | browser API | CSS opacity fallback (D-06) |

**Missing dependencies with no fallback:**
- `tailwindcss` and `@tailwindcss/vite` — must be installed as part of this phase.

**Missing dependencies with fallback:**
- View Transition API — unavailable on older browsers; CSS opacity transition is the planned fallback (D-06).

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None detected |
| Config file | None — no `vitest.config.*`, `jest.config.*`, or test directory found |
| Quick run command | `npm run build` (smoke test — build must complete without errors) |
| Full suite command | Manual browser check: dark/light toggle, screen visibility, footer text |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| STY-01 | Tailwind builds without errors | smoke | `npm run build` | ✅ (existing script) |
| STY-02 | `bg-bg`, `text-text` etc. appear in built CSS | smoke | `npm run build && grep 'color-bg' dist/client/assets/*.css` | ✅ |
| STY-03 | `#FAFAFA`/`#121213` in built CSS variables | smoke | `npm run build && grep -E '(FAFAFA|121213)' dist/client/assets/*.css` | ✅ |
| STY-04 | No `light-dark()` or `color-mix()` in new CSS | smoke | `grep -r 'light-dark\|color-mix' src/tailwind.css` | ✅ |
| STY-05 | Single accent token, no colour picker references | manual | Inspect `src/tailwind.css` | — |
| SCR-01 | Three screens render in DOM | smoke | `grep -c 'data-screen' index.html` should equal 3 | ✅ |
| SCR-02 | State-driven — no URL changes on showScreen() | manual | Open app, call showScreen, confirm URL unchanged | — |
| SCR-03 | Cross-fade works in supported browser | manual | Open in Chrome, trigger showScreen, observe animation | — |
| FTR-01 | Footer text correct on all screens | smoke | `grep 'Made with heart' index.html` | ✅ |
| FTR-02 | No GitHub link in footer | smoke | `grep -v 'github' index.html` (footer area) | ✅ |

### Sampling Rate

- **Per task commit:** `npm run build` (confirms no build errors)
- **Per wave merge:** `npm run build` + manual browser check in both dark/light modes
- **Phase gate:** All smoke commands green + manual cross-fade and dark mode check before `/gsd:verify-work`

### Wave 0 Gaps

No test framework is present. This phase does not require one — all validation is via build smoke tests and manual browser checks. No Wave 0 test infrastructure needed.

---

## Project Constraints (from CLAUDE.md)

| Directive | Impact on Phase 1 |
|-----------|-------------------|
| Never commit to `main` or `staging` — work branches only | All Phase 1 work on a feature branch |
| Never run `wrangler deploy` or `npm run deploy` | No deployment in this phase |
| Follow review gates (DA review + self-review before PR) for changes touching >1 file or >30 lines | Phase 1 touches `vite.config.ts`, `index.html`, new `src/tailwind.css`, new `src/screens.ts` — review gates apply |
| Tech stack: Tailwind CSS, existing Vite + Cloudflare Workers setup stays | Confirmed: adding Tailwind to existing Vite setup |
| Backend: No worker/API changes — frontend only | Confirmed: no worker files touched |
| Compatibility: Must work on all current browsers (ES2022 target) | View Transition API fallback required (D-06) |
| Under 15 semantic colour tokens in tailwind.config.ts | Phase 1 uses 6 tokens — well within limit. Note: config is in CSS `@theme`, not `tailwind.config.ts` |
| No `console.log` in production code | `screens.ts` must not include debug logging |
| Data attributes for DOM selection, not IDs | `data-screen="welcome|game|completion"` and `data-screens` on `<main>` |
| kebab-case filenames | `tailwind.css`, `screens.ts` — compliant |
| DOM cache pattern: `const dom = { ... }` | `screens.ts` must follow this pattern |
| Double blank lines between logical sections, section headers with `// ─── Name ───` | Apply in `screens.ts` |

---

## Sources

### Primary (HIGH confidence)

- [tailwindcss.com/docs/installation](https://tailwindcss.com/docs/installation) — v4 Vite install, `@import "tailwindcss"`, plugin names and versions
- [tailwindcss.com/docs/dark-mode](https://tailwindcss.com/docs/dark-mode) — `@custom-variant dark` directive, class-based dark mode in v4
- [tailwindcss.com/docs/theme](https://tailwindcss.com/docs/theme) — `@theme` directive, namespace-to-utility mapping, dark mode override pattern
- npm registry — `tailwindcss@4.2.2`, `@tailwindcss/vite@4.2.2` verified 2026-04-11

### Secondary (MEDIUM confidence)

- [github.com/tailwindlabs/tailwindcss/issues/15399](https://github.com/tailwindlabs/tailwindcss/issues/15399) — Cloudflare build failure with beta versions; resolved in stable v4 releases
- [developer.chrome.com/docs/web-platform/view-transitions](https://developer.chrome.com/docs/web-platform/view-transitions/) — `document.startViewTransition` API, fallback pattern

### Tertiary (LOW confidence)

- Community search results on plugin ordering — multiple sources agree `tailwindcss()` before `cloudflare()`, not officially documented

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — versions verified against npm registry; official docs used for all setup steps
- Architecture: HIGH — patterns derived from official Tailwind v4 docs and existing codebase conventions
- Pitfalls: HIGH — most pitfalls are direct consequences of documented v4 changes from v3

**Research date:** 2026-04-11
**Valid until:** 2026-07-11 (Tailwind v4 is stable; unlikely to break in 90 days)
