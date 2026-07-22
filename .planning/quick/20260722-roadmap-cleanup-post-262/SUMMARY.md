---
quick_id: 260722-tp3
slug: roadmap-cleanup-post-262
date: 2026-07-22
status: complete
pr: 263
---

# Summary — roadmap cleanup after #262

## Done

**Part A** — closed 8 shipped-but-open issues on GitHub, each verified in code on `main` first:
#81, #194, #199, #202, #228, #249 (all #254), #255 (#258), #155 (#261). Every close carries a
comment naming the shipping PR and the file evidence. 38 open → 30.

Added the `roadmap` label to #143, #151, #200, #201, #203. Every open issue now carries it, so
the GitHub `roadmap` query and `docs/ROADMAP.md` agree for the first time.

**Part B** — `docs/ROADMAP.md`: added #261 to _Recently shipped_ (closes #155), annotated the
#254/#255 entries, added #225 to _Next_ under a new **Feedback** heading at position 3, and
logged a dated "Backlog sweep — 2026-07-22" section.

`docs/GIT-WORKFLOW.md`: new rule — release PRs must list `Closes #NUM` per bundled issue.

## Root cause found

Not doc rot. #254, #258 and #261 named their issues in prose and used no closing reference.
GitHub auto-closes only from a PR body or commit message, and only on merge to the default
branch — so squash-merging into `staging` closes nothing. Fixed in GIT-WORKFLOW.md.

## QA

Doc-only plus GitHub metadata. No code, no build, no tests. DA review skipped per CLAUDE.md's
gate. Self-review: _Next_ numbering sequential 1–10, links resolve, no code surface touched.

## Deviations from plan

One addition beyond the agreed scope: the `GIT-WORKFLOW.md` rule. The plan covered fixing the
symptom; without the rule the same drift recurs on the next release PR. Flagged to the user.

## Follow-ups

- GitHub Projects board (Inbound/Now/Next/Future/Done) — approved, needs `gh auth refresh -s read:project,project`
- #225 feedback open/resolved state, then the feedback → GitHub triage bot — approved, in that order
