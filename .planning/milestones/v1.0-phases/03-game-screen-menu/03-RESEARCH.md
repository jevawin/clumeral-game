# Phase 3: Game Screen + Menu — Research

**Researched:** 2026-04-12
**Domain:** Vanilla TypeScript DOM migration — game screen rebuild + hamburger menu
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Clue Presentation**
- D-01: Keep the current clue format — property type label, highlighted digit box indicators showing which positions the clue applies to, clue text, and operator+value on a second line in bold accent colour.
- D-02: No card wrapper around the clue list — clues render directly on the background (GAM-01).
- D-03: Keep skeleton loaders while the puzzle fetches — placeholder shapes matching the clue layout.

**Game Header**
- D-04: Sticky header bar with three elements: "Clumeral" logo text (left), puzzle number (centre or beside logo), hamburger menu trigger (right).
- D-05: Subtle bottom border (border token colour) separating header from content.
- D-06: Header stays pinned at the top when scrolling on small screens.

**Menu Style**
- D-07: Hamburger icon in header opens a dropdown/popover with four items: light/dark toggle, archive link, feedback trigger, how-to-play link.
- D-08: Menu closes on tap outside AND has a close button (both dismissal methods).
- D-09: Menu uses existing SVG icons from `public/sprites.svg` (moon/sun, archive, feedback, help).

**Migration Approach**
- D-10: Rebuild game markup from scratch inside `[data-screen="game"]` — new HTML, Tailwind classes, new data attributes.
- D-11: Remove old game markup from `index.html` (the `<div id="puzzle" class="card">` block and surrounding elements) — don't just hide it.
- D-12: Update `app.ts` DOM cache and render functions to target the new elements.
- D-13: Drop the hint text ("Tap a box to eliminate possible numbers") — players get guidance from the welcome screen how-to-play.

### Claude's Discretion
- Digit elimination visual treatment (cross-out, fade, strikethrough — pick what fits the new layout)
- Dark mode toggle style in dropdown (labelled switch vs icon swap)
- Spacing, padding, and responsive adjustments
- Exact header layout proportions (logo/puzzle/hamburger sizing)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| GAM-01 | Game screen shows clues listed directly on background (no card wrapper) | D-02 locked; clue list renders on `bg-bg`; `renderClues()` targets new `[data-clue-list]` — no wrapper div needed |
| GAM-02 | Game screen shows digit boxes with number pad input | Digit box HTML, `buildKeypad()`, `renderBox()` all reusable; DOM cache keys need renaming to new data attributes |
| GAM-03 | Game screen shows submit button | `[data-submit-wrap]` + `[data-submit]` pattern unchanged; `checkSubmit()` logic unchanged |
| GAM-04 | Digit elimination works exactly as current implementation | `toggleDigit()`, `possibles`, `renderBox()`, `buildKeypad()` are pure logic — no changes needed; only DOM targets change |
| GAM-05 | Guess submission and server-side validation works without regression | `handleGuess()` fetch call and API contract unchanged; only DOM feedback targets change |
| GAM-06 | Random puzzle and replay modes work through the new screen flow | `loadPuzzle()` path detection and `startRandomPuzzle()` / `startReplayPuzzle()` unchanged; `showScreen("game")` is already wired in `screens.ts` |
| MNU-01 | Compact menu accessible from game screen header (hamburger or icon) | `[data-menu-btn]` button in sticky header; hamburger icon from sprites.svg |
| MNU-02 | Menu contains light/dark mode toggle | `[data-theme-toggle]` in dropdown; calls existing `initTheme()` toggle — requires new button to wire the same `click` listener |
| MNU-03 | Menu contains archive link | `<a href="/puzzles">` inside `[data-menu]`; icon from sprites.svg |
| MNU-04 | Menu contains feedback trigger | `[data-fb-btn]` inside `[data-menu]`; wires to existing `initFeedbackModal()` listener |
| MNU-05 | Menu contains how-to-play link | `[data-htp-btn]` inside `[data-menu]`; wires to existing `initModal()` listener |
</phase_requirements>

---

## Summary

Phase 3 is a DOM migration and HTML rebuild, not a logic rebuild. The game logic in `app.ts` — `toggleDigit()`, `handleGuess()`, `renderBox()`, `renderClues()`, `buildKeypad()` — stays intact. The only changes to `app.ts` are: (1) update the `dom` cache to point at new data attributes inside `[data-screen="game"]`, and (2) move event listeners that currently bind to elements that no longer exist in the new markup (digit boxes, submit button).

The hamburger menu is the only genuinely new feature. It is a simple show/hide dropdown with four wired items. Three of those items already have working implementations: `initTheme()` for the toggle, `initModal()` for how-to-play, and `initFeedbackModal()` for feedback. The menu needs a new `initMenu()` function that handles open/close, click-outside, Escape key, and focus management.

The migration risk is in the DOM cache transition. `app.ts` currently queries elements at module load time. If new elements don't exist in the DOM at that moment, all `dom.*` references will be null. The fix is to defer DOM cache population until `[data-screen="game"]` has been injected with its content — or to replace the module-level `const dom = {}` with a lazy initialisation pattern called from inside `loadPuzzle()`.

**Primary recommendation:** Write game screen HTML into `index.html` directly (same approach as Phase 2 for the welcome screen), then update `app.ts` DOM cache to target the new data attributes. Do not dynamically inject the game screen HTML — Phase 2 already showed the pattern of HTML-in-index with JS wiring.

---

## Standard Stack

### Core (verified from codebase)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Tailwind CSS v4 | 4.x (via `tailwindcss/theme` imports in `src/tailwind.css`) | Utility classes for all new markup | Locked in Phase 1; `@theme` tokens already defined |
| TypeScript | 6.0.2 | All new module code | Project standard; strict mode |
| Vite | 8.0.3 | Dev server and build | Existing build tool |

### Supporting (existing project modules)

| Module | Purpose | How Phase 3 Uses It |
|--------|---------|---------------------|
| `src/screens.ts` | `showScreen("game")` | Already wired; game content just needs to exist |
| `src/theme.ts` | `initTheme()`, theme toggle listener | Menu's dark mode button wires into the same listener |
| `src/modals.ts` | `initModal()`, `initFeedbackModal()` | Menu's HTP and feedback buttons trigger existing open functions |
| `src/app.ts` | All game logic | DOM cache updated; logic untouched |
| `public/sprites.svg` | Icon sprite sheet | Hamburger, moon, sun, archive, feedback, help icons |

**No new npm packages required.**

---

## Architecture Patterns

### Recommended File Changes

```
index.html                    — add game screen HTML inside [data-screen="game"]; remove old puzzle card
src/app.ts                    — update dom cache; add initMenu(); update event listener wiring
src/theme.ts                  — no changes (menu wires to existing toggle behaviour)
src/modals.ts                 — no changes (menu wires to existing open functions)
src/screens.ts                — remove "hide overlay when game screen empty" guard (game screen won't be empty)
```

### Pattern 1: HTML-in-index, JS wiring (Phase 2 precedent)

Phase 2 showed the pattern: write static HTML into `[data-screen="welcome"]` in `index.html`, then wire interactivity in a dedicated `welcome.ts` module. Phase 3 follows the same approach.

Game screen HTML goes directly into `[data-screen="game"]` in `index.html`. The `app.ts` DOM cache then queries those elements as it does today — no dynamic injection.

**Why:** The game screen is not conditionally rendered. It always exists in the DOM; `screens.ts` just controls its visibility via opacity. Static HTML is simpler, avoids timing issues with `querySelector` at module load, and matches Phase 2 precedent.

### Pattern 2: DOM cache with new data attributes

The existing `dom` cache in `app.ts` uses old data attributes (`data-hint`, `data-digits`, `data-keypad-wrap`, etc.). These still work if we keep the same attribute names on the new elements. The UI-SPEC uses the same attribute names (`[data-digits]`, `[data-keypad-wrap]`, `[data-keypad]`, `[data-submit-wrap]`, `[data-submit]`, `[data-feedback]`, `[data-history]`, `[data-history-list]`), so the DOM cache needs minimal changes.

Key diff from old to new:
- `dom.clueList` currently uses `.clue-list` (class selector) — change to `[data-clue-list]`
- `dom.plabel` (`[data-plabel]`) — keep but new location inside game header
- `dom.hint` (`[data-hint]`) — DROP (D-13 removes hint text)
- `dom.save` / `dom.saveCheck` — keep (save-score row stays)
- `dom.stats`, `dom.next`, `dom.nextNumber`, `dom.again` — keep (these are post-guess UI, stay in game screen)

### Pattern 3: `initMenu()` — new function in `app.ts`

The hamburger menu needs its own initialisation function. Pattern follows `initModal()` in `modals.ts`:

```typescript
// Source: src/modals.ts initModal() pattern
function initMenu(): void {
  const menuBtn = document.querySelector('[data-menu-btn]') as HTMLButtonElement | null;
  const menu = document.querySelector('[data-menu]') as HTMLElement | null;
  if (!menuBtn || !menu) return;

  function openMenu(): void {
    menu!.classList.remove('hidden');
    menuBtn!.setAttribute('aria-expanded', 'true');
    // move focus to first focusable item
    (menu!.querySelector('button, a') as HTMLElement | null)?.focus();
  }

  function closeMenu(): void {
    menu!.classList.add('hidden');
    menuBtn!.setAttribute('aria-expanded', 'false');
    menuBtn!.focus();
  }

  menuBtn.addEventListener('click', openMenu);
  document.querySelector('[data-menu-close]')?.addEventListener('click', closeMenu);
  document.addEventListener('click', (e) => {
    if (!menu!.contains(e.target as Node) && e.target !== menuBtn) closeMenu();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !menu!.classList.contains('hidden')) closeMenu();
  });
}
```

The menu's `[data-theme-toggle]` button needs an additional `click` listener that calls the theme toggle. But `initTheme()` in `theme.ts` binds the toggle listener inside its closure — it queries `[data-theme-toggle]` once. If the new menu also has `[data-theme-toggle]`, `initTheme()` will find only the first match. **This is the key wiring pitfall** — see Pitfall 2.

### Pattern 4: `screens.ts` guard removal

`screens.ts` has a guard at line 40–43 that hides the entire screen overlay when the game screen is empty (`const gameEmpty = !dom.game.children.length`). Once game content is in `index.html`, this guard is no longer needed and should be removed — otherwise the overlay may flash invisible on first render.

### Anti-Patterns to Avoid

- **Dynamically injecting game screen HTML from JS** — creates timing issues with DOM cache initialisation. Write HTML directly in `index.html`.
- **Using class selectors for new game elements** — project convention is `data-*` attributes for DOM selection. Don't introduce `.clue-list` class selectors.
- **Calling `initTheme()` again** — `initTheme()` reads localStorage and sets up the theme from scratch. Don't call it twice. Wire the menu toggle button to fire the same `click` event on the existing `[data-theme-toggle]`, or export a `toggleTheme()` function from `theme.ts`.
- **Keeping the old puzzle card in a hidden state** — D-11 says remove it, not hide it. Hidden markup with duplicate data attributes will confuse `querySelector`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| View Transition cross-fade | Custom CSS animation | `document.startViewTransition()` already in `screens.ts` | Already implemented with fallback |
| SVG icons | New SVG files or inline SVG blobs | `public/sprites.svg` with `<use href="/sprites.svg#icon-*"/>` | All needed icons already exist |
| Modal open/close | New modal system | `initModal()` / `initFeedbackModal()` in `modals.ts` | Already handles focus, Escape, click-outside, transitions |
| Theme toggle | New toggle logic | `initTheme()` in `theme.ts` | Already reads localStorage, applies classes, updates canvas |
| Skeleton animation | Custom CSS keyframes | Tailwind `animate-pulse` | Built-in, matches UI-SPEC |
| Click-outside detection | MutationObserver or pointer capture | `document.addEventListener('click', ...)` with `contains()` check | Simple, correct pattern already used in `modals.ts` |

---

## Common Pitfalls

### Pitfall 1: DOM cache reads null because elements don't exist yet

**What goes wrong:** `app.ts` runs `const dom = { ... }` at module level. If the game screen HTML is not yet in the DOM when the module executes, every `dom.*` reference is null. All render functions silently no-op.

**Why it happens:** Module-level `querySelector` runs once, immediately on parse. This is only safe if the target elements already exist in `index.html` before the script runs.

**How to avoid:** Write game screen HTML statically in `index.html` before the `<script type="module" src="/src/app.ts">` tag. The existing approach (static HTML in `index.html`, queried at module load) works fine when the HTML is there. Phase 2's `welcome.ts` follows the same model.

**Warning signs:** `dom.digits` is null at page load; digit box click listeners silently fail to attach.

---

### Pitfall 2: `initTheme()` only wires the first `[data-theme-toggle]` it finds

**What goes wrong:** The old footer had one `[data-theme-toggle]`. The new menu also has `[data-theme-toggle]`. `initTheme()` calls `document.querySelector('[data-theme-toggle]')` (single element) — it only wires the first match. The second toggle in the menu won't toggle the theme.

**Why it happens:** `initTheme()` is designed for a single toggle button. Multiple `[data-theme-toggle]` elements in the DOM means only the first gets the `click` listener.

**How to avoid:** Two options:
1. Give the menu's toggle a different data attribute (e.g., `data-menu-theme-toggle`) and inside `initMenu()`, wire it to dispatch a programmatic `click` on the primary `[data-theme-toggle]`, or fire the same `applyTheme` logic.
2. Export a `toggleTheme()` function from `theme.ts` and call it directly from the menu button's listener.

Option 2 is cleaner. `theme.ts` currently does not export `toggleTheme()` — this export needs to be added.

**Warning signs:** Clicking dark mode in the menu does nothing; `initTheme()` listener fires on the original element (which no longer exists after the footer is removed).

---

### Pitfall 3: Old footer `[data-theme-toggle]` removed but `initTheme()` bound to it

**What goes wrong:** The old footer links (lines 392–432 in `index.html`) include `[data-theme-toggle]`, `[data-htp-btn]`, `[data-fb-btn]`. D-11 says remove the old markup. After removal, `initTheme()` finds no `[data-theme-toggle]` and returns early (line 27 in `theme.ts`: `if (!togBtn) return;`). Theme toggle breaks entirely.

**Why it happens:** `initTheme()` is called during `Init` at line 785 of `app.ts`, before any user interaction. Once the old footer is removed, the element it expects is gone.

**How to avoid:** Ensure the new menu's `[data-theme-toggle]` is in the DOM before `initTheme()` runs — which it will be if the HTML is static in `index.html`. Then handle the multiple-toggle issue described in Pitfall 2.

**Warning signs:** Dark mode toggle stops working entirely after old footer is removed.

---

### Pitfall 4: Analytics listeners bound to removed elements

**What goes wrong:** `app.ts` lines 794–804 bind analytics tracking to elements in the old footer: `[data-htp-btn]`, `[data-modal-gotit]`, `[data-fb-send]`, `[data-theme-toggle]`, `[data-swatches]`. After removing the old markup, these queries return null — the listeners are never attached.

**Why it happens:** The analytics wiring at the bottom of `app.ts` uses the same data attributes as the old footer. The new menu uses the same attributes — so the listeners should naturally transfer. But `[data-swatches]` (colour swatch picker) is in the old footer and is being removed (colour picker is dropped per Phase 1 decisions).

**How to avoid:**
- `[data-htp-btn]` — will exist in new menu; analytics listener attaches correctly.
- `[data-theme-toggle]` — will exist in new menu; analytics listener attaches correctly.
- `[data-fb-send]` / `[data-modal-gotit]` — inside modals, unchanged.
- `[data-swatches]` — colour picker removed; delete this analytics listener.

**Warning signs:** `track('theme_toggle')` never fires; no console error (listener silently not attached).

---

### Pitfall 5: `screens.ts` overlay stays invisible if game screen children check still active

**What goes wrong:** `screens.ts` line 42: `overlay.classList.toggle('invisible', next === 'game' && gameEmpty)`. Once game screen has content, `gameEmpty` is always false — but the check remains. If content is ever cleared (e.g., a future dynamic render), the overlay hides itself.

**Why it happens:** The guard was added as a Phase 2 temporary measure to let the old UI show through while game screen was empty.

**How to avoid:** Remove the guard and the `gameEmpty` variable from `screens.ts` as part of this phase.

---

### Pitfall 6: `dom.plabel` location change breaks puzzle label rendering

**What goes wrong:** `startDailyPuzzle()` and `startRandomPuzzle()` write to `dom.plabel` to show "Puzzle #N · date". In the old markup, `[data-plabel]` was inside the card. In the new layout, it moves to the sticky header. But `startReplayPuzzle()` also calls `dom.plabel.parentElement.insertBefore(label, dom.plabel)` to insert an "Archived puzzle" label — this DOM manipulation assumes `[data-plabel]` has a specific parent structure.

**How to avoid:** Keep `[data-plabel]` as a direct child of the header's left-section div. The `insertBefore` call in `startReplayPuzzle()` will still work as long as the parent element is a flex container that can accommodate a sibling element above the puzzle number.

---

## Code Examples

### Sticky header structure (from UI-SPEC)

```html
<!-- Source: 03-UI-SPEC.md Layout Contract -->
<header data-game-header class="h-14 sticky top-0 z-30 flex items-center justify-between px-4 bg-bg border-b border-border">
  <div class="flex items-center gap-2">
    <span class="text-xl font-bold text-text">Clumeral</span>
    <span data-plabel class="text-muted text-base"></span>
  </div>
  <button data-menu-btn class="h-10 w-10 flex items-center justify-center text-text" aria-expanded="false" aria-controls="game-menu" aria-label="Open menu">
    <svg width="24" height="24" aria-hidden="true"><use href="/sprites.svg#icon-menu"/></svg>
  </button>
</header>
```

### Menu dropdown structure (from UI-SPEC)

```html
<!-- Source: 03-UI-SPEC.md Component Inventory -->
<div id="game-menu" data-menu role="dialog" aria-label="Game menu"
     class="hidden absolute top-14 right-0 z-40 min-w-[200px] py-2 bg-surface border border-border rounded-lg shadow-lg">
  <button data-theme-toggle class="flex items-center gap-3 px-4 py-3 w-full text-base text-text hover:bg-bg">
    <svg width="20" height="20" class="text-muted" aria-hidden="true"><use href="/sprites.svg#icon-moon"/></svg>
    <span data-theme-label>Dark mode</span>
  </button>
  <a href="/puzzles" class="flex items-center gap-3 px-4 py-3 w-full text-base text-text hover:bg-bg">
    <svg width="20" height="20" class="text-muted" aria-hidden="true"><use href="/sprites.svg#icon-archive"/></svg>
    Archive
  </a>
  <button data-fb-btn class="flex items-center gap-3 px-4 py-3 w-full text-base text-text hover:bg-bg">
    <svg width="20" height="20" class="text-muted" aria-hidden="true"><use href="/sprites.svg#icon-feedback"/></svg>
    Feedback
  </button>
  <button data-htp-btn class="flex items-center gap-3 px-4 py-3 w-full text-base text-text hover:bg-bg">
    <svg width="20" height="20" class="text-muted" aria-hidden="true"><use href="/sprites.svg#icon-help"/></svg>
    How to play
  </button>
  <button data-menu-close class="flex items-center gap-3 px-4 py-3 w-full text-base text-muted hover:bg-bg">
    <svg width="20" height="20" aria-hidden="true"><use href="/sprites.svg#icon-circle-x"/></svg>
    <span class="sr-only">Close menu</span>
  </button>
</div>
```

### Clue list (from UI-SPEC — no card wrapper)

```html
<!-- Source: 03-UI-SPEC.md Layout Contract -->
<div data-clue-list role="list" aria-label="Puzzle clues" aria-busy="true"
     class="[display:grid] [grid-template-columns:max-content_1fr] gap-x-2 gap-y-4">
  <!-- Skeleton loaders (3 rows) — replaced by renderClues() -->
  <div class="clue-skeleton contents" aria-hidden="true">
    <div class="w-16 h-8 rounded bg-surface animate-pulse"></div>
    <div class="flex flex-col gap-2">
      <div class="h-4 w-4/5 rounded bg-surface animate-pulse"></div>
      <div class="h-4 w-2/5 rounded bg-surface animate-pulse"></div>
    </div>
  </div>
</div>
```

### `dom` cache keys that change in `app.ts`

```typescript
// Source: src/app.ts current dom cache — changes required
const dom = {
  // REMOVE: hint — D-13 drops hint text
  // hint: $('[data-hint]') as HTMLElement | null,

  // RENAME target selector: .clue-list → [data-clue-list]
  clueList: $('[data-clue-list]') as HTMLElement | null,

  // KEEP (same data attributes in new markup):
  feedback: $('[data-feedback]') as HTMLElement | null,
  digits: $('[data-digits]') as HTMLElement | null,
  keypadWrap: $('[data-keypad-wrap]') as HTMLElement | null,
  keypad: $('[data-keypad]') as HTMLElement | null,
  submitWrap: $('[data-submit-wrap]') as HTMLElement | null,
  submitBtn: $('[data-submit]') as HTMLButtonElement | null,
  save: $('[data-save]') as HTMLElement | null,
  saveCheck: $('[data-save-check]') as HTMLInputElement | null,
  stats: $('[data-stats]') as HTMLElement | null,
  next: $('[data-next]') as HTMLElement | null,
  nextNumber: $('[data-next-number]') as HTMLElement | null,
  again: $('[data-again]') as HTMLElement | null,
  plabel: $('[data-plabel]') as HTMLElement | null,
  history: $('[data-history]') as HTMLElement | null,
  historyList: $('[data-history-list]') as HTMLElement | null,
};
```

---

## Environment Availability

Step 2.6: SKIPPED — this phase is purely frontend HTML/CSS/TS changes. No external tools, services, databases, or CLI utilities beyond the existing Vite dev server are required.

---

## Validation Architecture

`nyquist_validation` is enabled in `.planning/config.json`.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None detected — no test runner in `package.json` scripts; no `vitest.config.*`, `jest.config.*`, or test directories in the project root |
| Config file | None |
| Quick run command | Manual: `npm run dev` + browser smoke test |
| Full suite command | Manual: `npm run build` (TypeScript compile check) |

No automated test infrastructure exists. All validation is manual browser testing and TypeScript compile checks.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| GAM-01 | Clues render directly on background (no card wrapper) | visual smoke | `npm run build` (compile only) | ❌ manual |
| GAM-02 | Digit boxes and number pad accept input | interaction smoke | manual in browser | ❌ manual |
| GAM-03 | Submit button present and submits | interaction smoke | manual in browser | ❌ manual |
| GAM-04 | Digit elimination works exactly as before | regression smoke | manual in browser | ❌ manual |
| GAM-05 | Guess submission reaches worker, correct/incorrect returned | integration smoke | manual in browser + network tab | ❌ manual |
| GAM-06 | Random puzzle and replay modes work | integration smoke | manual — visit `/random` and `/puzzles/N` | ❌ manual |
| MNU-01 | Hamburger opens menu | interaction smoke | manual in browser | ❌ manual |
| MNU-02 | Light/dark toggle in menu works | interaction smoke | manual in browser | ❌ manual |
| MNU-03 | Archive link present and navigates | interaction smoke | manual in browser | ❌ manual |
| MNU-04 | Feedback trigger opens feedback modal | interaction smoke | manual in browser | ❌ manual |
| MNU-05 | HTP link opens how-to-play modal | interaction smoke | manual in browser | ❌ manual |

### Sampling Rate

- **Per task commit:** `npm run build` — catches TypeScript errors
- **Per wave merge:** `npm run build` + manual browser smoke of changed area
- **Phase gate:** All requirements manually verified in browser before `/gsd:verify-work`

### Wave 0 Gaps

No test framework to install. This project uses manual browser testing only. TypeScript strict mode (`tsconfig.json`: `strict: true`) acts as the primary automated check.

- [ ] Confirm TypeScript compiles cleanly after each wave: `npm run build`

---

## Project Constraints (from CLAUDE.md)

These directives apply to all implementation work in this phase:

- **Never commit to `main` or `staging`** — work on branch `192-redesign-three-screens` (current branch)
- **Never run `wrangler deploy` or `npm run deploy`**
- **Follow review gates** (DA review + self-review + PR) for changes touching more than one file, adding/removing >30 lines, or changing CSS/theming
- **Tech stack:** Tailwind CSS, existing Vite + Cloudflare Workers setup — no new dependencies
- **Backend:** No worker/API changes — frontend only
- **Design:** Under 15 semantic colour tokens in `tailwind.config.ts` — Phase 1 has 6, this phase adds none
- **DOM selection:** Use `data-*` attributes, not IDs or class selectors
- **Event listeners:** Attach at module level, not inside `startDailyPuzzle()` or similar functions
- **No `console.log`** in production code — use `track()` for analytics or swallow errors silently
- **File naming:** kebab-case for new files; no camelCase
- **Section headers:** `// ─── Section Name ───` pattern in TypeScript files
- **Prettier:** `printWidth: 200`, `htmlWhitespaceSensitivity: ignore`
- **Tailwind dark mode:** `dark:` variants, not `light-dark()` or `color-mix()` — note: legacy `style.css` uses `light-dark()` but new Tailwind markup must use `dark:` variants per STY-04
- **Green accent only** — no colour theme picker (picker removed; delete `[data-swatches]` analytics listener)

---

## Open Questions

1. **Does `public/sprites.svg` contain a hamburger/menu icon?**
   - What we know: The file contains: help, feedback, archive, moon, sun, heart, check, uncheck, cookie, github, info, circle-x, octo-related icons (verified from `index.html` usage).
   - What's unclear: No `icon-menu` (hamburger) reference appears in the existing codebase. The menu button needs an icon.
   - Recommendation: Check `public/sprites.svg` for a menu/hamburger icon. If absent, use three horizontal lines rendered as inline `<svg>` with three `<rect>` elements rather than importing a new sprite — or use `icon-circle-x` rotated as a close icon and Unicode `☰` as the hamburger character (accessible since it has an `aria-label`).

2. **`theme.ts` `initTheme()` queries a single `[data-theme-toggle]` — the old footer element is being removed**
   - What we know: `initTheme()` calls `document.querySelector('[data-theme-toggle]')` (line 27). The old footer had this element. The new menu also uses `[data-theme-toggle]`.
   - What's unclear: If both exist at load time, `querySelector` returns the first match. If the HTML order places menu before footer (it will, since menu is inside the game screen which comes after the old markup), the new toggle is found first.
   - Recommendation: Remove the old footer `[data-theme-toggle]` as part of D-11. The new menu's `[data-theme-toggle]` is found by `initTheme()`. No changes to `theme.ts` needed — `initTheme()` works as-is on the single new toggle. Confirm this in Wave 1 by verifying the toggle works after old footer removal.

3. **Save-score checkbox — keep or drop?**
   - What we know: D-13 drops the hint text. The save-score row (`[data-save]`) is not mentioned in the CONTEXT.md decisions either way.
   - What's unclear: The UI-SPEC includes the save-score row in the layout contract. Treat it as kept.
   - Recommendation: Keep `[data-save]` and `[data-save-check]` in the new markup. The UI-SPEC shows it appearing below the submit button with `mt-4`.

---

## Sources

### Primary (HIGH confidence)

- `src/app.ts` — Full game logic, DOM cache, render functions, event wiring (read directly)
- `src/screens.ts` — Screen state machine, overlay guard (read directly)
- `src/theme.ts` — Theme toggle implementation (read directly)
- `src/modals.ts` — Modal open/close pattern, feedback modal (read directly)
- `src/welcome.ts` — Phase 2 pattern for module structure and `showScreen()` wiring (read directly)
- `src/tailwind.css` — Tailwind v4 `@theme` tokens (read directly)
- `.planning/phases/03-game-screen-menu/03-UI-SPEC.md` — Approved visual and interaction contract (read directly)
- `.planning/phases/03-game-screen-menu/03-CONTEXT.md` — Locked decisions (read directly)
- `index.html` lines 280–457 — Current game markup and new screen shells (read directly)

### Secondary (MEDIUM confidence)

- `docs/DESIGN-SYSTEM.md` — Token definitions, clue display rules
- `docs/CONVENTIONS.md` — Accessibility, DOM patterns, code style

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all tools and libraries are already in use; no new dependencies
- Architecture: HIGH — migration pattern clear from Phase 2 precedent; logic untouched
- Pitfalls: HIGH — identified from direct codebase reading; not speculative

**Research date:** 2026-04-12
**Valid until:** 2026-05-12 (stable codebase; no fast-moving dependencies)
