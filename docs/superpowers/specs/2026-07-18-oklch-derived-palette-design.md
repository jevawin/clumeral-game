# OKLCH-derived palette — design

**Issue:** [#255](https://github.com/jevawin/clumeral-game/issues/255)
**Branch:** `issue/255`
**Date:** 2026-07-18
**Status:** prototype signed off 2026-07-18 — decisions recorded under
[Settled by the prototype](#settled-by-the-prototype)

Replaces the hand-picked colour set with a derived system: two base neutrals, a
fixed lightness per mode, and one hue angle per theme. Everything else computes.

---

## Why

31 unique colour literals live in player-facing code. #254 made them
maintainable — one place to change — but not fewer. Adding a fifth theme still
means hand-picking two hexes and verifying six contrast pairings.

The stronger reason is a bug class. #254 shipped an AA failure: raw accent as
text on `--color-surface` measures 4.03–4.13:1 in dark mode, below the 4.5:1 bar.
It survived a first fix because contrast was audited **per pairing** — each
pairing checked by hand, so one missed pairing shipped. This design makes that
unrepresentable rather than better-audited.

Measured, current values:

| theme | mode | hex | L | C | H | vs bg | vs surface |
|---|---|---|---|---|---|---|---|
| Lime | light | `#0a850a` | 0.536 | 0.178 | 142.6 | 4.60 | 4.80 |
| Lime | dark | `#1ead52` | 0.656 | 0.174 | 149.6 | 6.38 | **4.13** |
| Berry | light | `#de1f46` | 0.581 | 0.219 | 18.1 | 4.58 | 4.78 |
| Berry | dark | `#ea6c85` | 0.689 | 0.157 | 9.8 | 6.22 | **4.03** |
| Blue | light | `#376ddb` | 0.559 | 0.178 | 262.5 | 4.60 | 4.80 |
| Blue | dark | `#6393f2` | 0.673 | 0.151 | 262.8 | 6.23 | **4.03** |
| Violet | light | `#9a44ea` | 0.582 | 0.237 | 303.4 | 4.58 | 4.78 |
| Violet | dark | `#b679f0` | 0.688 | 0.177 | 305.9 | 6.22 | **4.03** |

All four dark accents fail on surface. The light accents pass, but only just —
4.58–4.60 against a 4.50 bar.

## Why OKLCH rather than colour-mixing

Mixing each hue toward the base neutrals to reach 5:1 needs a different
percentage per theme — light: Lime 69%, Berry 82%, Blue 75%, Violet 76%; dark:
73/58/68/66. That is eight magic numbers replacing eight hex values. It moves the
complexity instead of removing it. The cause is that hues differ in intrinsic
lightness.

OKLCH is perceptually uniform, so fixing `L` produces near-uniform contrast
across hues from a single shared parameter.

---

## The system

```
2 bases        D #121213   ·   L #FAFAFA
2 lightness    accent-L    light 0.50 · dark 0.78      ← the AA guarantee
8 chroma       per theme per mode, capped at today's saturation
4 hue angles   Lime · Berry · Blue · Violet
semantics      success = Lime · error = Berry  (aliases, no values of their own)
3 rules        surface   = one step from bg toward L  (cards lift in both modes)
               border    = mix(fg, bg, 12%)
               on-accent = bg
```

Accents resolve as:

```css
--color-accent: oklch(var(--accent-l) var(--accent-c) var(--accent-h));
```

Only `--accent-h` changes per theme. `colours.ts` sets one number instead of two
hexes.

All contrast figures below are computed against the **derived** surfaces —
`#FFFFFF` light and `#2A2A2B` dark — not today's `#FFFFFF` / `#363634`. The
surface rule steps toward the light base in *both* modes, so cards lift off the
page either way: barely in light, clearly in dark. Light surface lands back on
white because sign-off chose the white base; only the dark surface moves.

### Chroma is contrast-inert

This is the finding that shapes the rest. Holding `L` fixed and pushing chroma
from 0.14 to the maximum in-gamut value moves contrast by at most ~0.5, and
nothing drops below AA (figures against the cream base that was on the table at
the time; the argument is unchanged under white, which only raises them):

| theme (light) | at C=0.14 | at max chroma |
|---|---|---|
| Lime | 5.00 | 4.96 |
| Berry | 5.74 | 5.97 |
| Blue | 5.43 | 5.65 |
| Violet | 5.69 | 6.19 |

So the AA guarantee rides on `L` alone. Chroma and hue move freely underneath and
**cannot** reintroduce the #254 bug class. That makes chroma a free aesthetic
dial, which is why the prototype settled it rather than the maths.

Two constraints follow:

- **Lime light is the tight one.** Green's gamut ceiling at L=0.50 is 0.157, the
  lowest of the four, and Lime carries the worst ratio in the system at every
  chroma. The light background value cannot drift downward without re-checking.
- **Chroma is gamut-limited, not taste-limited, in five of eight cases.** Blue
  dark caps at 0.111 and Berry/Violet dark at 0.135/0.140, all below today. A
  shared dark chroma would have to sit under Blue's 0.111 and drag the other
  three down with it — which is why sign-off went per-theme.

### Two tokens disappear

- **`--color-on-accent` → `bg`.** Light on-accent is already `#FFFFFF` and dark
  is `#121213` — effectively the two bases. Making it literally `bg` collapses
  two AA checks into one, since contrast is symmetric: "accent text on bg" and
  "bg text on accent fill" become the same ratio.
- **`--color-accent-strong` → removed.** One accent per mode now clears AA on
  both `bg` and `surface` in all four themes. The split only existed because the
  hand-picked accents sat slightly too light.

### Semantics alias two of the themes

`success` and `error` must stay green and red whichever accent is active. Two
collisions make that harder than it looks:

- **success vs Lime** — both land near H 145–150. 0° separation.
- **error vs Berry** — error sits at H≈26, proposed Berry at H=5. 22° apart.

The issue flags the first. The second is equally real and was found during
discuss. Both happen for a structural reason: today the semantics differ from the
accents in **lightness as well as hue**. Fixing `L` deletes that second
differentiator, leaving hue as the only separator — and two of four themes land
inside it.

An earlier revision answered this with a lightness band, `semantic-L` set below
`accent-L` so the semantics read as feedback rather than as ordinary accent text.
Sign-off rejected it: at the bottom of the scale green is gamut-crushed (ceiling
0.110 at L=0.40), so the light success green came out too dark, and lifting it
spent the very separation the band existed to provide.

The resolution is to stop treating the collision as a problem. **Success is the
Lime theme and error is the Berry theme** — same lightness, same chroma, same
hue, no values of their own. Under Lime the success message and the accent are
the same green; under Berry the error message and the accent are the same
berry. That is acceptable because colour is not carrying the meaning: a filled
tick sits beside the success text and a cross beside the error text, satisfying
WCAG 1.4.1 on its own. The colour is reinforcement, not signal.

What this buys:

- Six declared values disappear — the band (2), the semantic hues (2) and the
  semantic chromas (2).
- The semantics inherit the accent AA guarantee instead of needing their own
  verification. There is no longer a pairing that only the semantics exercise.
- The tightest pairing in the system disappears. Error dark on surface was 4.70;
  the worst semantic ratio is now 5.36, equal to the worst accent.
- Under the three themes that are *not* the aliased one, the semantics are more
  distinct from the accent than the band ever made them.

| | hex | vs bg | vs surface |
|---|---|---|---|
| success light (Lime) | `#00791E` | 5.36 | 5.59 |
| error light (Berry) | `#B60054` | 6.45 | 6.74 |
| success dark (Lime) | `#65D46D` | 9.98 | 7.64 |
| error dark (Berry) | `#FF91AC` | 8.82 | 6.76 |

**The dependency this creates:** the tick and cross icons are now load-bearing
for accessibility, not decoration. If either is ever removed, success and error
become indistinguishable from the accent under their own theme and the aliasing
has to be revisited. `tests/palette-contrast.spec.ts` records this next to the
assertion that the two semantics differ from each other.

Separation holds at any hue, so a future fifth theme cannot collide with the
semantics. Since semantics do not vary per theme, their contrast is verified once
rather than four times.

---

## Build pipeline — verified, not assumed

This pipeline mangled `light-dark()` inside SVG `fill` keyframes in #210, so
`oklch()` was proven before any design work rested on it. Probe tokens were
patched into `@theme` and the SSR `<style>` block, `npm run build` was run, and
the emitted bundles read directly. Results:

| pattern | result |
|---|---|
| `oklch(0.50 0.14 145)` | → `oklch(50% .14 145)` — normalised, intact |
| `oklch(var(--l) var(--c) var(--h))` | **verbatim** — this is the mechanism the system needs |
| `oklch(var(--tuple))` | verbatim |
| oklch-valued var in SVG `fill` keyframes | verbatim, nothing rewritten |
| SSR inline `<style>` block | untouched |

The SSR block is safe because it is a template literal inside `.ts` — it bundles
as a JavaScript string and never reaches Lightning CSS.

Three behaviours the probe found that are not in the issue:

1. **Unused `@theme` tokens are tree-shaken.** A declared-but-unreferenced token
   vanished from the bundle. Any parameter that only JS reads must be referenced
   somewhere in CSS or it will not ship.
2. **`color-mix(in oklch, …)` emits a duplicated srgb fallback** above the real
   declaration, and Lightning CSS flattens one level of var indirection when
   building it. It still tracks runtime changes, but the rule becomes two
   declarations.
3. **Static `color-mix` is folded at build time** to a literal. It only stays
   live if a `var()` sits inside it.

**Still to probe during execute:** `oklch(calc(var(--accent-l) - 0.10) …)` — the
semantic-L delta depends on `calc()` inside `oklch()` surviving the same pass.
If it does not, the delta becomes two declared values instead of one. Low risk,
cheap to check, but it must be checked before the token work starts.

---

## Known traps

- **`/archive` duplicates the tokens.** It is Worker-rendered, ships its own
  inline `<style>` in [src/worker/puzzles.ts](../../../src/worker/puzzles.ts),
  and does not load `tailwind.css`. Every token change must be written twice.
  This is what let #243 survive its first fix.
- **`--octo-c1/2/3` stay hardcoded hex.** They cannot use `var()` inside SVG
  `fill` keyframes (#210). Six values, decorative, no contrast requirement — out
  of scope for the reduction target.
- **Lime light has ~0.5 of AA headroom.** The light background value cannot drift
  without re-checking it.

### Token parity test

The duplication is the weakest part of this design: 10 declared values still
exist in two places, so drift risk shrinks but does not vanish. A Vitest spec
parses the token block out of both `src/tailwind.css` and the `<style>` string in
`src/worker/puzzles.ts`, and fails if the token sets or values diverge. Runs in
the normal `npm test` pass; no Playwright needed.

Deliberately not solving the duplication properly — generating the Worker block
from a shared module would touch the Worker bundle, and #200 (migrate `/archive`
to a SPA route) deletes the duplication anyway. No point solving it twice.

---

## Sequence

1. **Prototype comparison page** — throwaway, outside the app. Welcome / game /
   completion × 4 themes × 2 modes, current vs proposed, with toggles for:
   accent chroma; shared-vs-per-theme chroma; cream `#F3F1ED` vs current
   `#FAFAFA`/white cards. **Sign-off gate — no app code moves before this.**
2. **Probe `calc()` inside `oklch()`** through the build.
3. **Tokens** in `src/tailwind.css` — derivation, remove `--color-on-accent` and
   `--color-accent-strong`, update every consumer.
4. **Mirror into `src/worker/puzzles.ts`** + the parity test.
5. **DESIGN-SYSTEM.md** rewritten around the derivation rules.
6. **QA** at the agreed level.
7. **DA review → self-review → PR to `staging`.**

### Settled by the prototype

Three perceptual questions the contrast maths could not answer. Decided
2026-07-18 against `docs/prototypes/255-palette.html`.

**1. Accent chroma — per-theme, capped at today's saturation.**

Shared chroma read as visibly muted, which is what the prototype was built to
test. The muting was never the lightness fix: L moves 0.536 → 0.50 in light,
which is imperceptible. It was one shared chroma having to fit under the lowest
ceiling across four hues, taking Violet from 0.237 → 0.14 and Berry from 0.219 →
0.14.

The rule is `min(today's chroma, the hue's sRGB ceiling at the AA lightness)`:

| | light | vs today | dark | vs today |
|---|---|---|---|---|
| Lime | 0.157 | ceiling-capped from 0.178 | 0.174 | matches today |
| Berry | 0.201 | ceiling-capped from 0.219 | 0.135 | ceiling-capped from 0.157 |
| Blue | 0.178 | matches today | 0.111 | ceiling-capped from 0.151 |
| Violet | 0.237 | matches today | 0.140 | ceiling-capped from 0.177 |

Five of the eight are gamut-limited rather than chosen. That residual muting is
the genuine cost of the AA fix in dark mode: clearing 4.5:1 on `surface` needs
L 0.78, and a lighter colour has less sRGB room for chroma. It cannot be
recovered without leaving sRGB.

**2. Light base — white `#FAFAFA`, not cream `#F3F1ED`.**

Cream was tried and rejected. White also raises the worst accent ratio from 5.00
to 5.36, so the "Lime light has ~0.5 headroom" constraint above loosens slightly.

**3. Per-theme, not shared.** Follows from (1). Costs 8 declared values instead
of 2 — see the revised count in the acceptance criteria.

One side effect worth recording: the Lime-dark/success collision was the weakest
pairing in the system under shared chroma, because C 0.111 flattened Lime toward
the success green. At the per-theme value of 0.174 the two separate clearly. The
decision that fixed the muting also fixed the tightest collision.

---

## QA scope

Agreed up front, matched to a change where every colour on screen moves:

- **Full Playwright regression** against the production build, 5-engine matrix.
- **axe** in both light and dark, including the open-menu and open-modal cases
  added in #254.
- **Computed contrast unit test** — asserts every accent × mode × (`bg`,
  `surface`) pairing clears 4.5:1 by computing the ratio, so the guarantee is
  enforced in CI rather than audited once. This is the direct answer to how #254
  shipped its AA failure.
- **Token parity test** — `tailwind.css` vs the Worker's inline block.

---

## Acceptance criteria

- [x] Prototype comparison page built and signed off before any app code changes
- [ ] `oklch()` verified through the build in both `tailwind.css` and the SSR block
- [ ] Palette derives from ≤20 declared values; 31 literals reduced

      Revised from ≤10 at sign-off. Per-theme chroma costs 8 values instead of
      2, so the realistic target is ~18. The reduction is real but smaller than
      first scoped, and it buys back the accent vividness the shared value cost.
- [ ] `--color-on-accent` and `--color-accent-strong` removed
- [ ] All accent text ≥4.5:1 on **both** `--color-bg` and `--color-surface`,
      4 themes × 2 modes, asserted by test
- [ ] success/error distinguishable from the active accent, including under Lime
      **and Berry**
- [ ] Token parity test passing
- [ ] axe suite green in light and dark, menu and modal cases included
- [ ] DESIGN-SYSTEM.md rewritten around the derivation rules

## Constraints

- Never commit to `main` or `staging`. PR targets `staging`.
- Never run `wrangler deploy`.
- DA review (fresh-context subagent) → self-review before the PR.
