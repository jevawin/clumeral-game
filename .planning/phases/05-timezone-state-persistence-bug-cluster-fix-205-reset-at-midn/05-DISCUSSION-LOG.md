# Phase 5: Timezone + state-persistence bug cluster - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-29
**Phase:** 05-timezone-state-persistence-bug-cluster-fix-205-reset-at-midn
**Areas discussed:** Canonical day + backend rule, Mid-game persistence (#206)

---

## Area selection

| Option | Description | Selected |
|--------|-------------|----------|
| Canonical day + backend rule | Europe/London vs local midnight; may worker date logic change? | ✓ |
| Mid-game persistence (#206) | What survives reload, when cleared | ✓ |
| Existing-data migration (#209) | Repair/recompute vs leave vs reset | |
| Streak definition / grace | Stay alive while today unplayed vs break at midnight | |

---

## Canonical day + backend rule

### Q1 — What defines "today's puzzle"?

| Option | Description | Selected |
|--------|-------------|----------|
| Europe/London for all | Global UK-midnight day for everyone | |
| Each user's local midnight | Wordle-style; per-device midnight, no global sync | ✓ |
| UTC for all | Global UTC-midnight day | |

**User's choice:** Each user's local midnight.

### Q2 — How to handle the worker (UTC clock) given the backend-untouched constraint?

| Option | Description | Selected |
|--------|-------------|----------|
| Allow minimal worker date fix | Relax constraint this phase; accept client date / widen future-puzzle guard ~1 day; no API shape change | ✓ |
| Strict frontend-only | Touch zero worker code; some UTC-midnight edge cases stay imperfect | |
| Need to see worker gate first | Research worker date logic before deciding | |

**User's choice:** Allow minimal worker date fix.
**Notes:** Local-midnight makes the client date authoritative; the worker's UTC future-puzzle guard can reject a valid local "today," so a small worker date-guard fix is permitted (logic only, no API change).

---

## Mid-game persistence (#206)

### Q1 — What survives a reload?

| Option | Description | Selected |
|--------|-------------|----------|
| Eliminated digits + guesses | Board state + wrong guesses; re-fetch clues | |
| Full board + feedback msgs | Above + last feedback text + active keypad box | ✓ |
| Just eliminated digits | Crossed-out digits only | |

**User's choice:** Full board + feedback msgs.

### Q2 — When is saved state cleared?

| Option | Description | Selected |
|--------|-------------|----------|
| On solve + on day rollover | Wipe on solve; discard state whose date ≠ today | ✓ |
| Only on solve | Keep until solved; date-check on read | |
| Never auto-clear | Always keep; loader date-guards | |

**User's choice:** On solve + on day rollover.

### Q3 — Which game modes restore mid-game state?

| Option | Description | Selected |
|--------|-------------|----------|
| Daily only | Daily puzzle only; random + archive start fresh | ✓ |
| Daily + archive replays | Daily and archived-date puzzles | |
| All modes | Daily, archive, random | |

**User's choice:** Daily only.

---

## Claude's Discretion

- Streak grace definition (#209) — left to research/planner under the local-midnight rule.
- Existing-data migration — default non-destructive; cheap healing OK, no silent deletes.
- Mid-game storage key + JSON shape + version guard — Claude's call, follow `dlng_` convention.
- Countdown alignment with canonical day.

## Deferred Ideas

- Global/synced day model (Europe/London or UTC) — rejected for local-midnight.
- Persistence for random + archive-replay modes.
- Destructive history migration / streak recomputation tooling.
