---
name: planning
description: Use after a brief is settled and da-brief has passed — turns the brief file into an implementation plan without reopening product decisions
---

# Planning

You are working from a **file**, not from memory. Your context was cleared. Read the brief
before anything else.

## Start

1. `git branch --show-current`, then read `docs/work/*-brief.md` on this branch in full.
2. If any section reads `Ack: pending`, or the brief has no `da-brief` sign-off recorded,
   **stop** and say so. The brief is not closed and planning it is premature.
3. Create `docs/work/YYYY-MM-DD-<slug>-plan.md` alongside it, same slug.

## What the plan is for

The brief settled **what** and **which observable behaviour**. The plan settles **how**:
file layout, function and module names, order of work, what gets tested and how.

**Do not reopen product decisions.** If the brief is genuinely ambiguous or you find a
contradiction, do not resolve it yourself and do not guess — go back and ask, naming the
brief item number. That is a reopen, and it re-opens that section's ack.

## Shape

- Tasks small enough to test and commit on their own.
- Each task names exact files to create or modify, and the tests that prove it.
- Each task cites the **brief item numbers** it implements. Every numbered item in the
  brief must be traceable to a task or explicitly marked as needing no code.
- Follow `docs/ARCHITECTURE.md` and `docs/CONVENTIONS.md`. The separation rules there are
  checked by `da-build` regardless of what the plan says.
- Tests first, then implementation, per task.
- No placeholders. "Add appropriate error handling" is not a plan step; write what it does.

## Closing

1. Commit the plan file.
2. Dispatch a fresh-context `Task` subagent with the `da-plan` skill on this file.
3. Fix every Medium+ finding; a Low may be deferred with stated justification.
4. Commit, then ask **Jamie** to approve the plan — plan approval is his, as dev lead, and
   is required before any build work starts.
5. Once approved, say you are clearing context before Build.
