---
phase: 4
slug: feedback-modal
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-12
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None — manual browser testing only |
| **Config file** | none |
| **Quick run command** | `npm run dev` and open browser |
| **Full suite command** | n/a |
| **Estimated runtime** | ~30 seconds (visual inspection) |

---

## Sampling Rate

- **After every task commit:** Visual inspection in dev browser (dark and light mode)
- **After every plan wave:** Full manual walkthrough of modal open → fill → submit flow
- **Before `/gsd:verify-work`:** All 5 FBK requirements visually confirmed
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | FBK-01 | manual | — | n/a | ⬜ pending |
| 04-01-02 | 01 | 1 | FBK-02 | manual | — | n/a | ⬜ pending |
| 04-01-03 | 01 | 1 | FBK-03 | manual | — | n/a | ⬜ pending |
| 04-01-04 | 01 | 1 | FBK-04 | manual | — | n/a | ⬜ pending |
| 04-01-05 | 01 | 1 | FBK-05 | manual | — | n/a | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. No automated test framework needed — this is a markup-and-styling migration validated by visual inspection.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Clicking feedback button in game menu opens modal | FBK-01 | UI interaction — no test framework | 1. Open dev server 2. Click game menu 3. Click feedback button 4. Verify modal opens with backdrop |
| Category pill selection toggles accent fill | FBK-02 | Visual state change + ARIA | 1. Open feedback modal 2. Click each category pill 3. Verify accent fill on selected, border-only on others 4. Check `aria-checked` toggles |
| Textarea warns at 400 chars, blocks at 500 | FBK-03 | Character counter behaviour | 1. Open feedback modal 2. Type 400+ chars 3. Verify counter shows warn colour 4. Type to 500 chars 5. Verify input blocked |
| Metadata line shows puzzle/date/device/browser | FBK-04 | Dynamic content rendering | 1. Open feedback modal 2. Read metadata line 3. Verify puzzle number, date, device, browser are correct |
| Submit posts to GAS endpoint with retry | FBK-05 | Network request + toast | 1. Fill feedback form 2. Click send 3. Verify toast appears 4. Check Network tab for GAS request |

---

## Validation Sign-Off

- [ ] All tasks have manual verify instructions
- [ ] Sampling continuity: visual check after every task commit
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
