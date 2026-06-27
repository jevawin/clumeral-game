---
phase: quick-260601-dcx
plan: 01
subsystem: ui
tags: [feedback, localstorage, diagnostics, vitest, modals]

requires: []
provides:
  - collectDebug() helper exported from src/modals.ts
  - 6 diagnostic fields (history, prefs, active, tzOffset, localToday, screen) on every feedback POST
  - plain-English "game data attached" note on the feedback meta line
affects: [feedback debugging, future bug-report triage]

tech-stack:
  added: []
  patterns:
    - "Per-key safeGet() wrapping a single localStorage.getItem in its own try/catch — returns \"\" on miss or throw, never blocks the send"
    - "Object-spread merge of a collector helper into an existing payload to add fields without touching the original shape"

key-files:
  created:
    - tests/feedback-debug.spec.ts
  modified:
    - src/modals.ts

key-decisions:
  - "Send dlng_* as raw unparsed strings — server reproduces client state verbatim; never JSON.parse on this code path (T-dcx-04)"
  - "Meta line shows only a plain note, never raw JSON/field values (T-dcx-03)"
  - "Spread collectDebug() into payload so all 6 fields attach on every category, not bug-only"

patterns-established:
  - "safeGet(key): isolated try/catch per localStorage read for DoS-safe diagnostics (T-dcx-01)"

requirements-completed: []

duration: 4min
completed: 2026-06-01
---

# Quick 260601-dcx: Feedback Debug Payload Summary

**Every feedback submission now carries 6 browser-diagnostic fields (raw localStorage snapshots plus timezone/screen/local-date context) on top of the original 7, with a plain-English note telling the player game data is attached.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-06-01T09:40:00Z
- **Completed:** 2026-06-01T09:42:00Z
- **Tasks:** 2 completed
- **Files modified:** 2 (1 created, 1 modified)

## Accomplishments

- Added `collectDebug()` (exported) to `src/modals.ts`. Returns `history`, `prefs`, `active` (raw unparsed localStorage strings), `tzOffset` (number), `localToday` (`todayKey()`), and `screen` (`WxH`).
- Added module-level `safeGet()` — wraps each `localStorage.getItem` in its own try/catch, returns `""` on missing key or thrown access (private mode / blocked / quota).
- Spread `collectDebug()` into the feedback POST `payload`; all 6 fields now attach on every category (general, bug, suggestion, praise). The original 7 fields (`category`, `message`, `puzzleNumber`, `date`, `device`, `browser`, `userAgent`) are byte-for-byte unchanged.
- Imported `todayKey` from `./date.ts` (single source of truth for local date).
- Appended a short, honest note to the feedback meta line: `… · Game data attached to help debug.` No raw JSON or field values rendered to the player.
- Created `tests/feedback-debug.spec.ts` (vitest) covering raw-string passthrough, missing-key safety (no throw), and `tzOffset`/`localToday`/`screen` shape.

## Verification

- `npm run build` — production build succeeds (Vite + worker bundle clean).
- `npm test -- feedback-debug` — 3/3 pass.
- Full suite: `npm test` — 112/112 pass across 10 files (no regressions).
- `no-cors` fetch, `MAX_RETRIES` loop, backoff, and success/failure toasts left untouched. No backend/worker changes.

## TDD Gate Compliance

Task 1 followed RED → GREEN:
- RED commit `d518e29` — `test(quick-260601-dcx-01)`: `collectDebug is not a function` confirmed failing.
- GREEN commit `ecc87ea` — `feat(quick-260601-dcx-01)`: implementation, tests pass.

No REFACTOR commit needed — implementation was minimal and clean.

## Threat Model Compliance

- **T-dcx-01 (DoS, localStorage read):** mitigated — `safeGet()` per-key try/catch returns `""`, never throws or blocks the send.
- **T-dcx-02 (info disclosure, raw dlng_* to webhook):** accepted per plan — non-PII game state, operator-owned webhook, attached deliberately for debugging.
- **T-dcx-03 (info disclosure, meta line):** mitigated — only a plain note shown, no raw JSON/values.
- **T-dcx-04 (tampering, forged dlng_active):** accepted per plan — sent as raw diagnostic string, never parsed or trusted on this path; existing `loadActive` validation unchanged.

## Deviations from Plan

None — plan executed as written.

## Known Stubs

None.

## Commits

- `d518e29` test(quick-260601-dcx-01): add failing test for collectDebug() debug fields
- `ecc87ea` feat(quick-260601-dcx-01): attach collectDebug() fields to feedback payload
- `fb5c13b` feat(quick-260601-dcx-01): add plain-English game-data note to feedback meta line

## Self-Check: PASSED

- Files verified: `tests/feedback-debug.spec.ts`, `src/modals.ts`, `260601-dcx-SUMMARY.md` all present.
- Commits verified: `d518e29`, `ecc87ea`, `fb5c13b` all in git log.
- `collectDebug` export confirmed in `src/modals.ts`.
