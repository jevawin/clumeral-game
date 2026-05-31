---
quick_id: 260531-vwi
description: Remove nav from brand, bounce octopus logo on tap
date: 2026-05-31
status: complete
commit: 2302079
---

# Summary — 260531-vwi

Removed navigation from the header brand button. Tapping the octopus logo or
the "Clumeral" wordmark now spring-bounces the header logo, matching the old
site's tap-to-bounce mascot.

## Changes

- `src/octo.ts` — extracted reusable `springBounceEl(el, H, cb)`; `springBounce`
  now delegates (mascot behaviour unchanged, H=56). Added guarded `bounceBrand()`
  (H=12) targeting `[data-brand-octo]`.
- `index.html` — header logo svg tagged `[data-brand-octo]` with
  `transform-origin: center bottom`; `aria-label="Home"` → `"Bounce Clumeral"`.
- `src/app.ts` — `[data-brand]` click now calls `bounceBrand()` instead of the
  context-aware `navigate(...)`.

## Verification

- `npx tsc --noEmit` — clean.
- `npm run build` — clean (worker + client).

## Notes / follow-ups

- The brand used to be the exit path on `/archive/<date>` (back to the archive
  list) and a way to reach "How to play" from `/play`. Both are gone by design.
  Browser back still works; archive list also reachable via in-page buttons on
  completion. Flag for the user if a header back-affordance is still wanted.
- Pre-PR review gates (DA review → self-review) apply before any PR: this change
  touches navigation + a11y across 3 files.
</content>
