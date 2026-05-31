---
phase: 7
plan: 01
slug: simplify
status: draft
nyquist_compliant: false
wave_0_complete: false
retrofit: true
retrofit_authored: 2026-05-02
created: 2026-05-02
---

# Phase 7 — Validation Strategy (Retrofit)

> Per-phase validation contract. **This file is a retrofit** — Phase 7 ran outside the GSD workflow and never had a validation strategy authored at execution time. The honest record below is `nyquist_compliant: false` and `wave_0_complete: false`.

---

## Status

This validation file is authored retroactively in Phase 9. Phase 7 was delivered via direct commit `2e13e2b` on 2026-04-21 without going through `/gsd-execute-phase`, so no Wave 0 test scaffold was authored, no per-task automated verification was sampled, and no validation strategy existed at execution time. **`nyquist_compliant: false` is the honest record.** Retroactively reconstructing a per-task automated harness is out of scope for this retrofit phase.

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

Not applied at execution time. The build was run manually before commit `2e13e2b` was pushed; no per-task sampling record exists. Retroactive sampling is impractical because the working tree has advanced through Phase 8.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 07-01-01 | 01 | 1 | SIMP-01 | grep | `git grep -n data-tlt -- src/ index.html` (expect empty) | n/a | n/a (retrofit — see 07-01-VERIFICATION.md) |
| 07-01-02 | 01 | 1 | SIMP-01 | grep | inspect `[data-screen="welcome"]` block in index.html | n/a | n/a (retrofit) |
| 07-01-03 | 01 | 1 | SIMP-01 | grep | `grep -nE "icon-menu\|icon-sun\|icon-github\|icon-heart" public/sprites.svg` (expect empty) | n/a | n/a (retrofit) |
| 07-01-04 | 01 | 1 | SIMP-01 | inspection | manual review of tailwind.css comments | n/a | n/a (retrofit) |
| 07-01-05 | 01 | 1 | SIMP-01 | manual | browser walkthrough | n/a | implicit_pass via v1.0 audit |

*Status legend: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky · n/a (retrofit) · implicit_pass*

---

## Wave 0 Requirements

Wave 0 not applicable — Phase 7 ran outside the GSD workflow. No test scaffold authored; `wave_0_complete: false` is the honest record. Retroactive Wave 0 work is not planned.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| No visual regressions from letter-reveal removal, sprite pruning, or CSS audit | SIMP-01 | Visual correctness cannot be automated | At execution time: walk through welcome / game / completion / modal / menu in light + dark mode at 375px and desktop. Confirmation never explicitly recorded; implicit pass via v1.0 audit (lines 158-167) running 5/7 E2E flows on the post-Phase-7 tree without flagging Phase-7-introduced regressions. |

---

## Nyquist Compliance

This phase is **non-compliant** with the Nyquist sampling discipline. No automated per-task test was sampled during execution. Retroactive verification (`07-01-VERIFICATION.md`) relies on grep evidence + audit observations, which is sufficient to confirm SIMP-01 is satisfied but does not retroactively make this phase Nyquist-compliant.

**Reason:** Retrofit — phase ran outside the GSD workflow, validation strategy never authored, applying retroactively is out of scope.

**Optional follow-up:** `/gsd-validate-phase 7` may be run if a future maintainer wants to author a proper validation harness. **Not required for v1.0 milestone closure.**

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies — N/A (retrofit)
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify — N/A (retrofit)
- [ ] Wave 0 covers all MISSING references — N/A (retrofit)
- [ ] No watch-mode flags — N/A (retrofit)
- [ ] Feedback latency < 15s — N/A (retrofit)
- [ ] `nyquist_compliant: true` set in frontmatter — **No, set to `false` (honest retrofit record)**

**Approval:** non-compliant (retrofit, accepted)

---

## Retrofit Provenance

Authored 2026-05-02 by Phase 9 retrofit. No source code changed.
