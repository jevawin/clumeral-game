---
phase: 1
slug: data-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-07
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None — static browser app, no build step |
| **Config file** | none |
| **Quick run command** | Open index.html via local HTTP server, check browser console |
| **Full suite command** | Full manual checklist (all 6 DATA requirements) |
| **Estimated runtime** | ~5 minutes manual |

---

## Sampling Rate

- **After every task commit:** Open page in browser via local HTTP server, check browser console
- **After every plan wave:** Full manual checklist (all 6 DATA requirements)
- **Before `/gsd:verify-work`:** All 6 DATA checks pass in browser
- **Max feedback latency:** ~5 minutes

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 1-xx-01 | 01 | 1 | DATA-01 | smoke | Manual: load page, check Network tab shows data.csv fetched | ❌ W0 | ⬜ pending |
| 1-xx-02 | 01 | 1 | DATA-02 | unit | Manual: open devtools console, check `typeof gameRows[0]['Attendance']` | ❌ W0 | ⬜ pending |
| 1-xx-03 | 01 | 1 | DATA-03 | unit | Manual: `console.log(gameHeaders)` — verify no trailing spaces | ❌ W0 | ⬜ pending |
| 1-xx-04 | 01 | 1 | DATA-04 | smoke | Manual: check `gameRows[0]` is a data row, not a header string | ❌ W0 | ⬜ pending |
| 1-xx-05 | 01 | 1 | DATA-05 | smoke | Manual: throttle network to Slow 3G, observe loading indicator | ❌ W0 | ⬜ pending |
| 1-xx-06 | 01 | 1 | DATA-06 | smoke | Manual: rename data.csv, reload page, observe error message | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Create `.planning/phases/01-data-foundation/MANUAL-TEST-CHECKLIST.md` — manual test procedures for all 6 DATA requirements
- [ ] Document local HTTP server requirement (not `file://` direct open) — add as a comment in `index.html` or dev note

*Note: No automated test runner is feasible without adding a build step, which contradicts the locked no-build-step decision. All verification is manual browser inspection.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| data.csv fetched on page load | DATA-01 | No test runner; static app | Load page, open Network tab, confirm data.csv request succeeds |
| Numeric columns are JS numbers | DATA-02 | Browser runtime only | Open devtools console, run `typeof gameRows[0]['Attendance']` — expect "number" |
| All 23 headers have no trailing whitespace | DATA-03 | Browser runtime only | Open console, run `console.log(gameHeaders)`, verify no trailing spaces |
| Row 0 is data (not header string) | DATA-04 | Browser runtime only | Check `gameRows[0]` is an object with numeric keys |
| Loading indicator visible before fetch | DATA-05 | UI behavior, needs throttling | Throttle to Slow 3G in devtools, reload, observe "Loading..." before data appears |
| Error message on fetch failure | DATA-06 | Requires broken environment | Rename data.csv, reload, observe error message in UI (not blank page) |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5 minutes
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
