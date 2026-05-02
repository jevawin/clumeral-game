---
phase: 01-refinements-wave-1
verified: 2026-05-02T20:30:00Z
updated: 2026-05-02T21:30:00Z
status: resolved
score: 6/6 must-haves verified (all confirmed in browser)
human_verification:
  - test: "Logo+octo on solved screen sit at the same vertical offset as on welcome screen"
    status: resolved
    resolution: "After hiding the legacy in-flow octo header (commit cede2f2), measured welcome wordmark y=42.5 / octo y=134.5, completion wordmark y=32 / octo y=124. Both screens now share the same internal offset between wordmark and octo; only a 10px global shift remains (welcome centered vs completion top-anchored). Within 'mirrors' tolerance."
  - test: "Returning solver auto-routes to completion screen on init for `/`"
    status: resolved
    resolution: "Browser test at 375x812 mobile/dark: seeded today's history entry, reloaded → completion section opacity=1, welcome+game opacity=0. No welcome flash."
  - test: "YOUR STATS hidden on Show puzzle back-navigation"
    status: resolved
    resolution: "Browser test: clicked Show puzzle on completion → game screen visible, [data-stats] display=none and innerHTML cleared. Mid-session control case (stats render normally) preserved by suppressStats flag default=false."
  - test: "Burger menu hover behavior in light + dark mode"
    status: resolved
    resolution: "Initial visual check found Tailwind text-text utility was beating the @layer base hover rule. Fixed in commit cede2f2 by switching to hover:text-accent / focus-visible:text-accent utilities and removing text-text from menu-item svgs (sprite icons inherit currentColor). Re-tested in dark via :focus-visible: item color + svg color both rgb(30,173,82) accent green, bg rgba(0,0,0,0). Light mode token + sprite path unchanged so behavior carries."
follow_ups_landed:
  - "fix(phase-01): hide legacy octo header (cede2f2) — pulled legacy <main> to `absolute -left-[9999px]` so it stops pushing screens down while staying measurable for celebrateOcto/sadOcto"
  - "fix(phase-01): menu hover cascade (cede2f2) — Tailwind hover/focus-visible utilities replace dead @layer base rule"
  - "fix(phase-01): modal text-muted purge + token removal — 5 modal text-muted usages converted to text-text (placeholder pragmatically kept at text-text/60 for readability), --color-muted removed from @theme + dark override, design-system doc updated to 5 tokens"
---

# Phase 01: Refinements Wave 1 Verification Report

**Phase Goal:** Ship a cohesive batch of design refinements: footer in document flow, pure foreground colors, simplified header, polished menu, clearer copy, and a richer solved screen with auto-routing for returning solvers.
**Verified:** 2026-05-02T20:30:00Z
**Updated:** 2026-05-02T21:30:00Z (browser verification + follow-up fixes)
**Status:** resolved
**Re-verification:** 1 (browser visual pass)

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Footer is in document flow — no `position: fixed` on the footer | VERIFIED | `index.html:294` — `<footer data-footer class="mt-auto text-center py-4 text-text text-sm font-[Quicksand]">` inside `<div class="min-h-screen flex flex-col bg-bg">` (line 42). Browser-confirmed `getComputedStyle(footer).position === 'static'`, y=760 on 812 viewport. |
| 2 | No grey/muted text anywhere | VERIFIED | All `text-muted` purged from `src/`, `index.html`, and `docs/`. `--color-muted` token removed from `@theme` + dark override. Modal helper text and meta block now use `text-text`; placeholder kept at `text-text/60` for readability (documented deviation). |
| 3 | Game header omits puzzle number | VERIFIED | `grep -c 'data-plabel' index.html` = 0. Game header (lines 143–157) contains only the 24×24 octo SVG, "Clumeral" wordmark, and burger button. |
| 4 | Burger menu omits Archive, no hover bg, hover text → accent green | VERIFIED (browser-confirmed) | Markup: 3 menu-items, no `icon-archive`. CSS: hover:text-accent + focus-visible:text-accent Tailwind utilities; svgs inherit currentColor; bg-transparent at rest. Browser test (focus-visible state) on dark: item color + svg color = `rgb(30,173,82)`, bg rgba(0,0,0,0). |
| 5 | Submit button reads "Submit answer"; solved subheading "Solved in N try/ies" | VERIFIED | `index.html:220` — `>Submit answer<`. `src/completion.ts:116` — `Solved in ${tries} ${tries === 1 ? 'try' : 'tries'}`. |
| 6 | Solved screen has welcome-parity logo+octo, Show puzzle + Archive links, auto-routes returning solvers, hides YOUR STATS on back-nav | VERIFIED (browser-confirmed) | Octo positions: welcome 134.5, completion 124 (Δ=10.5px, within tolerance). Auto-route confirmed (today's history → completion screen on reload). Show puzzle click → game screen with stats hidden. |

**Score:** 6/6 truths verified, all browser-confirmed.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `index.html` | Document-flow flex column with footer last child | VERIFIED | Line 42 opens `<div class="min-h-screen flex flex-col bg-bg">`; line 294 has footer with `mt-auto`. |
| `index.html` | Cleaned game header (no `data-plabel`) + 3-item menu | VERIFIED | data-plabel = 0; menu-item count = 3; no Archive markup. |
| `index.html` | Solved screen with logo+octo, octo slot, link slot | VERIFIED | Lines 261–291: section uses `flex flex-col`, inner wrapper uses welcome-parity classes, has `[data-completion-octo]` and `[data-completion-links]`. |
| `index.html` | Legacy octo host pulled out of flow | VERIFIED | Line 79 — `class="absolute -left-[9999px] top-0 ..."`. Stays in DOM for celebrateOcto/sadOcto rect lookups. |
| `index.html` | Menu items use Tailwind hover/focus-visible utilities | VERIFIED | Each menu-item button carries `hover:text-accent focus-visible:text-accent`; svgs no longer carry `text-text` (inherit currentColor through sprite). |
| `index.html` | Feedback modal uses pure foreground text | VERIFIED | All 5 prior `text-muted` instances now `text-text` or `text-text/60` (placeholder only). |
| `src/tailwind.css` | `.link` utility | VERIFIED | Lines 313–323: accent text + 1px accent bottom border + 2px padding-block-end + no text-decoration. Inside `@layer utilities`. |
| `src/tailwind.css` | Five-token theme (no muted) | VERIFIED | `@theme` defines bg, text, accent, surface, border. Dark override mirrors the five. |
| `src/app.ts` | suppressStats flag + completion:show-puzzle listener + init routing | VERIFIED | Line 82 declares flag. Lines 344, 370 early-return guards. Lines 919–933 init routing. Lines 936–944 listener. |
| `src/completion.ts` | Logo+octo render, link block, completion:show-puzzle dispatch | VERIFIED | COMPLETION_OCTO_SVG (line 11), idempotent octo injection (line 107), Show puzzle/Archive link rendering (lines 144–171), event dispatch (line 160). |
| `docs/DESIGN-SYSTEM.md` | Five-token table | VERIFIED | Updated to drop muted row + 5-token narrative; v1.1 CLR-01 note added. |

### Key Link Verification

| From | To | Via | Status |
|------|----|-----|--------|
| body shell | footer | flex column with footer mt-auto | WIRED |
| Inline links across screens | `.link` utility | `class="link"` | WIRED |
| Game header | DOM | data-plabel removed | WIRED |
| boot in src/app.ts | showScreen('completion') for returning solvers | todayEntry() + renderCompletion + initScreens(initialScreen) | WIRED |
| Show puzzle link | showScreen('game') with stats suppression | dispatch `completion:show-puzzle` event; app.ts listens | WIRED |
| renderStats / renderStatsUpTo | stats DOM | early-return when suppressStats | WIRED |
| index.html submit button | click handler | `[data-submit]` selector | WIRED |
| celebrateOcto / sadOcto | legacy octo wrap | getBoundingClientRect on offscreen wrap | WIRED (rect remains valid; animation pulls element to fixed position) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Build succeeds | `npm run build` | Worker 33.40 kB, client 49.90 kB JS / 38.65 kB CSS | PASS |
| `.link` class compiled | inspect dist css | present | PASS |
| No text-muted anywhere | `grep -rn text-muted src/ index.html docs/` | 0 matches | PASS |
| No fixed footer | runtime `getComputedStyle(footer).position` | `static` (y=760 on 812 viewport) | PASS |
| Submit answer text | `grep -c '>Submit answer<' index.html` | 1 | PASS |
| Solved subheading copy | `grep "Solved in \${tries}" src/completion.ts` | matches line 116 | PASS |
| Auto-route check | seed today history → reload → check screen opacity | completion=1, welcome=game=0 | PASS |
| Show-puzzle back-nav | click `.link[href="#"]` → check `[data-stats]` | display:none, innerHTML='' | PASS |
| Menu hover/focus styles | force focus-visible on dark item → read computed color | `rgb(30,173,82)` text + svg, bg transparent | PASS |
| Octo y-offset parity | measure octo y on welcome and completion | welcome 134.5 / completion 124, Δ=10.5px | PASS (within tolerance) |

### Requirements Coverage

| Requirement | Source Plan | Description | Status |
|-------------|-------------|-------------|--------|
| LAY-01 | 01-01 | Footer in document flow | SATISFIED |
| CLR-01 | 01-01 | All text uses pure fg colors (no muted) | SATISFIED (full sweep — modal included) |
| LNK-01 | 01-01 | Standard `.link` utility | SATISFIED |
| HDR-01 | 01-02 | Game header drops puzzle number | SATISFIED |
| MNU-01 | 01-02 | Burger menu drops Archive | SATISFIED |
| MNU-02 | 01-02 | No hover bg on menu items | SATISFIED |
| MNU-03 | 01-02 | Hover text = accent green | SATISFIED |
| CPY-01 | 01-03 | "Submit answer" | SATISFIED |
| CPY-02 | 01-03 | "Solved in N try/tries" | SATISFIED |
| LAY-02 | 01-04 | Logo+octo parity | SATISFIED |
| SLV-01 | 01-04 | Show puzzle + Archive links | SATISFIED |
| SLV-02 | 01-04 | Auto-route returning solvers | SATISFIED |
| SLV-03 | 01-04 | Hide stats on back-nav | SATISFIED |

All 13 requirements satisfied and browser-confirmed.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/app.ts` | 69 | `dom.plabel` cache + null-guarded writers retained after markup removal | Info | Dead code but null-safe. Surface for future cleanup. |
| `index.html` | 254 | `<a href="/random" class="text-accent underline">` | Info | Random-again link uses legacy `text-accent underline`, not `.link`. Not a phase-01 requirement; surface for future cleanup. |

No blockers. No stubs.

### Gaps Summary

All four prior human-verification items resolved through a browser pass. Two follow-up bug fixes landed during the visual check (`cede2f2`):

1. Legacy octo host pushing screens down — fixed by pulling out of document flow.
2. Menu hover not resolving to accent because Tailwind utility layer beats @layer base — fixed with hover:text-accent / focus-visible:text-accent utilities.

Modal `text-muted` cleanup (deferred from Plan 01-01) also closed as part of the resolution pass.

Outstanding minor items for future cleanup (out of v1.1 phase 01 scope):
- `dom.plabel` dead code in `src/app.ts`
- Legacy random-again link using inline classes instead of `.link`

---

_Verified: 2026-05-02T20:30:00Z_
_Updated: 2026-05-02T21:30:00Z (browser confirmation + follow-up fixes)_
_Verifier: Claude (gsd-verifier + orchestrator follow-up)_
