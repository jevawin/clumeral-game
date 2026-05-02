---
phase: 01-refinements-wave-1
plan: 01
subsystem: layout-and-tokens
tags: [layout, tailwind, tokens, links, footer]
requires:
  - Tailwind v4 @theme tokens (--color-accent, --color-text)
provides:
  - body shell in document flow (min-h-screen flex flex-col + footer last child)
  - .link utility (accent text, 1px accent bottom border, 2px padding, no underline)
  - text-text-only foreground in app/welcome/completion + non-modal/non-menu index spots
affects:
  - Plan 02 (HDR-01 / MNU-03) — burger menu and game header still own their text-muted spots; will be replaced there
  - Plan 04 — "Show puzzle" / "Archive" links will adopt .link
tech-stack:
  added: []
  patterns:
    - "Standard inline link via class=\"link\" (LNK-01)"
    - "Document-flow footer (mt-auto on last child of min-h-screen flex flex-col)"
key-files:
  created: []
  modified:
    - index.html
    - src/tailwind.css
    - src/app.ts
    - src/welcome.ts
    - src/completion.ts
decisions:
  - "Keep --color-muted token in @theme — feedback modal and burger menu still consume it; only utility usages purged in plan-scoped files."
  - "Use mt-auto on footer rather than flex-1 on screens main alone — defensive guarantee that footer pins to bottom on short pages."
  - "Use logical properties (border-block-end, padding-block-end) in .link for future RTL safety."
metrics:
  duration: ~3 min
  completed: 2026-05-02
requirements:
  - LAY-01
  - CLR-01
  - LNK-01
---

# Phase 01 Plan 01: Layout + Tokens Foundation Summary

Footer moved into normal document flow via min-h-screen flex flex-col wrapper, all `text-muted` usages purged from app/welcome/completion plus non-modal/non-menu index spots, and a standard `.link` utility added in `src/tailwind.css` (accent text, 1px accent bottom border, 2px padding, no underline).

## What Changed

### Task 1 — Footer in document flow + .link utility (commit `2cd569a`)

**`index.html`:**
- Opening `<div class="min-h-screen bg-bg">` (was wrapping legacy header octo + feedback modal + toast only) → `<div class="min-h-screen flex flex-col bg-bg">` and extended to wrap **everything visible**: feedback modal, legacy header `<main>`, toast container, screens `<main data-screens>`, and footer.
- `<main data-screens>` class changed from `fixed inset-0 z-10 pointer-events-none` → `relative flex-1 z-10`. Inner per-screen `pointer-events-none` / `pointer-events-auto` toggles in `screens.ts` keep driving interactivity.
- `<footer data-footer>` moved inside the flex column wrapper as its last child. Class changed from `fixed bottom-0 left-0 right-0 z-20 text-center py-4 text-muted text-sm font-[Quicksand]` → `mt-auto text-center py-4 text-text text-sm font-[Quicksand]`.

**`src/tailwind.css`:**
- Added `.link` rule inside the existing `@layer utilities`, between `.warn` and `.fb-cat[aria-checked="true"]`:
  ```css
  .link {
    color: var(--color-accent);
    border-block-end: 1px solid var(--color-accent);
    padding-block-end: 2px;
    text-decoration: none;
  }
  .link:hover, .link:focus-visible { color: var(--color-accent); border-block-end-color: var(--color-accent); }
  ```

### Task 2 — Purge text-muted from app/welcome/completion + non-modal index spots (commit `b75e925`)

**`src/app.ts`** — replaced `text-muted` → `text-text` in:
- Tag-tip popover close button (line 180)
- History `<li>` className (line 334)
- `renderStats` heading + Played/Avg-tries labels + Last-N-games line (lines 349, 351, 352, 354)
- `renderStatsUpTo` heading + Played/Avg-tries labels + Last-N-games line (lines 372, 374, 375, 377)
- Replay archive label className + inner SVG icon (lines 593, 594)

**`src/welcome.ts`** — replaced in:
- Two HTP arrow `<span>`s (lines 97, 113)
- "Tap to remove" caption (line 111)
- Welcome puzzle-# subline (line 135)

**`src/completion.ts`** — replaced in:
- `renderStatBox` label `<span>` (line 84)

**`index.html`** — replaced in non-modal/non-menu spots:
- `data-save` row className (line 230)
- "Your guesses" heading (line 246)
- `data-next` paragraph (line 254)
- `data-completion-subheading` (line 270)
- `data-completion-countdown` (line 276)

## What Was Left Alone (and why)

- **`<dialog data-fb-modal>` and descendants (lines 44–76 of index.html).** Feedback modal is internally consistent and not part of CLR-01's "all visible text" sweep in this plan — keeps text-muted on subtitle, char counter, "This info will be sent..." copy, and meta block.
- **Burger menu item icons (`<svg ... class="text-muted">` lines 165, 169, 173, 177).** Plan 02 (MNU-03) rebuilds menu styles; that plan owns the change.
- **Game header puzzle-label `<span data-plabel class="... text-muted ...">` (line 152).** Plan 02 (HDR-01) deletes this whole element.
- **`placeholder:text-muted` on textarea (line 67).** Placeholders are an intermediate UI state, not foreground text — kept per plan's scope clarification.
- **`--color-muted` token in `@theme` and `html.dark` blocks of `src/tailwind.css`.** Still consumed by the feedback modal and burger menu via Tailwind's `text-muted` / `placeholder:text-muted` utilities; plan explicitly directed to leave the token in place.
- **Mini-digit indicator classes `bg-accent/5` / `bg-accent/50` in welcome.ts and app.ts.** Not muted — opacity-suffixed accent — confirmed unchanged.

## Verification

- `grep -RE "\\btext-muted\\b" src/app.ts src/welcome.ts src/completion.ts` → no matches.
- `grep -E "data-footer[^>]*\\bfixed\\b" index.html` → no matches.
- `grep -c "data-footer.*mt-auto" index.html` → 1.
- `grep -c "min-h-screen flex flex-col bg-bg" index.html` → 1.
- `grep -n "main data-screens" index.html` → line 136, contains `relative flex-1 z-10` and not `fixed`.
- `grep -c "\\.link {" src/tailwind.css` → 1.
- `grep -c "border-block-end: 1px solid var(--color-accent)" src/tailwind.css` → 1.
- `grep -c "data-fb-modal" index.html` → 3 (modal still present).
- `grep -c "placeholder:text-muted" index.html` → 1 (textarea placeholder retained).
- `npm run build` → exit 0 in both Cloudflare-Workers and client environments. Output: `dist/client/assets/index-DuzBV-nk.css` (38.30 kB) — `.link` class present in compiled CSS.

## Deviations from Plan

None — plan executed exactly as written.

## Authentication Gates

None.

## Known Stubs

None.

## Self-Check: PASSED

- File `index.html`: FOUND
- File `src/tailwind.css`: FOUND
- File `src/app.ts`: FOUND
- File `src/welcome.ts`: FOUND
- File `src/completion.ts`: FOUND
- Commit `2cd569a` (Task 1): FOUND
- Commit `b75e925` (Task 2): FOUND
