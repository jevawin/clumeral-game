# Clumeral `static/` Redesign — Implementation Brief

**Purpose:** `static/` is a **visual/UI prototype only**. It demonstrates the new design direction but uses hardcoded puzzle data and is not wired to the Worker or `puzzle.js`. When implementing, adapt the design and UI patterns into the existing `app.js` + `_worker.js` + `puzzle.js` architecture. Do not copy `game.js` logic wholesale — treat it as a reference for UI behaviour only.

**What changes:** Design, layout, fonts, colour system, mascot, entry mechanic, animations.
**What does not change:** `puzzle.js`, `_worker.js`, the filter/compute algorithm, `localStorage` keys, daily seeding, clue data structure.

---

## 1. New Digit Entry Mechanic

**Old:** Text input (`<input type="text" inputmode="numeric">`) + Submit button always visible.

**New:** Three interactive "digit boxes" replace the text input entirely. No text field.

### How it works
- Three `<div class="digit-box">` elements (`#d0`, `#d1`, `#d2`), each `flex:1` in a row, height `7rem`.
- Each box starts showing a **grid of possible digits** — box 0 (hundreds) shows 1–9, boxes 1–2 (tens, units) show 0–9.
- Digits are rendered as `<span>` inside a `.db-possibles` grid div:
  - Box 0: 3-col grid, 9 entries (1–9)
  - Boxes 1–2: 4-col grid, 10 entries (0–9), with a `dc-mid` class spanning col 2–4 to handle the layout asymmetry of 10 digits in 4 cols
- Eliminated digits get `.elim` class → rendered at `opacity: 0.12` (faded, not removed)
- When only **1 digit remains**, the box shows a large resolved digit (`.db-resolved`, Inconsolata font, `2rem`)

### Keypad
- A **floating keypad** (`#cw-keypad-wrap`, `display:none` → `.open`) appears below the digit boxes when a box is tapped.
- Keypad is a 5-column grid of `.kbtn` buttons.
- Tapping a keypad button **toggles** that digit eliminated/restored in the active box.
- Eliminated buttons get `.elim` class: lighter background, muted text.
- Tapping the same box again closes the keypad.

### Submit visibility
- Submit button is **hidden by default** (`display:none`).
- Only appears (`.visible` → `display:block`) when all 3 boxes have exactly 1 digit remaining.
- The cookie/save row is also hidden and only shown alongside submit via CSS adjacent sibling: `#cw-submit-wrap.visible + #cw-save { display: flex; }`.

### State (adapt into `app.js`, driven by real puzzle answer from `window.PUZZLE_DATA`)
```js
const possibles = [
  new Set(['1'..'9']),   // box 0: hundreds (no zero)
  new Set(['0'..'9']),   // box 1: tens
  new Set(['0'..'9']),   // box 2: units
];
let activeBox = null;
let gameSolved = false;
```

> **Prototype note:** `game.js` hardcodes `const CORRECT_ANSWER = '250'`. In the real implementation this must come from `window.PUZZLE_DATA.answer` (already handled by `loadPuzzle()` in `app.js`).

---

## 2. New Colour Theme

**Old:** Dark-only. Near-black `#0f0f1a` background, frosted glass card.

**New:** **Light/dark adaptive** using `light-dark()` CSS. Defaults to system `prefers-color-scheme`; user can toggle and preference is stored in `localStorage` key `dlng_theme`.

```css
:root {
  color-scheme: light dark;

  /* Constants (same in both themes) */
  --acc: #ff6d5a;

  /* Theme-adaptive */
  --bg:       light-dark(#f5edd8, #262624);    /* warm cream / near-black charcoal */
  --text:     light-dark(#262624, #fffdf7);    /* dark charcoal / warm white */
  --muted:    light-dark(rgba(38,38,36,.55), rgba(255,253,247,.6));
  --card-bg:  light-dark(#fffdf7, #2e2e2c);   /* solid card — NOT frosted glass */
  --surface:  light-dark(#ffffff, #363634);    /* keypad/digit-box background */
  --border:   light-dark(rgba(38,38,36,.12), rgba(255,253,247,.1));
  --card-sh:  light-dark(0.25rem 0.25rem 0 rgba(38,38,36,.12), 0.25rem 0.25rem 0 rgba(0,0,0,.3));
  --sh1:      light-dark(#e8a87c, #ff6d5a);   /* large bg circle */
  --sh2:      light-dark(#c0543a, #262624);   /* small bg circle (invisible in dark) */
}
:root.dark  { color-scheme: dark; }
:root.light { color-scheme: light; }
```

JS toggles `.dark`/`.light` on `:root`:
```js
document.documentElement.classList.toggle('dark',  isDark);
document.documentElement.classList.toggle('light', !isDark);
```

**Key change:** The card is no longer frosted glass. It uses a solid fill with an offset `box-shadow` (`0.25rem 0.25rem 0`) for a retro/offset shadow feel. Remove `backdrop-filter` entirely.

Theme toggle button label: "Dark" (in light mode) / "Light" (in dark mode). Icon: moon/sun SVG swap.

---

## 3. Fonts

**Old:** `Forum` (title/footer) + `Inter` (body/UI).

**New:** Three fonts, all Google Fonts — `Forum` and `Inter` are dropped:

```html
<link href="https://fonts.googleapis.com/css2?family=Frank+Ruhl+Libre:wght@300..900
  &family=DM+Sans:wght@300..700
  &family=Inconsolata:wdth,wght@75..125,300..700&display=swap" rel="stylesheet">
```

| Role | Font |
|------|------|
| Body / all UI text | `DM Sans` |
| Puzzle label, clue tags, digit boxes, keypad, modal section titles | `Inconsolata` (monospace) |
| Logo wordmark | SVG path (no font — see §6) |

`Frank Ruhl Libre` is imported but not actively used in the prototype — may be reserved for a future use.

---

## 4. Octopus Mascot

**Old:** No mascot.

**New:** Custom octopus SVG (`#octo`, 53×52px) in the page header, left of the logo title.

### Shape
Rounded rectangle body with 5 rounded tentacle feet along the bottom (achieved via SVG mask path). Body fill: `#FF6D5A` (coral). Outline: `#F6F0E8` (warm white). The full SVG path data is in `static/index.html` lines 98–140.

### Expression layers — toggled by `opacity` attribute:
| Element ID | State |
|------------|-------|
| `#eyeL-r` / `#eyeR-r` | Round eyes (default visible) |
| `#eyeL-s` / `#eyeR-s` | Squinting eyes |
| `#eyeL-x` / `#eyeR-x` | X eyes (wrong answer) |
| `#mouth-h` | Happy mouth (default visible) |
| `#mouth-s` | Squint mouth |
| `#mouth-sad` | Sad mouth (wrong answer) |

### Behaviours
- **Eye tracking:** Eyes follow mouse cursor. Updated each rAF via lerp: `eyeX += (eyeTX - eyeX) * 0.12`.
- **Idle bob:** Continuous `translateY(sin) rotate(sin)` applied every rAF while not animating.
- **Blink:** Alternate-eye blink every ~2.2–4.2s, compresses eye `r` attribute to near-zero and back.
- **Squint-glance:** Eyes squint + glance to several positions every 5–10s.
- **Entry reveal:** Octo fades + slides down into position on page load, then spring-bounces.
- **Click to replay:** `#octo-wrap onclick="replayEntry()"` — replays the full entry animation.

See §9 for wrong/correct answer animations.

---

## 5. How to Play Modal

**Old:** No modal, no instructions UI.

**New:** Full-screen modal (`#cw-modal`, `role="dialog"`) triggered by a "How to play" link in the footer links row. The inline SVG question-mark icon precedes the link text.

### Modal behaviour
- Backdrop: `rgba(0,0,0,0.55)`, fade in/out via `opacity` + CSS `transition`.
- Box: `max-width: 26rem`, slides up from `translateY(0.75rem)` on open.
- Dismissed by: ✕ button (top-right), "Got it" full-width button (bottom), or clicking the backdrop.
- **Auto-shown on first visit** — opens after 400ms if `localStorage.getItem('cw-htp-seen')` is absent. Closing sets this key to `'1'`.

### Modal content — 3 steps with live visual examples:
1. **Step 1:** Digit box showing all 9 digits in a grid. Caption: "A box starts with **all possible digits**. Tap it to open the keypad."
2. **Step 2:** Digit box with some digits faded (`.elim`) + a static demo keypad grid with matching eliminated buttons. Caption: "Tap numbers on the keypad to **remove them** as possibilities."
3. **Step 3:** Digit box showing a single resolved digit ("5"). Caption: "When **one number remains** it fills the box. Do this for all three digits, then submit."

The step examples use the real `.digit-box` / `.db-possibles` / `.db-resolved` / `.kbtn` / `.elim` classes — they are purely static, decorative instances with no JS attached.

---

## 6. Logo SVG

**Old:** `<h1 class="game-title">Clumeral</h1>` rendered in `Forum` font.

**New:** Inline SVG wordmark inside `<h1 id="cw-title">`, `viewBox="0 0 218 43"`. Each letter is a `<g class="tlt">` group containing hand-crafted fill paths. `fill="currentColor"` — inherits `var(--text)` so adapts to light/dark.

The `.tlt` groups start `opacity:0; transform:translateY(10px)` via CSS and are animated in staggered (80ms apart) during the entry sequence.

The full SVG path data is in `static/index.html` lines 144–226. Copy it verbatim.

---

## 7. Background and Circles

**Old:** CSS `radial-gradient` on `body`.

**New:** Three layered background elements, all `position:fixed; z-index:0; pointer-events:none`.

### 1. Dot grid canvas (`#cw-canvas`)
- Covers full viewport, `z-index:0`.
- 24px grid of 1.2px-radius dots.
- Base opacity `~0.10` per theme; brightens to `~0.38–0.40` within 90px of mouse cursor (quadratic falloff).
- Redraws on `mousemove`, `mouseleave`, `resize`.
- Light theme: `rgba(38,38,36,α)` · Dark theme: `rgba(255,253,247,α)`.

### 2. Large circle (`#cw-shape`)
- `top: -140px; right: -120px` · `460×460px` · `border-radius:50%`
- `background-color: var(--sh1)` → warm orange-ish in light, coral in dark
- `opacity: 0.11`

### 3. Small circle (`#cw-shape2`)
- `bottom: -100px; left: -80px` · `260×260px` · `border-radius:50%`
- `background-color: var(--sh2)` → dark red in light, near-invisible in dark (matches bg)
- `opacity: 0.07`

Both circles transition `background-color 0.4s` on theme change.

---

## 8. Digit Entry, Submit, and Cookie Row

### Submit button (`#cw-submit`)
- Full-width, height `3.25rem`, `border-radius: 0.1875rem` (nearly square corners).
- `background: var(--acc)`, no border, white text, DM Sans 600.
- Offset box-shadow: `0.1875rem 0.1875rem 0 rgba(38,38,36,.18)`.
- Active/press state: `translateY(2px) translateX(2px)` + shadow collapses to zero (physical press feel).
- Wrapped in `#cw-submit-wrap` which is `display:none` until `.visible` class is added.

### Cookie/save row (`#cw-save`)
- Hidden by default; revealed purely via CSS when submit becomes visible:
  ```css
  #cw-submit-wrap.visible + #cw-save { display: flex; }
  ```
- Uses a real `<input type="checkbox" id="cw-ck">` (visually hidden via `display:none`), with a styled `<label>` containing:
  - A green checkmark SVG (`.check-icon`, stroke `#4caf88`)
  - Text "Keep my score in a"
  - A cookie icon SVG (`#cookie-icon`, 13×13, `stroke: var(--muted)`)
  - Text "cookie"
- The existing `dlng_prefs` localStorage key and save logic in `app.js` are unchanged.

---

## 9. Success Confetti and Octopus Animation

### On correct answer
1. Hint area displays `"[answer] is the correct answer!"` in green (`#4caf88`), bold.
2. All 3 digit boxes get green border + green tint background (`rgba(76,175,136,.12)`).
3. Keypad closes, submit button hides.
4. **Confetti** bursts on screen.
5. Octopus **detaches** from the header and **flies freely** around the viewport for 5 seconds.
6. Octo gets `.celebrate` class → `filter: hue-rotate(145deg) saturate(1.3)` (turns it green/teal).
7. After 5s, octo **flies back** to its header placeholder position over 900ms, then reattaches. `.celebrate` is removed.

### Confetti
- Dynamically created `<canvas>` fixed over the page (`z-index:499`).
- 160 pieces, random size (6–14px × 4–8px), 6 colours: `#ff6d5a`, `#f7f2e8`, `#4caf88`, `#f4c842`, `#7b68ee`, `#ff9f7f`.
- Physics: gravity (`vy: 2–6`), lateral drift (`vx ±1.5`), sine wobble, rotation.
- Runs ~5.5 seconds then canvas self-removes.

### Floating octopus system
- `detachOcto()`: captures octo's current screen rect, adds `.floating` (`position:fixed; z-index:500; cursor:grab`), shows `#octo-placeholder` (same fixed dimensions) in the header to preserve layout.
- `animateTo(tx, ty, dur, cb)`: cubic-ease (`1 - (1-p)³`) position animation via `left`/`top` style.
- `flyOcto(duration, cb)`: rapid random repositioning around the viewport for `duration` ms.
- `gentleFloat()`: slow meandering drift used while floating but not flying.
- Octo is **draggable** while floating — mousedown/touchstart + mousemove/touchmove with drag offset.
- `reattachOcto()`: reverses detach, hides placeholder.
- Scroll guard: if placeholder scrolls back into view, octo reattaches automatically.

### On wrong answer
1. Hint: `"[answer] isn't right — keep trying!"` in coral.
2. Eyes switch to X, mouth to sad.
3. Octo **falls sideways** (rotates 90° toward screen centre) over 500ms with cubic ease.
4. Pauses 1.8s.
5. **Recovers** upright over 400ms.
6. Eyes/mouth return to normal. Hint text resets.

---

## Implementation Notes

- **This is a design-only migration.** Game logic (`puzzle.js`, `_worker.js`, clue generation, filtering, seeding, guess validation, history, stats) is unchanged. Only the UI layer changes.
- **`game.js` is a throwaway prototype.** It uses a plain `<script>` tag (not an ES module) and hardcodes the answer. Adapt its UI patterns and animations into `app.js` (the existing ES module), wiring state to `window.PUZZLE_DATA`.
- **Clue rendering changes significantly.** Clues now use a two-column `.cw-clue` / `.cw-tag` / `.cw-l1` / `.cw-l2` layout with mini digit indicators (`.mini-digits` / `.md.lit`) showing which digit positions a clue applies to. The `app.js` `renderClues()` function must produce this new markup, driven by the same clue data from `puzzle.js`.
- **DOM IDs will change.** The existing locked IDs in `CLAUDE.md` (`#status`, `#clues`, `#guess`, `#submit`, `#history`, `#feedback`, etc.) are superseded by this redesign. Update `CLAUDE.md` after implementation.
- **New localStorage key:** `dlng_theme` (`'light'` | `'dark'`). Existing keys (`dlng_history`, `dlng_prefs`) are unchanged.
- **New localStorage key:** `cw-htp-seen` — set to `'1'` when the How to Play modal is dismissed. Controls auto-show on first visit.
- **Logo SVG:** Copy the full inline SVG from `static/index.html` lines 144–226. The `.tlt` animation requires it to be inline (not `<img>`).
- **Octopus SVG:** Copy from `static/index.html` lines 98–140. Must remain inline for JS expression/animation to work.
- **`theme-color` meta tags** should be added for mobile browser chrome:
  ```html
  <meta name="theme-color" content="#f5edd8" media="(prefers-color-scheme: light)">
  <meta name="theme-color" content="#262624" media="(prefers-color-scheme: dark)">
  ```
- **`favicon.svg`** exists in `static/` — copy to the root and add `<link rel="icon" type="image/svg+xml" href="favicon.svg">`.
- **`jamie.webp`** (14×14px avatar) is referenced in the footer. Copy to root or embed as a data URI.
