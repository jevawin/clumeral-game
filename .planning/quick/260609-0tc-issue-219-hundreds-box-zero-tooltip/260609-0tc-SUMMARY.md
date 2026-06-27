---
phase: quick-260609-0tc
plan: 01
subsystem: keypad / tooltip
tags: [a11y, frontend, issue-219]
requires: []
provides: ["showTip() generic popover", "hundreds-box 0 explanatory tip"]
affects: [src/app.ts]
tech-stack:
  added: []
  patterns: ["aria-disabled (not native disabled) to keep an inert control operable"]
key-files:
  created: []
  modified: [src/app.ts]
decisions:
  - "Hundreds-box 0 uses aria-disabled=true instead of native disabled so it stays in tab order and can open the tip (WCAG 4.1.2 / 2.1.1)."
  - "showTagTip kept as a thin wrapper so the TAG_TIPS lookup + early-return stay on the (i) path; showTip stays generic."
metrics:
  duration: ~4 min
  completed: 2026-06-09
---

# Phase quick-260609-0tc Plan 01: Hundreds-box 0 zero tooltip (#219) Summary

Tapping the disabled `0` in the hundreds digit box now opens the same popover the (i) clue icons use, reading "The number is 100–999, so the first digit can't be 0." Reused the tooltip by extracting a generic `showTip(message, anchor)` from `showTagTip`; frontend-only, `src/app.ts` only.

## What was built

**Task 1 — Extract generic `showTip()`** (`3eed964`)
- Added `function showTip(message: string, anchor: HTMLElement): void` holding the popover body verbatim: `closeTagTip()`, `track("tooltip_opened")`, the `role="tooltip"` / `data-tag-tip` div with the identical Tailwind class string and `#icon-circle-x` close button, `${message}` in the same `<p>`, append-to-parent + `relative`, sticky-header flip logic, outside-click + Escape handlers, and the `_cleanup` hook.
- Reduced `showTagTip(tag, anchor)` to a 3-line wrapper: `TAG_TIPS[tag]` lookup, early-return if missing, then `showTip(tip, anchor)`. The lookup/early-return stay in the wrapper so the (i) path is byte-for-byte equivalent. `closeTagTip()` untouched.

**Task 2 — Hundreds-box 0 tappable** (`956fc99`)
- In `buildKeypad`, the `disabled` case (`activeBox === 0 && d === 0`) no longer sets native `btn.disabled`. Instead: `aria-disabled="true"`, a descriptive `aria-label` ("0 unavailable — the first digit can't be 0"), no `toggleDigit`, and a click handler calling `showTip("The number is 100–999, so the first digit can't be 0.", btn)`.
- `const disabled`/`const elim` unchanged, so the greyed styling and `h-12` (48px) touch target are preserved.
- All other digits unchanged: non-disabled keep `toggleDigit`; player-eliminated digits keep `aria-pressed` and the toggle handler.
- Native `<button>` means Enter/Space fire the click handler once `disabled` is removed — no extra key wiring.

## Verification

`npx tsc --noEmit` — exit 0 (clean).

`npx vitest run` — full suite green:
```
 Test Files  12 passed (12)
      Tests  120 passed (120)
```
This is the regression guard on the `showTagTip` refactor — the (i) tooltip behavior is unchanged.

## Deviations from Plan

None — plan executed exactly as written.

## Accessibility

- WCAG 4.1.2 Name, Role, Value: 0 uses `aria-disabled="true"` (not native `disabled`), stays in tab order, descriptive label set.
- WCAG 2.1.1 Keyboard: Enter/Space open the tip via native button activation.
- WCAG 2.5.5 / 2.5.8 Target Size: touch target stays `h-12` (48px), unchanged.
- Popover already has `role="tooltip"` and a labelled Close button.

## Self-Check: PASSED

- `src/app.ts` modified — FOUND (`function showTip` present, `showTip(tip, anchor)` wrapper present).
- Commit `3eed964` — FOUND.
- Commit `956fc99` — FOUND.

## Notes for orchestrator

- In-browser preview verification pending (not run here per constraints): tap the hundreds box → keypad → tap greyed 0 → confirm popover copy + close via X / outside-click / Escape; keyboard Enter/Space; confirm (i) tooltips and other eliminated digits still behave.
- Docs artifacts (SUMMARY/PLAN/STATE) and ROADMAP intentionally not committed — orchestrator handles the docs commit.
