# Clumeral

## What This Is

Clumeral is a daily number puzzle at clumeral.com. Players get clues about a 3-digit number, eliminate possibilities, and submit a guess. v1.0 (shipped 2026-05-02) restructured the app from a single busy page into three focused screens — welcome, game, completion — and rebuilt the entire UI in Tailwind CSS v4 with a 6-token palette.

## Core Value

The game screen works flawlessly — clues, digit elimination, guess submission, and answer validation behave exactly as they always did, in a cleaner, calmer layout.

## Current State

**Shipped:** v1.0 Clumeral Redesign (2026-05-02)
- 9 phases, 12 plans, 24 tasks
- 42/42 v1 requirements satisfied
- ~3,566 LOC TypeScript + CSS in `src/`
- Stack: Vite + Cloudflare Workers + Tailwind v4 (no component library)
- Backend untouched per project constraint

**Verified delivery:**
- Three-screen state machine with View Transition cross-fade
- Welcome screen with logo, octopus, subtitle, puzzle number, inline how-to-play (above Play first-visit, below return-visit, detection via any Clumeral localStorage key)
- Game screen: clues on bare background, digit boxes, keypad, submit, hamburger menu (theme/archive/feedback/HTP)
- Feedback modal: pills, char counter (warns at 400, blocks at 500), metadata line, Google Apps Script submit with retry
- Celebration: octopus + bubbles ~2.6s, skippable, prefers-reduced-motion respected, then completion screen
- Completion: stats (games/win%/streaks), feedback prompt, countdown
- Tailwind v4 with 6 semantic tokens (bg, text, muted, accent, surface, border), `dark:` variants only, green accent only
- Old style.css fully removed; Phase 7 dead-code pass removed letter-reveal system, four orphan sprite icons, duplicate welcome h1, and audited tailwind.css component classes

**Known tech debt** (carried into v1.1 backlog — see `.planning/milestones/v1.0-MILESTONE-AUDIT.md`):
- `modals.ts:188` — `console.error` violates no-console rule
- `screens.ts:54` — orphan `getCurrentScreen` export
- `app.ts:863, 872` — stale comments about modals.ts binding HTP/feedback openers
- `worker/puzzles.ts` — old `--acc` token (out of scope per backend-untouched constraint)
- `docs/DESIGN-SYSTEM.md` — says `@layer base` but `tailwind.css` uses both `@layer theme` and `@layer base`
- Nyquist (Wave-0 validation) non-compliant across all v1.0 phases — pre-Nyquist build, expected

## Current Milestone: v1.1 Design Refinements

**Goal:** Tighten the v1.0 design — layout structure, color contrast, copy clarity, solved-screen flow, menu polish.

**Target items:**
- Footer becomes part of natural document flow (header / content / footer flex with min-h-screen) — no longer fixed-position
- Drop all grey text — pure white-on-dark / black-on-light only
- Header simplified: remove puzzle number
- Burger menu: drop Archive item, drop hover background, hover text uses accent green
- Submit button copy: "Check my guess" → "Submit answer"
- Solved screen: logo + octopus match welcome screen position; on return-visit if today's puzzle is solved, route straight to solved screen; "Show puzzle" + "Archive" links below feedback (1px green underline, 2px bottom padding, no text-decoration); drop "YOUR STATS" section when returning from solved page
- Solved screen copy: "You already solved today's puzzle in 1 try!" → "Solved in N try/ies" (keep tick)
- **Phase 2 (deferred):** clue margin/spacing tightening — review fresh after Phase 1 ships

## Constraints (still in force)

- **Tech stack**: Tailwind CSS, Vite + Cloudflare Workers
- **Backend**: no worker/API changes (frontend-only)
- **Compatibility**: ES2022 target, all current browsers
- **Performance**: celebration must be skippable and under 3s
- **Design**: under 15 semantic colour tokens

## Out of Scope (still in force)

- Share button placeholder — add when feature ships, no greyed-out preview
- Multiple colour themes — deliberately removed to simplify palette
- Toast notification system — how-to-play is inline, not a toast
- Real-time multiplayer / social features
- Worker/API changes
- Component library — only ~3 real components, library adds weight for no value

## Key Decisions (v1.0 outcomes)

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Tailwind from scratch, not migrating old CSS | Clean break avoids fighting legacy patterns | ✓ Good — preflight disabled to coexist; old CSS removed cleanly in Phase 6 |
| No component library | ~3 real components; library = weight for no value | ✓ Good — render-function pattern works at this scale |
| State-driven screens, not URL routes | Matches Wordle, simpler | ✓ Good — `showScreen()` state machine + View Transition fallback |
| Green accent only, drop colour picker | Simplifies UI, collapses palette ~20 → ~6 tokens | ✓ Good — 6 tokens shipped (#0A850A / #1EAD52) |
| How-to-play inline on welcome | Players dismissed popup; inline gets read | ✓ Good — visual HTP with example clue on welcome |
| Feedback modal stays (restyled) | Works well | ✓ Good — Tailwind restyle with fade+scale + toast |
| Guide modal removed | Visual steps inline on welcome read better | ✓ Good — Phase 4 |
| Skippable celebration with onComplete callback | Avoids waiting on animations | ✓ Good — compressed ~6s → ~2.6s, tap-to-skip |
| Phase 7 ran as direct commit (no GSD plan) | Speed over ceremony for dead-code pass | ⚠️ Revisit — required Phase 9 retrofit; future simplify passes should run through `/gsd:plan-phase` |
| Defer FBK-01 completion-screen wiring to Phase 5 | Single-responsibility per phase | ⚠️ Revisit — created a partial requirement that surfaced as audit gap; eventually closed in Phase 8 |

## Context

Pre-redesign Clumeral had grown features (colour swatches, footer links, settings, guide modal) that competed for attention on one page. New players auto-dismissed the how-to-play popup. v1.0 followed daily-puzzle convention: one clear thing per screen.

Issues absorbed: #153 (Tailwind migration), #87 (copyright footer), #127 (bubble effect rework), #189 (HTP toast — superseded by inline). Issues #80, #78, #190 resolved by the new layout.

Backend deliberately untouched: same Cloudflare Workers, same KV cache, same Analytics Engine, same crypto-signed random puzzle tokens.

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-02 — v1.1 Design Refinements milestone started*
