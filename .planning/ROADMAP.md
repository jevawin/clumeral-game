# Roadmap: Clumeral

## Milestones

- ✅ **v1.0 Clumeral Redesign** — Phases 1-9 (shipped 2026-05-02) — see [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)
- 🚧 **v1.1 Design Refinements** — Phases 1-2 (in progress, started 2026-05-02)

## Phases

<details>
<summary>✅ v1.0 Clumeral Redesign (Phases 1-9) — SHIPPED 2026-05-02</summary>

- [x] Phase 1: Foundation (1/1 plans) — completed 2026-04-11
- [x] Phase 2: Welcome + How-to-Play (1/1 plans) — completed 2026-04-12
- [x] Phase 3: Game Screen + Menu (2/2 plans) — completed 2026-04-12
- [x] Phase 4: Feedback Modal (1/1 plans) — completed 2026-04-12
- [x] Phase 5: Celebration + Completion (2/2 plans) — completed 2026-04-12
- [x] Phase 6: Polish (2/2 plans) — completed 2026-04-15
- [x] Phase 7: Simplify (1/1 plans) — completed 2026-04-21 (artifacts retrofitted via Phase 9)
- [x] Phase 8: Audit Fixes (1/1 plans) — completed 2026-05-01
- [x] Phase 9: Phase 7 Retrofit (1/1 plans) — completed 2026-05-02

</details>

### 🚧 v1.1 Design Refinements (In Progress)

- [ ] **Phase 1: Refinements wave 1** — Layout, color, header, menu, copy, solved-screen behaviour and links (13 requirements)
- [ ] **Phase 2: Clue density** — Reduce clue margin/spacing for more clues per viewport (deferred — review after Phase 1 ships)
- [ ] **Phase 3: URL routing** — Semantic client routes (/welcome, /play, /solved, /archive, /archive/<date>), worker fallback, redirect rules, dated puzzle replay (10 requirements)

## Phase Details

### Phase 1: Refinements wave 1

**Goal:** Ship a cohesive batch of design refinements: footer in document flow, pure foreground colors, simplified header, polished menu, clearer copy, and a richer solved screen with auto-routing for returning solvers.
**Depends on:** Nothing (v1.0 shipped)
**Requirements:** LAY-01, LAY-02, CLR-01, HDR-01, MNU-01, MNU-02, MNU-03, CPY-01, CPY-02, SLV-01, SLV-02, SLV-03, LNK-01
**Success Criteria** (what must be TRUE):

  1. Footer is in document flow — visible at the bottom of short pages and pushed down naturally on long ones; no `position: fixed` on the footer
  2. No grey or muted text appears anywhere — all text is pure white in dark mode and pure black in light mode
  3. Game header no longer shows the puzzle number
  4. Burger menu omits Archive, has no hover background, and changes text to accent green on hover
  5. Submit button reads "Submit answer"; solved-screen copy reads "Solved in N try/ies" with the tick icon retained
  6. Solved screen positions logo + octopus identically to the welcome screen, shows "Show puzzle" + "Archive" links below feedback in the standard green-underline link style, auto-routes returning solvers, and hides the YOUR STATS section when the user navigates back to the puzzle

**Plans:** 4 plans

- [x] 01-01-PLAN.md — Footer in document flow, no muted text anywhere, standard `.link` utility (LAY-01, CLR-01, LNK-01)
- [x] 01-02-PLAN.md — Drop puzzle # from game header; remove Archive item; menu hover is accent text only (HDR-01, MNU-01, MNU-02, MNU-03)
- [x] 01-03-PLAN.md — Submit button reads "Submit answer"; solved subheading reads "Solved in N try/tries" (CPY-01, CPY-02)
- [x] 01-04-PLAN.md — Solved-screen logo+octo parity; Show puzzle + Archive links; auto-route returning solvers; hide YOUR STATS on back-navigation (LAY-02, SLV-01, SLV-02, SLV-03)

**UI hint:** yes

### Phase 2: Clue density

**Goal:** Tighten clue list margin and line spacing so more clues are visible on a single mobile viewport without scrolling, with no loss of legibility or tap-target size.
**Depends on:** Phase 1
**Requirements:** DEN-01
**Success Criteria** (what must be TRUE):

  1. On a 375px-wide mobile viewport, more clues are visible above the fold than in the v1.0 baseline
  2. Tap targets for digit elimination remain at or above the v1.0 size
  3. No visual regression in the typography hierarchy (clue label vs body)

**Plans:** TBD (run `/gsd:plan-phase 2`)
**UI hint:** yes

### Phase 3: URL routing

**Goal:** Replace the single-route SPA shell with semantic client routes so the address bar reflects state (welcome / play / solved / archive / dated puzzle), share links land users in the right place, and browser back/forward feels natural — without changing the underlying screens architecture.
**Depends on:** Phase 1
**Requirements:** RTE-01, RTE-02, RTE-03, ARC-01, ARC-02, ARC-03, POL-01, POL-02, POL-03, POL-04
**Success Criteria** (what must be TRUE):

  1. The address bar shows `/welcome`, `/play`, `/solved`, `/archive`, or `/archive/<YYYY-MM-DD>` matching the active screen — never just `/`.
  2. Refreshing or sharing any of those URLs lands the user on the correct screen (subject to redirect rules below); deep links never 404.
  3. Redirects: `/play` for a user with no onboarding → `/welcome`; `/play` for today already solved → `/solved`; `/solved` with no/stale history → `/welcome`; invalid or future `/archive/<date>` → `/archive`. Stale-day check fires on focus/visibility, not while the user is mid-interaction.
  4. Solving a puzzle uses `replaceState` (not `pushState`) so browser back from `/solved` skips the finished puzzle and lands on `/welcome`.
  5. `/archive/<YYYY-MM-DD>` for today links its solved view back to `/solved`; for any other date it links back to `/archive`.
  6. Each route sets a route-specific `<title>`; route changes emit a `route_change` analytics event with the path; `history.scrollRestoration` is set to `manual` once at boot.
  7. The existing `/puzzles` archive list is renamed to `/archive` (one redirect kept for back-compat) and `/random` is unchanged.

**Plans:** 6 plans

- [x] 03-01-PLAN.md — Wave 0: install vitest+jsdom, scaffold red specs (infra)
- [x] 03-02-PLAN.md — Wave 1: pure resolveRoute() + tests (RTE-03, ARC-03)
- [x] 03-03-PLAN.md — Wave 1: src/router.ts navigate/replaceRoute/initRouter + popstate + stale-day (RTE-01, POL-01..04)
- [x] 03-04-PLAN.md — Wave 2: wire router into src/app.ts + welcome.ts; replaceRoute on solve (RTE-01, RTE-03, POL-04)
- [x] 03-05-PLAN.md — Wave 2: worker rename /puzzles → /archive, 302s, SPA fallback, route_change allowlist (RTE-02, ARC-01, POL-02)
- [x] 03-06-PLAN.md — Wave 2: completion-screen back-links date-aware; replace /puzzles with /archive (ARC-02)

**UI hint:** no (no new visuals — pure routing/structure change)

## Backlog

- **Notification / message component** — Design a fixed (non-toast) inline message style and apply it to the archived-puzzle indicator on the game screen. Current implementation is a small text banner above the clue list — easy to miss. Likely uses: archived-puzzle indicator, stale-day warning, "puzzle of the day refreshed" cue. Surfaced from preview testing 2026-05-04 during phase 3 verification.

### Phase 5: Timezone + state-persistence bug cluster — fix #205 (reset at midnight Europe/London + puzzleNumber timezone), #206 (persist mid-game state across reload), #209 (streak under-counting). Shared root cause: date keyed UTC on write vs local on read

**Goal:** Establish one canonical client-side "puzzle day" (each user's local midnight, Wordle-style) so all date keying is consistent, then heal the three downstream symptoms: the daily puzzle resets at the player's local midnight (the worker no longer rejects a valid local "today"), mid-game progress survives reload, and the streak counts consecutive local days without phantom gaps.
**Depends on:** Phase 4
**Requirements:** none mapped (driven by CONTEXT decisions D-01..D-08; correctness fix, no new REQ IDs)
**Success Criteria** (what must be TRUE):

  1. A single client date module (`src/date.ts`) is the only source of "today" / puzzle-number on the client; `app.ts` and `welcome.ts` import it and define no duplicate date helpers (D-01, D-02, D-03).
  2. The worker accepts a local-midnight player's date up to one day ahead of its UTC clock and still rejects true-future dates; today's answer stays protected; no API shape change (D-04, D-05; fixes #205).
  3. A daily puzzle in progress is restored exactly on reload — eliminated digits, wrong guesses, active keypad box, and last feedback — with clues re-fetched fresh; saved state clears on solve and on day rollover; random/archive replays never persist (D-06, D-07, D-08; fixes #206).
  4. The streak counts consecutive local days, stays alive when today is unplayed, breaks on a real gap, and ignores same-day duplicates (fixes #209).
  5. Restored localStorage state is validated (version, date, shape, size) and fails safe to a fresh game on any malformed/stale payload — never crashes, never trusts persisted clues.

**Plans:** 5/5 plans complete

Plans:

**Wave 1**

- [x] 05-01-PLAN.md — Wave 1: shared `src/date.ts` (todayKey/puzzleNumberFor/localDateKey/formatDate) + tests (D-01, D-02, D-03)
- [x] 05-03-PLAN.md — Wave 1: worker future-guard widening via pure `src/worker/date-guard.ts` + tests; /solution untouched (D-04, D-05; #205)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 05-02-PLAN.md — Wave 2: de-dup client consumers — app.ts + welcome.ts import date.ts, delete duplicate helpers, formatDate-local (D-01, D-02, D-03)
- [x] 05-04-PLAN.md — Wave 2: mid-game persistence storage — ActiveState type + saveActive/loadActive/clearActive under dlng_active, fail-safe loader + tests (D-06, D-07)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 05-05-PLAN.md — Wave 3: app.ts save/clear/restore hooks (daily-only) + computeStats streak verify/test (D-06, D-07, D-08; #206, #209)

**UI hint:** no (correctness fix — no new visuals)

### Phase 6: Add 'Guess the number from 100-999' copy to welcome + play screens (#207)

**Goal:** Players see an explicit “Work out the number from 100–999” line on the welcome screen and a “Work out the number from 100–999. Clues:” line heading the clue list on the game screen, matching the shipped meta/OG wording.
**Requirements**: TBD
**Depends on:** Phase 5
**Plans:** 1 plan

Plans:

- [ ] 06-01-PLAN.md — Add range-copy line to welcome (above Play button) and play (above clue list) screens

### Phase 7: Archive replay: keep header date + Archive button visible so user can exit without solving (#208)

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 6
**Plans:** 0 plans

Plans:

- [ ] TBD (run /gsd:plan-phase 7 to break down)

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|---------------:|--------|-----------|
| 1. Refinements wave 1 | v1.1 | 4/4 | Complete | 2026-05-02 |
| 2. Clue density | v1.1 | 0/0 | Deferred | — |
| 3. URL routing | v1.1 | 6/6 | Complete | 2026-05-04 |
| 5. Timezone + state-persistence | v1.1 | 5/5 | Complete    | 2026-05-30 |

---
*Last updated: 2026-05-29 — Phase 5 planned (5 plans, 3 waves; timezone + state-persistence bug cluster)*
