---
phase: 2
slug: welcome-how-to-play
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-11
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None — no test runner in project |
| **Config file** | none |
| **Quick run command** | n/a |
| **Full suite command** | n/a |
| **Estimated runtime** | n/a |

---

## Sampling Rate

- **After every task commit:** Manual browser check (load page, inspect DOM)
- **After every plan wave:** Full manual walkthrough (both first-visit and return-visit flows)
- **Before `/gsd:verify-work`:** Full manual walkthrough must pass
- **Max feedback latency:** ~10 seconds (page reload)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | WEL-01 | manual | — | n/a | ⬜ pending |
| 02-01-02 | 01 | 1 | WEL-02 | manual | — | n/a | ⬜ pending |
| 02-01-03 | 01 | 1 | WEL-03 | manual | — | n/a | ⬜ pending |
| 02-01-04 | 01 | 1 | WEL-04 | manual | — | n/a | ⬜ pending |
| 02-01-05 | 01 | 1 | HTP-01 | manual | — | n/a | ⬜ pending |
| 02-01-06 | 01 | 1 | HTP-02 | manual | — | n/a | ⬜ pending |
| 02-01-07 | 01 | 1 | HTP-03 | manual | — | n/a | ⬜ pending |
| 02-01-08 | 01 | 1 | HTP-04 | manual | — | n/a | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements — no test runner exists in the project and setting one up is out of scope for this phase. Manual browser testing is the verification method.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Logo h1 and octopus SVG visible | WEL-01 | No test infra; visual check | Load page, confirm `<h1>Clumeral</h1>` and octopus SVG visible in welcome screen |
| Subtitle and puzzle number | WEL-02 | No test infra; visual check | Load page, confirm "A daily number puzzle" and "Puzzle #N" (N > 0) visible |
| Play button transitions to game | WEL-03 | No test infra; interaction check | Tap/click Play, confirm game screen appears |
| Welcome shows every visit | WEL-04 | No test infra; flow check | Reload page after playing, confirm welcome screen shown again |
| HTP inline (not modal) | HTP-01 | No test infra; visual check | Load page, confirm 3 numbered steps visible in welcome section (not a modal overlay) |
| HTP above Play on first visit | HTP-02 | No test infra; state-dependent | Clear localStorage, reload, confirm HTP steps appear above Play button |
| HTP below Play on return visit | HTP-03 | No test infra; state-dependent | Set `dlng_history` in localStorage, reload, confirm HTP steps appear below Play button |
| Detection uses dlng_history key | HTP-04 | No test infra; state-dependent | Set only `dlng_history` (no other keys), reload, confirm return-visit layout |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
