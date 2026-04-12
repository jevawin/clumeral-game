---
phase: 5
slug: celebration-completion
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-12
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None — no test framework installed |
| **Config file** | none |
| **Quick run command** | `npx tsc --noEmit` |
| **Full suite command** | `npx tsc --noEmit && npm run build` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx tsc --noEmit`
- **After every plan wave:** Run `npx tsc --noEmit && npm run build`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 05-01-01 | 01 | 1 | CEL-01 | manual | `npx tsc --noEmit` | N/A | ⬜ pending |
| 05-01-02 | 01 | 1 | CEL-02 | manual | `npx tsc --noEmit` | N/A | ⬜ pending |
| 05-01-03 | 01 | 1 | CEL-03 | manual | `npx tsc --noEmit` | N/A | ⬜ pending |
| 05-02-01 | 02 | 2 | CMP-01 | manual | `npx tsc --noEmit` | N/A | ⬜ pending |
| 05-02-02 | 02 | 2 | CMP-02 | manual | `npx tsc --noEmit` | N/A | ⬜ pending |
| 05-02-03 | 02 | 2 | CMP-03 | manual | `npx tsc --noEmit` | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. No test framework needed — all requirements are DOM/animation-based and verified manually + TypeScript compilation.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Octopus swims up with bubbles ~3s | CEL-01 | Canvas animation, no DOM assertion possible | Solve puzzle, observe octo flies up with bubbles, completes in ~3s |
| Completion screen appears after celebration | CEL-02 | Timing-dependent transition | Solve puzzle, wait for celebration to end, verify completion screen shows |
| Reduced motion skips celebration | CEL-03 | Requires OS/browser media query toggle | Enable prefers-reduced-motion in devtools, solve puzzle, verify direct fade to completion |
| Stats display correct values | CMP-01 | Requires localStorage state setup | Play multiple games, verify played/avg tries/streak/max streak match history |
| Feedback button opens modal | CMP-02 | UI interaction chain | Solve puzzle, reach completion, tap feedback button, verify modal opens |
| Stats read from localStorage | CMP-03 | Requires inspecting localStorage | Check localStorage history entries match displayed stats |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
