---
quick_id: 260722-tp3
slug: roadmap-cleanup-post-262
date: 2026-07-22
status: in-progress
---

# Roadmap cleanup after the #262 deploy

`main` is at #262 (staging → main, 7 commits). `docs/ROADMAP.md` stops at #255, and
eight issues that shipped were never closed — the release PRs never used `Closes #`.

## Part A — close 8 shipped-but-open issues

Each verified present in code on `main` before closing.

| Issue | Shipped in | Evidence |
|---|---|---|
| #81 Fibonacci special | #254 | `src/worker/puzzle.ts:11` `FIBONACCIS`, `firstIsFib`/`secondIsFib`/`thirdIsFib` |
| #155 Amend (i) definitions | #261 | `src/app.ts:155-158` `TAG_TIPS` match the requested wording |
| #194 Keypad hidden on finalise | #254 | `src/app.ts:483` cites the issue |
| #199 Archive in corner menu | #254 | `src/app.ts:910` `[data-menu-archive]` |
| #202 Semantic success/error tokens | #254 | `src/tailwind.css:80-81` |
| #228 "boxes" not "digits" | #254 | `src/app.ts:242` |
| #249 Accent palette tidy | #254 | superseded and completed by #255's derived palette |
| #255 OKLCH derived palette | #258 | `src/palette.ts` |

#155 is the notable one: PR #261 shipped exactly the wording #155 asked for but closed
no issues, so nobody noticed.

## Part B — docs/ROADMAP.md + label drift

1. Add #261 to _Recently shipped_ (merged via #262 on 2026-07-22), noting it closed #155.
2. Note on the #254 and #255 entries that their issues are now actually closed.
3. Add #225 (feedback open/resolved state) to _Next_ under a **Feedback** heading. It carries
   the `roadmap` label but appears nowhere in the file, and `docs/FEEDBACK.md` names it as the
   blocker for the feedback → GitHub triage loop.
4. Add the `roadmap` label to #143, #151, #200, #201, #203 — all listed in _Future_ but unlabelled.

## Out of scope

- The _Now_ item (#257) — untouched.
- Ordering of _Next_ beyond inserting #225.

## QA

Doc-only plus GitHub metadata. No code, no build, no tests. DA review skipped per
CLAUDE.md (single-file doc change). Self-review before PR.
