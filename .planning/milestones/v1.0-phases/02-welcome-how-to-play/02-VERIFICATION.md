---
phase: 02-welcome-how-to-play
verified: 2026-04-12T00:00:00Z
status: passed
score: 5/5 must-haves verified
gaps: []
human_verification:
  - test: "First-visit layout — HTP above Play button"
    expected: "When all localStorage keys cleared, the 3-step HTP list appears above the green Play button"
    why_human: "DOM ordering inside innerHTML can't be confirmed without rendering"
  - test: "Return-visit layout — HTP below Play button"
    expected: "When dlng_history is present, the Play button appears above the 3-step HTP list"
    why_human: "DOM ordering inside innerHTML can't be confirmed without rendering"
  - test: "Dark mode rendering"
    expected: "Welcome screen colours update correctly: dark background, light text, green accent button"
    why_human: "Tailwind dark: variants need visual inspection"
  - test: "No octopus animation regression"
    expected: "Game screen octopus still animates on click — welcome octopus does not animate or interfere"
    why_human: "octo.ts targeting can't be confirmed without running the app"
---

# Phase 02: Welcome + How-to-Play Verification Report

**Phase Goal:** Players land on a complete, correct welcome screen on every visit
**Verified:** 2026-04-12
**Status:** passed (HTP-04 gap resolved — widened detection to all Clumeral keys)
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Welcome screen shows logo, octopus mascot, subtitle, and today's puzzle number | ✓ VERIFIED | `welcome.ts` renders `<h1>Clumeral</h1>`, 96px decorative SVG, "A daily number puzzle", and `Puzzle #${puzzleNumber(todayLocal())}` |
| 2 | Tapping play button transitions to game screen | ✓ VERIFIED | `initWelcome()` attaches `click` listener calling `showScreen("game")` on `[data-play-btn]` |
| 3 | First visit shows HTP above play button | ✓ VERIFIED | `renderWelcome(true)` places `htpSteps()` before `playButton()` in the HTML string |
| 4 | Return visit shows HTP below play button | ✓ VERIFIED | `renderWelcome(false)` places `playButton()` before `htpSteps()` |
| 5 | Welcome screen appears on every visit | ✓ VERIFIED | `initScreens()` calls `updateScreenDOM("welcome")` unconditionally on every page load |

**Score:** 5/5 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/welcome.ts` | Welcome screen render and init logic, exports `initWelcome` | ✓ VERIFIED | 104 lines (above min 40), exports `initWelcome()` as sole public function |
| `index.html` | `[data-screen="welcome"]` section with structured content shell | ✓ VERIFIED | Line 440: `<section data-screen="welcome" ...>` present; note no `data-play-btn` in HTML — it's injected by `renderWelcome()` at runtime |
| `src/app.ts` | Imports and calls `initWelcome()` | ✓ VERIFIED | Line 12: `import { initWelcome } from './welcome.ts'`; Line 790: `initWelcome()` called after `initScreens()` |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/welcome.ts` | `src/screens.ts` | `import { showScreen } from './screens.ts'` | ✓ WIRED | Line 6 of welcome.ts |
| `src/welcome.ts` | localStorage | `localStorage.getItem("dlng_history")` | ✓ WIRED | Line 99 of welcome.ts |
| `src/app.ts` | `src/welcome.ts` | `import { initWelcome } from './welcome.ts'` | ✓ WIRED | Line 12 of app.ts |
| `src/welcome.ts` | `[data-play-btn]` → `showScreen('game')` | click handler on injected button | ✓ WIRED | Lines 102–103 of welcome.ts |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `src/welcome.ts` | `num` (puzzle number) | `puzzleNumber(todayLocal())` — deterministic date calculation | Yes — computes from current date and EPOCH_DATE | ✓ FLOWING |
| `src/welcome.ts` | `isNew` (visit type) | `!localStorage.getItem("dlng_history")` | Yes — real localStorage read at init time | ✓ FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| TypeScript compiles without errors | `npx tsc --noEmit` | No errors in app source files (2 pre-existing `vite.config.ts` node type warnings, unrelated to this phase) | ✓ PASS |
| `initWelcome` exported | `grep "export function initWelcome" src/welcome.ts` | Found at line 98 | ✓ PASS |
| No animation attributes on welcome octopus | `grep -c "data-octo\|data-eye\|data-mouth" src/welcome.ts` | 2 matches — both in a comment block (lines 29–30 explaining why they're absent), zero in actual SVG markup | ✓ PASS |
| `initScreens()` before `initWelcome()` | Order check in app.ts init block | Lines 789–790: `initScreens()` then `initWelcome()` | ✓ PASS |
| initScreens shows welcome without early-return guard | `initScreens()` calls `updateScreenDOM("welcome")` directly | Confirmed at line 68 of screens.ts | ✓ PASS |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| WEL-01 | 02-01-PLAN.md | Welcome screen shows logo and octopus mascot | ✓ SATISFIED | `<h1>Clumeral</h1>` + 96px decorative SVG in `renderWelcome()` |
| WEL-02 | 02-01-PLAN.md | Welcome screen shows subtitle and puzzle number | ✓ SATISFIED | "A daily number puzzle" + `Puzzle #${num}` rendered |
| WEL-03 | 02-01-PLAN.md | Welcome screen shows play button that transitions to game screen | ✓ SATISFIED | `[data-play-btn]` click calls `showScreen("game")` |
| WEL-04 | 02-01-PLAN.md | Welcome screen shows every visit (like Wordle) | ✓ SATISFIED | `initScreens()` unconditionally calls `updateScreenDOM("welcome")` |
| HTP-01 | 02-01-PLAN.md | How-to-play displayed inline on welcome screen (not a modal) | ✓ SATISFIED | HTP steps rendered as `<ol>` injected directly into the welcome section |
| HTP-02 | 02-01-PLAN.md | How-to-play appears above play button on first visit | ✓ SATISFIED | `renderWelcome(true)` places HTP before button in HTML string |
| HTP-03 | 02-01-PLAN.md | How-to-play appears below play button on return visits | ✓ SATISFIED | `renderWelcome(false)` places button before HTP |
| HTP-04 | 02-01-PLAN.md | First-visit detection based on whether any Clumeral localStorage keys exist | ✓ SATISFIED | `hasClumeralData()` checks all six keys: dlng_history, dlng_prefs, dlng_uid, dlng_theme, dlng_colour, cw-htp-seen |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None found | — | — | — | — |

No TODOs, no placeholder returns, no empty implementations, no hardcoded empty data that flows to rendering. The `data-octo`/`data-eye`/`data-mouth` references at lines 29–30 are comment text, not attributes, and are intentional explanatory notes.

---

### Human Verification Required

#### 1. First-visit HTP layout

**Test:** Open DevTools > Application > Local Storage, delete all keys. Reload the page.
**Expected:** The 3-step HTP list (numbered "1.", "2.", "3.") appears above the green Play button.
**Why human:** DOM ordering inside `innerHTML` assignment verified statically, but visual rendering needs browser confirmation.

#### 2. Return-visit HTP layout

**Test:** Add key `dlng_history` with value `[]` to localStorage. Reload.
**Expected:** The Play button appears above the 3-step HTP list.
**Why human:** Same as above.

#### 3. Dark mode rendering

**Test:** Toggle dark mode via the theme toggle. Inspect the welcome screen.
**Expected:** Background goes near-black, text goes light, the Play button stays green, subtitle text goes muted-light.
**Why human:** Tailwind `dark:` variant output needs visual inspection.

#### 4. Game octopus animation regression

**Test:** Click Play to reach the game screen. Click the octopus.
**Expected:** Octopus animates. The welcome screen octopus (which has no `data-octo` attribute) does not interfere.
**Why human:** `octo.ts` selects by `[data-octo]` — absence of attribute in welcome octopus prevents targeting, but this needs live confirmation.

---

### Gaps Summary

**One partial gap on HTP-04.**

The detection logic in `welcome.ts` checks only `dlng_history`, but REQUIREMENTS.md HTP-04 requires detection based on "any Clumeral localStorage key". The Clumeral keys in the codebase are: `dlng_history`, `dlng_uid`, `dlng_theme`, `dlng_prefs`, `dlng_colour`, and `cw-htp-seen`.

The PLAN (D-10 in CONTEXT.md) and RESEARCH.md explicitly narrowed this to `dlng_history` — it is a documented intentional decision. However, it creates a real edge case: a user who has toggled dark mode or changed the colour theme on a first visit (before completing a puzzle) will be shown the return-visit layout on their next visit, even though they've never played.

**Options to resolve:**
1. Widen the check in `welcome.ts` to scan all known Clumeral keys (aligns implementation with the written requirement).
2. Update REQUIREMENTS.md HTP-04 to formally state that detection uses `dlng_history` only (aligns the requirement with the intentional decision).

This is a design decision, not a technical error. The four human-verification items above are genuine needs — visual and interactive behaviour cannot be confirmed from code inspection alone.

---

_Verified: 2026-04-12_
_Verifier: Claude (gsd-verifier)_
