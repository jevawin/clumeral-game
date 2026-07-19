# OKLCH-Derived Palette Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace 31 hand-picked colour literals with a palette derived from two base neutrals, one lightness per mode, and one hue angle per theme — making the WCAG AA failure of #254 structurally unrepresentable.

**Architecture:** Accents resolve as `oklch(var(--accent-l) var(--accent-c) var(--accent-h))`. Contrast is carried by `--accent-l` alone, shared across all four themes, so a theme cannot fail AA. Chroma and hue are contrast-inert and vary freely per theme. `colours.ts` sets a `data-theme` attribute instead of two hexes, and CSS resolves hue and chroma from it. Success and error alias the Lime and Cherry themes rather than carrying their own hue, chroma and lightness — the tick and cross icons carry the meaning, so colour is never the only signal.

**Tech Stack:** Tailwind CSS v4 (`@theme`), Vite 8, Lightning CSS, Cloudflare Workers (SSR), Vitest, Playwright.

**Spec:** [2026-07-18-oklch-derived-palette-design.md](../specs/2026-07-18-oklch-derived-palette-design.md)
**Issue:** [#255](https://github.com/jevawin/clumeral-game/issues/255)
**Branch:** `issue/255` (already created, tracking origin)

---

## Target palette

Every value below is computed, not picked. All pairings verified — worst accent
ratio 5.36, which is now also the worst overall: aliasing the semantics onto the
themes removed the 4.70 error-dark-on-surface pairing that used to be tightest.

**Revised after Task 1 sign-off (2026-07-18):** per-theme chroma, white base.
See [Settled by the prototype](../specs/2026-07-18-oklch-derived-palette-design.md#settled-by-the-prototype).

### Declared values (20)

```
bases          dark #121213 · light #FAFAFA
surfaces       dark #2A2A2B · light #FFFFFF
text           dark #FAF8F4 · light #262624
accent-l       light 0.50 · dark 0.78
hue angles     Lime 145 · Cherry 5 · Blueberry 262 · Grape 305
accent chroma  light  Lime 0.157 · Cherry 0.201 · Blueberry 0.178 · Grape 0.237
               dark   Lime 0.174 · Cherry 0.135 · Blueberry 0.111 · Grape 0.140
semantics      success = Lime · error = Cherry      (aliases, not values)
```

This is the full count from `src/palette.ts`. Earlier figures in this document
(10, then 18, then 19) used a looser convention that omitted the surfaces and
text colours; under that same convention the previous design carried 26 values
and this one carries 20.

Chroma is `min(today's chroma, the hue's sRGB ceiling at that lightness)`. Five
of the eight are ceiling-limited; three (Blueberry light, Grape light, Lime dark) sit
at today's value with headroom to spare.

### Resolved — light (`bg #FAFAFA`, `surface #FFFFFF`, `text #262624`)

| token | hex | vs bg | vs surface |
|---|---|---|---|
| Lime | `#00791E` | 5.36 | 5.59 |
| Cherry | `#B60054` | 6.45 | 6.74 |
| Blueberry | `#245BC7` | 5.92 | 6.18 |
| Grape | `#8420CB` | 6.60 | 6.89 |
| text | `#262624` | 14.53 | 15.16 |
| success | `#00791E` | 5.36 | 5.59 |  ← the Lime accent
| error | `#B60054` | 6.45 | 6.74 |  ← the Cherry accent

### Resolved — dark (`bg #121213`, `surface #2A2A2B`, `text #FAF8F4`)

| token | hex | vs bg | vs surface |
|---|---|---|---|
| Lime | `#65D46D` | 9.98 | 7.64 |
| Cherry | `#FF91AC` | 8.82 | 6.76 |
| Blueberry | `#90B7FF` | 9.27 | 7.10 |
| Grape | `#CC9FFF` | 8.89 | 6.81 |
| text | `#FAF8F4` | 17.65 | 13.52 |
| success | `#65D46D` | 9.98 | 7.64 |  ← the Lime accent
| error | `#FF91AC` | 8.82 | 6.76 |  ← the Cherry accent

Every dark chroma except Lime's is at its sRGB ceiling — L=0.78 is what AA on
`surface` requires, and it leaves little room for saturation. Lime is the one
theme that could go brighter (ceiling 0.245) and is held at today's 0.174
instead.

---

## File structure

| file | responsibility | change |
|---|---|---|
| `docs/prototypes/255-palette.html` | Sign-off artifact. Self-contained, hand-written CSS, `proto-` class prefix so it cannot collide with Tailwind utility scanning. | create (throwaway) |
| `tests/helpers/colour.ts` | OKLCH → sRGB conversion + WCAG contrast ratio. Pure functions, no DOM. | create |
| `tests/palette-contrast.spec.ts` | Asserts every accent × mode × surface pairing clears 4.5:1, computed. The CI enforcement of the guarantee. | create |
| `tests/token-parity.spec.ts` | Parses token blocks from `tailwind.css` and the Worker `<style>` string; fails on divergence. | create |
| `src/tailwind.css` | Token derivation. Remove `--color-on-accent`, `--color-accent-strong`. | modify |
| `src/colours.ts` | `THEMES` becomes hue + chroma per mode. Sets `data-theme` on `<html>`, not `--color-accent`. | modify |
| `src/palette.ts` | Declared values, single source of truth for CSS, the Worker mirror and the tests. | create |
| `src/worker/puzzles.ts` | Mirror of the token block for SSR `/archive`. | modify |
| `index.html`, `src/app.ts`, `src/welcome.ts`, `src/walkthrough.ts` | `text-accent-strong` → `text-accent` sweep. | modify |
| `docs/DESIGN-SYSTEM.md` | Rewritten around derivation rules. | modify |

---

## Task 1: Prototype comparison page (SIGN-OFF GATE)

**No app code changes until the user signs this off.** This is acceptance
criterion #1 on the issue.

**Files:**
- Create: `docs/prototypes/255-palette.html`

**Critical constraint:** Tailwind v4 auto-scans project sources for class
candidates. Use only `proto-`-prefixed class names and hand-written CSS in a
`<style>` block. Do not use a single Tailwind utility class name in this file, or
it will add dead rules to the shipped stylesheet.

- [x] **Step 1: Create the prototype shell with the toggle controls**

Create `docs/prototypes/255-palette.html`. Self-contained, no build step, opens
via `file://`.

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>#255 — palette comparison</title>
<style>
  /* Derivation. Only these values are declared; everything else computes. */
  .proto-scope {
    --base-light: #F3F1ED;
    --base-dark:  #121213;
    --accent-h: 145;
    --accent-l: 0.50;
    --accent-c: 0.14;
    --semantic-l: calc(var(--accent-l) - 0.10);
    --bg: var(--base-light);
    --surface: #FAF8F4;
    --text: #262624;
    --accent:  oklch(var(--accent-l) var(--accent-c) var(--accent-h));
    --success: oklch(var(--semantic-l) 0.11 150);
    --error:   oklch(var(--semantic-l) 0.14 27);
    --border:  color-mix(in srgb, var(--text) 12%, transparent);
    --on-accent: var(--bg);
    background: var(--bg);
    color: var(--text);
  }
  .proto-scope[data-mode="dark"] {
    --accent-l: 0.78;
    --accent-c: 0.11;
    --bg: var(--base-dark);
    --surface: #2A2A2B;
    --text: #FAF8F4;
  }
  /* Toggle: white background instead of cream. */
  .proto-scope[data-cream="off"] { --base-light: #FAFAFA; --surface: #FFFFFF; }
  /* Toggle: per-theme chroma at each hue's sRGB ceiling. */
  .proto-scope[data-chroma="per-theme"][data-theme="Lime"]   { --accent-c: 0.157; }
  .proto-scope[data-chroma="per-theme"][data-theme="Cherry"]  { --accent-c: 0.201; }
  .proto-scope[data-chroma="per-theme"][data-theme="Blueberry"]   { --accent-c: 0.232; }
  .proto-scope[data-chroma="per-theme"][data-theme="Grape"] { --accent-c: 0.260; }
  .proto-scope[data-chroma="per-theme"][data-mode="dark"][data-theme="Lime"]   { --accent-c: 0.245; }
  .proto-scope[data-chroma="per-theme"][data-mode="dark"][data-theme="Cherry"]  { --accent-c: 0.135; }
  .proto-scope[data-chroma="per-theme"][data-mode="dark"][data-theme="Blueberry"]   { --accent-c: 0.111; }
  .proto-scope[data-chroma="per-theme"][data-mode="dark"][data-theme="Grape"] { --accent-c: 0.140; }
  /* Hue angles per theme. */
  .proto-scope[data-theme="Lime"]   { --accent-h: 145; }
  .proto-scope[data-theme="Cherry"]  { --accent-h: 5; }
  .proto-scope[data-theme="Blueberry"]   { --accent-h: 262; }
  .proto-scope[data-theme="Grape"] { --accent-h: 305; }

  /* CURRENT palette, for the side-by-side. Hardcoded, as it is today. */
  .proto-scope[data-palette="current"] {
    --bg: #FAFAFA; --surface: #FFFFFF; --text: #262624;
    --border: rgba(38,38,36,0.12);
    --success: #1a7a3a; --error: #c03030; --on-accent: #FFFFFF;
    --accent-strong: color-mix(in srgb, var(--accent) 82%, var(--text));
  }
  .proto-scope[data-palette="current"][data-mode="dark"] {
    --bg: #121213; --surface: #363634; --text: #FAF8F4;
    --border: rgba(246,240,232,0.1);
    --success: #4cc990; --error: #f07070; --on-accent: #121213;
  }
  .proto-scope[data-palette="current"][data-theme="Lime"]   { --accent: #0a850a; }
  .proto-scope[data-palette="current"][data-theme="Cherry"]  { --accent: #de1f46; }
  .proto-scope[data-palette="current"][data-theme="Blueberry"]   { --accent: #376ddb; }
  .proto-scope[data-palette="current"][data-theme="Grape"] { --accent: #9a44ea; }
  .proto-scope[data-palette="current"][data-mode="dark"][data-theme="Lime"]   { --accent: #1ead52; }
  .proto-scope[data-palette="current"][data-mode="dark"][data-theme="Cherry"]  { --accent: #ea6c85; }
  .proto-scope[data-palette="current"][data-mode="dark"][data-theme="Blueberry"]   { --accent: #6393f2; }
  .proto-scope[data-palette="current"][data-mode="dark"][data-theme="Grape"] { --accent: #b679f0; }
  /* Under the current palette, accent text uses accent-strong; under the
     proposed palette there is only one accent, so it falls back to it. */
  .proto-scope { --accent-text: var(--accent); }
  .proto-scope[data-palette="current"] { --accent-text: var(--accent-strong); }

  body { margin: 0; font-family: Quicksand, system-ui, sans-serif; }
  .proto-controls {
    position: sticky; top: 0; z-index: 10; display: flex; flex-wrap: wrap;
    gap: 1rem; padding: 0.75rem 1rem; background: #222; color: #fff;
    font: 500 0.85rem/1 system-ui;
  }
  .proto-controls label { display: flex; gap: 0.35rem; align-items: center; }
  .proto-grid { display: grid; grid-template-columns: 1fr 1fr; }
  .proto-scope { padding: 1.25rem; min-height: 100vh; }
  .proto-label {
    font: 700 0.7rem/1 system-ui; letter-spacing: 0.08em;
    text-transform: uppercase; opacity: 0.5; margin-bottom: 1rem;
  }
</style>
</head>
<body>
  <div class="proto-controls">
    <label>theme
      <select id="theme"><option>Lime</option><option>Cherry</option><option>Blueberry</option><option>Grape</option></select>
    </label>
    <label>mode
      <select id="mode"><option value="light">light</option><option value="dark">dark</option></select>
    </label>
    <label>screen
      <select id="screen"><option>welcome</option><option>game</option><option>completion</option></select>
    </label>
    <label>chroma
      <select id="chroma"><option value="shared">shared</option><option value="per-theme">per-theme</option></select>
    </label>
    <label>cream bg
      <select id="cream"><option value="on">cream</option><option value="off">white</option></select>
    </label>
  </div>
  <div class="proto-grid">
    <div class="proto-scope" id="paneCurrent" data-palette="current">
      <div class="proto-label">current</div>
      <div data-slot></div>
    </div>
    <div class="proto-scope" id="paneProposed" data-palette="proposed">
      <div class="proto-label">proposed</div>
      <div data-slot></div>
    </div>
  </div>
<script type="module">
  const panes = [document.getElementById('paneCurrent'), document.getElementById('paneProposed')];
  const ctl = id => document.getElementById(id);
  function sync() {
    for (const p of panes) {
      p.dataset.theme  = ctl('theme').value;
      p.dataset.mode   = ctl('mode').value;
      p.dataset.chroma = ctl('chroma').value;
      p.dataset.cream  = ctl('cream').value;
      p.querySelector('[data-slot]').innerHTML = SCREENS[ctl('screen').value];
    }
  }
  for (const id of ['theme','mode','screen','chroma','cream']) ctl(id).addEventListener('change', sync);
  const SCREENS = {};   // populated in Step 2
  window.SCREENS = SCREENS;
  window.__sync = sync;
</script>
</body>
</html>
```

- [x] **Step 2: Add the three screen compositions**

Replace `const SCREENS = {};` with the block below. These are representative
compositions, not pixel copies of the app — they exercise every surface a colour
lands on: page bg, card surface, accent text, accent fill, hollow button,
borders, and the two semantic states.

```js
  const CSS = `
    <style>
      .p-card { background: var(--surface); border: 1.5px solid var(--border);
                border-radius: 0.5rem; padding: 1rem; margin-bottom: 0.75rem; }
      .p-tag  { color: var(--accent-text); font: 700 0.85rem/1 Inconsolata, monospace;
                text-transform: uppercase; letter-spacing: 0.06em; }
      .p-clue { margin: 0.4rem 0 0; font-weight: 400; }
      .p-emph { color: var(--accent-text); white-space: nowrap; }
      .p-btn  { display: inline-flex; align-items: center; justify-content: center;
                min-height: 3rem; padding: 0.75rem 1rem; border-radius: 0.375rem;
                font: 600 1rem/1 inherit; cursor: pointer; margin-right: 0.5rem; }
      .p-solid  { background: var(--accent); color: var(--on-accent);
                  border: 1.5px solid var(--accent); }
      .p-hollow { background: transparent; color: var(--accent-text);
                  border: 1.5px solid var(--accent-text); }
      .p-boxes { display: flex; gap: 0.5rem; margin: 0.75rem 0; }
      .p-box  { flex: 1; aspect-ratio: 3/4; background: var(--surface);
                border: 1.5px solid var(--border); border-radius: 0.25rem;
                display: grid; place-items: center;
                font: 600 2rem/1 Inconsolata, monospace; color: var(--text); }
      .p-box.ok { background: color-mix(in srgb, var(--success) 12%, transparent);
                  border-color: color-mix(in srgb, var(--success) 40%, transparent); }
      .p-ok   { color: var(--success); font-weight: 700; }
      .p-err  { color: var(--error);   font-weight: 700; }
      .p-link { color: var(--accent-text); border-bottom: 1px solid var(--accent-text);
                text-decoration: none; }
      .p-sep  { border: 0; border-top: 1px solid var(--border); margin: 1rem 0; }
    </style>`;

  SCREENS.welcome = CSS + `
    <div class="p-card">
      <div class="p-tag">Clumeral</div>
      <p class="p-clue">Work out the number from <span class="p-emph">100&ndash;999</span>.
        A new puzzle every day.</p>
    </div>
    <div class="p-card">
      <div class="p-tag">How to play</div>
      <p class="p-clue">Each clue rules out digits. Eliminate until
        <span class="p-emph">one number</span> is left.</p>
      <div class="p-boxes"><div class="p-box">1</div><div class="p-box">2</div><div class="p-box">3</div></div>
    </div>
    <button class="p-btn p-solid">Play today</button>
    <button class="p-btn p-hollow">Archive</button>
    <hr class="p-sep">
    <p>Read the <a class="p-link" href="#">rules</a>.</p>`;

  SCREENS.game = CSS + `
    <div class="p-boxes"><div class="p-box">4</div><div class="p-box">7</div><div class="p-box">?</div></div>
    <div class="p-card">
      <div class="p-tag">Prime</div>
      <p class="p-clue">The number is <span class="p-emph">a prime number</span>.</p>
    </div>
    <div class="p-card">
      <div class="p-tag">Sum</div>
      <p class="p-clue">Its digits add up to <span class="p-emph">less than 15</span>.</p>
    </div>
    <div class="p-card">
      <div class="p-tag">Recurring</div>
      <p class="p-clue">Divided by 3 it gives a <span class="p-emph">recurring decimal</span>.</p>
    </div>
    <button class="p-btn p-solid">Submit guess</button>
    <button class="p-btn p-hollow">Reset</button>`;

  SCREENS.completion = CSS + `
    <div class="p-boxes"><div class="p-box ok">4</div><div class="p-box ok">7</div><div class="p-box ok">3</div></div>
    <p class="p-ok">Correct! You got it in 4 guesses.</p>
    <p class="p-err">Wrong &mdash; that breaks the prime clue.</p>
    <div class="p-card">
      <div class="p-tag">Your streak</div>
      <p class="p-clue"><span class="p-emph">12 days</span> in a row.</p>
    </div>
    <button class="p-btn p-solid">Share result</button>
    <button class="p-btn p-hollow">Play a random puzzle</button>`;
```

Then add `__sync()` as the last line of the module script so the page renders on
load.

- [x] **Step 3: Open it and check the semantic collision cases**

Run: `open docs/prototypes/255-palette.html`

Verify by eye, and specifically check the two collision cases the spec calls out
— these are the ones most likely to fail sign-off:

- **theme Lime + screen completion** — "Correct!" must not read as ordinary
  accent text. Separation here is the 0.10 lightness step, since success (H 150)
  and Lime (H 145) are only 5° apart.
- **theme Cherry + screen completion** — "Wrong" must not read as ordinary accent
  text. Same 0.10 step; error (H 27) and Cherry (H 5) are 22° apart.

- [x] **Step 4: Commit the prototype**

```bash
git add docs/prototypes/255-palette.html
git commit -m "prototype: palette comparison page for #255 sign-off

Throwaway. Hand-written CSS with proto- prefixed classes so Tailwind's
content scan cannot pick up utility candidates from it.

Toggles: theme, mode, screen, shared-vs-per-theme chroma, cream-vs-white bg."
```

- [x] **Step 5: STOP — get user sign-off** — DONE 2026-07-18

Decisions collected:

1. **Accent chroma — per-theme, capped at today's saturation.** Shared read as
   too muted. Eight values, listed under Target palette above.
2. **White `#FAFAFA`, not cream.** Surface stays `#FFFFFF`.
3. **Per-theme, not shared.** Follows from (1).

Consequences for the tasks below, all folded in already:

- Declared values go from 10 to 18. The acceptance criterion moved from ≤10 to
  ≤20 in the spec.
- `src/palette.ts` (Task 4) — `accentC` is a per-theme map per mode, not a scalar.
- `src/tailwind.css` (Task 5) — 8 chroma overrides keyed on the theme attribute.
- `src/colours.ts` (Task 6) — chroma varies by mode as well as theme, so the
  theme→chroma mapping lives in CSS keyed on a `data-theme` attribute rather than
  in `applyColour`. See Task 6 Step 1.
- Contrast tables recomputed against white; worst accent 5.00 → 5.36.

Two errors found while recomputing, corrected in both docs: the success-dark hex
was listed at C 0.15 (spec) and C 0.14 (plan) when the declared token is C 0.11,
and the error-dark hex was listed at C 0.15 in the spec when the token is C 0.14.
Contrast passed in every case, so nothing structural — but the hexes were wrong.

Prototype bug fixed during sign-off: the white/cream toggle tied with the
dark-mode rule on specificity and painted dark-mode cards white. The plan's Step
1 CSS above carries the same bug if copied verbatim; the committed prototype has
the `[data-mode="light"]` qualifier that fixes it.

---

## Task 2: Probe `calc()` inside `oklch()`

`--semantic-l: calc(var(--accent-l) - 0.10)` is the one declared value doing
double duty. `oklch(var())` is already proven; `calc()` inside it is not. Cheap
to check, and it must be checked before the token work depends on it.

**Files:**
- Modify (temporarily): `src/tailwind.css`

- [x] **Step 1: Patch a probe into `@theme`**

Add to the `@theme` block in `src/tailwind.css`, immediately after
`--color-bg`:

```css
  --probe-al: 0.50;
  --probe-sl: calc(var(--probe-al) - 0.10);
  --probe-sem: oklch(var(--probe-sl) 0.11 150);
```

And add to the `@layer utilities` block:

```css
  .probe-calc { color: var(--probe-sem); }
```

The `.probe-calc` rule is required — Step 3 of the earlier build probe showed
unused `@theme` tokens are tree-shaken out of the bundle entirely.

- [x] **Step 2: Build and inspect**

```bash
npm run build
grep -o "probe-sem:[^;]*" "$(ls -t dist/client/assets/*.css | head -1)"
```

Expected PASS: `probe-sem:oklch(var(--probe-sl) .11 150)` — emitted with the
`var()` intact.
Expected FAIL: the declaration is absent, or `calc()` has been flattened to a
literal number.

- [x] **Step 3: Revert the probe**

```bash
git checkout src/tailwind.css
git status --porcelain   # must be empty
```

- [x] **Step 4: Record the outcome**

**PASSED** — 2026-07-18. Superseded later that day: sign-off feedback lifted the
light semantic band from 0.10 to 0.06 while dark kept 0.10, so `--semantic-l` is
now two declared literals and the `calc()` is gone. The probe result still stands
and is recorded here because it de-risked the design before that change, and
because it documents what this build pipeline does to `calc()` inside `oklch()`.

Emitted bundle:

```
--probe-al:.5
--probe-sl:calc(var(--probe-al) - .1)
--probe-sem:oklch(var(--probe-sl) .11 150)
.probe-calc{color:var(--probe-sem)}
```

Lightning CSS normalises the number formatting but does not flatten the `calc()`
or resolve the `var()`. The prototype separately confirms it resolves at runtime:
under Lime light, `--success` computes to `oklch(0.4 0.11 150)`.

So `--semantic-l` stays one declared value. Probe reverted, tree clean.

Had it failed, `--semantic-l` would have become two literals — `0.40` light and
`0.68` dark — for one extra declared value and no other change.

**Noted while in the file:** light `--color-bg` is already `#FAFAFA` and
`--color-surface` already `#FFFFFF`. The white-not-cream decision therefore
leaves both light neutrals exactly as they are today. The only neutral that moves
is the dark surface, `#363634` → `#2A2A2B`.

---

## Task 3: Colour maths test helper

Written before the token change so the contrast guarantee exists as an
executable check first. Pure functions, no DOM, no imports from `src/`.

**Files:**
- Create: `tests/helpers/colour.ts`
- Test: `tests/palette-contrast.spec.ts` (Task 4)

- [ ] **Step 1: Write the failing test**

Create `tests/palette-contrast.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { oklchToHex, contrastRatio } from './helpers/colour';

describe('colour maths helpers', () => {
  it('converts a known OKLCH triple to sRGB hex', () => {
    // Lime accent, light mode: oklch(0.50 0.14 145)
    expect(oklchToHex(0.5, 0.14, 145)).toBe('#1E7729');
  });

  it('computes WCAG contrast symmetrically', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 1);
    expect(contrastRatio('#FFFFFF', '#000000')).toBeCloseTo(21, 1);
  });

  it('matches a known real-world ratio', () => {
    // Lime light accent on the derived cream page background.
    expect(contrastRatio('#1E7729', '#F3F1ED')).toBeCloseTo(5.0, 1);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

```bash
npx vitest run tests/palette-contrast.spec.ts
```

Expected: FAIL — `Failed to resolve import "./helpers/colour"`.

- [ ] **Step 3: Write the helper**

Create `tests/helpers/colour.ts`:

```ts
// OKLCH → sRGB and WCAG 2.1 contrast. Used to assert the palette's AA guarantee
// in CI rather than auditing pairings by hand — the failure mode that shipped
// the #254 AA bug. Matrices are Björn Ottosson's Oklab reference values.

function linearToSrgb(c: number): number {
  return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

function srgbToLinear(c: number): number {
  const n = c / 255;
  return n <= 0.04045 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4);
}

/** Linear-light sRGB triple for an OKLCH colour. Values may fall outside 0..1
 *  when the colour is out of gamut — callers clamp. */
function oklchToLinearRgb(L: number, C: number, H: number): [number, number, number] {
  const h = (H * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);

  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;

  const l = l_ ** 3;
  const m = m_ ** 3;
  const s = s_ ** 3;

  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

export function oklchToHex(L: number, C: number, H: number): string {
  const channel = (v: number): string => {
    const clamped = Math.max(0, Math.min(1, v));
    const byte = Math.round(linearToSrgb(clamped) * 255);
    return Math.max(0, Math.min(255, byte)).toString(16).toUpperCase().padStart(2, '0');
  };
  const [r, g, b] = oklchToLinearRgb(L, C, H);
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

/** True when the OKLCH colour fits inside sRGB without clipping. Clipping shifts
 *  lightness, which would silently break the contrast guarantee. */
export function inSrgbGamut(L: number, C: number, H: number): boolean {
  const eps = 1e-4;
  return oklchToLinearRgb(L, C, H).every((v) => v >= -eps && v <= 1 + eps);
}

function relativeLuminance(hex: string): number {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => srgbToLinear(parseInt(h.slice(i, i + 2), 16)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
```

- [ ] **Step 4: Run it to verify it passes**

```bash
npx vitest run tests/palette-contrast.spec.ts
```

Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add tests/helpers/colour.ts tests/palette-contrast.spec.ts
git commit -m "test: OKLCH and WCAG contrast helpers for the palette guarantee (#255)"
```

---

## Task 4: Contrast guarantee test

This is the direct answer to how #254 shipped an AA failure. It asserts the
guarantee by computing it, so a future fifth theme cannot be added without the
check running.

**Files:**
- Modify: `tests/palette-contrast.spec.ts`

- [ ] **Step 1: Write the failing test**

First **replace** the existing import line at the top of
`tests/palette-contrast.spec.ts` — do not add a second one, or the duplicate
identifiers will fail the build:

```ts
import { oklchToHex, contrastRatio, inSrgbGamut } from './helpers/colour';
import { PALETTE } from '../src/palette';
```

Then append the new suite below the existing `describe` block:

```ts
type ThemeName = keyof typeof PALETTE.hues;
const themes = Object.keys(PALETTE.hues) as ThemeName[];

describe('palette AA guarantee', () => {
  const modes = ['light', 'dark'] as const;

  it.each(modes)('every %s accent clears AA on bg and surface', (mode) => {
    const { accentL, accentC, bg, surface } = PALETTE[mode];
    for (const name of themes) {
      const hex = oklchToHex(accentL, accentC[name], PALETTE.hues[name]);
      expect(contrastRatio(hex, bg), `${name} on bg`).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(hex, surface), `${name} on surface`).toBeGreaterThanOrEqual(4.5);
    }
  });

  // Chroma is per-theme and five of the eight values sit on the sRGB ceiling, so
  // this is the check that stops a hand-tweak drifting out of gamut. Clipping
  // shifts lightness, which is the one thing the AA guarantee rests on.
  it.each(modes)('every %s accent fits inside sRGB', (mode) => {
    const { accentL, accentC } = PALETTE[mode];
    for (const name of themes) {
      expect(inSrgbGamut(accentL, accentC[name], PALETTE.hues[name]), `${name} out of gamut`).toBe(true);
    }
  });

  it.each(modes)('%s semantics clear AA and stay clear of the accent band', (mode) => {
    const { accentL, semanticL, bg, surface } = PALETTE[mode];
    for (const [name, { hue, chroma }] of Object.entries(PALETTE.semantics)) {
      const hex = oklchToHex(semanticL, chroma, hue);
      expect(contrastRatio(hex, bg), `${name} on bg`).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(hex, surface), `${name} on surface`).toBeGreaterThanOrEqual(4.5);
    }
    // The lightness gap is what keeps success readable under Lime and error
    // readable under Cherry, where hue separation alone is 5 deg and 22 deg.
    expect(Math.abs(accentL - semanticL)).toBeGreaterThanOrEqual(0.09);
  });

  it('bg text clears AA on both bg and surface in both modes', () => {
    for (const mode of modes) {
      const { text, bg, surface } = PALETTE[mode];
      expect(contrastRatio(text, bg)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(text, surface)).toBeGreaterThanOrEqual(4.5);
    }
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

```bash
npx vitest run tests/palette-contrast.spec.ts
```

Expected: FAIL — `Failed to resolve import "../src/palette"`.

- [ ] **Step 3: Create the palette source of truth**

Create `src/palette.ts`. This is the single declaration the CSS, the Worker
mirror, and the tests all agree on.

```ts
// Clumeral — palette.ts
// The derived palette's declared values. Everything else in the colour system
// computes from these. Contrast is carried by accentL alone, shared across all
// four themes, so a theme cannot fail WCAG AA — see tests/palette-contrast.spec.ts.
//
// Adding a fifth theme means adding one hue angle here. Nothing else.

export const PALETTE = {
  hues: { Lime: 145, Cherry: 5, Blueberry: 262, Grape: 305 },

  semantics: {
    success: { hue: 150, chroma: 0.11 },
    error:   { hue: 27,  chroma: 0.14 },
  },

  light: {
    bg: '#FAFAFA',
    surface: '#FFFFFF',
    text: '#262624',
    accentL: 0.5,
    // min(today's chroma, the hue's sRGB ceiling at accentL). Lime and Cherry are
    // ceiling-capped; Blueberry and Grape sit at today's value with room to spare.
    accentC: { Lime: 0.157, Cherry: 0.201, Blueberry: 0.178, Grape: 0.237 },
    semanticL: 0.4,
  },

  dark: {
    bg: '#121213',
    surface: '#2A2A2B',
    text: '#FAF8F4',
    accentL: 0.78,
    // All but Lime are at their sRGB ceiling. L=0.78 is what AA on surface
    // requires, and a lighter colour has less room for chroma — so these are
    // gamut limits, not choices. Lime could reach 0.245 and is held at today's
    // value instead.
    accentC: { Lime: 0.174, Cherry: 0.135, Blueberry: 0.111, Grape: 0.140 },
    semanticL: 0.68,
  },
} as const;
```

Adding a fifth theme now means adding a hue angle **and** a chroma value per
mode — three numbers, not one. The gamut test in Step 1 will catch a chroma set
above the new hue's ceiling.

- [ ] **Step 4: Run it to verify it passes**

```bash
npx vitest run tests/palette-contrast.spec.ts
```

Expected: PASS. Worst accent ratio is Lime light at 5.00; worst overall is error
dark on surface at 4.70.

- [ ] **Step 5: Commit**

```bash
git add src/palette.ts tests/palette-contrast.spec.ts
git commit -m "feat: palette source of truth + AA guarantee test (#255)

Contrast is asserted by computation across every accent x mode x surface
pairing, so the per-pairing audit that let #254 ship an AA failure is no
longer the mechanism protecting us."
```

---

## Task 5: Rewrite the tokens in `tailwind.css`

**Files:**
- Modify: `src/tailwind.css:35-117` (the `@theme` block and the `html.dark` override)

- [ ] **Step 1: Replace the `@theme` colour tokens**

In `src/tailwind.css`, replace the token declarations from `--color-bg` through
`--color-error` (keeping the `--shadow-*` and `--font-*` lines below untouched)
with:

```css
  /* ── Derived palette (#255) ────────────────────────────────────────────────
     Declared values live in src/palette.ts and are mirrored here and in the
     Worker's inline <style> (src/worker/puzzles.ts). tests/token-parity.spec.ts
     fails the build if those two drift apart.

     Contrast rides on --accent-l alone, shared by all four themes, so a theme
     cannot fail AA. Chroma and hue are contrast-inert: pushing chroma to the
     sRGB ceiling moves the ratio by at most ~0.5. This is what makes the #254
     bug class unrepresentable rather than merely fixed.

     Adding a theme = adding one hue angle. No new contrast pairings to verify. */

  --accent-l: 0.50;
  --semantic-l: calc(var(--accent-l) - 0.10);

  /* Hue and chroma per theme. colours.ts sets data-theme on <html>; these rules
     resolve both from it, so the mode half of the mapping stays in CSS and
     applyColour needs no light/dark branch. Defaults are Lime's. */
  --accent-h: 145;
  --accent-c: 0.157;

  --color-bg:      #FAFAFA;
  --color-surface: #FFFFFF;
  --color-text:    #262624;
  --color-accent:  oklch(var(--accent-l) var(--accent-c) var(--accent-h));
  --color-border:  color-mix(in srgb, var(--color-text) 12%, transparent);

  /* Success / error must stay green and red whichever accent is active. At a
     fixed accent lightness, hue is the only differentiator left — and success
     (H 150) sits 5 deg from Lime, error (H 27) sits 22 deg from Cherry. The
     lightness step is what keeps them readable as feedback rather than as
     ordinary accent text. Deeper rather than lighter in both modes: pushing the
     dark semantics up collapses red's gamut ceiling to a pale pink. */
  --color-success: oklch(var(--semantic-l) 0.11 150);
  --color-error:   oklch(var(--semantic-l) 0.14 27);
```

Delete the `--color-accent-strong` and `--color-on-accent` declarations along
with their comment blocks.

Then add the per-theme hue and chroma rules **outside** `@theme` (they are plain
rules, not tokens):

```css
html[data-theme="Lime"]   { --accent-h: 145; --accent-c: 0.157; }
html[data-theme="Cherry"]  { --accent-h: 5;   --accent-c: 0.201; }
html[data-theme="Blueberry"]   { --accent-h: 262; --accent-c: 0.178; }
html[data-theme="Grape"] { --accent-h: 305; --accent-c: 0.237; }

/* Dark chroma is lower for every theme but Lime: L=0.78 leaves less sRGB room
   for saturation. Hue does not vary by mode, so it is not repeated. */
html.dark[data-theme="Lime"]   { --accent-c: 0.174; }
html.dark[data-theme="Cherry"]  { --accent-c: 0.135; }
html.dark[data-theme="Blueberry"]   { --accent-c: 0.111; }
html.dark[data-theme="Grape"] { --accent-c: 0.140; }
```

- [ ] **Step 2: Replace the `html.dark` override**

Replace the colour lines inside `html.dark` (keeping `--octo-c1/2/3`):

```css
    --accent-l: 0.78;
    /* Lime's dark chroma, as the default. Every theme's own rule outranks this
       on specificity, so it only shows before colours.ts sets data-theme — and
       it is what /archive renders with, since the Worker mirror has no
       per-theme rules. Keep it equal to the Worker's :root.dark value or
       tests/token-parity.spec.ts fails. */
    --accent-c: 0.174;

    --color-bg:      #121213;
    --color-surface: #2A2A2B;
    --color-text:    #FAF8F4;
```

`--color-accent`, `--color-border`, `--color-success` and `--color-error` are not
repeated — they are `var()`-based and re-resolve automatically. Delete the
`--color-on-accent: var(--color-bg);` line and its comment.

- [ ] **Step 3: Sweep the CSS consumers**

In the same file, replace every `var(--color-accent-strong)` with
`var(--color-accent)` and every `var(--color-on-accent)` with `var(--color-bg)`.
There are 8 and 3 occurrences respectively.

```bash
grep -c "accent-strong\|on-accent" src/tailwind.css   # expect 0 when done
```

- [ ] **Step 4: Build and verify the tokens survive**

```bash
npm run build
CSS="$(ls -t dist/client/assets/*.css | head -1)"
grep -o "\-\-color-accent:[^;]*" "$CSS"
grep -o "\-\-color-success:[^;]*" "$CSS"
```

Expected: both emitted with `var()` intact, e.g.
`--color-accent:oklch(var(--accent-l) var(--accent-c) var(--accent-h))`.

- [ ] **Step 5: Commit**

```bash
git add src/tailwind.css
git commit -m "refactor: derive the palette from lightness + hue in tailwind.css (#255)

Removes --color-accent-strong and --color-on-accent. One accent per mode now
clears AA on both bg and surface, so the strong/raw split is unnecessary, and
on-accent collapses into bg -- which makes accent-on-bg and bg-on-accent the
same ratio by symmetry."
```

---

## Task 6: Switch `colours.ts` to hue angles

**Files:**
- Modify: `src/colours.ts:13-18` (`THEMES`), `:31-38` (`applyColour`), `:60-62` (swatch vars)
- Modify: `src/tailwind.css` (`.swatch-btn` rules)

- [ ] **Step 1: Replace `THEMES` and the interface**

In `src/colours.ts`, replace the `ColourTheme` interface and `THEMES` with:

```ts
import { PALETTE } from './palette';

type ThemeName = keyof typeof PALETTE.hues;

interface ColourTheme {
  name: ThemeName;
  hue: number;
  chromaLight: number;
  chromaDark: number;
}

// Hue plus a chroma per mode. Lightness is shared and lives in tailwind.css,
// which is what makes every theme AA-safe by construction — chroma is
// contrast-inert and free to vary per theme (#255).
const THEMES: ColourTheme[] = (Object.keys(PALETTE.hues) as ThemeName[]).map((name) => ({
  name,
  hue: PALETTE.hues[name],
  chromaLight: PALETTE.light.accentC[name],
  chromaDark: PALETTE.dark.accentC[name],
}));
```

- [ ] **Step 2: Simplify `applyColour`**

Chroma varies by theme *and* mode, so pushing it from JS would need the
`isDark()` branch back. Instead set a `data-theme` attribute and let the CSS
rules from Task 5 Step 1 resolve hue and both chroma values — the mode half stays
in the cascade next to `html.dark`, where it already lives.

```ts
function applyColour(theme: ColourTheme): void {
  active = theme;
  root.dataset.theme = theme.name;
  window._currentColour = theme.name;
  refreshSwatchState();
}
```

Delete the now-unused `isDark()` function.

**Check first:** confirm nothing else reads or writes `data-theme` on `<html>`.
`theme.ts` uses the `.dark` class, so it should be free, but verify before
relying on it:

```bash
grep -rn "data-theme\|dataset.theme" src/ index.html e2e/
```

- [ ] **Step 3: Set the swatch variables**

Each swatch dot needs its own hue and both chromas, since a dot's colour cannot
come from `--accent-c` (that is whichever theme is *active*, not the one the dot
represents). In `renderSwatches()`:

```ts
    btn.style.setProperty('--swatch-h', String(t.hue));
    btn.style.setProperty('--swatch-cl', String(t.chromaLight));
    btn.style.setProperty('--swatch-cd', String(t.chromaDark));
```

- [ ] **Step 4: Update the swatch CSS**

```css
  .swatch-btn {
    /* ... existing width/height/border-radius/etc unchanged ... */
    background: oklch(var(--accent-l) var(--swatch-cl) var(--swatch-h));
  }

  /* Kept, unlike the rest of the dark colour rules: --accent-l flips on its own
     but swatch chroma cannot, because each dot carries its own pair. */
  html.dark .swatch-btn {
    background: oklch(var(--accent-l) var(--swatch-cd) var(--swatch-h));
  }
```

The old `--swatch-dark` hex variable goes away; the dark rule stays.

- [ ] **Step 5: Leave `_refreshAccent` in place**

`theme.ts:15` calls `window._refreshAccent?.()` after a dark/light flip. It is
now a no-op for colour purposes, but it still refreshes swatch state and the
`_currentColour` global that e2e specs read. Removing it is out of scope for
#255 — leave it.

- [ ] **Step 6: Verify in the browser**

```bash
npm run dev
```

Open the app, cycle all four swatches in both light and dark. Confirm the accent
changes, the swatch dots show four distinct colours, and the active swatch ring
still renders.

- [ ] **Step 7: Commit**

```bash
git add src/colours.ts src/tailwind.css
git commit -m "refactor: colours.ts sets one hue angle per theme (#255)

Accent lightness and chroma are shared, so the theme definition is now a single
number and the isDark() branch in applyColour is gone -- hue does not vary by
mode. Swatch dots derive from the same tokens instead of carrying their own
light/dark hex pair."
```

---

## Task 7: Sweep the `text-accent-strong` utility usages

`text-accent-strong` was a Tailwind utility generated from the deleted token. Any
left behind will silently render as inherited colour.

**Files:**
- Modify: `index.html`, `src/app.ts`, `src/welcome.ts`, `src/walkthrough.ts`

- [ ] **Step 1: Find every occurrence**

```bash
grep -rn "accent-strong" index.html src/ --include=*.ts --include=*.html
```

Expected: 7 in `index.html`, 2 in `src/app.ts`, 2 in `src/welcome.ts`, 1 in
`src/walkthrough.ts`.

- [ ] **Step 2: Replace them**

```bash
sed -i '' 's/text-accent-strong/text-accent/g' index.html src/app.ts src/welcome.ts src/walkthrough.ts
grep -rn "accent-strong" index.html src/ --include=*.ts --include=*.html   # expect no output
```

- [ ] **Step 3: Run the unit suite**

```bash
npm test
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add index.html src/app.ts src/welcome.ts src/walkthrough.ts
git commit -m "refactor: text-accent-strong -> text-accent across the app (#255)"
```

---

## Task 8: Mirror the tokens into the Worker + parity test

`/archive` is Worker-rendered, ships its own inline `<style>`, and does not load
`tailwind.css`. This duplication is what let #243 survive its first fix.

**Files:**
- Create: `tests/token-parity.spec.ts`
- Modify: `src/worker/puzzles.ts:57-79` (the `<style>` token block)

- [ ] **Step 1: Write the failing test**

Create `tests/token-parity.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// /archive is Worker-rendered and ships its own copy of the tokens, because it
// never loads tailwind.css. #243 shipped a fix to the SPA that missed this copy
// and survived review as a result. This test is the guard.
//
// #200 migrates /archive to a SPA route, at which point the duplication and this
// test both go away.
//
// Scope: the base blocks only. The per-theme html[data-theme=...] rules are not
// compared, because /archive has no theme switcher and the Worker carries no
// per-theme rules to compare against. What that means in practice is that
// /archive always renders Lime — the --accent-h and --accent-c defaults in the
// base blocks — which is the behaviour today too.

const TOKENS = [
  '--accent-l',
  '--accent-c',
  '--semantic-l',
  '--color-bg',
  '--color-surface',
  '--color-text',
  '--color-accent',
  '--color-border',
  '--color-success',
  '--color-error',
];

function declarations(css: string, scope: string): Record<string, string> {
  // Grab the body of the given selector block, then pull the token declarations.
  const block = new RegExp(`${scope}\\s*\\{([^}]*)\\}`).exec(css);
  if (!block) throw new Error(`no "${scope}" block found`);
  const out: Record<string, string> = {};
  for (const token of TOKENS) {
    const m = new RegExp(`${token}\\s*:\\s*([^;]+);`).exec(block[1]);
    if (m) out[token] = m[1].trim().replace(/\s+/g, ' ');
  }
  return out;
}

const root = resolve(__dirname, '..');
const tailwind = readFileSync(resolve(root, 'src/tailwind.css'), 'utf-8');
const worker = readFileSync(resolve(root, 'src/worker/puzzles.ts'), 'utf-8');

describe('token parity: tailwind.css vs the Worker inline style', () => {
  it('light-mode tokens agree', () => {
    expect(declarations(worker, ':root')).toEqual(declarations(tailwind, '@theme'));
  });

  it('dark-mode tokens agree', () => {
    expect(declarations(worker, ':root\\.dark')).toEqual(
      declarations(tailwind, 'html\\.dark')
    );
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

```bash
npx vitest run tests/token-parity.spec.ts
```

Expected: FAIL — the Worker still carries the old hex tokens plus
`--color-accent-strong` / `--color-on-accent`, so the objects differ.

- [ ] **Step 3: Update the Worker's token block**

In `src/worker/puzzles.ts`, replace the `:root` and `:root.dark` colour
declarations with values that match `tailwind.css` exactly:

```css
  :root {
    color-scheme: light dark;
    /* Mirrors the @theme block in src/tailwind.css. /archive does not load
       tailwind.css, so these must be kept in step by hand — tests/token-parity.spec.ts
       fails if they drift. Goes away with #200. */
    --accent-l: 0.50;
    --semantic-l: calc(var(--accent-l) - 0.10);
    --accent-h: 145;
    --accent-c: 0.157;
    --color-bg:      #FAFAFA;
    --color-surface: #FFFFFF;
    --color-text:    #262624;
    --color-accent:  oklch(var(--accent-l) var(--accent-c) var(--accent-h));
    --color-border:  color-mix(in srgb, var(--color-text) 12%, transparent);
    --color-success: oklch(var(--semantic-l) 0.11 150);
    --color-error:   oklch(var(--semantic-l) 0.14 27);
  }
  :root.dark {
    color-scheme: dark;
    --accent-l: 0.78;
    --accent-c: 0.174;
    --color-bg:      #121213;
    --color-surface: #2A2A2B;
    --color-text:    #FAF8F4;
  }
  :root.light { color-scheme: light; }
```

Then sweep the consumers in the same file: replace every
`var(--color-accent-strong)` with `var(--color-accent)` and every
`var(--color-on-accent)` with `var(--color-bg)`.

```bash
grep -c "accent-strong\|on-accent" src/worker/puzzles.ts   # expect 0
```

- [ ] **Step 4: Run it to verify it passes**

```bash
npx vitest run tests/token-parity.spec.ts
```

Expected: PASS, 2 tests.

- [ ] **Step 5: Verify `/archive` renders**

```bash
npm run preview
```

Open `http://localhost:4173/archive` in both light and dark. Confirm the page
background, link colour, and table rows all pick up the new palette — the SSR
block takes `oklch()` verbatim because it is a JS template literal and never
reaches Lightning CSS.

- [ ] **Step 6: Commit**

```bash
git add src/worker/puzzles.ts tests/token-parity.spec.ts
git commit -m "feat: mirror derived tokens into the Worker + parity test (#255)

/archive ships its own token copy because it never loads tailwind.css. #243
shipped a fix that missed this copy. The parity test makes that class of miss
fail in CI instead of in review."
```

---

## Task 9: Rewrite `DESIGN-SYSTEM.md`

**Files:**
- Modify: `docs/DESIGN-SYSTEM.md`

- [x] **Step 1: Read the current doc**

```bash
cat docs/DESIGN-SYSTEM.md
```

- [x] **Step 2: Rewrite the colour section**

Replace the hand-picked palette listing with the derivation. Cover:

- **The declared values** — the 18 from `src/palette.ts`, and that it is the
  single source of truth.
- **The rule that matters** — contrast rides on `--accent-l` alone, shared
  across themes. Chroma and hue are contrast-inert, so they are free aesthetic
  dials — which is exactly why chroma could be set per theme without reopening
  the AA question.
- **How to add a theme** — add a hue angle to `PALETTE.hues` and a chroma to
  `light.accentC` / `dark.accentC`. Three numbers. The contrast test covers AA
  automatically; the gamut test catches a chroma set above the hue's ceiling.
  Note that dark chroma is usually gamut-limited, so pick it by finding the
  ceiling at L=0.78 rather than by eye.
- **Why `--color-accent-strong` and `--color-on-accent` are gone** — one accent
  now clears AA on both `bg` and `surface`; on-accent is `bg`, which makes the
  two directions the same ratio by symmetry.
- **The semantic lightness band** — why success/error sit `accent-l − 0.10`, and
  the Lime/Cherry collisions that make it necessary.
- **The two known exceptions** — `--octo-c1/2/3` stay hardcoded hex (#210,
  cannot use `var()` in SVG `fill` keyframes, decorative, no contrast
  requirement); and the Worker token mirror in `src/worker/puzzles.ts`, guarded
  by `tests/token-parity.spec.ts` until #200 lands.
- **Build constraints** — unused `@theme` tokens are tree-shaken, so a token only
  JS reads must be referenced in CSS somewhere.

- [x] **Step 3: Commit**

```bash
git add docs/DESIGN-SYSTEM.md
git commit -m "docs: rewrite DESIGN-SYSTEM.md around the derivation rules (#255)"
```

---

## Work on this branch beyond the plan

Added during execution, in response to review while testing. None of it is in the
task list above, and **Task 11's PR body must cover it** — the diff spans more
than the palette.

| commits | what | notes |
|---|---|---|
| `84fa7ea`, `5c41080` | Strike through eliminated digits in the boxes and number pad | Unrelated to the palette. Kept on this branch by explicit decision — it is a colour-adjacent visual change and the user was happy to ship it together. Boxes moved from `opacity` to alpha-on-colour so the strike could carry its own alpha; both now sit at the same value, 18% boxes / 25% pad. |
| `96e83d4` | `/archive` → Show puzzle now lands on `/play` in every case | **Pre-existing bug, not introduced by #255.** The Worker-rendered link is a full page load and cannot pass `skipResolve`, so RTE-03 bounced it to `/solved` or `/welcome`. Fixed with a `?from=archive` marker. Five router tests; two fail without the fix. |
| `c2489dc`, `72169b9`, `c7c2a98`, `13ac398` | Fruit icons in the accent swatches, selected-state arrow, own menu section | Icon colour needed no new contrast check: it is the `on-accent = bg` rule, so it inherits the accent-on-bg ratio by symmetry. |
| `065ce5e` | Themes renamed to fruit — Cherry, Blueberry, Grape | **Carries a storage migration.** `dlng_colour` stores the theme name, so without it every player not on Lime would silently reset. Migration lives in `initColours` *and* the Worker's inline script; 6 tests cover it. |

### Still unverified

**Cleared by Task 10 on 2026-07-19** — the full suite ran green (260 e2e, 24 axe,
169 unit). Kept for the record:

- ~~The e2e suite has not been run since any of this.~~ Run. `menu.spec.ts` passed
  untouched; `shadow-theme.spec.ts` needed a one-line parser fix (`0291173`) —
  see Task 10 Step 3.
- ~~`shadow-theme.spec.ts` was rewritten to read the expected accent back from the
  live page.~~ That rewrite was correct and is why the fix was one line: the spec
  compares the shadow to the *live* accent, so it needed no new hexes.
- ~~Expect other specs asserting literal colours to fail.~~ None did. `shadow-theme`
  was the only colour-asserting spec that broke, and not over a colour value.

---

## Task 10: QA

The level agreed during discuss, matched to a change where every colour on screen
moves.

**Files:**
- Modify (if selectors changed): `e2e/specs/*`

**Ran 2026-07-19. Outcome: green.** 169 unit · 24 axe · 260 e2e, one spec fixed.
Findings recorded under each step.

- [x] **Step 1: Unit suite**

```bash
npm test
```

Expected: PASS, including the contrast and parity specs.

PASS — 169 tests, 16 files.

- [x] **Step 2: axe, both schemes**

```bash
npx playwright test --grep axe
```

Expected: 26 axe tests green, both colour schemes, including the open-menu and
open-modal cases added in #254.

PASS — 24 green, 36 skipped. The count is 24 not 26: 12 axe cases (6 per scheme)
across the two chromium projects. The other three engines skip axe by config.

- [x] **Step 3: Full regression, 5-engine matrix**

```bash
npm run test:e2e
```

Expected: full suite green. Any failure asserting a literal colour value is a
**test that needs updating**, not necessarily a regression — but confirm each one
by eye before changing an assertion.

First run: 250 passed, **10 failed**, all `shadow-theme.spec.ts`, light mode only,
identical across all five engines — that consistency ruled out flake.

Cause was the spec's channel regex, `([\d.]+)`, which cannot parse a negative
number. Cherry light is chroma-capped at its sRGB ceiling, so green resolves to
exactly 0 and float error takes it a hair under; the browser serialises
`color(srgb 0.715305 -0.000747958 0.328425 / 0.3)`.

Confirmed by eye before touching the assertion, per the instruction above: both
the shadow and `--color-accent` rasterise through a canvas to `rgb(182, 0, 84)`
— the planned `#B60054`. The rendering was correct; only the parser was not.
This also reconciles with `inSrgbGamut`, which passes: it checks *linear*-light
RGB against `eps 1e-4`, and linear `-5.8e-5` × 12.92 ≈ the `-0.00075` gamma value
the browser prints. Both agree Cherry light is over the boundary by a rounding
hair.

Fixed in `0291173` — accept a sign and an exponent, and clamp to the byte range
so both sides of the comparison sit in the same space (`resolvedAccent` already
clamps via canvas). Re-run: **260 passed, 0 failed, 38 skipped.**

- [x] **Step 4: Manual visual pass**

```bash
npm run preview
```

Walk welcome → game → completion in all four themes × both modes. Confirm against
the prototype signed off in Task 1. Check `/archive` separately, since it renders
through the Worker path.

PASS. Rather than eyeball 8 combos for colour accuracy, the resolved tokens were
rasterised through a canvas in the built preview and compared to the Task 1
target tables. **Every one of the 8 theme × mode combos matches**, worst ratio
5.36 (Lime light on bg). Screens were then checked by eye for legibility and
layout, which is what numbers cannot catch.

| mode | theme | accent | vs bg | vs surface |
|---|---|---|---|---|
| light | Lime | `#01791E` | 5.36 | 5.59 |
| light | Cherry | `#B60054` | 6.45 | 6.74 |
| light | Blueberry | `#245BC7` | 5.92 | 6.18 |
| light | Grape | `#8420CC` | 6.58 | 6.86 |
| dark | Lime | `#65D46D` | 9.98 | 7.64 |
| dark | Cherry | `#FF91AC` | 8.82 | 6.76 |
| dark | Blueberry | `#90B7FF` | 9.27 | 7.10 |
| dark | Grape | `#CC9FFF` | 8.89 | 6.81 |

Off-by-one hex differences against the target tables (`#01791E` vs `#00791E`,
`#8420CC` vs `#8420CB`) are 1/255 rounding, not drift.

Two things found that the plan predicted differently, both in the plan's favour:

- **`/archive` honours the player's theme.** The parity test's scope comment in
  the plan predicted it "always renders Lime". The shipped Worker carries
  `:root[data-theme=...]` rules (`src/worker/puzzles.ts:98-105`) behind a
  `--chroma-*` indirection, so the dark block redefines four chroma values
  instead of repeating per-theme rules. Verified live: Cherry light and Grape
  dark both render correctly. The committed `tests/token-parity.spec.ts` already
  covers all four themes plus the semantic aliases — the stale comment exists
  only in this plan document, not in the test.
- **Semantics alias the themes rather than sitting in a lightness band.** Task 5's
  draft text still describes `--semantic-l: calc(var(--accent-l) - 0.10)` with
  hues 150/27. What shipped matches the architecture note at the top of this plan:
  `--color-success` and `--color-error` are the Lime and Cherry accents at the
  shared `--accent-l`. So under Lime, success *is* the accent colour; under
  Cherry, error is. Verified that `ICON_CHECK`/`ICON_CROSS` accompany every
  semantic message (`src/app.ts:294-310`), so colour is never the only signal.

- [x] **Step 5: Commit any test updates**

```bash
git add e2e/
git commit -m "test: update colour assertions for the derived palette (#255)"
```

---

## Task 11: Remove the prototype and open the PR

**Done 2026-07-19. PR [#258](https://github.com/jevawin/clumeral-game/pull/258)
against `staging`.** The DA review found two HIGH issues; both were reproduced
independently and fixed before the PR opened (`05bc3c2`). Details under Step 3.

Final QA after the review fixes: **182 unit · 36 axe · 272 e2e**, 0 failures.

- [x] **Step 1: Delete the prototype**

It served its purpose at sign-off and should not ship. It stays in git history if
anyone wants it back.

```bash
git rm docs/prototypes/255-palette.html
git commit -m "chore: remove the #255 prototype comparison page

Signed off in Task 1. Kept in history at the commit that added it."
```

- [x] **Step 2: Count the literals**

**Result:** 14 unique hexes in the grep's scope, not the ~12 predicted — the
prediction forgot the octopus mascot fill (`#F6F0E8`) and the `theme-color` meta
(`#f5edd8`). Palette-relevant literals went **18 → 6** (the six neutrals); the
other 8 are decorative and pre-existing. The honest headline used in the PR is
**31 literals → 20 declared values**, as the plan anticipated.

`src/worker/feedback.ts` and `src/worker/stats.ts` carry 22 more hexes between
them. Those are internal dashboards, not player-facing, and are out of scope.


Confirm the headline claim before writing it in the PR body.

```bash
grep -rEoh '#[0-9A-Fa-f]{6}' src/ index.html --include=*.ts --include=*.css --include=*.html | sort -u
```

Expected: roughly 12 unique values — the two bases, the two surfaces, the two
text colours, and the six `--octo-c*` decorative stops. The hue and chroma
numbers are not hex literals, so this grep does not see them; the honest headline
is 31 literals → ~18 declared values, not → 12.

- [x] **Step 3: DA review**

Dispatch a **fresh-context subagent** per [docs/DA-REVIEW.md](../../DA-REVIEW.md).
Give it the issue, the spec, and the diff. Do not summarise your own work for it
— the point is a reviewer without your assumptions.

Done. It was given the issue, the spec and the diff, and told explicitly *not* to
read this plan. It earned the gate — **two HIGH findings**, both real, both
reproduced before fixing:

1. **`palette.ts` was not the source of truth it claimed to be.** Shipped code
   read only `hues` and `accentC`; `accentL`, `bg`, `surface` and `text` were
   read by nothing but the contrast test. `token-parity.spec.ts` compared the two
   stylesheets *to each other*, so they could drift together away from
   `palette.ts`. Verified the scenario: setting `--accent-l: 0.62` in both CSS
   files passed all 169 tests while shipping light mode under 4.5:1. **This is
   the exact bug class the whole task exists to remove**, reachable through the
   single parameter the design rests on. Parity is now three-way; the drift
   scenario was re-run and fails.

2. **`?from=archive` was still bounced for its target user.** `coldRedirect`
   calls `replaceState` at `router.ts:194`, rewriting the pathname, and
   `fromArchive` read it afterwards. Any returning player whose last SPA visit
   was an earlier day — the normal case for archive browsing — lost the marker.
   `96e83d4`'s "lands on /play in every case" was false. The five router tests
   never seeded a stale `dlng_last_visit_date`, so they passed over it. Marker is
   now read before the redirect and exempted from it; 2 tests added, the first
   fails without the fix.

Also actioned: parity compares token *sets* by pattern rather than a fixed list;
theme list and semantic aliases derive from `PALETTE`; the duplicated
`LEGACY_NAMES` map is parity-checked; `Object.hasOwn` guards the legacy lookup;
dead `[data-swatches]` rule removed; stale `--octo-c*` and archive-anchor
comments corrected.

Accepted rather than fixed, documented in `DESIGN-SYSTEM.md`: `--color-border`
has a light-only Lightning CSS fallback (`#2626241f`) that only affects browsers
predating `color-mix` support. Fixing it means reintroducing a hand-maintained
per-mode literal, which is what this task removes.

- [x] **Step 4: Self-review**

Follow [docs/SELF-REVIEW.md](../../SELF-REVIEW.md) line by line over the full
diff.

Done against `origin/staging...HEAD` (not `main...HEAD` — staging carries #254
and #253, which are not this PR's work). Caught two comments the branch had made
stale, the checklist's stated #1 miss: `tailwind.css` claimed the Worker mirror
carries no per-theme rules, and `a11y.spec.ts` still credited the removed
`--color-on-accent` token. Fixed in `1e39ce9`.

- [x] **Step 5: Push and open the PR against `staging`** — [#258](https://github.com/jevawin/clumeral-game/pull/258)

Every bullet below is covered in the body, plus the four extra pieces of work and
the DA findings. Axe theme coverage was added during this step by decision
(`36986dd`): every axe scan had only ever run on the default Lime, so the other
three themes were never scanned. 24 → 36 axe tests, all green.

QA was re-run in full after the review fixes, since they changed shipped code:
**182 unit · 36 axe · 272 e2e**, 0 failures.

> One process note for next time: the first full e2e re-run **exited 0 while
> actually failing** — port 4173 was held by a preview server, so Playwright
> never started. `npm run test:e2e` masking a hard failure behind exit 0 is worth
> knowing about. Stop preview servers before a suite run and read the tail, do
> not trust the exit code.


```bash
git push -u origin issue/255
gh pr create --base staging --title "Derive the whole palette from 2 base colours + hue angles (OKLCH) (#255)" --body "..."
```

PR body must record:

- The literal count, before and after.
- The `calc()` probe outcome from Task 2.
- The three sign-off decisions from Task 1.
- That `--color-accent-strong` and `--color-on-accent` are removed, partly
  undoing #254 by design.
- The worst-case contrast ratio: **5.36**, Lime light on bg — which is now the
  worst *overall* too, measured live in Task 10. The "4.70 overall, error dark on
  surface" figure this bullet used to carry predates the semantics being aliased
  onto the themes, which removed that pairing. Do not repeat it in the PR body.
- That per-theme chroma raised the declared-value count from 10 to 18, and why
  it was worth it — shared chroma read as visibly muted at sign-off.
- That five of the eight dark chroma values are sRGB gamut limits rather than
  choices, so dark accents are less saturated than today and cannot be restored
  without dropping below AA.

**Never merge this yourself.** The user merges on GitHub.

- [ ] **Step 6: Post-merge (user does the merge first)**

```bash
git remote prune origin
git branch -d issue/255
```

Then update `docs/ROADMAP.md`: move #255 out of _Now_ into _Recently shipped_,
and promote the next _Next_ item. Note that #256 (exclude `.planning/` from the
Tailwind content scan) was gated on #255 landing.
