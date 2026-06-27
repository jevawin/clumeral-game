---
phase: 05
phase_slug: timezone-state-persistence-bug-cluster-fix-205-reset-at-midn
created: 2026-05-29
status: active
---

# Phase 05 Validation Strategy

> Derived from RESEARCH.md Validation Architecture section. Defines what to test, at which boundaries, and what evidence proves the phase goal is met.

## Validation Boundaries

| Layer | What's tested | What's mocked | Why |
|-------|---------------|---------------|-----|
| `src/date.ts` (new) | `todayKey()`, `puzzleNumberFor()`, `localDateKey()` across timezones + DST | System time + TZ | Linchpin of the fix — all date keying flows through it |
| `src/storage.ts` | `saveActive()` / `loadActive()` / `clearActive()` round-trip, version guard, date-mismatch discard | Real localStorage via jsdom | #206 persistence correctness; corrupt/stale state must not crash loader |
| `src/completion.ts` | `computeStats` streak walk with local-keyed history (no phantom gaps) | Fixture history arrays | #209 streak under-counting heals once dates are local |
| `src/worker/index.ts` | future-guard tolerance accepts local-midnight edge, rejects true-future | Request/date inputs | #205 worker rejection of valid local "today" |

## Critical Paths

1. **BST↔GMT transition days** — `localDateKey()` returns the right day on the 25h/23h days (late March, late October Europe/London).
2. **Local-midnight vs UTC-midnight gap** — player at 00:30 local (BST = 23:30 UTC prev day) gets today's puzzle; worker guard accepts it.
3. **History round-trip** — game recorded at 23:00 local reads back under the same date key the next read uses (no UTC drift).
4. **Day rollover with saved state** — `dlng_active` saved yesterday is discarded, not loaded, after local midnight.
5. **Streak continuity** — consecutive local days count up; a true gap day breaks streak; same-day re-read does not.
6. **route-resolver date round-trip** — archive/replay date near midnight resolves to the intended day, not UTC-shifted.

## Coverage Targets

- `src/date.ts`: 100% — every export tested across ≥3 timezones including one DST-transition day.
- `src/storage.ts` active-state fns: save/load/clear + version mismatch + date mismatch.
- `src/completion.ts` streak: at least the 6 critical scenarios above.
- Worker guard: accept-local-edge + reject-true-future.

## Evidence Requirements

- `npx vitest run` green output showing the new test files.
- Explicit assertion list for DST-transition days (highest-risk path).

## Out of Scope

- E2E browser automation (no Playwright in project).
- Persistence for random / archive-replay modes (daily-only per D-08).
- Destructive history migration tests (no migration performed per CONTEXT).

## Validation Architecture (from research)

See `05-RESEARCH.md` § "Validation Architecture" for the full source. Summary above is the executable contract; the research section holds the rationale and the BST/GMT landmine detail.
