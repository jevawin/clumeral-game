---
phase: 2
slug: filtering-engine
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-07
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None — static browser app; no test runner |
| **Config file** | None |
| **Quick run command** | Browser console: `runFilterLoop(gameRows)` — verify output shape |
| **Full suite command** | Browser console stress test: 50-iteration loop (see Per-Task map) |
| **Estimated runtime** | ~30 seconds (manual browser steps) |

---

## Sampling Rate

- **After every task commit:** Run `runFilterLoop(gameRows)` in browser console — confirm `{ answer, clues }` shape
- **After every plan wave:** Run 50-iteration stress test + FILT-08 single-row test
- **Before `/gsd:verify-work`:** All 10 FILT manual checks pass
- **Max feedback latency:** ~30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 2-01-01 | 01 | 0 | FILT-01 | unit (manual) | `console.log(RANGE_GROUPS)` — confirm 6 groups with correct indices | ❌ Wave 0 | ⬜ pending |
| 2-01-02 | 01 | 1 | FILT-02, FILT-03 | smoke | `runFilterLoop(gameRows)` — confirm output shape, run 10x for randomness | ❌ Wave 0 | ⬜ pending |
| 2-01-03 | 01 | 1 | FILT-04 | unit (manual) | Inspect `clue.operator` — text cols show `=`/`!=` only | ❌ Wave 0 | ⬜ pending |
| 2-01-04 | 01 | 1 | FILT-05, FILT-06 | smoke | Run with filtered subset where one col is uniform; confirm loop continues | ❌ Wave 0 | ⬜ pending |
| 2-01-05 | 01 | 1 | FILT-07, FILT-08 | smoke | 50-iteration stress test; `runFilterLoop([gameRows.find(r => r.Number === 111)])` — no hang | ❌ Wave 0 | ⬜ pending |
| 2-01-06 | 01 | 1 | FILT-09, FILT-10 | unit (manual) | `runFilterLoop(gameRows).clues[0]` shape; `.answer` is number 100–999 | ❌ Wave 0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Verify actual PapaParse key names for duplicate headers: `Object.keys(gameRows[0])` in browser console — **BLOCKING** (must happen before writing `RANGE_GROUPS`)
- [ ] Manual test checklist created: `.planning/phases/02-filtering-engine/MANUAL-TEST-CHECKLIST.md`
- [ ] 50-iteration stress test script (copy-paste ready for browser console)

*All Phase 2 validation is manual browser-console based — no test framework to install.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| RANGE_GROUPS indices correct | FILT-01 | No test runner; browser-only | `console.log(RANGE_GROUPS)` — confirm 6 groups |
| Loop starts with all 900 rows | FILT-02 | Browser-only | Add `console.log(candidates.length)` at loop start |
| Random range/col/value selection | FILT-03 | Randomness requires repeated runs | Run `runFilterLoop(gameRows)` 10x, verify different clues |
| Numeric cols use 4 operators | FILT-04 | Browser-only | Inspect `clue.operator` across multiple runs |
| Filter skipped if all eliminated | FILT-05 | Requires pathological input | Verify no run produces 0 candidates mid-loop |
| Filter skipped if col uniform | FILT-06 | Requires constructed scenario | Run with pre-filtered rows where one col is uniform |
| Loop terminates correctly | FILT-07 | Requires 50-iteration stress test | Copy-paste stress script into browser console |
| Iteration cap prevents hang | FILT-08 | Requires repeated-digit row | `runFilterLoop([gameRows.find(r => r.Number === 111)])` |
| Clue shape `{ label, operator, value }` | FILT-09 | Browser-only | Inspect `runFilterLoop(gameRows).clues[0]` |
| answer is Number field (100–999) | FILT-10 | Browser-only | `typeof answer === 'number' && answer >= 100 && answer <= 999` |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
