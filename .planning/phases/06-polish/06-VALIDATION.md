---
phase: 6
slug: polish
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-12
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Manual browser verification (no test framework in project) |
| **Config file** | none |
| **Quick run command** | `npm run build` |
| **Full suite command** | `npm run build && npx tsc --noEmit` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run build`
- **After every plan wave:** Run `npm run build && npx tsc --noEmit`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 06-01-01 | 01 | 1 | STY-06 | build | `npm run build` | ✅ | ⬜ pending |
| 06-01-02 | 01 | 1 | STY-06 | typecheck | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 06-01-03 | 01 | 1 | STY-06 | manual | Browser walkthrough | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. No test framework needed — this phase validates via build success, type checking, and manual visual inspection.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| All screens render correctly in light/dark mode | STY-06 | Visual correctness cannot be automated | Load each screen (welcome, game, completion, modal, menu) in both themes at mobile + desktop viewports |
| Octo animation works (celebration + click replay) | STY-06 | Animation timing/visual quality needs human eye | Complete a puzzle, verify celebration plays, click octo to replay |
| Clue digit indicators display correctly | STY-06 | Small visual elements need pixel-level check | Open game screen with clues, verify digit position indicators render properly |
| No style.css referenced in build output | STY-06 | Build artifact inspection | Check `dist/` output contains no reference to style.css |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
