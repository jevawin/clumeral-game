---
quick_id: 260531-vwi
description: Remove nav from brand, bounce octopus logo on tap
date: 2026-05-31
---

# Quick Task 260531-vwi: Remove brand nav, bounce octopus logo

Restore the old site's behaviour: the header brand (octopus logo + "Clumeral"
wordmark) no longer navigates. Tapping it spring-bounces the header logo SVG.

## Decision (discuss)

Bounce target: the header logo SVG (`[data-brand-octo]`) — the only visible
octopus in the new design. The full mascot `[data-octo-wrap]` is an offscreen
measurement host, so it is not used here.

## Tasks

1. **octo.ts** — extract `springBounceEl(el, H, cb)` from `springBounce`; add
   guarded `bounceBrand()` that bounces `[data-brand-octo]` at H=12.
   - verify: `npx tsc --noEmit` clean; `springBounce` still drives the mascot.
2. **index.html** — add `data-brand-octo` + `transform-origin: center bottom`
   to the header logo svg; drop `aria-label="Home"` (wordmark is the name).
   - verify: build clean.
3. **app.ts** — replace the context-aware `navigate` brand handler with
   `bounceBrand()`; import it from `./octo.ts`.
   - verify: build clean; no remaining brand navigation.
</content>
