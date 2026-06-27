# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — Clumeral Redesign

**Shipped:** 2026-05-02
**Phases:** 9 | **Plans:** 12 | **Tasks:** 24
**Timeline:** 2026-04-11 → 2026-05-02 (22 days)
**Git:** 114 commits, 91 files changed, +15,405 / -2,727 LOC

### What Was Built

- Three-screen state machine (welcome / game / completion) with View Transition cross-fade and reduced-motion fallback
- Welcome screen with logo, octopus mascot, inline how-to-play that reorders by first-vs-return visit (six-key Clumeral localStorage detection)
- Game screen rebuilt: clues on bare background, digit boxes, keypad, submit, sticky header with hamburger menu (theme/archive/feedback/HTP)
- Tailwind v4 from scratch: 6 semantic tokens (`bg`, `text`, `muted`, `accent`, `surface`, `border`), `dark:` variants only, green accent (#0A850A / #1EAD52), no `color-mix()` or `light-dark()`
- Feedback modal: pills, char counter (warns 400, blocks 500), metadata line, Google Apps Script submit with retry, bottom-centre toast
- Octopus celebration compressed ~6s → ~2.6s, skip-on-tap, `prefers-reduced-motion` honoured, then cross-fade to completion screen
- Completion screen with stats (games played, win %, current/max streak), feedback prompt, countdown
- Old style.css fully removed; Phase 7 dead-code pass cut letter-reveal system, four orphan sprite icons, duplicate welcome h1, audited tailwind.css component classes
- Phase 8 closed audit gaps (`[data-plabel]` absent, replay routing, dead `[data-fb-header-btn]` query)
- Phase 9 retroactively produced GSD artifacts for Phase 7 (Phase 7 had bypassed the workflow)

### What Worked

- **Wave-based execution** — most phases were 1-2 plans deep; parallel-safe waves rare but kept orchestrator context lean (~10–15%)
- **Verification-driven gap closure** — the v1.0 milestone audit caught GAM-01/GAM-06/FBK-01 as partial-not-broken, closed cleanly in a single Phase 8
- **Tailwind from scratch (not migration)** — clean break avoided fighting legacy CSS patterns; preflight disabled to coexist during migration window
- **State-driven screens, not URL routes** — `showScreen()` pattern matched Wordle convention and stayed simple; integration checker found zero broken flows
- **Backend-untouched constraint** — kept scope honest, prevented mission creep into worker code
- **Preview-mode UAT automation** (Phase 8) — all 7 E2E flows confirmed in browser without manual testing churn

### What Was Inefficient

- **Phase 7 ran as a direct commit, no GSD plan** — saved ceremony in the moment but cost a full retrofit phase (Phase 9) to backfill SUMMARY/VERIFICATION/VALIDATION when the v1.0 audit found the artifact gap. Net-negative trade.
- **REQUIREMENTS.md checkbox + traceability drift** — phases passed verification but the requirements doc wasn't synced; flagged twice (audit + pre-archive). The `/gsd-transition` step was skipped or under-utilised.
- **FBK-01 deferred-by-design** — Phase 4 explicitly scoped completion-screen wiring to Phase 5, but the requirement was logged as partial across two phases and resurfaced as a Phase 8 audit fix. A single-phase-completes-the-requirement rule would have avoided this.
- **Three rounds of audit/fix on Phase 7** — direct commit → audit flags missing artifacts → Phase 8 fixes code → Phase 9 fixes docs. Could have been one Phase 7 done correctly.

### Patterns Established

- **Per-plan SUMMARY frontmatter must list `requirements-completed`** — early phases (01, 02, 04, 06-02) shipped without it, which forced manual reconstruction during audit
- **Direct commits should still produce a SUMMARY** — even when skipping `/gsd-plan-phase`, leaving the artifact behind avoids retrofit cost
- **Audit before archive** — `/gsd-audit-milestone` before `/gsd-complete-milestone` caught real partial requirements that the per-phase verifications had passed
- **Preview-mode automation > manual UAT** — for visual/flow verification, scripted browser automation produced higher-confidence sign-off than manual checklists
- **One requirement, one phase** — splitting a single REQ across phases (FBK-01 in Phases 4 + 5) creates partial-state confusion

### Key Lessons

1. **Don't bypass GSD for "small" passes.** Phase 7 felt like a quick dead-code sweep; it cost a full retrofit phase later. The artifact discipline pays its own cost in audit time.
2. **Run `/gsd-audit-milestone` before declaring done.** v1.0 audit found 4 partial requirements that all per-phase verifications had passed. Audit's job is to catch what passes individually but fails together.
3. **Sync REQUIREMENTS.md after every phase.** Stale checkboxes and traceability rows compound and require pre-archive cleanup. `/gsd-transition` should be the default chase-step.
4. **Preview-mode automation is the right tool for UI sign-off.** Saved an entire round of human UAT churn in Phase 8.
5. **Defer requirements deliberately, not implicitly.** If a requirement spans phases, name it explicitly in both phase plans and mark partial-by-design in the requirement.

### Cost Observations

- Model mix: not tracked per-phase (no telemetry log); profile = `inherit` (default mix of opus + sonnet)
- Sessions: 11 phase execution sessions + audit/retrofit sessions
- Notable: Phase 8 + Phase 9 (~3 sessions combined) were directly caused by Phase 7 bypassing GSD — the cost of skipping process

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Shipped | Phases | Plans | Notable Process Change |
|-----------|---------|-------:|------:|------------------------|
| v1.0 | 2026-05-02 | 9 | 12 | First milestone — established GSD discipline, learned cost of bypassing it (Phase 7 → Phase 9 retrofit) |

### Recurring Wins

- Wave-based execution kept orchestrator context lean
- Tailwind-from-scratch (vs migration) decision held up across all 9 phases

### Recurring Issues

- REQUIREMENTS.md sync drift (only one milestone, but appeared twice within v1.0 — flag for v1.1 watch)
- Cross-phase partial requirements (FBK-01) created confusion — single-phase-completes-requirement rule pending validation in v1.1
