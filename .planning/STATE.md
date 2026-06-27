---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: Design Refinements
status: verifying
stopped_at: Phase 7 complete — verified (Task 3 matrix 16/16)
last_updated: "2026-05-31T00:00:00.000Z"
last_activity: 2026-05-31
progress:
  total_phases: 6
  completed_phases: 5
  total_plans: 17
  completed_plans: 17
  percent: 83
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-02)

**Core value:** The game screen works flawlessly — clues, digit elimination, guess submission, and answer validation behave exactly as they always did, in a cleaner, calmer layout.
**Current focus:** Phase 07 — archive-replay-keep-header-date-archive-button-visible-so-us

## Current Position

Phase: 07 (archive-replay-keep-header-date-archive-button-visible-so-us) — COMPLETE
Plan: 1 of 1
Status: Phase 7 complete + pushed to new-design — phase-level PR deferred (ships with v1.1 milestone PR to main)
Last activity: 2026-06-07 - Completed quick task 260607-df0: fix streak/best-streak under-counting from unsorted history

Progress: [██████████] 100%

## Performance Metrics

**Velocity:**

- Total plans completed (v1.1): 10
- Average duration: ~5 min/plan (executor)
- Total execution time: not tracked

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 05 | 5 | - | - |

**Recent Trend:**

- Last 5 plans: —
- Trend: —

*Updated after each plan completion*
| Phase 01-refinements-wave-1 P01 | 3m | 2 tasks | 5 files |
| Phase 01-refinements-wave-1 P03 | 1 min | 1 tasks | 2 files |
| Phase 01-refinements-wave-1 P02 | 1 min | 2 tasks | 2 files |
| Phase 01-refinements-wave-1 P04 | 4 min | 2 tasks tasks | 3 files files |
| Phase 07-archive-replay-keep-header-date-archive-button-visible-so-us P01 | 10min | 2 tasks | 2 files |

## Accumulated Context

### Roadmap Evolution

- v1.1 milestone added (2026-05-02): Design Refinements — 2 phases. Phase 1 batches 13 design items. Phase 2 deferred clue density review.
- Phase 3 added (2026-05-03): URL routing — semantic client routes (/welcome, /play, /solved, /archive, /archive/<date>) with worker fallback, redirect rules, and dated puzzle replay. Decided to ship under v1.1 rather than spin up v1.2.
- Phase 5 added (2026-05-29): Timezone + state-persistence bug cluster — fix #205 (reset at midnight Europe/London + puzzleNumber timezone), #206 (persist mid-game state across reload), #209 (streak under-counting). Shared root cause suspected: date keyed UTC on write vs local on read. P1 bugs.
- Phase 6 added (2026-05-29): Add 'Guess the number from 100-999' copy to welcome + play screens (#207). P2 UX.
- Phase 7 added (2026-05-29): Archive replay header CTAs stay visible so user can exit without solving (#208). P3 bug.

### Decisions

Decisions are logged in PROJECT.md Key Decisions table. v1.0 decisions remain in force (Tailwind-from-scratch, no component library, state-driven screens, green accent only).

v1.1 starting decisions:

- Phase numbering reset to 1 for v1.1 (--reset-phase-numbers used)
- v1.0 phase directories archived to .planning/milestones/v1.0-phases/
- [Phase 01-refinements-wave-1]: Keep --color-muted token in @theme — feedback modal and burger menu still consume it; only utility usages purged in plan-scoped files.
- [Phase 01-refinements-wave-1]: Use mt-auto on footer rather than flex-1 alone — defensive guarantee that footer pins to bottom on short pages.
- [Phase 01-refinements-wave-1]: Use logical properties (border-block-end, padding-block-end) in .link for future RTL safety.
- [Phase 01-refinements-wave-1]: Leave dom.plabel cache + writers in src/app.ts intact — null-safe writes silently no-op; deferred dead-code cleanup avoids unrelated diff in this plan.
- [Phase 01-refinements-wave-1]: CPY-02 drops the trailing period — REQUIREMENTS.md quotes 'Solved in N try' / 'Solved in N tries' verbatim with no full stop.
- [Phase 01-refinements-wave-1]: Leave src/app.ts showCompletedState 'You already solved...' inline copy untouched in Plan 03 — Plan 04 SLV-02 makes that path unreachable on init by auto-routing solved returners to the completion screen.
- [Phase 01-refinements-wave-1]: Use menu-item class hook + scoped [data-menu] .menu-item svg { color: inherit } so hover accent flows to icons via existing currentColor sprite paths.
- [Phase 01-refinements-wave-1]: Plan 04 — Solved screen uses pre-render before initScreens to avoid flash on returning-solver auto-route; todayEntry() is synchronous (localStorage).
- [Phase 01-refinements-wave-1]: Plan 04 — Cross-screen state mutation (suppressStats) stays in app.ts; completion.ts dispatches a document CustomEvent (completion:show-puzzle) so stats ownership is not split across modules.
- [Phase 01-refinements-wave-1]: Plan 04 — Decorative octo SVG copied with mask id renamed to completion-octo-mask; both screens live in DOM simultaneously, so duplicate ids would be invalid.
- [Phase ?]: archive exit routing
- [Phase ?]: archive-row visibility anchor

### Pending Todos

None.

### Blockers/Concerns

None.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260531-nua | Remove range + "Clues:" copy from play screen | 2026-05-31 | 7abc418 | [260531-nua-remove-range-clues-copy-from-play-screen](./quick/260531-nua-remove-range-clues-copy-from-play-screen/) |
| 260531-qjn | Docs cleanup (#215): thin CLAUDE.md to rules + pointers, refresh stale README structure | 2026-05-31 | 7434e9a | [260531-qjn-docs-cleanup-thin-claude-md-to-rules-poi](./quick/260531-qjn-docs-cleanup-thin-claude-md-to-rules-poi/) |
| 260531-vwi | Remove nav from brand; tapping octopus logo / "Clumeral" wordmark bounces the logo | 2026-05-31 | 2302079 | [260531-vwi-remove-nav-from-brand-bounce-octopus-log](./quick/260531-vwi-remove-nav-from-brand-bounce-octopus-log/) |
| 260601-auy | Fix midnight date divergence (UTC vs local) + stale archive brand link | 2026-06-01 | 60b8c9f | [260601-auy-midnight-date-divergence](./quick/260601-auy-midnight-date-divergence/) |
| 260601-bva | Fix PWA stale-asset / unstyled-stacked render on iOS resume after deploy (precache bundles + catch fallback + capped reload guard) | 2026-06-01 | 9d91fd7 | [260601-bva-fix-pwa-stale-asset-unstyled-stacked-ren](./quick/260601-bva-fix-pwa-stale-asset-unstyled-stacked-ren/) |
| 260601-dcx | Attach browser diagnostics (localStorage dump + tzOffset + localToday + screen) to feedback POST for debugging | 2026-06-01 | fb5c13b | [260601-dcx-feedback-debug-payload](./quick/260601-dcx-feedback-debug-payload/) |
| 260607-df0 | Fix streak/best-streak under-counting — computeStats sorts a copy of history before the walk + recency gate; recordGame sorts on write (root cause of friend's "Streak 5 / Best 16" on a 25-day run) | 2026-06-07 | c7e4f36 | [260607-df0-fix-streak-best-streak-under-counting-fr](./quick/260607-df0-fix-streak-best-streak-under-counting-fr/) |
| 260608-wyy | Fix archived solves inflating daily stats — tag archive solves `archived: true` in dlng_history; computeStats excludes tagged entries from all four stats (Played, Avg, Streak, Best). Replay detection + archive Tries column still read raw history by date (friend's "archive affects streak") | 2026-06-08 | 0c033c0 | [260608-wyy-fix-archive-solves-affecting-daily-stats](./quick/260608-wyy-fix-archive-solves-affecting-daily-stats/) |
| 260609-0tc | #219 hundreds-box 0 explainer — tapping the disabled 0 shows the (i)-style tooltip "first digit can't be 0"; extracted generic `showTip()`, made the 0 `aria-disabled` (not native) so it's tappable. DA review fixes: close tip before keypad rebuild (leak), no `aria-pressed` on the explainer | 2026-06-09 | 956fc99 | [260609-0tc-issue-219-hundreds-box-zero-tooltip](./quick/260609-0tc-issue-219-hundreds-box-zero-tooltip/) |
| 260627-pog | Cross-origin localStorage migration page at `/migrate` — standalone static page (outside SPA router) to carry a player's `dlng_*` data from the leftover `new-design` preview origin to clumeral.com. Export reads the 5 migratable keys (skips `dlng_uid`/`dlng_last_visit_date`), import writes via allowlist; payload in URL fragment so it stays out of CF logs. PR [#230](https://github.com/jevawin/clumeral-game/pull/230) → staging. **Deploy needs both origins:** main + a recreated `new-design` branch | 2026-06-27 | a843783 | [260627-pog-build-cross-origin-localstorage-migratio](./quick/260627-pog-build-cross-origin-localstorage-migratio/) |

## Session Continuity

Last session: 2026-05-30T22:08:42.020Z
Stopped at: Phase 6 context gathered
Resume file: None
