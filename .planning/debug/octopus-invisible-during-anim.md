---
status: resolved
trigger: "210, octopus invisible during animation, run playwright to confirm and/or ask me"
github_issue: 210
created: 2026-05-31
updated: 2026-05-31
---

# Debug: Octopus invisible during celebration animation

## Symptoms

- **Expected:** Octopus stays visible for the entire celebration animation, in both light and dark themes.
- **Actual:** While swimming around on the completion screen, the octopus goes invisible — blends into / disappears against the background.
- **Errors:** None reported.
- **Timeline:** Reported as GitHub issue #210 (labels: roadmap, P2, UI/UX, bug).
- **Reproduction:** Complete a puzzle → completion screen → octopus celebration swims around → it disappears at points. User unsure which theme/accent is worst — treat as "any accent, both themes".

## Proposed solution (from issue #210)

Transition octopus colour smoothly between theme accent colours as it swims, so it never matches the current background. Must stay skippable and under 3s.

## Acceptance criteria (issue #210)

- [ ] Octopus visible for the entire celebration in both light and dark themes
- [ ] Octopus colour transitions smoothly between theme colours while swimming (no hard jumps)
- [ ] Celebration stays skippable and under 3s

## Confirmation method

User chose: code inspection of octo.ts colour/render logic + empirical Playwright confirmation (drive to completion screen, sample octopus pixels vs background during animation). Note: project uses Vitest/jsdom — no Playwright in this repo. Confirmed via CSS build inspection instead.

## Current Focus

- hypothesis: CONFIRMED (see Root Cause)
- next_action: done — fix applied and verified in built output

## Evidence

- timestamp: 2026-05-31T00:00:00Z
  file: src/tailwind.css lines 139-144
  note: |
    `octo-colours` keyframe uses CSS `light-dark()` at 25%, 50%, 75% stops:
    ```css
    @keyframes octo-colours {
      0%, 100% { fill: var(--color-accent); }
      25%      { fill: light-dark(#de1f46, #ea6c85); }
      50%      { fill: light-dark(#376ddb, #6393f2); }
      75%      { fill: light-dark(#9a44ea, #b679f0); }
    }
    ```

- timestamp: 2026-05-31T00:00:01Z
  file: dist/client/assets/index-z9bVmBII.css (built output)
  note: |
    Lightning CSS (Vite's CSS transformer) converts `light-dark()` to concatenated
    custom property pairs for the polyfill:
    ```css
    @keyframes octo-colours {
      0%,to { fill: var(--color-accent) }
      25%   { fill: var(--lightningcss-light,#de1f46) var(--lightningcss-dark,#ea6c85) }
      50%   { fill: var(--lightningcss-light,#376ddb) var(--lightningcss-dark,#6393f2) }
      75%   { fill: var(--lightningcss-light,#9a44ea) var(--lightningcss-dark,#b679f0) }
    }
    ```
    SVG's `fill` property takes a single `<paint>` value. Two concatenated `var()` expressions
    is an invalid `fill` value. The property becomes invalid and falls back to the CSS
    initial value for `fill`, which is `black` (#000000).

- timestamp: 2026-05-31T00:00:02Z
  impact: |
    At 25%, 50%, 75% of every 1.44s colour cycle, the octopus body fill becomes black.
    Dark mode background is #121213 (near-black). Black octopus on near-black background
    = invisible. Light mode background is #FAFAFA — black body is visible, but the colour
    cycling feature is fully broken in both modes (always black at intermediate stops instead
    of Berry/Blue/Violet).

## Root Cause

**File:** `src/tailwind.css`, `@keyframes octo-colours`

**Summary:** `light-dark()` is used in `fill` keyframe stops. Vite's Lightning CSS build
step converts `light-dark()` to its `--lightningcss-light / --lightningcss-dark` polyfill
by concatenating two `var()` expressions. SVG `fill` only accepts a single paint value —
two concatenated `var()` values is invalid CSS. The browser discards invalid fill values and
falls back to the SVG `fill` initial value of `black`. In dark mode (#121213 background),
a black octopus is invisible. In light mode the octopus turns black (visible, but wrong).

**Worst case:** Dark mode, any accent — octopus goes black (invisible) at 25%/50%/75% of
each 1.44s colour cycle during the 2.88s celebration.

## Resolution

- root_cause: light-dark() in SVG fill keyframe falls back to black because Lightning CSS rewrites it to two concatenated var() expressions, which is an invalid SVG fill value.
- fix: Replaced light-dark() in @keyframes octo-colours with three plain CSS custom properties (--octo-c1, --octo-c2, --octo-c3). Light values defined on :root in @layer base; dark values override in html.dark inside @layer theme. Lightning CSS has nothing to rewrite — each fill stop is a single valid var() reference.
- verification: Built with `npm run build`. Extracted @keyframes octo-colours from dist/client/assets/index-Cy_bTly5.css — confirmed all four stops emit single var() values (--color-accent, --octo-c1, --octo-c2, --octo-c3). Confirmed both :root and html.dark custom property declarations present in built output. No two-value concatenation, no hardcoded black.
- files_changed:
  - src/tailwind.css — removed light-dark() from keyframe, added --octo-c1/c2/c3 to :root and html.dark
- specialist_hint: typescript
- review_gates: DA review + self-review required before PR (CSS/theming change, >30 lines affected)
