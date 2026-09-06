# Plan — the stats panel in Tailwind

Date: 2026-08-29 · Branch: `dev/edit-mode-on-stats` · Brief:
[`docs/work/2026-08-29-stats-tailwind-brief.md`](2026-08-29-stats-tailwind-brief.md)

**Approved: Jamie 2026-08-29.** Plan approval is his as dev lead. Build may
start. §0's two decisions were settled in the same conversation and are recorded
there.

Every claim in this plan was re-checked against the code on 2026-08-29. Where a
brief item rested on a wrong fact, the correction is called out and the brief
item number is named.

---

## 0. Two decisions, settled

Both are "how", not "what", so neither reopens a brief section. Both were put to
Jamie with a recommendation, both were sent back with "alternatives that fit
Tailwind?", and both now have an answer that is fully native and fully
steppable. **Settled: Jamie 2026-08-29.**

### 0.1 The 1.5px border on the stat boxes — a named utility

`.stat-col` has `border: 1.5px`. Tailwind's border scale is 0, 1, 2, 4, 8 —
there is no 1.5, and there is no `--border-width-*` theme namespace to add one
to (checked: `node_modules/tailwindcss/theme.css` declares none). Rounding to
`border` or `border-2` is 33% either way and breaks the deliberate match to the
play screen's undo and reset controls that finding 51 flagged. Writing
`border-[1.5px]`, as the rest of `index.html` already does seven times, keeps
the pixel but is invisible to edit mode: it is absent from
`.edit-mode/families.json`, so edit mode thinks it collides with nothing, and it
sorts after `border-2` in the compiled stylesheet, so tapping plus or minus adds
a class that loses the cascade and the control looks dead.

**Settled: declare it once, as a real utility.**

```css
@utility border-hairline {
  border-width: 1.5px;
}
```

at the top level of `src/tailwind.css`, outside `@layer base`.

Verified on this build: a design system compiled from `src/tailwind.css` plus
that block returns `border-hairline` from `getClassList()`. So it lands in edit
mode's catalogue and in the family map as a `border-width`, which means edit
mode swaps it for `border-2` properly instead of stacking a losing class behind
it. No arbitrary value, nothing moves, no dead tap.

It is a scale of one, so minus and plus step *out* of it rather than *within*
it — that is the honest limit, and it is the same limit any 1.5px border has.
The seven `border-[1.5px]` uses in `index.html` are out of scope here, but they
are the obvious follow-up: one name for the border everywhere.

**And the watermark, for consistency.** `.stat-col__mark` has `opacity: 0.12`.
`opacity-12` compiles, but like `border-[1.5px]` it is absent from
`getClassList()`, so it has the same dead-tap problem — and unlike the border it
is not worth a named utility for one decorative element. It becomes
`opacity-10`: catalogued, steppable, and 17% fainter on a watermark that is
already almost invisible. Jamie can step it back in edit mode in one tap.

### 0.2 The 360px stack — the boxes wrap themselves

`.stat-cols` stacks its boxes into one column below 22.5rem (360px) and goes to
three across above it (finding 46). Finding 42 established that **no**
responsive variant is in edit mode's catalogue — `sm:`, `xs:` and
`min-[22.5rem]:` are all equally unsteppable, and worse, a variant that wins on
a wide screen makes tapping the base class look dead.

Dropping the narrow-screen behaviour outright is not safe. Item 56 settled
`text-3xl` (30px) on the box figures, and three boxes on a 320px screen leave
about 67px of text width each, inside a box with `overflow: hidden`. "2m 38s" at
30px does not fit that.

**Settled: no breakpoint. The boxes wrap themselves.**

- the row — `flex flex-wrap gap-2` (was `grid grid-cols-1 gap-2` plus a media
  query)
- each box — `grow basis-24` added to its existing classes

Every class is on the scale, including `basis-24`, which is the one that decides
when the boxes wrap. So Jamie can move the wrap point himself in edit mode,
which the breakpoint never allowed.

What changes, exactly. `basis-24` is 6rem, so three boxes need
`3 x 96 + 2 x 8 = 304px` of content, which is a **336px** viewport once the 32px
gutter is off. Today's switch is at 360px.

| Viewport | Streaks (3 boxes) today | Streaks with `basis-24` | Records (2 boxes) today | Records with `basis-24` |
|---|---|---|---|---|
| 320px | all three stacked | **two, then one** | both stacked | **two across** |
| 360px | three across | three across | two across | two across |
| 390px+ | three across | three across | two across | two across |

So it differs from today only below 360px, and in the safe direction: at 320px
the widest box gets 116px of text room rather than the 67px three-across would
give, and rather than today's full 256px. `text-3xl` at 30px fits 116px.

`basis-24` is in `rem`, so it also wraps at large browser text, which is what
the `22.5rem` media query was for (its comment says so explicitly).

## 1. What changed from the brief, and why

Facts the brief got wrong, corrected here. None of these change a decision Jamie
made; they change what the code has to do to deliver it.

1. **`.stat-col`'s radius is already exact.** Brief item 25 said
   `border-radius: 0.3125rem` becomes `rounded-sm`, a rounding. The rule actually
   reads `border-radius: var(--radius-sm)`, and Tailwind's `--radius-sm` is
   `0.25rem`, so `rounded-sm` is a pixel-identical swap. The 0.3125rem value item
   25 was thinking of is the goes bar, which finding 50 already corrected to
   `rounded-full` (exact — the radius is half the height, so it is a pill).
2. **`text-accent-2`, `-3` and `-4` exist as real utilities.** Item 13's
   recommendation was to keep `--section-accent` alive as an arbitrary property,
   `[--section-accent:var(--color-accent-2)]`. That is not needed. The served
   catalogue (`.edit-mode/classes/classlist.txt`, 23,183 entries) contains
   `text-accent-2/3/4`, `bg-accent-2/3/4` and `border-accent-2/3/4`. So the
   indirection is deleted outright and each element takes its colour directly —
   which is what item 23 said the work was for, satisfies item 27's "no arbitrary
   values", and leaves every colour on the panel steppable in edit mode. This is
   strictly better than item 13's own example and changes no colour.
3. **`text-3xl` needs no line-height class.** Tailwind's `text-3xl` ships
   `line-height: calc(2.25 / 1.875)` = **1.2 exactly**, which is what the three
   rules asking for 1.2 at that size already want. Fewer classes, no rounding.
4. **The panel's colour class lands in `index.html`, not `completion.ts`.** The
   `[data-completion-panel]` element is written at `index.html:356`; the panel's
   innerHTML is what `completion.ts` builds. Item 61's single colour class goes on
   that div.
5. **Class names must be written as literals, never interpolated.** Tailwind v4
   finds classes by scanning source text, so `class="text-${accent}"` produces no
   rule at all. The panel's accent utilities are in no source file today — they
   reach it through `--section-accent` — so the current production stylesheet
   contains `.text-accent` but **not** `.text-accent-2`, `.border-accent-2` or
   `.bg-accent-4`. Interpolating them would ship a panel whose icons, borders and
   numbers all fall back to the foreground colour, silently, with the four-colour
   rotation gone. It would not be caught: vitest renders into jsdom with no
   stylesheet, and edit mode's dev build pulls in all 23,183 utilities through
   `@source` in `src/tailwind-edit.css`, so item 39's phone check would show the
   right colours while production shipped grey. Task 3 passes whole literal class
   strings, and Task 4 guards the built stylesheet.
6. **The `.goes-row` grid becomes a flex row.** Its
   `grid-template-columns: 1.25rem 1fr 2.25rem` has no scale utility and would
   need an arbitrary value. `flex items-center gap-2` with `w-5` on the label,
   `flex-1` on the track and `w-9` on the count gives the **same three widths
   exactly** (1.25rem, remainder, 2.25rem) out of four steppable classes.

---

## 2. Every value that moves (brief items 18, 25, 26, 38, 59)

The full conversion, element by element. "Exact" means pixel-identical.
**Bold** rows are the only things that move.

### The panel container — `index.html:356`

| Today | Becomes | Effect |
|---|---|---|
| `[data-completion-panel] { color: var(--color-text) }` in CSS | `text-text` on the div | Exact. Moves from stylesheet to markup; still one class on one element, still inherited by everything (items 48, 61) |

### `.stat-block__head` → the section heading

| Today | Becomes | Effect |
|---|---|---|
| `display:flex; align-items:center` | `flex items-center` | Exact |
| `gap: 0.5rem` | `gap-2` | Exact |
| `margin-block-end: 0.5rem` | `mb-2` | Exact — the document is horizontal LTR, so block-end is bottom |
| `font-size: 1.5rem` | `text-2xl` | Exact |
| `font-weight: 700` | `font-bold` | Exact |
| **`line-height: 1.2`** | **`leading-tight`** | **1.2 → 1.25, about +1.2px on a 24px line** |
| `color: var(--color-text)` | deleted | Inherits from the container (item 61) |

### `.stat-block__icon` → the heading's icon

| Today | Becomes | Effect |
|---|---|---|
| `inline-size/block-size: 1.5rem` | `size-6` | Exact |
| `flex: none` | `flex-none` | Exact |
| `color: var(--section-accent)` | `text-accent-2` / `text-accent-3` / `text-accent-4` | Exact colour, indirection gone |

### `.stat-hero` → the "Solved!" fallback line

| Today | Becomes | Effect |
|---|---|---|
| **`font-size: 1.75rem`** | **`text-3xl`** | **28px → 30px** |
| `font-weight: 700` | `font-bold` | Exact |
| `line-height: 1.2` | (none) | Exact — `text-3xl`'s own line-height is 1.2 |
| `color: var(--color-text)` | deleted | Inherits |

### `.stat-today` → the two figures under the solved message

| Today | Becomes | Effect |
|---|---|---|
| `display:flex; flex-wrap:wrap; justify-content:center` | `flex flex-wrap justify-center` | Exact |
| `gap: 1.5rem` | `gap-6` | Exact |
| `margin-block-start: -0.75rem` | `-mt-3` | Exact |
| `margin-block-end: 0.5rem` | `mb-2` | Exact |

### `.stat-figure` and its parts

| Today | Becomes | Effect |
|---|---|---|
| `display:flex; align-items:baseline` | `flex items-baseline` | Exact |
| `gap: 0.5rem` | `gap-2` | Exact |
| icon `1.5rem` square, `flex:none` | `size-6 flex-none` | Exact |
| **icon `transform: translateY(0.2em)`** | **`translate-y-1`** | **3.2px → 4px. Equidistant between `translate-y-0.5` (2px) and `translate-y-1` (4px); rounded up because under-nudging leaves the icon riding high, which is the bug the rule exists to fix** |
| value `font-weight: 700` | `font-bold` | Exact |
| **value `font-size: clamp(1.375rem, 7vw, 1.75rem)`** | **`text-3xl`** | **A fluid 22–28px becomes a flat 30px (item 56). On a 390px phone that is 27px → 30px** |
| value `line-height: 1.2` | (none) | Exact — `text-3xl` default |
| value `color: var(--color-accent)` | `text-accent` | Exact |

### `.stat-cols` / `.stat-cols--two` → the box rows

| Today | Becomes | Effect |
|---|---|---|
| `display:grid; grid-template-columns:1fr` + `@media (min-width:22.5rem) { repeat(3,1fr) }` | `flex flex-wrap` on the row, `grow basis-24` on each box | **Three across from 336px up instead of 360px. Below that, two boxes then one, where today all three stack. See §0.2's table** |
| `gap: 0.5rem` | `gap-2` | Exact |
| `margin: 0` | `m-0` | Exact |
| `.stat-cols--two` `@media (min-width:22.5rem) { repeat(2,1fr) }` | no separate class — the same `flex flex-wrap` and `grow basis-24` | **Two across at every width, where today they stack below 360px. The `stat-cols--two` variant disappears entirely** |

### `.stat-col` → the box

| Today | Becomes | Effect |
|---|---|---|
| `position:relative; overflow:hidden` | `relative overflow-hidden` | Exact. `overflow-hidden` is load-bearing: it clips the watermark |
| `background: var(--color-surface)` | `bg-surface` | Exact |
| `border: 1.5px` | `border-hairline` | Exact — a named utility declared once in `src/tailwind.css`, see §0.1 |
| border colour `var(--section-accent)` | `border-accent-2` / `border-accent-3` | Exact |
| `border-radius: var(--radius-sm)` | `rounded-sm` | Exact — both are 0.25rem |
| `padding: 0.625rem 0.75rem` | `py-2.5 px-3` | Exact |

### `.stat-col__mark` → the rotated watermark

| Today | Becomes | Effect |
|---|---|---|
| `position: absolute` | `absolute` | Exact |
| `inset-block-end: -0.875rem` | `-inset-be-3.5` | Exact |
| `inset-inline-end: -0.875rem` | `-inset-e-3.5` | Exact |
| `inline-size/block-size: 4rem` | `size-16` | Exact |
| `transform: rotate(45deg)` | `rotate-45` | Exact |
| `color: var(--color-text)` | deleted | Inherits |
| **`opacity: 0.12`** | **`opacity-10`** | **0.12 → 0.10, a 17% fainter watermark. `opacity-12` compiles but is not in `getClassList()`, so it has §0.1's dead-tap problem and is not worth a named utility for one decorative element (§0.1)** |
| `pointer-events: none` | `pointer-events-none` | Exact |

### `.stat-col__label` and `.stat-col__value`

| Today | Becomes | Effect |
|---|---|---|
| label `display:block; position:relative` | `block relative` | Exact |
| label `font-size: 1rem` | `text-base` | Exact |
| label `font-weight: 400` | `font-normal` | Exact |
| **label `line-height: 1.2`** | **`leading-tight`** | **1.2 → 1.25** |
| label `color: var(--color-text)` | deleted | Inherits — and the label still carries no accent class, which is what brief 80 requires |
| value `margin: 0; margin-block-start: 0.125rem` | `m-0 mt-0.5` | Exact |
| value `position: relative` | `relative` | Exact |
| value `font-weight: 700` | `font-bold` | Exact |
| **value `font-size: clamp(1.25rem, 6.5vw, 1.75rem)`** | **`text-3xl`** | **A fluid 20–28px becomes a flat 30px (item 56). This is the figure §0.2 exists to protect** |
| value `line-height: 1.2` | (none) | Exact — `text-3xl` default |
| value `color: var(--section-accent)` | `text-accent-2` / `text-accent-3` | Exact |

### `.stat-lines`, `.stat-line` and its parts → All time

| Today | Becomes | Effect |
|---|---|---|
| `display:grid; repeat(2, 1fr)` | `grid grid-cols-2` | Exact |
| `gap: 0.875rem 1rem` | `gap-y-3.5 gap-x-4` | Exact |
| **`.stat-line` `line-height: 1.3`** | **`leading-tight`** | **1.3 → 1.25. `leading-snug` (1.375) is 0.075 away, `leading-tight` 0.05** |
| `.stat-line` `color: var(--color-text)` | deleted | Inherits |
| value `display: block` | `block` | Exact |
| value `font-weight: 700` | `font-bold` | Exact |
| **value `font-size: 1.375rem`** | **`text-xl leading-tight`** | **22px → 20px. `text-xl` (1.25rem) and `text-2xl` (1.5rem) are exactly equidistant; `text-xl` wins because `text-2xl` would make the All-time figures the same size as the block heading above them, and today they are deliberately smaller. `leading-tight` is needed because `text-xl` otherwise drags in a 1.4 line-height** |
| value `color: var(--section-accent)` | `text-accent-4` | Exact |
| label `display: block` | `block` | Exact |
| label `font-size: 1rem` | `text-base leading-tight` | Exact size; `leading-tight` keeps the 1.25 the parent now sets, which `text-base`'s own 1.5 would otherwise override |
| label `margin-block-start: 0.125rem` | `mt-0.5` | Exact |

### `.goes-chart` and `.goes-row*` → the attempts chart

| Today | Becomes | Effect |
|---|---|---|
| chart `margin-block-start: 1rem` | `mt-4` | Exact |
| row `display:grid; grid-template-columns: 1.25rem 1fr 2.25rem; align-items:center` | row `flex items-center`, label `w-5 shrink-0`, track `flex-1`, count `w-9 shrink-0` | Exact — same three widths. `shrink-0` is load-bearing: a grid track is a hard width, a flex item is not, and without it a label or count would grow past 1.25rem / 2.25rem once its content exceeded that. The buckets are `1`–`5` and `6+` and the counts are small, so it would not bite today, but it is the first thing to give at 200% browser text |
| row `gap: 0.5rem` | `gap-2` | Exact |
| row `font-size: 1rem` | `text-base` | Exact. The 1.5 line-height it brings matches what the row already inherits from preflight's `html { line-height: 1.5 }` |
| row `color: var(--color-text)` | deleted | Inherits |
| **row `padding-block: 0.1875rem`** | **`py-0.5`** | **3px → 2px per side, so each row is 2px shorter and the six-row chart 12px shorter. `py-1` (4px) is equally distant; `py-0.5` is the value brief item 25 already named** |
| track `block-size: 0.625rem` | `h-2.5` | Exact |
| track `border-radius: 0.3125rem` | `rounded-full` | Exact — the radius is half the height, so the shape is a pill and `rounded-full` reproduces it (finding 50) |
| track `background-color: var(--color-border)` | `bg-border` | Exact |
| track `overflow: hidden` | `overflow-hidden` | Exact |
| fill `display:block; block-size:100%` | `block h-full` | Exact |
| fill `border-radius: 0.3125rem` | `rounded-full` | Exact |
| fill `background-color: var(--section-accent)` | `bg-accent-4` | Exact |
| fill `style="inline-size: N%"` | unchanged | Stays inline — a computed percentage cannot be a class (item 16) |
| count `text-align:end; font-weight:700` | `text-end font-bold` | Exact |

### Summary of everything that moves

Ten things, and only four of them are visible at arm's length:

1. Hero figures and box figures: fluid 20–28px → flat **30px** (settled, item 56).
2. All-time figures: 22px → **20px**.
3. Attempts chart: each row **2px shorter**, chart 12px shorter.
4. **Below 360px the boxes wrap instead of stacking** — see §0.2's table. This is
   the only layout change on the panel, and it only affects a 320px phone and
   large browser text.
5. Watermark opacity 0.12 → 0.10.
6. Heading line-height 1.2 → 1.25.
7. Box label line-height 1.2 → 1.25.
8. All-time line line-height 1.3 → 1.25.
9. Icon nudge 3.2px → 4px.
10. `.stat-hero` fallback 28px → 30px.

The 1.5px border does **not** move: `border-hairline` is exactly 1.5px (§0.1).

Nothing else changes by so much as a pixel.

---

## 3. The `data-` labels (brief items 24, 36, 53, 62)

Every element the tests reach gets an attribute. Five already exist and stay:
`data-completion-panel`, `data-stat-block`, `data-goes-row`, `data-goes-label`,
`data-goes-count`.

New, all in `src/completion.ts`:

| Element | Attribute |
|---|---|
| `.stat-today` wrapper | `data-stat-today` |
| `.stat-hero` fallback | `data-stat-hero` |
| `.stat-figure` | `data-stat-figure` |
| `.stat-figure__icon` | `data-stat-figure-icon` |
| `.stat-figure__value` | `data-stat-figure-value` |
| `.stat-block` section | `data-stat-block` (already there) |
| `.stat-block__head` | `data-stat-head` |
| `.stat-block__icon` | `data-stat-icon` |
| `.stat-note` | `data-stat-note` |
| `.stat-cols` | `data-stat-cols` |
| `.stat-col` | `data-stat-col` |
| `.stat-col__label` | `data-stat-label` |
| `.stat-col__value` | `data-stat-value` |
| `.stat-col__mark` | `data-stat-mark` |
| `.stat-lines` | `data-stat-lines` |
| `.stat-line` | `data-stat-line` |
| `.stat-line__value` | `data-stat-line-value` |
| `.stat-line__label` | `data-stat-line-label` |
| `.goes-chart` | `data-goes-chart` |
| `.goes-row__track` | `data-goes-track` |
| `.goes-row__fill` | `data-goes-fill` |

`stat-block` and `stat-note` are the two names that appear in the markup with no
CSS rule at all (finding 53), so they only need labels — there is nothing to
delete for them.

---

## 4. Tasks

Tests first, then implementation, in each task. Each is small enough to commit on
its own and each leaves the suite green.

### Task 1 — `data-` labels on the markup, tests moved onto them

**Implements:** brief items 24, 36, 53.
**Files:** `src/completion.ts`, `tests/completion-stats.spec.ts`,
`e2e/pages/completion.page.ts`, `e2e/specs/player-stats.spec.ts`.

No CSS changes at all. The classes stay on the markup alongside the new
attributes, so nothing moves on screen and the whole suite must stay green. This
is the step that decouples the tests from the class names before anything is
deleted.

1. Add every attribute in §3 to the markup in `src/completion.ts`.
2. Rewrite the DOM selectors in `tests/completion-stats.spec.ts`:
   - line 41 `.stat-line` → `[data-stat-line]`
   - line 56 `.stat-col` → `[data-stat-col]`
   - line 58 `.stat-col__value` → `[data-stat-value]`
   - line 61, 69 `.stat-col__label` → `[data-stat-label]`
   - line 74 `.stat-figure__value` → `[data-stat-figure-value]`
   - line 257 `expect(kids[0]).toBe('stat-today')` → assert the first child
     carries `data-stat-today`
   - lines 267, 298 `h3 .stat-block__icon` → `h3 [data-stat-icon]`
   - line 288 `.stat-col__value--best` → `[data-stat-value-best]` (still expected
     to be null; the class never existed)
   - lines 301, 304 `.stat-col__mark`, `.stat-col` → `[data-stat-mark]`,
     `[data-stat-col]`
   - line 308 `.stat-figure__icon` → `[data-stat-figure-icon]`
   - line 313 `.stat-block__rule` → `[data-stat-rule]` (still null)
   - lines 337 `.stat-col` → `[data-stat-col]`
   - line 365 `.stat-note` → `[data-stat-note]`
   - line 386 `.stat-note.stat-row` → `[data-stat-note][data-stat-row]`
     (still null)
   - line 542 the exact-string assertion on
     `'<p class="stat-hero">Solved!</p>'` → after Task 1 it reads
     `'<p data-stat-hero class="stat-hero">Solved!</p>'`, and after Task 3
     `'<p data-stat-hero class="text-3xl font-bold">Solved!</p>'`. The exact
     string IS the assertion here — it is the guard on a value that reaches
     `innerHTML` — so it is written out, not derived
3. `e2e/pages/completion.page.ts` — **three** lines, not two. Lines 40 and 41
   (`.stat-col` → `[data-stat-col]`, `.stat-line` → `[data-stat-line]`) and
   **line 63**, inside the `stat(label)` helper, which every
   `completion.stat(...)` assertion in `player-stats.spec.ts` goes through.
   Missing line 63 breaks every stat lookup in the e2e suite, and Task 7 does
   not run e2e locally, so it would only surface in CI on the pull request.
4. `e2e/specs/player-stats.spec.ts` lines 68, 69, 72, 73: `.stat-col` →
   `[data-stat-col]`.
5. **Fix two assertions on those lines that are already wrong.** Lines 72-73
   assert `.stat-col svg` has count 0 in the streak and records blocks. The
   watermark landed in `dce25fa` (2026-08-14) and puts an `svg` inside every
   box; the spec was last touched the day after and never updated. The real
   counts are 3 and 2. Correct them to `toHaveCount(3)` and `toHaveCount(2)`
   and say so in the commit message, so a CI failure on the pull request is not
   mistaken for something this conversion did.

**Proves it:** `npx vitest run tests/completion-stats.spec.ts` green. The e2e
files compile; they are not run here (QA level is set in Task 7).

### Task 2 — the one stylesheet assertion that can move on its own

**Implements:** part of brief items 47, 62.
**File:** `tests/completion-stats.spec.ts`.

Three of the four rewrites the review calls for assert state that only Task 3
creates — the accent literals in `completion.ts`, `text-text` in `index.html`,
and the absence of the panel's CSS. Specifying them here would leave the suite
red at the end of Task 2, which breaks the rule that every task commits green.
They move into Task 3 instead. Only this one stands alone.

`tests/completion-stats.spec.ts:317-319`, `draws no line between All-time
entries`: today it does `/\.stat-line\s*\{[^}]*\}/.exec(sheet)![0]` and checks
the rule contains no `border`. The non-null assertion means that deleting
`.stat-line` makes it **throw**, not fail (finding 47), so it has to be
rewritten before Task 3 rather than left to break. It becomes an assertion on
`src/completion.ts`: the element carrying `data-stat-line` has no `border`
utility in its class list. Same guarantee, asserted where the rule now lives —
and it passes both before and after Task 3.

**Proves it:** `npx vitest run tests/completion-stats.spec.ts` green, with the
classes still present.

### Task 3 — the conversion

**Implements:** brief items 13, 18, 20, 21, 23, 25, 27, 47, 48, 56, 61, 62, and
§2 of this plan.
**Files:** `src/completion.ts`, `index.html`, `src/tailwind.css`,
`tests/accent-rotation.spec.ts`, `tests/completion-stats.spec.ts`.

The conversion and the three test rewrites that depend on it are one commit,
because neither half passes without the other.

1. `src/tailwind.css`: add the `border-hairline` utility (§0.1) at the **top
   level of the file, outside `@layer base`** — `@utility` inside a layer does
   not compile. Put it beside the existing `@custom-variant dark` block, with a
   comment saying it is 1.5px because that is the play screen's border width and
   the panel deliberately matches it, and that it is a named utility rather than
   `border-[1.5px]` so edit mode can see it is a border width.
2. `index.html:356`: add `text-text` to the `data-completion-panel` div.
3. `src/completion.ts`: give `block()` a fifth parameter and `statColumn()` a
   fifth parameter, each carrying **whole, literal class strings** — the streak
   call site passes `'text-accent-2'` and `'border-accent-2 text-accent-2'`, the
   records call site `'text-accent-3'` and `'border-accent-3 text-accent-3'`, the
   all-time call site `'text-accent-4'`. `statLine()` and `goesChart()` are only
   ever used by All time, so they write `text-accent-4` and `bg-accent-4`
   directly.

   **Never a stem, never interpolated** (§1.5). `class="text-${accent}"` compiles
   to nothing and ships a panel with no accent colours at all. Every accent class
   name must appear complete in the file, so Tailwind's scanner can see it.
4. Replace every class on every element with the utilities in §2. `statColumn()`
   gains `grow basis-24`, and the two `<dl>` wrappers become `flex flex-wrap
   gap-2 m-0` — the `stat-cols--two` variant has no counterpart and simply goes
   (§0.2).

   Note the `<dl>` keeps its `dt`/`dd` pairs. A flex `<dl>` puts each `dt` and
   its `dd` in the flow separately, which is why every pair is already wrapped in
   a `div` — `statColumn()` returns one, and that div is the flex item. Nothing
   about the markup's reading order changes. The `style`
   attribute on the goes fill stays untouched (item 16). Every `aria-` attribute
   and both `sr-only` spans stay untouched (items 29, 30).
5. Delete lines **509-728** of `src/tailwind.css` — the `[data-completion-panel]`
   colour rule, the three `[data-stat-block]` accent rules and all 22 component
   rules. Not 729 or 730: those two lines are the `.digit-box` section's own
   comments, and `.digit-box` is out of scope. Move the comments that still
   describe live decisions into `src/completion.ts` beside the markup they
   explain: the dark-mode colour guard, the watermark's `overflow: hidden`
   dependency, the label-above-number reading order, and the 1.5px border's match
   to the play screen. A comment that only described a deleted rule goes with it.
6. `.digit-box`, `.digit-box__*` and everything after line 728 are **not touched**
   (finding 43). The container query and `16cqw` belong to `.digit-box`, which is
   the clue boxes on `/play` and the how-to-play demo on `/welcome`, and is
   explicitly out of scope (item 9).
7. `tests/accent-rotation.spec.ts`, the test `gives each section its colour, and
   colours nothing but icons and numbers`:
   - the three `[data-stat-block="<id>"] { --section-accent: var(--color-accent-N) }`
     regexes become assertions on `src/completion.ts` — the `streak` block's
     markup contains the literals `text-accent-2` and `border-accent-2`,
     `records` contains `text-accent-3` and `border-accent-3`, `all-time`
     contains `text-accent-4` and `bg-accent-4`. Asserting the literal is a
     second guard against §1.5's interpolation trap.
   - the `.stat-col__label { color: var(--color-text) }` regex becomes: the
     element carrying `data-stat-label` has no `text-accent` class. Same
     guarantee — the label stays in the foreground colour, per brief 80 —
     asserted where the colour now lives.
   - the three tests above it (`%s maps its three other slots`, `%s shows four
     different hues`, `the @theme defaults are Lime's rotation`) read `@theme`
     and `html[data-theme=...]`, which this work does not touch. They stay
     exactly as they are.
8. `tests/completion-stats.spec.ts:562-599`, the `the panel colours itself once,
   at the top` block:
   - `sets a text colour on the panel container` → assert `index.html`'s
     `data-completion-panel` div carries `text-text`.
   - `reads in the body font, with no Inconsolata left on the panel` → assert
     `src/completion.ts` contains no `font-mono` and no `Inconsolata`. The CSS
     slice it used is gone; Task 4 covers the stylesheet side.
   - `leaves no box around the records` → unchanged. The `.stat-box` half is
     about a class deleted long ago and the `src/completion.ts` half still holds.
   - `uses the theme token, never a literal colour` → assert the
     `data-completion-panel` div's class list in `index.html` contains no hex
     literal.
   - Keep the comment block above these tests — it explains the dark-mode bug —
     and add a line saying the guard moved from the stylesheet to the markup and
     guards the same thing (items 48, 61).

**Proves it:** the full vitest suite green (`npx vitest run`), including
`tests/token-parity.spec.ts` and `tests/palette-contrast.spec.ts`, which the
accents must not disturb.

### Task 4 — the dead-CSS guard

**Implements:** brief items 37, 63.
**File:** `tests/completion-stats.spec.ts` (new test at the end).

A test that reads `src/tailwind.css` as source — the way the existing tests in
that file do — and asserts none of these 22 names appears:

`goes-chart` `goes-row` `goes-row__count` `goes-row__fill` `goes-row__track`
`stat-block__head` `stat-block__icon` `stat-col` `stat-col__label`
`stat-col__mark` `stat-cols` `stat-cols--two` `stat-col__value` `stat-figure`
`stat-figure__icon` `stat-figure__value` `stat-hero` `stat-line`
`stat-line__label` `stat-lines` `stat-line__value` `stat-today`

Plus: no `--section-accent` anywhere in the file, and no
`[data-stat-block="..."]` rule.

**`border-hairline` is not a violation of this test and must not be caught by
it.** It is an `@utility`, not a component class — Tailwind compiles it into the
utilities layer, `getClassList()` returns it, and edit mode can apply and remove
it like any other class. That is the whole difference from the 22 names above,
which are plain rules the design system cannot see. The test asserts those 22
names; `border-hairline` is not one of them.

It asserts **absence from `src/tailwind.css`**, not from the built stylesheet,
and it does **not** list `stat-block` or `stat-note` — those two never had rules,
so asserting their absence would pass trivially and mean nothing (item 63,
finding 53).

Match on a word boundary rather than a bare substring, so `stat-col` does not
also match `stat-cols` and give a false pass. (`-` is a non-word character and
`s` and `_` are word characters, so `\bstat-col\b` correctly misses `stat-cols`
and `stat-col__label`.)

**And a second test, guarding the other direction** — that the accent utilities
really are in the shipped stylesheet. This is §1.5's failure mode, and nothing
else in the suite can see it: vitest renders into jsdom with no stylesheet at
all, and the dev build pulls in every utility through `@source`, so both would
pass on a panel that ships grey.

The test runs `npm run build` output — `dist/client/assets/*.css` — and asserts
it contains `.text-accent-2`, `.text-accent-3`, `.text-accent-4`,
`.border-accent-2`, `.border-accent-3` and `.bg-accent-4`. Confirmed absent from
today's build, so it fails before Task 3 and passes after, which is the proof
that it is testing the right thing.

If the suite must not shell out to a build, the same guard as a cheaper check:
assert `src/completion.ts` contains each of those six names as a whole literal.
That is what Tailwind's scanner reads, so it is the same question one step
earlier, and it runs in milliseconds. Prefer this one; the build-output version
is the belt-and-braces option if `npm run build` is already part of the job.

**Proves it:** both tests green after Task 3, and both red if Task 3 is reverted.

### Task 5 — the one-off comparison, and the 320px check

**Implements:** brief items 38, 41, 56.
**Files:** `scripts/stats-style-diff.mjs` and
`e2e/specs/stats-overflow.spec.ts`, both throwaway.

Item 41 settled on a one-off comparison, not a permanent baseline. But the two
halves need different tools, and the plan's first draft got this wrong: jsdom
has no layout engine at all. Measured on this box, jsdom returns `scrollWidth`
and `clientWidth` of **0** for every element, never applies a media query, and
hands back `clamp(1.25rem, 6.5vw, 1.75rem)` verbatim rather than resolving it.
So a jsdom overflow check is a guaranteed false pass on the one thing item 56
made a condition of Jamie's sign-off, and a jsdom run at three widths produces
three identical results.

**5a — the style diff, in jsdom, for what jsdom can actually see.**
`scripts/stats-style-diff.mjs` builds the panel's markup by calling
`renderCompletion` with the demo history from `src/demo-history.ts` (no router,
no navigation — the panel is built by a function, so call the function), loads
the built stylesheet, and records `getComputedStyle` for every element inside
`[data-completion-panel]`: `font-size`, `line-height`, `font-weight`, `color`,
`background-color`, `border-width`, `border-color`, `border-radius`, `padding`,
`margin`, `gap`, `grid-template-columns`, `opacity`, `transform`.

Run it on the commit before Task 3 and the commit after, and diff. Every
difference must appear in §2's list; anything else is a bug in the conversion.
This catches colour, weight, spacing and radius — all the exact swaps — which is
most of the risk. It **cannot** see the fluid font sizes resolve, and it cannot
see the 360px breakpoint. Say that in the pull request rather than implying the
diff is complete.

**5b — the 320px check, in a browser, run by CI.** A throwaway spec,
`e2e/specs/stats-overflow.spec.ts`, that loads `/solved?demo=stats` at **320,
390 and 480** wide and asserts, for every `[data-stat-value]` and every
`[data-stat-figure-value]`, that `scrollWidth <= clientWidth` of its box. It
also records the resolved `font-size` at each width, so the pull request can
state "27px → 30px on a 390px phone" as a measurement rather than arithmetic.

CI runs the full Playwright matrix on every pull request, so this costs nothing
extra and needs no local run. **Do not run Playwright locally for it** — that is
Jamie's call to make in the moment, not a step in this plan. Once the numbers
are in the pull request the spec is deleted in a follow-up commit, which is what
item 41's "one-off" means.

If 5b shows the longest figure overflowing at 390px, that is a real finding and
goes back to Jamie with the number, because it is the risk item 56 named when he
answered "30".

**Proves it:** 5a's diff matching §2 exactly, and 5b green in CI, both pasted
into the pull request.

### Task 6 — the docs

**Implements:** brief items 40, 64, 34, 55.
**Files:** `docs/DESIGN-SYSTEM.md`, `CLAUDE.md`.

1. `docs/DESIGN-SYSTEM.md`:
   - lines 221-224: delete the `.stat-*` and `.goes-*` entries from the component
     class list. They are already stale — they name `.stat-boxes`, `.stat-box__*`,
     `.stat-flame` and `.stat-row`, none of which exist.
   - line 180: the `.stat-boxes` reference in the page-column note becomes
     `data-stat-cols`.
   - line 249: the watermark note keeps its point — `overflow: hidden` still does
     the clipping — but names `overflow-hidden` on `data-stat-col`.
   - line 264: the `--section-accent` paragraph is rewritten. Each section now
     takes its colour from `text-accent-N` / `border-accent-N` / `bg-accent-N`
     directly; there is no indirection left.
   - **line 253**: "Labels 16px, numbers 20-28px … the number's `clamp` tops out
     where three boxes still fit a 390px screen" is falsified by item 56 — the
     numbers become a flat 30px and there is no `clamp` left. This is the line
     the change most directly invalidates. Rewrite it to the new sizes.
   - **line 275**: "the boxes borrow the play screen's digit-box styling — …
     the `shadow-box` utility" is already stale; `shadow-box` was removed, which
     `tests/completion-stats.spec.ts:593` asserts. Correct it while here.
   - line 282: the `.stat-box__pair` `column-reverse` note describes a layout
     that no longer exists. Delete it.
   - Add a short paragraph saying the completion panel is built from utilities
     only and has no component classes, so edit mode can design it.
2. `CLAUDE.md`, Outstanding actions: add the deferred accessibility pass, naming
   brief item 34 — the full pass on the finished stats panel is owed once the
   redesign that follows this conversion lands, and this conversion was signed
   off on the basis that it changes nothing about the screen-reader experience.
3. `docs/work/2026-08-29-stats-tailwind-brief.md`: change the eleven
   `Ack: n/a` lines to `Override: Jamie 2026-08-29` (finding 55). Dave was never
   asked and has not agreed to anything here; the record should say so.

### Task 7 — QA level, and the branch discipline

**Implements:** brief items 39, 60.

**QA level: light.** The change is presentational and confined to one screen.
`npx vitest run` in full is the gate. The e2e suite is **not** run locally — CI
runs the full six-project matrix on the pull request, and a local run is a
`--project=chromium-desktop --workers=1` job that only happens if Jamie asks for
it in the moment. Task 5b rides on that CI run and adds nothing local. Item 39's phone check is the acceptance test that matters.

**Branch discipline (item 60).** The work happens here on
`dev/edit-mode-on-stats`, the only branch with both the stats panel and edit
mode. The conversion commits must stay clean and separate from any edit-mode
commit so they can be cherry-picked onto `dev/stats-tweaks` for #311. In
practice:

- Tasks 1-6 touch only `src/completion.ts`, `index.html`, `src/tailwind.css`,
  the four test files, `scripts/stats-style-diff.mjs`,
  `e2e/specs/stats-overflow.spec.ts`, `docs/DESIGN-SYSTEM.md`, `CLAUDE.md` and
  the two `docs/work/` files. **No file under `src/edit-mode/`,
  `edit-mode/` or `.edit-mode/` is touched by any of them.**
- Each task is one commit. If anything in edit mode has to change to make the
  panel designable, that is a separate commit, outside the cherry-pick set, and
  it is called out in the pull request.
- The brief and this plan travel with the cherry-pick.

---

## 5. Brief items → tasks

Every numbered item in the brief, traced.

| Item | Where |
|---|---|
| 1, 2, 3, 4, 5, 6 | Background. No code. |
| 7 | Superseded by item 60. Task 7. |
| 8 | §2 — the list of what moves is the evidence. |
| 9, 10, 11, 12 | Out of scope. Task 3 step 5 protects `.digit-box`. |
| 13 | Task 3. Delivered by direct colour utilities, not the arbitrary property item 13 suggested — see §1.2. |
| 14 | Tasks 1-4; the existing suite covers every state. |
| 15 | Corrected by finding 48. Delivered by item 61 — Task 3 steps 1 and 7. |
| 16 | Task 3 step 3 — the inline width is untouched. |
| 17 | Task 1 — `data-stat-block` stays, and becomes a hook only. |
| 18 | §2, Task 3. |
| 19 | No code. |
| 20, 21 | Task 3 steps 3 and 4. |
| 22 | No code. `player-stats.ts`, `screens.ts` and the router are not in any task's file list. |
| 23 | Task 3 — `@theme` is untouched. `border-hairline` is an `@utility`, which is a separate mechanism, and §0.2's answer needs no breakpoint token. |
| 24 | Tasks 1 and 3. |
| 25, 26 | §2. |
| 27 | Void — replaced by item 56. |
| 28 | No code. Task 3 changes classes only; no string in `completion.ts` moves. |
| 29, 30 | Task 3 step 3. |
| 31 | No code. `tests/palette-contrast.spec.ts` runs unchanged in Task 3. |
| 32 | No code. Every size in §2 is a `rem` step. |
| 33 | Void — replaced by item 56. |
| 34 | Task 6 step 2. |
| 35 | No code. |
| 36 | Tasks 1, 2 and 3. |
| 37 | Task 4, narrowed by item 63. |
| 38 | §2 and Task 5. |
| 39 | Task 7. |
| 40 | Task 6 step 2. |
| 41 | Task 5. Split in two, because jsdom has no layout engine. |
| 42 | §0.2 — settled by using no responsive variant at all. |
| 43 | Task 3 step 5. |
| 44 | §2 — two fluid sizes, both listed. |
| 45 | Void — item 33 is replaced by item 56. |
| 46 | §0.2 — settled with `flex flex-wrap` + `basis-24`, no breakpoint at all. |
| 47 | Task 2 (the one that throws) and Task 3 steps 6-7. |
| 48 | Task 3 steps 1 and 7. |
| 49 | Task 7. |
| 50 | §2 — `rounded-full` (exact) and `opacity-10` (0.12 → 0.10, see §0.1). |
| 51 | §0.1 — the 1.5px is kept exactly, as the `border-hairline` utility. |
| 52 | Background. No code. |
| 53 | §3 and Task 4. |
| 54 | Task 6 step 1. |
| 55 | Task 6 step 3. |
| 56 | §2 and Task 5b, measured in a real browser in CI. |
| 57 | Superseded by item 60. |
| 58 | Superseded by item 61. |
| 59 | §2. |
| 60 | Task 7. |
| 61 | Task 3 steps 1 and 7. |
| 62 | Task 2 and Task 3 steps 6-7. |
| 63 | Task 4. |
| 64 | Task 6 step 1. |

---

## 6. Build record

### Task 5a — the style diff, and the correction it needed

**The plan's mechanism does not work, and the replacement is in the script.**
Task 5a specified `getComputedStyle` in jsdom. jsdom cannot parse Tailwind v4's
output at all — it throws `Could not parse CSS stylesheet` on the built file and
every element then reads back as a browser default, on both commits. That is a
diff of nothing against nothing: a guaranteed false pass, which is the same trap
the plan spotted for the overflow half and missed for this one.

So `scripts/stats-style-diff.mjs` keeps jsdom for the DOM, which works fine, and
resolves the declarations by walking the built stylesheet with postcss instead.
It reports **declared** values, so it sees colour, weight, spacing, radius,
border width and opacity — the exact swaps, which is most of the risk. It has no
layout engine, so it cannot resolve a fluid font size or a media query; those are
Task 5b's job, in a browser. Rules inside a media, container or supports query
are counted and reported rather than silently skipped (42 after, 44 before).

Two things it had to get right to be worth running:

- **Custom properties resolve per element, down the tree.** A file-wide map hands
  all four blocks whichever `--section-accent` was declared last, and quietly
  reports three of them as the wrong colour. An early run did exactly that.
- **Shorthands are watched as well as longhands.** Without `border` and
  `background` in the list, the old `border: 1.5px solid var(--section-accent)`
  was dropped and read back as "no border", making an exact swap look like a
  change.

**Result: 109 elements compared, 43 distinct differences, and every one of them
is in §2.** Run as:

```
npx vite build && node scripts/stats-style-diff.mjs > /tmp/after.json
# same two commands in a worktree at 91b3478, into /tmp/before.json
node scripts/stats-style-diff.mjs --compare /tmp/before.json /tmp/after.json
```

The ten value changes §2 predicted, and nothing else:

| Element | Before | After | §2 |
|---|---|---|---|
| `data-stat-figure-value` | `clamp(1.375rem, 7vw, 1.75rem)` | `1.875rem` | items 1, 10 |
| `data-stat-value` | `clamp(1.25rem, 6.5vw, 1.75rem)` | `1.875rem` | item 1 |
| `data-stat-line-value` | `1.375rem` | `1.25rem` | item 2 |
| `data-goes-row` `padding-block` | `0.1875rem` | `0.125rem` | item 3 |
| `data-stat-cols` | `grid`, `grid-template-columns: 1fr` | `flex`, `flex-wrap: wrap`, boxes `flex-grow: 1; flex-basis: 6rem` | item 4, §0.2 |
| `data-stat-mark` `opacity` | `0.12` | `0.1` | item 5 |
| `data-stat-head` `line-height` | `1.2` | `1.25` | item 6 |
| `data-stat-label` `line-height` | `1.2` | `1.25` | item 7 |
| `data-stat-line` `line-height` | `1.3` | `1.25` | item 8 |
| `data-stat-figure-icon` | `transform: translateY(0.2em)` | `translate: … 0.25rem` | item 9 |

The rest of the 43 rows are the same value written a different way, and are
listed here so nobody has to re-derive them:

- **Colour moved from seven elements to one.** `data-stat-head`,
  `data-stat-label`, `data-stat-line`, `data-goes-row` and `data-stat-mark` all
  go from an explicit `color` to none, inheriting `text-text` from the panel
  container. That is item 61, and it is the whole point of the change.
- **The accents did not move by a hair.** Every icon, border and figure resolves
  to the same `oklch` it did before — `oklch(0.78 0.174 145)` on Streak,
  `oklch(0.78 0.135 5)` on Records. The indirection went; the colour did not.
- **The border is still 1.5px.** It reads as `border-width: 1.5px` plus a
  separate `border-color` rather than one `border` shorthand. `border-hairline`
  is exact (§0.1).
- **`rounded-full` reports as `3.40282e38px`.** That is `calc(infinity * 1px)`
  after minification. The old radius was half the height, so the shape was
  already a pill (finding 50).
- **The goes row keeps its three widths.** `grid-template-columns: 1.25rem 1fr
  2.25rem` becomes `width: 1.25rem` + `flex: 1` + `width: 2.25rem`, with
  `flex-shrink: 0` added (§1.6).
- **`grid-cols-2` emits `repeat(2, minmax(0, 1fr))`** where the old rule said
  `repeat(2, 1fr)`. Tailwind's standard, and the safer of the two: `minmax(0,
  1fr)` stops a long figure forcing a track wider than its share.
- **`transform` became `rotate` and `translate`.** Tailwind v4 uses the
  standalone properties. Same 45 degrees, same nudge.

### Task 5b — the 320px check

`e2e/specs/stats-overflow.spec.ts` loads `/solved?demo=stats` at 320, 390 and
480 wide and asserts every `[data-stat-value]` and `[data-stat-figure-value]`
has `scrollWidth <= clientWidth`. It attaches the resolved font size and the
text at each width to the CI report, so the pull request can quote a measurement
rather than arithmetic. **Not run locally** — it rides the matrix CI already runs
on every pull request, per Task 7.

Both files are throwaway and are deleted once the numbers are in the pull
request, which is what item 41's "one-off" means.
