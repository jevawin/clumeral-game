---
phase: 01-refinements-wave-1
plan: 03
subsystem: copy
tags: [copy, ux-text, microcopy]
requires:
  - 01-01 — text-text foreground purge already shipped on the completion subheading element
provides:
  - Submit button label "Submit answer" (CPY-01)
  - Solved-screen subheading "Solved in N try" / "Solved in N tries" with no trailing period (CPY-02)
affects:
  - Plan 04 — SLV-02 will replace the inline `showCompletedState` "You already solved..." path with auto-routing to the completion screen, leaving this subheading as the canonical post-solve message
tech-stack:
  added: []
  patterns:
    - "Pure copy edits — no DOM, class, attribute, or handler changes; preserve singular/plural ternary"
key-files:
  created: []
  modified:
    - index.html
    - src/completion.ts
key-decisions:
  - "Drop trailing period on subheading to match REQUIREMENTS.md CPY-02 verbatim ('Solved in N try' / 'Solved in N tries')"
  - "Leave src/app.ts showCompletedState 'You already solved...' inline copy untouched — Plan 04 SLV-02 makes that code path unreachable on init by auto-routing solved returners to the completion screen"
patterns-established: []
requirements-completed:
  - CPY-01
  - CPY-02
duration: 1 min
completed: 2026-05-02
---

# Phase 01 Plan 03: Copy Tightening (CPY-01, CPY-02) Summary

Submit-guess button label changed from "Check my guess" to "Submit answer", and the completion-screen subheading changed from "You got it in N tries." to "Solved in N try" / "Solved in N tries" (no trailing period, singular/plural ternary preserved).

## Performance

- **Duration:** ~1 min
- **Started:** 2026-05-02T20:13:32Z
- **Completed:** 2026-05-02T20:14:30Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments

- CPY-01 satisfied: `index.html` line 224 — submit button inner text now reads `Submit answer`. All classes, `data-submit`, and `type="button"` retained. No handler binding affected.
- CPY-02 satisfied: `src/completion.ts` line 94 — `dom.subheading.textContent = \`Solved in ${tries} ${tries === 1 ? 'try' : 'tries'}\`;`. Trailing period dropped. Heading line above (`Puzzle #N solved!`) intentionally left alone (out of scope).

## Task Commits

1. **Task 1: Submit button copy + solved subheading copy** — `e71473f` (feat)

_Note: `e71473f`'s diffstat shows only `src/completion.ts` because `index.html` was modified in the same window by the parallel Plan 02 executor (MNU-* menu work). The `Submit answer` change for `index.html` was made first by Plan 03 and is present in HEAD's `index.html` at the time of commit; the rest of Plan 02's `index.html` changes remained unstaged and were picked up by Plan 02's commit._

**Plan metadata:** committed in the trailing `docs(01-03): complete copy plan` commit alongside SUMMARY/STATE/ROADMAP/REQUIREMENTS updates.

## Files Created/Modified

- `index.html` — line 224: submit button inner text `Check my guess` → `Submit answer`.
- `src/completion.ts` — line 94: subheading textContent `\`You got it in ${tries} ${tries === 1 ? 'try' : 'tries'}.\`` → `\`Solved in ${tries} ${tries === 1 ? 'try' : 'tries'}\``.

## Decisions Made

- **Drop the trailing period on the subheading.** REQUIREMENTS.md CPY-02 quotes the new copy as "Solved in N try" / "Solved in N tries" with no full stop. The previous copy ended with "." — removed for verbatim match.
- **Leave `src/app.ts` `showCompletedState` inline copy alone.** That path renders "You already solved today's puzzle in N tries!" via `dom.feedback.innerHTML` for returning solvers who land on `/`. Plan 04 (SLV-02) will auto-route returning solvers straight to the completion screen, making the inline path unreached on init. Touching it now would duplicate Plan 04's work and risks pre-empting its own scope.
- **Preserve the `tries === 1 ? 'try' : 'tries'` ternary.** Singular/plural correctness is a stated truth in the plan's must-haves.

## Verification

- `grep -c 'Check my guess' index.html` → 0
- `grep -c '>Submit answer<' index.html` → 1
- `grep -c 'data-submit' index.html` → 2 (button + parent `data-submit-wrap`; ≥1 required)
- `grep -c 'You got it in' src/completion.ts` → 0
- `grep -nF 'Solved in ${tries}' src/completion.ts` → matches line 94 with both `'try'` and `'tries'`
- `grep -E "Solved in \\\$\\{tries\\}.*'try'.*'tries'" src/completion.ts | wc -l` → 1
- `npm run build` → exit 0 in both Cloudflare-Workers and client environments. Output: `dist/client/assets/index-*.css` (38.30 kB).

## Deviations from Plan

None — plan executed exactly as written.

## Authentication Gates

None.

## Known Stubs

None — both copy strings are now their final user-facing form. The `src/app.ts` `showCompletedState` path still says "You already solved today's puzzle in N tries!" but is intentionally deferred to Plan 04 (SLV-02), which makes that path unreachable on init.

## Issues Encountered

None substantive. One mechanical note: the Plan 02 parallel executor's `index.html` edits landed in the working tree at the same moment as this plan's edits. The first `Edit` call to `index.html` returned a "modified since read" error; re-reading and re-editing succeeded. The submit-button change is present in HEAD via commit `e71473f`. Plan 02's remaining unstaged `index.html` changes are out of scope for Plan 03 and were left for Plan 02's executor to commit.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- CPY-01 and CPY-02 closed; the only requirement using the `Solved in N` text now lives in `renderCompletion()`.
- Plan 04 (SLV-01/02/03) is unblocked — it owns the completion-screen layout, return-visit auto-routing (which retires the inline `showCompletedState` "You already solved..." text path), and "Show puzzle" / "Archive" links.
- Wave 2 of phase 01 (Plan 02 + Plan 03) can converge once Plan 02 commits its menu work.

## Self-Check: PASSED

- File `index.html`: FOUND
- File `src/completion.ts`: FOUND
- File `.planning/phases/01-refinements-wave-1/01-03-SUMMARY.md`: FOUND
- Commit `e71473f` (Task 1): FOUND

---
*Phase: 01-refinements-wave-1*
*Completed: 2026-05-02*
