---
phase: 1
slug: foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-11
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Manual + Vite dev server |
| **Config file** | vite.config.ts |
| **Quick run command** | `npm run build` |
| **Full suite command** | `npm run build && npm run dev` (visual check) |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run build`
- **After every plan wave:** Run `npm run build && npm run dev` (visual check)
- **Before `/gsd:verify-work`:** Full build must succeed, dev server must render all screens
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | STY-01 | build | `npm run build` | N/A | ⬜ pending |
| 01-01-02 | 01 | 1 | STY-02 | build + grep | `grep '@theme' src/styles.css` | N/A | ⬜ pending |
| 01-01-03 | 01 | 1 | STY-03, STY-04 | build + grep | `grep 'dark:' src/*.ts` | N/A | ⬜ pending |
| 01-02-01 | 02 | 1 | SCR-01, SCR-02, SCR-03 | build + visual | `npm run build` | N/A | ⬜ pending |
| 01-02-02 | 02 | 1 | FTR-01, FTR-02 | visual | dev server check | N/A | ⬜ pending |
| 01-03-01 | 03 | 2 | STY-05 | grep | `grep 'Made with' src/*.ts` | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements. Tailwind v4 install is part of Phase 1 tasks, not a separate Wave 0.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Cross-fade transition between screens | SCR-02 | CSS animation quality is visual | Switch between screens in dev server, verify smooth opacity transition |
| Dark mode colour accuracy | STY-03, STY-04 | Exact colour rendering needs visual check | Toggle dark mode, compare backgrounds against #FAFAFA / #121213 |
| Footer appears on all screens | FTR-01 | Layout position across screens | Navigate all three screens, verify footer visible |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
