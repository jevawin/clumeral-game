---
phase: 7
slug: archive-replay-keep-header-date-archive-button-visible-so-us
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-30
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None — no automated test runner in project |
| **Config file** | none |
| **Quick run command** | `npm run build` (type-check + bundle; catches TS/compile regressions) |
| **Full suite command** | `npm run build` then manual verify (see Manual-Only) |
| **Estimated runtime** | ~10–20 seconds for build |

---

## Sampling Rate

- **After every task commit:** Run `npm run build` — must compile clean (no TS errors).
- **After every plan wave:** Run `npm run build` + the relevant manual verify steps.
- **Before `/gsd-verify-work`:** Build green AND all manual verify steps pass on both breakpoints.
- **Max feedback latency:** ~20 seconds (build) + manual pass.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 07-01-* | 01 | 1 | AC1 (date+CTA visible before/during/after solve) | — | N/A | manual + build | `npm run build` | ✅ | ⬜ pending |
| 07-01-* | 01 | 1 | AC2 (mobile + desktop parity) | — | N/A | manual | n/a (viewport check) | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*None — existing build pipeline covers compile-time verification. This is a frontend bug fix in `src/app.ts`; no new test infrastructure is warranted (project has no UI test runner and adding one is out of scope per `CLAUDE.md` frontend-only constraint).*

---

## Manual-Only Verifications

The project has no automated UI test runner. All behavioral acceptance is manual. These steps must pass before merge.

**Setup:** Open `/archive`, pick a date, cold-load `/archive/YYYY-MM-DD`.

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Banner + Archive button visible on cold load (unsolved) | AC1 | No UI test runner | Cold load `/archive/YYYY-MM-DD` → archive banner + Archive button both visible at top |
| Stay visible during play | AC1 | DOM/interaction state | Eliminate some digits → banner + Archive button still visible |
| Brand button does not strand user | AC1 | Navigation/route behavior | Tap Clumeral logo → goes to archive list (`/archive`), NOT a stranded `/play` game screen with hidden archive context |
| Stay visible after solve | AC1 | Post-solve render path | Solve puzzle → banner still visible; Archive/Today links present in stats area |
| Already-solved archive puzzle | AC1 | Cold-load history branch | Cold load an archive date already in history → banner + Archive button visible, "Solved in N tries" shown |
| Mobile parity (375px) | AC2 | Viewport-dependent layout | Repeat all above at 375px width → identical results |
| Desktop parity (1280px) | AC2 | Viewport-dependent layout | Repeat all above at 1280px width → identical results |
| Daily puzzle unaffected | AC1 (regression guard) | Cross-mode regression | Load today's `/play` → NO archive banner shown (stays hidden); normal flow intact |

---

## Validation Sign-Off

- [ ] Build green (`npm run build`) after every task
- [ ] All 8 manual verify rows pass on both breakpoints
- [ ] Daily-puzzle regression guard passes (no archive banner on today's `/play`)
- [ ] No watch-mode flags
- [ ] `nyquist_compliant: true` set once manual matrix is defined in plans

**Approval:** pending
