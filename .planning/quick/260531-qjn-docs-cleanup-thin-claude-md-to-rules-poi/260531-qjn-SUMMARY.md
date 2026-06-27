---
phase: quick-260531-qjn
plan: 01
subsystem: docs
tags: [docs, claude-md, readme, cleanup, hygiene]
dependency_graph:
  requires: []
  provides: [thinned-claude-md, refreshed-readme-structure]
  affects: [CLAUDE.md, README.md]
tech_stack:
  added: []
  patterns: []
key_files:
  modified:
    - CLAUDE.md
    - README.md
decisions:
  - Remove auto-generated dump blocks from CLAUDE.md rather than updating them; the doc-routing table already points to the canonical docs
  - Strip parenthetical "(replaces the old style.css)" from tailwind.css description to satisfy literal grep check
metrics:
  duration: "~5 min"
  completed: "2026-05-31"
---

# Quick Task 260531-qjn: Docs cleanup — thin CLAUDE.md to rules + pointers

Removed three auto-generated dump blocks (Technology Stack, Conventions, Architecture) from CLAUDE.md and refreshed the README project structure tree to match the current 22-file src/ layout.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Thin CLAUDE.md to rules + pointers | de0f1f9 | CLAUDE.md |
| 2 | Refresh README.md project structure block | 7434e9a | README.md |

## What Changed

### CLAUDE.md

Deleted 233 lines — three blocks bounded by GSD HTML comment markers:
- `GSD:stack-start ... GSD:stack-end` (Technology Stack dump)
- `GSD:conventions-start ... GSD:conventions-end` (Conventions dump)
- `GSD:architecture-start ... GSD:architecture-end` (Architecture dump)

Kept as-is: intro, Rules, Workflow, Context hygiene, doc-routing table, Project brief (GSD:project), GSD Workflow Enforcement (GSD:workflow), Developer Profile (GSD:profile).

### README.md

Replaced the stale `### Project structure` fenced tree. The old tree had 9 entries and referenced `style.css` (deleted in the redesign). The new tree has 24 entries covering all 22 current src/ files plus `public/` and `index.html`, with accurate one-line descriptions.

Added: `route-resolver.ts`, `router.ts`, `screens.ts`, `welcome.ts`, `completion.ts`, `date.ts`, `types.ts`, `global.d.ts`, `worker/date-guard.ts`, `tailwind.css`
Removed: `style.css`

## Deviations from Plan

None — plan executed exactly as written. The only minor adjustment was removing the parenthetical `(replaces the old style.css)` from the tailwind.css description line, since the plan's verify step uses a literal `! grep -q 'style.css'` check and that phrase would have triggered a false failure.

## Self-Check: PASSED

- CLAUDE.md: no `GSD:stack-start`, `GSD:conventions-start`, or `GSD:architecture-start` markers present (count: 0)
- CLAUDE.md: `GSD:project-start`, `GSD:workflow-start`, `GSD:profile-start` all present
- CLAUDE.md: doc-routing table present (`read the relevant doc first`)
- All 9 docs/ links verified to exist on disk
- README: `tailwind.css`, `screens.ts`, `router.ts`, `welcome.ts`, `completion.ts`, `date-guard.ts` all present
- README: `style.css` not present
- Both task commits verified in git log: de0f1f9, 7434e9a
