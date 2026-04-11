# Clumeral Redesign

## What This Is

Clumeral is a daily number puzzle at clumeral.com. Players get clues about a 3-digit number and eliminate possibilities to find the answer. This project restructures the app from a single busy page into three clean, focused screens — welcome, game, completion — inspired by Wordle's simplicity. The entire UI gets rebuilt from scratch in Tailwind CSS with a minimal colour palette.

## Core Value

The game screen must work flawlessly — clues, digit elimination, guess submission, and answer validation must all function exactly as they do today, just in a cleaner layout.

## Requirements

### Validated

- ✓ Daily puzzle generation with 5-7 clues — existing
- ✓ Server-side answer validation (answer never reaches client) — existing
- ✓ Digit elimination via clue tapping — existing
- ✓ Number pad input and guess submission — existing
- ✓ Game history persisted to localStorage — existing
- ✓ Random puzzle mode — existing
- ✓ Puzzle archive / replay — existing
- ✓ Light/dark mode toggle — existing
- ✓ Feedback modal with categories, metadata, Google Form submission — existing
- ✓ Analytics tracking via Cloudflare Analytics Engine — existing
- ✓ Celebration animation (octopus + bubbles) on correct answer — existing

### Active

- [ ] Three distinct screens: welcome, game, completion (state-driven, single page)
- [ ] Welcome screen: logo, octopus, subtitle, puzzle number, how-to-play, play button
- [ ] How-to-play placement: above play button (first visit), below (return visits)
- [ ] Game screen: clues listed directly on background (no card wrapper), digit boxes, number pad, submit button
- [ ] Compact menu on game screen: light/dark toggle, archive link, feedback, how-to-play
- [ ] Completion screen: basic stats (games played, win %, current streak, max streak), feedback prompt
- [ ] Feedback modal accessible from both completion screen and game menu
- [ ] Celebration animation: octopus swims up from bottom with bubbles (~3s), then completion screen appears
- [ ] Built from scratch with Tailwind CSS
- [ ] Minimal palette: ~7 semantic tokens with light/dark variants in tailwind.config.ts
- [ ] Dark mode: near-black (#121213), light mode: off-white (#FAFAFA)
- [ ] No colour theme picker — green accent only
- [ ] No `color-mix()` or `light-dark()` — Tailwind `dark:` variants and opacity modifiers only
- [ ] Simplified footer on all screens: "Made with heart by Jamie & Dave. (c) 2026."
- [ ] Old CSS fully removed once replacement is complete
- [ ] No visual regression on core gameplay

### Out of Scope

- Share button — separate roadmap item, no placeholder needed
- Multiple colour themes — removed deliberately to simplify UI and codebase
- Toast notification system — how-to-play is now inline, not a toast
- Real-time multiplayer or social features — not relevant to this redesign
- Worker/API changes — backend stays untouched, this is purely a frontend rebuild

## Context

The app has grown features (colour swatches, footer links, settings, guide modal) that compete for attention on one page. New players auto-dismiss the how-to-play popup without reading it. The redesign follows what the best daily puzzles do: one clear thing per screen.

The existing feedback modal (`src/modals.ts`) works well — category pills (General/Bug/Idea/Praise), textarea with character counter at 400/500, metadata line (puzzle number, date, device, browser), submit to Google Apps Script with 3-retry logic. It stays, just restyled in Tailwind.

Several existing issues get absorbed: #153 (Tailwind migration), #87 (copyright footer), #127 (bubble effect rework), #189 (how-to-play toast — superseded by inline approach). Issues #80 (tap clues to hide) and #78 (clicking digit hides clues) need rethinking in the new layout. Issue #190 (trial input above clues) is decided by the new layout.

**Technical approach:** Tailwind installed fresh, new screens built in Tailwind from scratch. Old CSS stays until fully replaced, then gets removed. No component library — the UI has ~3 real components (button, dropdown menu, stats display). The design anchor is a tight `tailwind.config.ts`.

**Screen transitions:** State-driven on a single page (like Wordle), not URL routes.

## Constraints

- **Tech stack**: Tailwind CSS, existing Vite + Cloudflare Workers setup stays
- **Backend**: No worker/API changes — frontend-only rebuild
- **Compatibility**: Must work on all current browsers (ES2022 target)
- **Performance**: Celebration animation must be skippable and under 3s
- **Design**: Under 15 semantic colour tokens in tailwind.config.ts

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Tailwind from scratch, not migrating old CSS | Clean break avoids fighting legacy patterns | — Pending |
| No component library | Only ~3 real components; library adds weight for no value | — Pending |
| State-driven screens, not URL routes | Matches Wordle pattern, simpler implementation | — Pending |
| Green accent only, drop colour picker | Simplifies UI and collapses palette from ~20 tokens to ~7 | — Pending |
| How-to-play inline on welcome screen | Players dismissed the popup; inline content gets read | — Pending |
| Feedback modal stays (restyled) | Works well, just needs Tailwind styling | — Pending |
| No share button placeholder | Cleaner to add it when the feature ships | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? -> Move to Out of Scope with reason
2. Requirements validated? -> Move to Validated with phase reference
3. New requirements emerged? -> Add to Active
4. Decisions to log? -> Add to Key Decisions
5. "What This Is" still accurate? -> Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-11 after initialization*
