# Phase 5: Timezone + state-persistence bug cluster — Context

**Gathered:** 2026-05-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix three date/timezone bugs that share one root cause — the app has no single canonical "puzzle day," so dates get keyed inconsistently (UTC on write vs local on read) across client and worker:

- **#205** — daily puzzle should reset at the player's local midnight; the worker's "future puzzle" guard runs against its own UTC clock and can reject a player's valid local "today," and `puzzleNumber` is computed inconsistently.
- **#206** — mid-game progress is lost on reload (only completed games are stored).
- **#209** — streak count is under-reported because the date-keying mismatch creates phantom gaps in history.

The fix is to establish a single canonical date convention (each user's local midnight) used everywhere, then heal the downstream symptoms (reset, persistence, streak) on top of it.

**Out of scope:** changing the puzzle generation algorithm, API request/response shapes, analytics, or any UI redesign. This is a correctness fix, not a feature.
</domain>

<decisions>
## Implementation Decisions

### Canonical "puzzle day"
- **D-01:** The daily puzzle is keyed to **each user's own local midnight** (Wordle-style). No global Europe/London or UTC sync. Two players in different timezones can be on different puzzle numbers at the same instant — that is intended.
- **D-02:** The **client's local date is the source of truth.** The client computes "today" from the browser's local clock and drives all date-keyed reads/writes (history, puzzle fetch, streak).
- **D-03:** There must be **one shared date helper** used everywhere on the client (replace the duplicated `todayLocal()` / `puzzleNumber()` / `formatDate()` copies in `app.ts`, `welcome.ts`). Single source removes the UTC-vs-local drift that causes #205 and #209.

### Backend rule (relaxes the project-wide "backend-untouched" constraint, this phase only)
- **D-04:** A **minimal worker date fix is allowed** for this phase. Scope is limited to making the worker accept the client's date as authoritative / widening the "future puzzle" guard (~1 day tolerance) so a local-midnight player past their midnight but before UTC midnight is not rejected.
- **D-05:** **No API shape change.** Request/response contracts, route paths, and puzzle generation stay identical. The worker change is date-guard logic only.

### Mid-game persistence (#206)
- **D-06:** Persist the **full board + feedback**: eliminated digits per box, submitted wrong guesses, the active keypad box, and the last feedback message. Player resumes exactly where they were. Clues are re-fetched fresh from the API on restore (not persisted).
- **D-07:** Saved state is cleared **on solve AND on day rollover** — wipe on completion, and discard/ignore any saved state whose date ≠ today's local date so yesterday's half-game never loads.
- **D-08:** Persistence applies to **daily puzzles only.** Random puzzles and archive replays start fresh on reload.

### Claude's Discretion
- **Streak definition / grace (#209):** not explicitly discussed. Default expectation: once D-01..D-03 give one canonical date, the existing `computeStats` streak walk in `completion.ts` should heal. Researcher/planner decides whether the current streak should stay alive while today is unplayed (count from yesterday) or break at midnight — pick the behavior that matches a daily-puzzle player's intuition and document it.
- **Existing-data migration:** not explicitly discussed. Default expectation: leave existing `dlng_history` as-is (no destructive migration); the canonical date fix corrects counting going forward. If a cheap, non-destructive repair makes old streaks heal, that is acceptable — but a one-time reset of an already-broken streak is tolerable. Do not silently delete history.
- **Storage shape / key for mid-game state:** new localStorage key and JSON shape are Claude's call (follow `dlng_` prefix convention). Include a schema/version guard so a future shape change can't crash the loader.
- **Countdown alignment:** `completion.ts` countdown already targets local midnight (`setHours(24,0,0,0)`) — confirm it stays consistent with the canonical day.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Date / puzzle-day logic (the bug surface)
- `src/app.ts` §"Date helpers" (~L96-114) — client `todayLocal()`, `puzzleNumber()`, `formatDate()` (duplicated copy).
- `src/welcome.ts` (~L13-21, L130-132) — second duplicated copy of the same date helpers + puzzle-number display.
- `src/worker/puzzle.ts` (~L184-204) — worker `todayLocal()`, `puzzleNumber()`, `puzzleDate()`, `dateSeedInt()`. Worker runs UTC on Cloudflare.
- `src/worker/index.ts` (~L139, L237) — daily puzzle serving + "Cannot guess future puzzles" guard (the #205 gate).
- `src/route-resolver.ts` (~L23-26) — date round-tripping via `toISOString().slice(0,10)`.

### State persistence + streak (the symptoms)
- `src/storage.ts` — `loadHistory` / `recordGame` (history shape `{date, tries, answer}`); keys `dlng_history`, `dlng_prefs`. New mid-game persistence lives here.
- `src/completion.ts` (~L45-93) — `computeStats` streak walk (#209) and `formatCountdown` (local-midnight countdown).
- `src/app.ts` (~L530-590, L660-720, L900-920) — `gameState` shape, daily/replay start paths, completion render, date→puzzleNumber replay.
- `src/types.ts` — `GameState`, `HistoryEntry`, `Prefs` interfaces.

### Project docs
- `docs/ARCHITECTURE.md` — puzzle logic, seeding, storage rules.
- `docs/URL-ARCHITECTURE.md` — routing / date-in-URL rules (archive replay uses date keys).
- `docs/CONVENTIONS.md` — code patterns, no-console rule, accessibility.
- `.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/CONVENTIONS.md` — codebase maps.
- ROADMAP.md Phase 5 section — bug list + shared-root-cause statement.

### Issues
- GitHub #205 (midnight reset + puzzleNumber timezone), #206 (persist mid-game state), #209 (streak under-counting).
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `storage.ts` `dlng_` localStorage pattern + try/catch silent-fallback — reuse for the new mid-game state key.
- `completion.ts` `computeStats` already walks history for streak — fix in place rather than rewrite.

### Established Patterns
- Date helpers are **duplicated** across `app.ts`, `welcome.ts`, and (separately) `worker/puzzle.ts`. The fix must collapse the client copies into one shared helper; the worker keeps its own (no client↔worker cross-import — strict boundary per CONVENTIONS).
- `puzzleNumber()` anchors date strings at `T00:00:00Z` (UTC) on both sides — deterministic given the same date string, so the bug is in *which date string* is chosen (`todayLocal`), not in `puzzleNumber` math itself.
- Render functions are idempotent and read from `gameState` — restore path can rebuild `gameState` then call existing renderers.

### Integration Points
- Client `todayLocal()` → puzzle fetch → worker date guard (`worker/index.ts`). The minimal worker fix lands here.
- New mid-game save hooks into the guess-submit + digit-eliminate flows in `app.ts`; restore hooks into the daily-puzzle start path.
</code_context>

<specifics>
## Specific Ideas

- Canonical model is explicitly **Wordle-style** local-midnight daily, not a globally-synced UK day.
- Restore must re-fetch clues from the API rather than trusting persisted clue data (clues are server-derived; only player-side board state is persisted).
</specifics>

<deferred>
## Deferred Ideas

- Global/synced "everyone gets the same puzzle at the same moment" model (Europe/London or UTC) — rejected in favor of local-midnight; revisit only if a leaderboard/social feature ever needs a shared day.
- Persisting mid-game state for random + archive-replay modes — out of scope; daily only.
- Destructive history migration / streak recomputation tooling — not planned; only non-destructive healing if cheap.

</deferred>

---

*Phase: 05-timezone-state-persistence-bug-cluster-fix-205-reset-at-midn*
*Context gathered: 2026-05-29*
