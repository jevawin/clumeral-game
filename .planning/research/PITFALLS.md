# Pitfalls Research

**Domain:** Daily puzzle game — Tailwind CSS migration + multi-screen UI redesign
**Researched:** 2026-04-11
**Confidence:** HIGH (verified against official Tailwind docs, community issues, and codebase inspection)

---

## Critical Pitfalls

### Pitfall 1: Dynamic class names get purged in production

**What goes wrong:**
Tailwind scans source files statically at build time. Any class name assembled at runtime — via string concatenation, template literals, or conditional string building — won't appear in the final CSS. The style works in dev (where all classes may be generated) and silently breaks in production.

This is directly relevant here. The existing codebase builds class names dynamically — for example, `keypad__btn` + `" elim"` (app.ts line 402). When porting that logic to Tailwind, the temptation is `"keypad__btn " + (disabled ? "opacity-25 text-gray-400" : "")`. Tailwind won't see `opacity-25` or `text-gray-400` in the concatenated output.

**Why it happens:**
Developers coming from CSS expect classes to be available globally. Tailwind's JIT engine only ships classes it can find as complete literal strings in scanned files.

**How to avoid:**
Always write full class strings. Use a lookup object or conditional:
```ts
// Bad — purged in production
const cls = "keypad__btn " + (disabled ? "opacity-25" : "");

// Good — full class strings visible at scan time
const cls = disabled ? "keypad__btn opacity-25" : "keypad__btn";
```
For state-driven styles (eliminated digits, active digit box, disabled submit), define the full class variants upfront as constants or lookup maps. Never concatenate fragments.

**Warning signs:**
- Styles work in `vite dev` but disappear after `vite build`
- Toggled states (eliminated, active, disabled) lose styling in the production preview

**Phase to address:**
Setup phase (Tailwind installation) — establish the pattern before any component is built. Enforce via code review checklist.

---

### Pitfall 2: Tailwind Preflight wipes existing styles during parallel CSS period

**What goes wrong:**
The plan is to run old CSS and new Tailwind CSS side by side until the old CSS is fully replaced. Tailwind's Preflight (its built-in CSS reset) fires immediately on install and zeroes out margins, padding, list bullets, button styles, and heading sizes across the whole page — including elements still styled by the old CSS. This causes visual chaos before the old CSS is removed.

The existing `style.css` has its own `@layer reset` with `:where(*, *::before, *::after)` zeroing, so the two resets will interact unpredictably, with Preflight likely winning due to specificity.

**Why it happens:**
Developers add Tailwind and import it globally, not realising Preflight is opt-out rather than opt-in.

**How to avoid:**
One of two approaches:

Option A — Disable Preflight entirely during the parallel period, re-enable it once old CSS is removed:
```js
// tailwind.config.ts (v3) or CSS config (v4)
corePlugins: { preflight: false }
```

Option B (preferred given the clean-break approach) — Build each new screen in isolation behind a screen-switcher flag. Old CSS only applies to hidden screens, new Tailwind CSS only applies to visible ones. Remove old CSS at end of each screen's completion, not at the end of the whole project.

**Warning signs:**
- Buttons lose their border/padding immediately after Tailwind is added
- Headings collapse to body-size text
- Lists lose bullets
- The `style.css` custom properties override partially fail

**Phase to address:**
Tailwind setup phase — decide the coexistence strategy before installing.

---

### Pitfall 3: Dark mode flash on page load (FOUC)

**What goes wrong:**
The new design uses Tailwind's `class` dark mode strategy (toggling `.dark` on `<html>`). If the theme preference is read from `localStorage` by a script that loads after the HTML paints, users briefly see the light theme before the dark class is applied. This is jarring and very visible on the welcome screen's dark background.

The existing `theme.ts` already handles this correctly — it reads `localStorage` and applies the class immediately. But if that logic is restructured or moved during the redesign, the protection can accidentally be removed.

**Why it happens:**
The Tailwind `class` strategy relies on JS to set `.dark`. If that JS runs after first paint — even by a few milliseconds — the flash happens. Inline `<script>` in `<head>` is immune; deferred or module scripts are not.

**How to avoid:**
Keep theme initialisation in an inline `<script>` in `<head>`, not in the main JS module bundle. The minimal version:
```html
<script>
  const saved = localStorage.getItem('dlng_theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  if (saved === 'dark' || (!saved && prefersDark)) {
    document.documentElement.classList.add('dark');
  }
</script>
```
The full `theme.ts` toggle logic stays in the bundle; this inline script just sets the class synchronously before anything renders.

**Warning signs:**
- A white flash before dark backgrounds appear on hard refresh
- Flash only on first load (cached subsequent loads are fine — a false signal)
- Issue reproducible by throttling CPU in DevTools

**Phase to address:**
Welcome screen build phase — before dark backgrounds are introduced.

---

### Pitfall 4: Coexisting old `color-mix()` / `light-dark()` CSS conflicts with Tailwind's colour system

**What goes wrong:**
The existing `style.css` uses `light-dark()` and `color-mix()` extensively for its CSS custom properties (`--bg`, `--acc`, `--tag-bg`, etc.). The PROJECT.md requirement is: **no `color-mix()` or `light-dark()` in the new code — Tailwind `dark:` variants and opacity modifiers only**.

During the parallel period, old CSS with `light-dark()` will still be active. If any new Tailwind components reference the old CSS variables (e.g., `style="color: var(--acc)"`) instead of Tailwind colour tokens, the two systems will produce inconsistent colours — especially on theme toggle, where Tailwind updates the `.dark` class but the CSS variable relies on `color-scheme` to switch.

**Why it happens:**
The old custom properties look convenient and are already defined. Reaching for `var(--acc)` in a new component feels like reuse, but it couples new code to the old system you're replacing.

**How to avoid:**
Define all colours as Tailwind tokens in `tailwind.config.ts`. Never reference old CSS variables from new Tailwind-styled components. When building a new screen, start by mapping each old custom property to a Tailwind semantic token:

| Old | New Tailwind token |
|-----|-------------------|
| `--acc` | `accent` |
| `--bg` | `background` |
| `--text` | `foreground` |
| `--muted` | `muted` |

Use `dark:` variants on the token, not `light-dark()`.

**Warning signs:**
- Accent colour doesn't switch on dark/light toggle in new components
- New components use a slightly different shade than old components on the same screen during transition
- `inline style` with `var(--acc)` appearing in new HTML

**Phase to address:**
Tailwind setup phase — define the full token map before any screen is built. Enforce: no `var(--)` in new component HTML.

---

### Pitfall 5: Screen state coupling breaks game logic

**What goes wrong:**
The redesign introduces three screens (welcome, game, completion) driven by a JS state variable. The existing game logic in `app.ts` — `possibles`, `gameState`, `submitting`, `activeBox` — is tightly coupled (noted in CONCERNS.md). When the screen-switcher hides or removes the game screen's DOM, any event listeners attached to now-hidden elements may fire against detached nodes, or fail silently when elements are `null`.

Specifically: if the game screen is hidden via `display: none` (which Tailwind's `hidden` class does), the DOM is still present but invisible. If it's conditionally removed from the DOM (like a component unmount), all the module-level references in `app.ts` (e.g., `document.querySelector('[data-keypad]')`) become stale.

**Why it happens:**
The existing app was built as a single-screen app. All DOM queries run once on init. A screen-transition architecture assumes elements can come and go, but the existing module pattern doesn't account for that.

**How to avoid:**
Use `display: none` / `display: flex` (or Tailwind's `hidden` / `block`) rather than removing elements from the DOM. This keeps all DOM references valid. The screen-switcher function only toggles visibility — never destroys nodes.

Document this constraint at the top of the screen-switcher module. Also verify that the `submitting` guard (app.ts line 612) is not disrupted by screen transitions — if the user somehow triggers a guess while navigating, it must still be blocked.

**Warning signs:**
- `null` reference errors in the console when switching screens
- Keypad buttons stop responding after returning to the game screen
- Double-submit guard stops working

**Phase to address:**
Screen architecture phase — establish the visibility-toggle pattern before any screen components are built.

---

### Pitfall 6: Tailwind v4 vs v3 — wrong version choice for this setup

**What goes wrong:**
Tailwind v4 (current as of 2026) is the right choice for new Vite projects. However, v4 drops PostCSS as the primary integration path in favour of `@tailwindcss/vite` — a first-party Vite plugin. This project uses `@cloudflare/vite-plugin` already. Stacking a second Vite plugin (`@tailwindcss/vite`) is the documented approach, but needs verifying for compatibility with the Cloudflare plugin.

If v3 is installed by mistake (e.g., `npm install tailwindcss` without specifying `@latest` in some environments), you get a PostCSS config that then conflicts with the Cloudflare plugin's own PostCSS setup.

Also: v4 is CSS-first. The design token config lives in a CSS file using `@theme { }`, not a `tailwind.config.ts`. The PROJECT.md says `tailwind.config.ts` — this is v3 syntax. Reconcile this early or the config approach will mismatch the version.

**Why it happens:**
The install command `npm install tailwindcss` installs the latest (v4) but documentation searches often surface v3 guides, leading to mismatched configuration patterns.

**How to avoid:**
- Install explicitly: `npm install tailwindcss @tailwindcss/vite`
- Add `@tailwindcss/vite` to `vite.config.ts` plugins array, alongside `cloudflare()`
- In CSS: `@import "tailwindcss"` (v4 syntax) — not the v3 three-directive block
- If using v4: design tokens go in CSS `@theme { }` block, not `tailwind.config.ts`
- Verify `@cloudflare/vite-plugin` compatibility with `@tailwindcss/vite` before committing to the approach

**Warning signs:**
- PostCSS errors after install
- `tailwind.config.js` and `@theme {}` both present (version mismatch)
- Classes not applying despite correct HTML

**Phase to address:**
Tailwind setup phase — version decision and plugin compatibility check must happen first.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Leaving old CSS variables (`var(--)`) in new Tailwind components | Reuse existing tokens without redefining | Permanent coupling to old system; two colour systems to maintain | Never — new components must use Tailwind tokens only |
| Keeping old CSS until the very end of the project | No visual breakage during development | Old and new systems interact unpredictably; harder to spot regressions | Acceptable only if screens are cleanly isolated (hidden, not removed) |
| Using `hidden` (display:none) for inactive screens instead of a router | Simple, no extra deps | Inactive screens still rendered; marginal memory cost | Acceptable — matches the Wordle pattern, DOM count is small |
| Using arbitrary Tailwind values (`w-[28.75rem]`) for pixel-perfect matches | Exact match to old layout without redesigning | Defeats the design-token system; hard to maintain consistency | Acceptable for the initial port; plan a cleanup pass before finalising |
| Putting screen state in a module-level variable instead of a state object | Simple, no boilerplate | Harder to add persistence or undo; state scattered across modules | Acceptable for three screens; would be a problem at larger scale |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Tailwind v4 + `@cloudflare/vite-plugin` | Adding `@tailwindcss/vite` after `cloudflare()` in plugin array without testing order | Check plugin order; Tailwind CSS processing should run before Cloudflare's bundling step |
| Tailwind `dark:` + existing `theme.ts` toggle | Assuming Tailwind's `darkMode: 'class'` auto-detects the class — it doesn't know about `localStorage` | Keep `theme.ts` toggle logic; it sets `.dark` on `<html>`; Tailwind responds to that class |
| Tailwind Preflight + existing `@layer reset` | Both resets apply; specificity battle causes unexpected results | Disable Preflight while old CSS is present; enable once old CSS is removed |
| Octopus RAF loop + screen transitions | `trackEyes()` RAF loop (noted in CONCERNS.md) continues running when octopus isn't visible | Pause the RAF loop when welcome screen hides; resume when it shows again |
| Feedback modal (restyled in Tailwind) + existing `modals.ts` JS | Restyling breaks the JS selectors if class names or `data-` attributes change | Keep all `data-` attributes intact; only change visual classes, never selector hooks |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Celebration animation (`octo.ts`) not cleaned up after completion screen appears | CPU stays elevated after puzzle solved; battery drain | Stop the celebration RAF loop and remove event listeners once the animation ends and the completion screen is shown | Any time a user solves the puzzle |
| All three screens rendered and styled at full cost, even inactive ones | Slower initial paint; unnecessary style recalculation | Use `hidden` (display:none) which removes elements from layout but not from render tree; consider `content-visibility: auto` on inactive screens | At current scale: never a real problem. Worth preventing anyway. |
| Tailwind CSS bundle size bloat from safelisted classes | Larger CSS file than expected | Only safelist what's genuinely dynamic; prefer lookup tables so static strings are found by scanner | Not a real concern for this project's scale |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No visual feedback during screen transition (welcome → game) | Game screen appears instantaneously; disorienting for first-time users | Add a brief CSS transition (opacity/translate) on screen show/hide; keep it under 150ms so it doesn't feel sluggish |
| How-to-play content hidden on return visits but accessible | Return users click "How to play" expecting the same content they saw first visit; if moved or truncated, trust breaks | Keep the full how-to-play content identical on both first and return visit paths; only the position changes (above/below button) |
| Completion screen showing before celebration animation finishes | Player doesn't see the satisfying end-state; feels like a bug | Completion screen must not appear until the ~3s animation completes. Enforce via `setTimeout` or `animationend` event, not a guess |
| Digit box state (eliminated vs active) not visually distinct enough in light mode | Players can't tell which digit they're targeting | Test digit box contrast in both light and dark mode during game screen build; use Tailwind's opacity modifiers rather than separate colour values |
| Menu (archive, feedback, how-to-play) hidden behind a compact button on game screen | If menu isn't discoverable, players don't know these features exist | Ensure the compact menu button has an accessible label and visible affordance (icon + subtle label or tooltip) |

---

## "Looks Done But Isn't" Checklist

- [ ] **Dark mode:** Toggle switches both `dark:` Tailwind classes AND the canvas dot-grid redraws (via `drawCanvas()` in `theme.ts`) — verify both respond to the same toggle click
- [ ] **Digit elimination:** Clue tapping eliminates digits from `possibles` sets AND updates keypad button styling AND updates digit boxes — all three must fire
- [ ] **Screen transitions:** Welcome → Game transition must initialise the game (fetch puzzle, render clues, set up keypad) before revealing the game screen, not after
- [ ] **Completion screen stats:** Stats are read from `localStorage` history — verify `recordGame()` fires before the completion screen renders, not after
- [ ] **Feedback modal:** Modal is accessible from game screen menu AND completion screen — test both trigger paths after restyling
- [ ] **Celebration animation skip:** Animation must be skippable (tap/click) even if the full 3s hasn't elapsed — completion screen appears immediately on skip
- [ ] **Replay mode:** Archive replays use a different code path in `app.ts` — verify replay works end-to-end after screen restructure
- [ ] **Random puzzle mode:** Random puzzle path is separate from daily path — verify it correctly shows the game screen via the same state-driven flow

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Dynamic class purging discovered in production | MEDIUM | Identify purged classes via DevTools, add to `safelist` in config as a quick fix, then refactor to static strings before next release |
| Preflight conflict causes visual chaos after install | LOW | Add `corePlugins: { preflight: false }` to config, rebuild — restores old styles immediately |
| Dark mode FOUC introduced after restructure | LOW | Add inline `<script>` in `<head>` that sets `.dark` class synchronously before page paints |
| Screen state corruption (null references after transition) | HIGH | Audit all `document.querySelector()` calls in `app.ts`; switch to visibility-toggle pattern; may require partial rewrite of init logic |
| Wrong Tailwind version installed | LOW | `npm remove tailwindcss`, reinstall with explicit version; update config approach to match |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Dynamic class purging | Tailwind setup — establish class-string pattern rule | Test all toggled states (eliminated, active, disabled) in a production build before moving to next screen |
| Preflight + old CSS conflict | Tailwind setup — decide coexistence strategy | After Tailwind install, check that existing game screen renders identically to before |
| Dark mode FOUC | Welcome screen build — add inline theme script | Hard-refresh in dark mode; no flash visible before dark background appears |
| Old CSS variables in new components | Tailwind setup — define token map, enforce no `var(--)` | Code review: search for `var(--` in any new component HTML |
| Screen state coupling breaks game | Screen architecture phase — visibility-toggle decision | Navigate between all three screens 10 times; verify no console errors, no broken interactions |
| Wrong Tailwind version | Tailwind setup — explicit install + plugin compatibility check | Run `npx tailwindcss --version`; verify `@tailwindcss/vite` plugin loads without PostCSS errors |
| Celebration animation not cleaned up | Completion screen build phase | Open DevTools Performance tab; record 30s after puzzle is solved; verify no active RAF loop |

---

## Sources

- [Tailwind CSS Preflight — official docs](https://tailwindcss.com/docs/preflight)
- [Tailwind CSS dark mode — official docs](https://tailwindcss.com/docs/dark-mode)
- [Tailwind CSS dynamic class names](https://tailkits.com/blog/tailwind-dynamic-classes/)
- [Tailwind v4 Vite setup guide](https://eastondev.com/blog/en/posts/dev/20260325-tailwind-v4-vite-setup/)
- [Dark mode FOUC in vanilla JS / React](https://notanumber.in/blog/fixing-react-dark-mode-flickering)
- [Dark mode transitions trigger on load — Tailwind GitHub discussion](https://github.com/tailwindlabs/tailwindcss/discussions/3479)
- [Tailwind v4 global reset conflicts — GitHub discussion](https://github.com/tailwindlabs/tailwindcss/discussions/16597)
- [Tailwind class purging in production](https://www.mindfulchase.com/explore/troubleshooting-tips/front-end-frameworks/troubleshooting-tailwind-css-class-purging-in-production-builds.html)
- Codebase inspection: `src/app.ts`, `src/theme.ts`, `src/colours.ts`, `src/style.css`, `src/octo.ts`, `vite.config.ts`, `package.json`
- `.planning/codebase/CONCERNS.md` — fragile areas and performance concerns

---
*Pitfalls research for: Tailwind CSS migration + multi-screen UI redesign (Clumeral)*
*Researched: 2026-04-11*
