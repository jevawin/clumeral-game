---
phase: 3
slug: game-screen-menu
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-12
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Manual browser testing + dev server |
| **Config file** | vite.config.ts |
| **Quick run command** | `npm run dev` + browser verification |
| **Full suite command** | `npm run build && npm run dev` |
| **Estimated runtime** | ~10 seconds (build) |

---

## Sampling Rate

- **After every task commit:** Run `npm run build` (catches type errors, import issues)
- **After every plan wave:** Full build + manual browser test of game flow
- **Before `/gsd:verify-work`:** Full build clean + all game flows tested in browser
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | GAM-01 | build + manual | `npm run build` | ✅ | ⬜ pending |
| 03-01-02 | 01 | 1 | GAM-02 | build + manual | `npm run build` | ✅ | ⬜ pending |
| 03-01-03 | 01 | 1 | GAM-03 | build + manual | `npm run build` | ✅ | ⬜ pending |
| 03-01-04 | 01 | 1 | GAM-04 | build + manual | `npm run build` | ✅ | ⬜ pending |
| 03-01-05 | 01 | 1 | GAM-05 | build + manual | `npm run build` | ✅ | ⬜ pending |
| 03-01-06 | 01 | 1 | GAM-06 | build + manual | `npm run build` | ✅ | ⬜ pending |
| 03-01-07 | 01 | 1 | MNU-01 | build + manual | `npm run build` | ✅ | ⬜ pending |
| 03-01-08 | 01 | 1 | MNU-02 | build + manual | `npm run build` | ✅ | ⬜ pending |
| 03-01-09 | 01 | 1 | MNU-03 | build + manual | `npm run build` | ✅ | ⬜ pending |
| 03-01-10 | 01 | 1 | MNU-04 | build + manual | `npm run build` | ✅ | ⬜ pending |
| 03-01-11 | 01 | 1 | MNU-05 | build + manual | `npm run build` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. `npm run build` catches TypeScript errors and import issues. No test framework needed — this is a frontend UI migration verified by build + browser.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Clues render without card wrapper | GAM-01 | Visual layout check | Load daily puzzle, verify clues display directly on background |
| Digit boxes accept input | GAM-02 | Interactive UI | Tap digit boxes, verify number pad appears and digits toggle |
| Digit elimination from clues | GAM-03 | Interactive UI | Tap digits in clue indicators, verify elimination works |
| Guess submission + validation | GAM-04 | End-to-end with worker | Submit a guess, verify server response and feedback display |
| Random/archive modes | GAM-05 | Multi-flow test | Navigate to random puzzle and archive replay, verify game loads |
| Menu items functional | MNU-01–05 | Interactive UI | Open hamburger menu, test each item (theme toggle, archive, feedback, HTP) |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
