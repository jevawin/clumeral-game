# Stack Research

**Domain:** Tailwind CSS v4 added to existing Vite + TypeScript project
**Researched:** 2026-04-11
**Confidence:** HIGH (official docs + npm registry confirmed)

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `tailwindcss` | 4.2.2 | CSS utility framework | v4 is the current stable release; v3 is legacy. CSS-first config is the v4 pattern. |
| `@tailwindcss/vite` | 4.2.2 | Vite plugin for Tailwind | First-party plugin introduced in v4. Replaces PostCSS pipeline entirely; faster builds, tighter HMR integration. |

Both packages track the same version number — install them together.

### Supporting Libraries

None needed for this project. Clumeral has roughly three custom components (button, dropdown menu, stats display). No component library is warranted. `@tailwindcss/forms` and `@tailwindcss/typography` are available but add weight for no value here.

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `@tailwindcss/upgrade` | Automated v3-to-v4 migration | Not needed — this is a fresh Tailwind install alongside vanilla CSS, not a migration |

---

## Installation

```bash
npm install tailwindcss @tailwindcss/vite
```

No other packages. Do not install `postcss`, `autoprefixer`, or `@tailwindcss/postcss` — the Vite plugin handles everything.

---

## Configuration

### vite.config.ts

Add `tailwindcss()` to the `plugins` array alongside the existing `cloudflare()` plugin:

```typescript
import { defineConfig } from "vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [
    cloudflare(),
    tailwindcss(),
    // existing sw-cache-bust plugin stays
  ],
});
```

Plugin order: `cloudflare()` first, `tailwindcss()` second. The sw-cache-bust plugin stays as-is.

### CSS entry point

One line replaces all `@tailwind` directives:

```css
@import "tailwindcss";
```

Import this at the top of the new Tailwind CSS file (e.g. `src/styles/tailwind.css`). The existing `src/style.css` stays untouched until the old CSS is fully replaced.

### No tailwind.config.ts

In v4, `tailwind.config.ts` is gone. All customisation lives in CSS using `@theme`. Do not create a config file — it is not in the v4 docs and will likely be dropped in v5.

If you ever need to reference a legacy config (unlikely here), v4 supports `@config "./tailwind.config.ts"` in CSS, but we won't use that.

---

## Semantic Colour Tokens — the v4 Pattern

The project requires ~7 semantic colour tokens with light/dark variants. The v4 approach:

**Step 1 — Define primitive colours in `@theme`** (light-mode defaults):

```css
@import "tailwindcss";

@theme {
  /* Primitives — not used directly in markup */
  --color-near-black: oklch(0.13 0.005 270);   /* #121213 */
  --color-off-white:  oklch(0.98 0.002 270);   /* #FAFAFA */
  --color-green-500:  oklch(0.65 0.19 142);

  /* Semantic tokens — use these in markup */
  --color-surface:    var(--color-off-white);
  --color-on-surface: var(--color-near-black);
  --color-accent:     var(--color-green-500);
  /* ... up to ~7 total */
}
```

**Step 2 — Override semantics for dark mode in `@layer base`**:

```css
@layer base {
  .dark {
    --color-surface:    var(--color-near-black);
    --color-on-surface: var(--color-off-white);
    /* accent stays the same in both modes */
  }
}
```

**Step 3 — Toggle via class on `<html>`** (matching the existing pattern):

```css
@custom-variant dark (&:where(.dark, .dark *));
```

This matches how the existing app already toggles dark mode — adding/removing `.dark` on `<html>`. No change to the existing toggle logic.

**In markup**, use semantic token names as utility classes:

```html
<body class="bg-surface text-on-surface">
```

Tailwind generates `bg-surface`, `text-on-surface`, etc. automatically from any `--color-*` token defined in `@theme`.

---

## Dark Mode — Design Decisions

**No `color-mix()`, no `light-dark()`** — PROJECT.md explicitly rules these out. Use `dark:` variants and semantic token overrides only.

**Manual toggle, not `prefers-color-scheme`** — the existing app has a user-controlled toggle. Use the class-based `@custom-variant dark` approach (above), not the media-query approach.

**Palette target** — PROJECT.md requires under 15 semantic colour tokens. Aim for 7:
- `surface` — page background
- `on-surface` — primary text
- `surface-raised` — card / elevated background (digit boxes, number pad)
- `on-surface-muted` — secondary text
- `border` — dividers, outlines
- `accent` — green, interactive elements
- `on-accent` — text on green backgrounds

---

## Alternatives Considered

| Recommended | Alternative | Why Not |
|-------------|-------------|---------|
| `@tailwindcss/vite` | `@tailwindcss/postcss` | PostCSS plugin works but is slower and adds PostCSS config boilerplate. Vite plugin is first-party and faster. |
| CSS-first `@theme` | `tailwind.config.ts` | Config file is not part of v4 by default; will be dropped in v5. CSS-first is the direction. |
| Class toggle (`.dark`) | `prefers-color-scheme` media | Project has existing user toggle; media query would break it. |
| Semantic token overrides in `@layer base` | `dark:` variants everywhere in markup | Semantic tokens mean each dark colour lives in one place, not scattered across every element. |
| No component library | shadcn/ui, DaisyUI, Flowbite | ~3 custom components don't justify the weight or abstraction overhead. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `postcss` + `@tailwindcss/postcss` | Redundant when using Vite; the Vite plugin handles transforms natively | `@tailwindcss/vite` |
| `tailwind.config.ts` / `tailwind.config.js` | Not the v4 default; poorly documented; will likely drop in v5 | `@theme` in CSS |
| `color-mix()` | PROJECT.md rules it out explicitly | `dark:` variants + semantic token overrides |
| `light-dark()` | PROJECT.md rules it out explicitly; also Firefox 128+ only | `dark:` variants + semantic token overrides |
| Tailwind v3 | Legacy; PostCSS-only, slower, JavaScript config | Tailwind v4 |
| Component library (DaisyUI, Flowbite, shadcn/ui) | Overkill for 3 components; adds CSS weight and API surface | Hand-rolled with Tailwind utilities |

---

## Version Compatibility

| Package | Version | Compatible With | Notes |
|---------|---------|-----------------|-------|
| `tailwindcss` | 4.2.2 | `@tailwindcss/vite` 4.2.2 | Same version — always install together |
| `@tailwindcss/vite` | 4.2.2 | Vite 8.x | Tested against Vite 5+ officially; project uses Vite 8.0.3 which is newer but compatible |
| Tailwind v4 | any v4 | Chrome 111+, Safari 16.4+, Firefox 128+ | Uses modern CSS features (`@layer`, `@property`, CSS nesting). ES2022 browser target in this project is fine. |

---

## Browser Compatibility Note

Tailwind v4 requires modern browsers: Chrome 111+, Safari 16.4+, Firefox 128+ (all released 2023–2024). This project already targets ES2022. No conflict. The features Tailwind v4 relies on — `@layer`, CSS nesting, native custom properties — are fully supported in all current browsers.

---

## Sources

- [Tailwind CSS v4 release announcement](https://tailwindcss.com/blog/tailwindcss-v4) — v4.0 release date, CSS-first config, Vite plugin, performance numbers (HIGH confidence — official)
- [Tailwind docs — Installation with Vite](https://tailwindcss.com/docs) — exact install steps, `@import "tailwindcss"`, Vite plugin config (HIGH confidence — official)
- [Tailwind docs — Dark mode](https://tailwindcss.com/docs/dark-mode) — `@custom-variant dark`, class-based toggle pattern (HIGH confidence — official)
- [Tailwind docs — Theme variables](https://tailwindcss.com/docs/theme) — `@theme` directive, namespace conventions, `--color-*` generating utilities (HIGH confidence — official)
- [npm: @tailwindcss/vite](https://www.npmjs.com/package/@tailwindcss/vite) — current version 4.2.2 confirmed (HIGH confidence)
- [GitHub discussion: dark mode semantic colors](https://github.com/tailwindlabs/tailwindcss/discussions/15083) — `@custom-variant` + `@layer base` override pattern (MEDIUM confidence — community, cross-checked with official docs)
- [Mavik Labs: Design Tokens with Tailwind v4](https://www.maviklabs.com/blog/design-tokens-tailwind-v4-2026) — `@theme` semantic token structure, dark mode `@layer base` override (MEDIUM confidence — third-party, consistent with official docs)

---

*Stack research for: Tailwind CSS v4 on Vite + TypeScript (Clumeral UI redesign)*
*Researched: 2026-04-11*
