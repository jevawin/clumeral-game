---
phase: 01-refinements-wave-1
verified: 2026-05-02T20:30:00Z
status: human_needed
score: 6/6 must-haves verified (1 needs human confirmation)
human_verification:
  - test: "Logo+octo on solved screen sit at the same vertical offset as on welcome screen"
    expected: "When transitioning welcome → game → solved, the Clumeral title + octopus appear at the same y-offset on both screens (no perceived jump)"
    why_human: "Welcome section uses `flex items-center justify-center` (vertically centers content), completion section uses `flex flex-col` (anchors at top). Both use the same inner wrapper classes (`max-w-[390px] mx-auto flex flex-col items-center gap-6 px-6 py-8`) and the same 96×96 octo SVG, so size parity is guaranteed. Vertical offset parity depends on viewport height and content height — only a browser test confirms it."
  - test: "Returning solver auto-routes to completion screen on init for `/`"
    expected: "Solve today's puzzle → refresh → app loads directly into completion screen, welcome screen never flashes"
    why_human: "Logic is wired (todayEntry() → renderCompletion → initScreens('completion')) but real-time render order can only be confirmed by browser test."
  - test: "YOUR STATS hidden on Show puzzle back-navigation"
    expected: "From completion, click Show puzzle → game screen renders, YOUR STATS panel is NOT visible. Mid-session before clicking Show puzzle, stats panel still appears."
    why_human: "suppressStats flag and listener are wired correctly; runtime DOM update can only be confirmed in a browser."
  - test: "Burger menu hover behavior in light + dark mode"
    expected: "Hovering a menu item: no background fill, text+icon turn accent green. Mouse off: returns to text-text color."
    why_human: "Hover CSS is in place but visual rendering needs a browser; sprite icon color depends on currentColor in /public/sprites.svg (verified present per Plan 02 SUMMARY: 8 occurrences)."
---

# Phase 01: Refinements Wave 1 Verification Report

**Phase Goal:** Ship a cohesive batch of design refinements: footer in document flow, pure foreground colors, simplified header, polished menu, clearer copy, and a richer solved screen with auto-routing for returning solvers.
**Verified:** 2026-05-02T20:30:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Footer is in document flow — no `position: fixed` on the footer | VERIFIED | `index.html:294` — `<footer data-footer class="mt-auto text-center py-4 text-text text-sm font-[Quicksand]">` inside `<div class="min-h-screen flex flex-col bg-bg">` (line 42). No `fixed` class on footer. |
| 2 | No grey/muted text in app body, welcome, completion | VERIFIED (scoped) | `grep text-muted` in `src/app.ts`, `src/welcome.ts`, `src/completion.ts` returns 0. Non-modal/non-menu spots in `index.html` use `text-text`. Feedback modal still has 5 `text-muted` usages (lines 51, 67, 68, 70, 71) but the success criterion as worded scopes to "app body, welcome, completion screens" — modal explicitly excluded by Plan 01-01. |
| 3 | Game header omits puzzle number | VERIFIED | `grep -c 'data-plabel' index.html` = 0. Game header (lines 143–157) contains only the 24×24 octo SVG, "Clumeral" wordmark, and burger button. |
| 4 | Burger menu omits Archive, no hover bg, hover text → accent green | VERIFIED | `grep -c 'icon-archive' index.html` = 0. `grep -c 'hover:bg-bg' index.html` = 0. `grep -c 'menu-item' index.html` = 3. CSS rule at `src/tailwind.css:225-228` switches `color` to `var(--color-accent)` on `:hover` and `:focus-visible` with `background-color: transparent`. |
| 5 | Submit button reads "Submit answer"; solved subheading "Solved in N try/ies" | VERIFIED | `index.html:220` — `>Submit answer<`. `src/completion.ts:116` — `Solved in ${tries} ${tries === 1 ? 'try' : 'tries'}` (no trailing period). Tick icons elsewhere unchanged. |
| 6 | Solved screen has welcome-parity logo+octo, Show puzzle + Archive links, auto-routes returning solvers, hides YOUR STATS on back-nav | VERIFIED (with human nuance) | All four sub-truths covered by code below. Vertical-offset parity flagged for human visual confirmation. |

**Score:** 6/6 truths verified (truth 1 has visual aspect routed to human verification)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `index.html` | Document-flow flex column with footer last child | VERIFIED | Line 42 opens `<div class="min-h-screen flex flex-col bg-bg">`; line 294 has footer with `mt-auto`. |
| `index.html` | Cleaned game header (no `data-plabel`) + 3-item menu | VERIFIED | data-plabel = 0; menu-item count = 3; no Archive markup. |
| `index.html` | Solved screen with logo+octo, octo slot, link slot | VERIFIED | Lines 261–291: section uses `flex flex-col`, inner wrapper uses welcome-parity classes, has `[data-completion-octo]` and `[data-completion-links]`. |
| `src/tailwind.css` | `.link` utility | VERIFIED | Lines 313–323: accent text + 1px accent bottom border + 2px padding-block-end + no text-decoration. Inside `@layer utilities`. |
| `src/tailwind.css` | Menu item hover rule | VERIFIED | Lines 219–235: `[data-menu] .menu-item:hover` switches color to accent, keeps background transparent, SVG inherits via `color: inherit`. |
| `src/app.ts` | suppressStats flag + completion:show-puzzle listener + init routing | VERIFIED | Line 82 declares flag. Lines 344, 370 early-return guards. Lines 919–933 init routing. Lines 936–944 listener. |
| `src/completion.ts` | Logo+octo render, link block, completion:show-puzzle dispatch | VERIFIED | COMPLETION_OCTO_SVG (line 11), idempotent octo injection (line 107), Show puzzle/Archive link rendering (lines 144–171), event dispatch (line 160). |
| `src/welcome.ts` | text-muted purged | VERIFIED | grep returns 0. |
| `src/completion.ts` | text-muted purged | VERIFIED | grep returns 0. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| body shell | footer | flex column with footer mt-auto | WIRED | `index.html:42, 294` — flex column wrapper + mt-auto on last child. |
| Inline links across screens | `.link` utility | `class="link"` | WIRED | `src/completion.ts:154, 167` — Show puzzle + Archive use `className = 'link'`. |
| Game header | DOM | data-plabel removed | WIRED | Markup gone (=0); `dom.plabel` cache resolves to null; writes are null-guarded (intentional dead-code per Plan 02). |
| boot in src/app.ts | showScreen('completion') for returning solvers | todayEntry() + renderCompletion + initScreens(initialScreen) | WIRED | `src/app.ts:919-932` — synchronous localStorage check, pre-render before initScreens. |
| Show puzzle link | showScreen('game') with stats suppression | dispatch `completion:show-puzzle` event; app.ts listens | WIRED | `src/completion.ts:160` dispatches; `src/app.ts:936-944` listens, sets suppressStats, clears stats DOM, calls showScreen('game'). |
| renderStats / renderStatsUpTo | stats DOM | early-return when suppressStats | WIRED | `src/app.ts:344-348, 370-374` — early returns hide and clear DOM. |
| index.html submit button | click handler | `[data-submit]` selector | WIRED | Selector unchanged; only inner text changed. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `src/completion.ts` renderCompletion | `tries`, `puzzleNum`, `isRandom` | Caller passes; daily caller in `src/app.ts:929` reads `todayHistory.tries` from `loadHistory()` (localStorage) | Real | FLOWING |
| `src/completion.ts` stats grid | `loadHistory()` | localStorage `dlng_history` | Real (existing v1.0 data path) | FLOWING |
| `src/app.ts` suppressStats flag | `let suppressStats` | `completion:show-puzzle` event listener | Real (event-driven) | FLOWING |
| `src/app.ts` init routing | `todayEntry()` → `todayHistory` | localStorage history | Real | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Build succeeds | `npm run build` | Both Worker (33.40 kB) and client (49.90 kB JS, 38.60 kB CSS) bundles built; exit 0 | PASS |
| `.link` class compiled | inspect `dist/client/assets/index-*.css` | Class present per Plan 01-01 SUMMARY | PASS |
| No text-muted in three target files | `grep text-muted src/app.ts src/welcome.ts src/completion.ts` | 0 matches | PASS |
| No fixed footer | `grep -E "data-footer[^>]*\\bfixed\\b" index.html` | 0 matches | PASS |
| Submit answer text present | `grep -c '>Submit answer<' index.html` | 1 | PASS |
| Solved subheading copy | `grep "Solved in \${tries}" src/completion.ts` | matches line 116 | PASS |
| Auto-route check loaded | runtime browser test | — | SKIP (needs browser) |
| Show-puzzle navigation | runtime browser test | — | SKIP (needs browser) |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| LAY-01 | 01-01 | Footer in document flow | SATISFIED | `min-h-screen flex flex-col` on body wrapper, `mt-auto` on footer, no `position: fixed` |
| CLR-01 | 01-01 | All text uses pure fg colors (no muted) | SATISFIED (scoped) | text-muted purged from app/welcome/completion + non-modal/non-menu index spots. Modal (5 usages) explicitly excluded by plan scope; user-defined success criterion 2 also scopes to "app body, welcome, completion screens". REQUIREMENTS.md text "modals" is broader than plan scope — flag for future cleanup. |
| LNK-01 | 01-01 | Standard `.link` utility | SATISFIED | `src/tailwind.css:313-323` |
| HDR-01 | 01-02 | Game header drops puzzle number | SATISFIED | `data-plabel` markup removed |
| MNU-01 | 01-02 | Burger menu drops Archive | SATISFIED | `icon-archive` count = 0 |
| MNU-02 | 01-02 | No hover bg on menu items | SATISFIED | `hover:bg-bg` count = 0; CSS `background-color: transparent` on hover |
| MNU-03 | 01-02 | Hover text = accent green | SATISFIED | CSS `color: var(--color-accent)` on `:hover` / `:focus-visible` |
| CPY-01 | 01-03 | "Submit answer" | SATISFIED | `>Submit answer<` count = 1 |
| CPY-02 | 01-03 | "Solved in N try/tries" | SATISFIED | Template literal with ternary on `src/completion.ts:116` |
| LAY-02 | 01-04 | Logo+octo parity | SATISFIED (visual confirmation routed to human) | Same wrapper classes + same 96×96 OCTO; section flex differs (welcome `items-center justify-center` vs completion `flex flex-col`) — visual y-offset parity needs browser test |
| SLV-01 | 01-04 | Show puzzle + Archive links | SATISFIED | Two links rendered with `className = 'link'`, Show puzzle gated on `!isRandom` |
| SLV-02 | 01-04 | Auto-route returning solvers | SATISFIED | Init block at `src/app.ts:919-932` reads `todayEntry()`, pre-renders, sets `initialScreen = 'completion'` |
| SLV-03 | 01-04 | Hide stats on back-nav | SATISFIED | `suppressStats` flag + early returns + listener |

All 13 requirements declared in plan frontmatters cross-reference cleanly against REQUIREMENTS.md, all marked `[x]` in REQUIREMENTS.md and `Complete` in the traceability table. No orphaned requirements.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/app.ts` | 69 | `dom.plabel` cache + null-guarded writers retained after markup removal | Info | Dead code but null-safe; documented decision in 01-02 SUMMARY (defer cleanup to future plan). No runtime risk. |
| `index.html` | 51, 67, 68, 70, 71 | `text-muted` in feedback modal | Info | Out of scope per Plan 01-01 explicit decision and the user's success criterion 2 wording. REQUIREMENTS.md CLR-01 mentions modals — the modal sweep is deferred. Surface for future plan. |
| `index.html` | 254 | `<a href="/random" class="text-accent underline">` | Info | Random-again link uses `text-accent underline` (legacy style), not `.link` utility. LNK-01 says ".link applies to ... future inline links" — existing inline link not migrated. Not a phase-01 requirement; surface for future cleanup. |

No blockers. No stubs.

### Human Verification Required

See `human_verification` in frontmatter. Four items:

1. **Logo+octo vertical-offset parity (LAY-02 visual)** — only confirmable by loading welcome and completion screens in a browser and visually comparing the y-position of the title/octo block.
2. **Returning solver auto-route (SLV-02)** — solve today's puzzle, refresh, confirm completion screen loads with no welcome flash.
3. **YOUR STATS hidden on Show puzzle back-nav (SLV-03)** — from completion, click Show puzzle, confirm stats panel is not visible. Sanity-check the negative case (mid-session before Show puzzle: stats still appear).
4. **Burger menu hover (MNU-02 + MNU-03)** — hover an item in light + dark, confirm no background fill and text+icon turn accent green.

### Gaps Summary

No blocking gaps. The phase ships all 13 requirements as designed. Two known scope decisions are documented (not gaps):

- Feedback modal `text-muted` deferred (Plan 01-01 decision, aligned with the user's narrowed Success Criterion 2 wording).
- `dom.plabel` dead code deferred (Plan 01-02 decision; null-safe, no runtime impact).

Manual browser verification recommended for the four items above before opening the staging PR.

---

_Verified: 2026-05-02T20:30:00Z_
_Verifier: Claude (gsd-verifier)_
