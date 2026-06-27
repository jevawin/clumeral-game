# Phase 5: Timezone + State-Persistence Bug Cluster — Research

**Researched:** 2026-05-29
**Domain:** Date-keying correctness, localStorage persistence, streak calculation
**Confidence:** HIGH — all findings verified from live source code; no external dependencies required

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Daily puzzle keyed to each user's own local midnight (Wordle-style). Two players in different timezones can be on different puzzle numbers — intended.
- **D-02:** Client's local date is the source of truth. Client computes "today" from the browser's local clock and drives all date-keyed reads/writes.
- **D-03:** One shared date helper on the client — replace duplicated `todayLocal()` / `puzzleNumber()` / `formatDate()` in `app.ts` and `welcome.ts`. Single source removes UTC-vs-local drift.
- **D-04:** Minimal worker date fix allowed this phase. Scope: widen the "future puzzle" guard (~1 day tolerance). No API shape change.
- **D-05:** No API shape change. Request/response contracts, route paths, and puzzle generation stay identical. Worker change is date-guard logic only.
- **D-06:** Persist full board + feedback on reload: eliminated digits per box, submitted wrong guesses, active keypad box, and last feedback message. Clues re-fetched fresh on restore.
- **D-07:** Saved state cleared on solve AND on day rollover (discard any saved state whose date ≠ today's local).
- **D-08:** Persistence applies to daily puzzles only. Random and archive replays start fresh on reload.

### Claude's Discretion

- **Streak definition (#209):** once D-01..D-03 give one canonical date, determine whether streak stays alive while today is unplayed (count from yesterday) or breaks at midnight.
- **Existing-data migration:** leave `dlng_history` as-is; canonical date fix corrects counting going forward. Cheap non-destructive repair acceptable if available.
- **Storage shape / key for mid-game state:** new localStorage key and JSON shape (follow `dlng_` prefix, include schema/version guard).
- **Countdown alignment:** confirm `completion.ts` countdown stays consistent with canonical day.

### Deferred Ideas (OUT OF SCOPE)

- Global/synced "everyone gets same puzzle at same moment" model (Europe/London or UTC).
- Mid-game persistence for random + archive-replay modes.
- Destructive history migration / streak recomputation tooling.
</user_constraints>

---

## Summary

Three bugs share one root cause: the app has no single canonical "puzzle day." `todayLocal()` is duplicated in three places (`app.ts`, `welcome.ts`, `worker/puzzle.ts`) and each copy is correct — but the worker's copy produces UTC-based dates while the client copies produce local-date strings. The mismatch surfaces at the guard in `worker/index.ts:101` (`body.date > todayLocal()`) where the worker's UTC "today" can be behind a UK user's local "today," rejecting a valid guess.

The fix has four independent parts: (1) collapse the two client copies of `todayLocal`/`puzzleNumber`/`formatDate` into a new `src/date-helpers.ts` module; (2) widen the worker's future-puzzle guard by one calendar day; (3) add mid-game state persistence keyed under `dlng_draft`; (4) confirm/fix `computeStats` streak logic once the canonical date is in place.

No packages need to be installed. No API shape changes. The fix is pure TypeScript across four files plus one new module.

**Primary recommendation:** Create `src/date-helpers.ts`, import it from `app.ts` and `welcome.ts`, then address the three downstream bugs in separate focused tasks.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|---|---|---|---|
| Canonical "puzzle day" computation | Browser / Client | — | Local midnight is user-browser-local by design (D-01/D-02) |
| Future-puzzle guard | API / Worker | — | Worker validates dates server-side; guard lives in `handleGuess` |
| Mid-game state save/restore | Browser / Client (localStorage) | — | Board state is client-side only; clues re-fetched from API |
| Streak calculation | Browser / Client | — | `computeStats` in `completion.ts` reads `dlng_history` |
| Countdown to next puzzle | Browser / Client | — | `formatCountdown` in `completion.ts` already targets local midnight |

---

## Standard Stack

No new packages. This phase uses only the project's existing stack:

- TypeScript (already installed) — new `src/date-helpers.ts` module
- localStorage API — new `dlng_draft` key for mid-game persistence
- vitest + jsdom (already installed) — new unit tests

### Installation

None required. [VERIFIED: live package.json]

---

## Package Legitimacy Audit

No external packages are added in this phase.

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

---

## Bug Root Cause Analysis

### Exactly how the current code mis-keys dates

**Client `todayLocal()` — correct (local date):**

`app.ts:98-101` and `welcome.ts:15-18` both read:
```typescript
function todayLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
```
`new Date()` returns the current local time. `getFullYear()`, `getMonth()`, `getDate()` all use local timezone. This is correct for a local-midnight model. [VERIFIED: live source]

**Worker `todayLocal()` — also uses local time, but "local" on Cloudflare is UTC:**

`src/worker/puzzle.ts:184-187`:
```typescript
export function todayLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
```
Identical code — but on a Cloudflare Worker, `new Date()` always returns UTC. So `d.getDate()` returns the UTC date. For a UK player at 00:30 BST (23:30 UTC the day before), the client says "today is 2026-06-01" but the worker says "today is 2026-05-31." [VERIFIED: live source + Cloudflare Worker docs — Workers run in UTC]

**The guard that rejects the player:**

`src/worker/index.ts:101-103`:
```typescript
if (body.date > todayLocal()) {
  return json({ error: 'Cannot guess future puzzles' }, 400);
}
```
String comparison `body.date > todayLocal()` — if client sends `"2026-06-01"` and worker's `todayLocal()` returns `"2026-05-31"`, the guard fires and rejects a valid guess. [VERIFIED: live source]

**`puzzleNumber()` is NOT the bug:**

`puzzleNumber(dateStr)` in both client and worker anchors at `T00:00:00Z` (UTC epoch arithmetic). Given the same `dateStr`, both produce the same number. The bug is purely which `dateStr` is chosen (from `todayLocal()`), not how `puzzleNumber` computes its result. The CONTEXT.md claim is confirmed. [VERIFIED: live source — `app.ts:103-106`, `worker/puzzle.ts:195-198`]

**`route-resolver.ts` — no date bug here:**

`isValidDate` at line 26 round-trips via `toISOString().slice(0,10)` (UTC). This correctly rejects invalid dates like `2026-02-31`. It does not produce a date string for puzzle keying — it only validates archive URL segments. No fix needed here. [VERIFIED: live source]

**Duplicate `EPOCH_DATE` constant:**

`EPOCH_DATE = "2026-03-08"` appears independently in `app.ts:51`, `welcome.ts:13`, and `worker/puzzle.ts:193`. The new `date-helpers.ts` must export the epoch constant too so `app.ts` and `welcome.ts` import it instead of defining it locally. The worker keeps its own copy (no cross-import). [VERIFIED: live source]

---

## Architecture Patterns

### Recommended New Module: `src/date-helpers.ts`

**What:** Exports `EPOCH_DATE`, `todayLocal()`, `puzzleNumber()`, `formatDate()`. No imports (pure computation). Zero side effects.

**When to use:** Imported by `app.ts` and `welcome.ts`. The worker keeps its own `puzzle.ts` copies untouched (strict no-cross-import boundary).

**Why a new file (not combining into `storage.ts`):** `storage.ts` imports `types.ts` and uses `localStorage`. A pure date module has no browser or storage dependencies — keeping it separate matches the "minimal public API per module" and "pure computation" patterns in CONVENTIONS. The CONTEXT.md comment in `welcome.ts` line 11 already says "Replicated from app.ts to avoid circular imports (RESEARCH.md recommendation)" — confirming the circular-import concern. `date-helpers.ts` resolves this without creating a new circular path.

**No circular import risk:** `app.ts` → `date-helpers.ts` (pure, no imports). `welcome.ts` → `date-helpers.ts` (pure, no imports). Neither module imports the other.

**Example module shape:**
```typescript
// src/date-helpers.ts
// Shared client-side date helpers. Pure computation — no browser APIs, no imports.

export const EPOCH_DATE = "2026-03-08"; // DO NOT MODIFY — breaks puzzleNumber determinism

export function todayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function puzzleNumber(dateStr: string): number {
  const ms = new Date(dateStr + "T00:00:00Z").getTime() - new Date(EPOCH_DATE + "T00:00:00Z").getTime();
  return Math.max(1, Math.floor(ms / 86400000) + 1);
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
```
[ASSUMED: module name and shape — matches CONTEXT.md intent + CONVENTIONS patterns; planner may adjust]

### Recommended Project Structure (additions only)

```
src/
├── date-helpers.ts    # NEW — shared client date helpers (todayLocal, puzzleNumber, formatDate, EPOCH_DATE)
├── app.ts             # MODIFIED — remove local date helpers, import from date-helpers.ts
├── welcome.ts         # MODIFIED — remove local date helpers, import from date-helpers.ts
├── storage.ts         # MODIFIED — add saveDraft / loadDraft / clearDraft
└── worker/
    └── index.ts       # MODIFIED — widen future-puzzle guard
```

### Pattern: Worker Future-Puzzle Guard Fix

**Current guard (src/worker/index.ts:101):**
```typescript
if (body.date > todayLocal()) {
  return json({ error: 'Cannot guess future puzzles' }, 400);
}
```

**Problem:** String comparison only. `todayLocal()` on the worker is UTC. A UK player who crossed local midnight but not UTC midnight sends a date string one day ahead of the worker's "today," triggering the guard.

**Fix:** Allow up to 1 calendar day of tolerance — accept `body.date` if it is at most 1 day beyond the worker's UTC "today." This covers all timezone offsets (UTC+14 at maximum). Puzzle generation is still keyed by the client's date so the correct puzzle is served.

**Precise implementation (D-04/D-05 — guard logic only, no API shape change):**
```typescript
// Replace the strict future check with a 1-day tolerance.
// Worker runs UTC; client local date can be up to 1 day ahead (UTC+14).
function isFuturePuzzleDate(date: string): boolean {
  const todayUtc = todayLocal(); // worker's todayLocal returns UTC date
  if (date <= todayUtc) return false;
  // Allow one day ahead (any timezone west of UTC-0 that crossed local midnight)
  const tomorrow = new Date(todayUtc + 'T00:00:00Z');
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const tomorrowStr = tomorrow.toISOString().slice(0, 10);
  return date > tomorrowStr;
}
// Then in handleGuess:
if (isFuturePuzzleDate(body.date)) {
  return json({ error: 'Cannot guess future puzzles' }, 400);
}
```
[ASSUMED: exact implementation — shape matches D-04/D-05 intent; planner may adjust the helper name]

The same guard also appears at `worker/index.ts:137` for `GET /api/puzzle/:num` and at line 150 for `GET /api/puzzle/:num/solution`. Both compare `date > todayLocal()`. The `/api/puzzle/:num` guard should also get the 1-day tolerance (a player can legitimately request today's puzzle by number). The `/solution` guard at line 150 uses `date >= todayLocal()` — this protects today's answer and should NOT get the tolerance (it would expose the current answer early). [VERIFIED: live source]

### Pattern: Mid-Game State Persistence

**localStorage key:** `dlng_draft` [ASSUMED — follows `dlng_` prefix convention per ARCHITECTURE.md; planner confirms]

**Schema:**
```typescript
interface DraftState {
  v: 1;                    // schema version — bump if shape changes
  date: string;            // YYYY-MM-DD (must match todayLocal() on restore)
  possibles: number[][];   // snapshot of possibles[i].values() per box (Set → Array for JSON)
  guesses: number[];       // wrong guesses so far
  activeBox: number | null;
  feedbackKey: string | null; // "incorrect" | "error" | null (not the rendered HTML)
}
```

**Why version field:** CONVENTIONS pattern — a schema version guard prevents a future shape change from crashing the loader silently. On mismatch, discard and start fresh.

**Save hooks — where to add:**
- After `toggleDigit()` resolves (digit elimination) — `app.ts` around line 390 (the `toggleDigit` function writes to `possibles` then calls `renderBox` and `checkSubmit`)
- After incorrect guess confirmed in `handleGuess()` — `app.ts` around line 680 (after `gameState.guesses.push(guess)`)
- After `selectBox()` / `openBox()` changes `activeBox` — `app.ts` around line 421-426 (after setting `activeBox`)

**Restore path — where to hook:**
In `startDailyPuzzle()` (`app.ts:534`), after confirming `!entry` (not already solved), attempt `loadDraft()`. If draft exists with matching `date`, rebuild state from it before calling `resetPuzzleUI()`:
1. Restore `possibles` from `draft.possibles` (Array → Set)
2. Set `gameState.guesses = draft.guesses`
3. Call existing `renderAllBoxes()` (idempotent)
4. Call existing `renderHistory(gameState.guesses)`
5. If `draft.activeBox !== null`, call `openBox(draft.activeBox)`
6. If `draft.feedbackKey === 'incorrect'`, call `renderFeedback('incorrect')`

**Clear hooks:**
- On solve: in `handleGuess()` after `result.correct` confirmed — `clearDraft()` before `renderCompletion` / `replaceRoute`
- On day rollover: `loadDraft()` checks `draft.date !== todayLocal()` and discards (returns null) — no explicit hook needed, the date guard handles it naturally
- Random + archive: `startRandomPuzzle` and `startReplayPuzzle` never call `saveDraft` or `restoreDraft` — they simply don't participate

**Storage helpers to add to `storage.ts`:**
```typescript
const STORAGE_DRAFT = "dlng_draft";

export function saveDraft(draft: DraftState): void {
  try {
    localStorage.setItem(STORAGE_DRAFT, JSON.stringify(draft));
  } catch { /* quota exceeded — non-critical */ }
}

export function loadDraft(): DraftState | null {
  try {
    const raw = localStorage.getItem(STORAGE_DRAFT);
    if (!raw) return null;
    const d = JSON.parse(raw) as DraftState;
    if (d?.v !== 1) return null; // schema mismatch — discard
    return d;
  } catch {
    return null;
  }
}

export function clearDraft(): void {
  try { localStorage.removeItem(STORAGE_DRAFT); } catch { /* ignore */ }
}
```
[ASSUMED: function names and schema — follows storage.ts patterns; planner may adjust]

**DraftState type:** Add to `src/types.ts`.

### Pattern: Streak Logic Analysis (#209)

**Current `computeStats` in `completion.ts:45-78`:**

The streak walk is a single pass over `history` (most-recent-first, as stored by `recordGame`). For each entry it parses `entry.date + 'T00:00:00'` (local midnight — correctly avoiding UTC shift at line 59). It computes `dayDiff` between consecutive entries. If `dayDiff === 1`, it increments `currentRun`. Otherwise it breaks the streak.

**The #209 under-counting root cause:**

When a user plays after local midnight but before UTC midnight, `recordGame` writes `entry.date = todayLocal()` (local, correct) but on subsequent app load the worker returns clues with `date: todayLocal()` (UTC, potentially yesterday). If the client uses the API-returned date to key the history entry, the entry is written with yesterday's UTC date while the next day's entry uses local date — creating a phantom gap of 2 in the history. After D-01..D-03, the client always uses `date-helpers.ts:todayLocal()` (local) and ignores the API-returned date for keying — the phantom gap cannot occur. [VERIFIED: live source tracing]

**Streak behavior with today unplayed:**

Looking at `computeStats`: it iterates history in insertion order (newest first via `unshift` in `recordGame`). The first entry is the most recently played day. If today is unplayed, the first entry is yesterday. The streak check compares consecutive pairs — it does not compare the first entry against today.

**Recommendation (Claude's Discretion):** Keep the streak alive when today is unplayed. A player with a 7-day streak who checks their stats before solving today should still see 7, not 0. The current code already does this — it measures the streak from the top of history, not from today. This matches Wordle's behavior and a daily-puzzle player's intuition. No change needed to `computeStats` streak logic once D-01..D-03 fix the date-keying bug.

**Streak counted from yesterday while today unplayed:** `computeStats` starts counting from the first history entry. If yesterday is present and today is absent, the streak starts from yesterday. This is correct Wordle-style behavior. [VERIFIED: live source — `completion.ts:58-75`]

**Existing-data healing:** Once `date-helpers.ts` is in place, all new history entries use local dates. Old entries that were written correctly (most entries, since the client always used `getDate()`) are unaffected. The only affected entries are those written with a UTC-displaced date — for BST users, this is entries recorded between 23:00 and 00:00 BST. Those entries will have been written one day behind the correct local date. The phantom gap this creates heals forward naturally as new correct entries are written. No migration needed. [ASSUMED: impact scope estimate — based on analysis of which code paths write history]

### Pattern: Countdown Alignment Confirmation

`completion.ts:83-93` — `formatCountdown` uses `midnight.setHours(24, 0, 0, 0)`. This sets the time to the next local midnight (24:00 today = 00:00 tomorrow, browser-local). This is already correct for a local-midnight model. No change needed. [VERIFIED: live source]

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---|---|---|---|
| Timezone-aware date serialization | Custom UTC formatter | `getFullYear/getMonth/getDate` (local methods) | Already correct in all three existing copies — just consolidate |
| Schema versioning for draft | Ad-hoc field checks | `v: 1` version field + strict equality check | Single integer is sufficient; complex semver is overkill at this scale |
| Streak gap detection | Custom date diff | `Math.round(diff / 86400000)` already in `computeStats:63` | Already handles DST (rounds nearest day) |

---

## Common Pitfalls

### Pitfall 1: Parsing `entry.date + 'T00:00:00Z'` (UTC) vs `'T00:00:00'` (local) in streak walk

**What goes wrong:** If `computeStats` or any new code parses a `YYYY-MM-DD` string with `T00:00:00Z`, it anchors at UTC midnight. For a UK user in BST, this shifts the local date by 1 hour earlier, producing midnight of the previous day in local time. Day-diff comparisons then show gaps of 2 where there should be 1.

**Why it happens:** `new Date("2026-06-01T00:00:00Z")` = UTC midnight = 01:00 BST. `new Date("2026-06-01T00:00:00")` = 00:00 BST. The Z makes it UTC-anchored.

**How to avoid:** Always parse stored date strings with `T00:00:00` (no Z) when doing day arithmetic in client code. The existing `computeStats` at `completion.ts:59` already does this correctly. Any new date arithmetic should follow the same pattern.

**Warning signs:** Streak drops by 1 unexpectedly for users in UTC+ timezones in summer.

### Pitfall 2: Draft restore racing with clue fetch

**What goes wrong:** `startDailyPuzzle` is called after the clue API resolves. If restore happens before `renderClues()` is called (clues not yet in the DOM), `renderAllBoxes()` has nothing to render into.

**Why it happens:** The restore path in `startDailyPuzzle` follows `renderClues(clues)` at line 534, so clues are already in the DOM. But if restore is wired in the wrong order, box renders silently no-op (no elements to query).

**How to avoid:** Call `restoreDraft()` only after `renderClues(clues)` has been called. `startDailyPuzzle` already calls `renderClues` as its first line (line 534) — restore must come after, not before.

**Warning signs:** Digit boxes appear blank on restore even though draft was saved.

### Pitfall 3: `todayEntry()` in `app.ts` reads from `storage.ts:loadHistory()` using `todayLocal()` from `app.ts`

**What goes wrong:** After extracting `todayLocal` to `date-helpers.ts`, the `todayEntry()` helper in `app.ts` (line 118-121) calls the local `todayLocal()`. If the import is added but the local definition is not removed, the old function silently shadows the import.

**Why it happens:** TypeScript allows a module-level function to shadow an import if both have the same name. No compiler error; the old function wins.

**How to avoid:** Remove the local `todayLocal`, `puzzleNumber`, and `formatDate` definitions in `app.ts` entirely after adding the import from `date-helpers.ts`. Same for `welcome.ts`. Remove the local `EPOCH_DATE` constant in both files.

**Warning signs:** `puzzleNumber` returns wrong values in `app.ts` while tests on `date-helpers.ts` pass.

### Pitfall 4: Draft survives across days if `clearDraft()` is not called on solve

**What goes wrong:** Player solves today's puzzle. Tomorrow they open the app. Draft still exists with yesterday's date. The date guard in `loadDraft()` rejects it (correct) — but only if the date check is in `loadDraft`. If the caller does the date check, a missed call path leaves stale draft.

**How to avoid:** Embed the staleness check inside `loadDraft()` itself: return null if `draft.date !== todayLocal()`. This makes it impossible for a caller to forget.

**Warning signs:** Player sees yesterday's eliminated digits briefly on first load of a new day before they clear.

### Pitfall 5: Saving draft on every `toggleDigit` call causes excess writes

**What goes wrong:** Each keypad tap calls `toggleDigit`, which would trigger `saveDraft` → `localStorage.setItem`. On slow devices with large history objects, this could be perceptible.

**Why it happens:** `dlng_draft` is a small object (at most 3 arrays of ≤10 numbers each plus a few scalars) — this is not a real problem for this app. Serialized size is under 200 bytes. `localStorage.setItem` is synchronous but fast at this scale.

**How to avoid:** No throttling needed. Document the decision explicitly in code comments so future maintainers don't add unnecessary debouncing.

### Pitfall 6: Worker guard fix exposes tomorrow's puzzle one day early

**What goes wrong:** Widening the guard by 1 day could let a player guess a puzzle date 1 day in the future if the KV key for tomorrow doesn't exist yet.

**Why this is not a real problem:** `getDailyPuzzle` generates and caches puzzles on demand. A player guessing tomorrow's date sends a correct `YYYY-MM-DD` string. The worker generates the puzzle for that date, serves clues, and validates the guess — all consistently. The "cannot guess future puzzles" guard is not a security boundary; it just prevents nonsensical date requests. Allowing 1 day ahead is intentional per D-04.

**Warning signs:** None — this is the intended fix. But document clearly in code that the tolerance is deliberate.

---

## Code Examples

### Exact current duplicate to remove from `app.ts` (lines 96-114)
```typescript
// ─── Date helpers ─────────────────────────────────────────────────────────────

function todayLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function puzzleNumber(dateStr: string): number {
  const ms = new Date(dateStr + "T00:00:00Z").getTime() - new Date(EPOCH_DATE + "T00:00:00Z").getTime();
  return Math.max(1, Math.floor(ms / 86400000) + 1);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
```
Replace with: `import { EPOCH_DATE, todayLocal, puzzleNumber, formatDate } from './date-helpers.ts';`

Note: `EPOCH_DATE` is also defined at `app.ts:51` in the constants section — remove that too.

### Exact current duplicate to remove from `welcome.ts` (lines 13-23)
```typescript
const EPOCH_DATE = "2026-03-08";

function todayLocal(): string { ... }
function puzzleNumber(dateStr: string): number { ... }
```
Replace with: `import { todayLocal, puzzleNumber } from './date-helpers.ts';`

(`formatDate` is not used in `welcome.ts` — `welcome.ts:131` inlines its own `toLocaleDateString` call. That inline call should also be replaced by `formatDate` from `date-helpers.ts` for consistency, but the planner decides scope.)

### Existing `startDailyPuzzle` restore hook location (`app.ts:534-551`)
```typescript
function startDailyPuzzle(date: string, num: number, clues: ClueData[]): void {
  renderClues(clues);             // line 535 — clues must be in DOM before restore

  const entry = todayEntry();     // line 537
  if (entry) {                    // already solved — show completed state
    ...
    return;
  }

  // HERE: attempt draft restore for unsolved daily
  // restoreDraft() goes between the `if (entry)` block and `gameState = { ... }` below

  gameState = { answer: null, guesses: [], solved: false, puzzleNum: num, date };
  resetPuzzleUI();
  ...
}
```

### Existing `handleGuess` — where to add `clearDraft()` (`app.ts:635-671`)
```typescript
if (result.correct) {
  gameState.solved = true;
  ...
  if (!gameState.isRandom && saveScore && gameState.date) {
    recordGame(gameState.date, tries, guess);
  }
  clearDraft(); // add HERE — after recordGame, before renderCompletion/replaceRoute
  ...
  renderCompletion(...);
  replaceRoute('/solved');
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|---|---|---|---|
| Single `puzzle.ts` shared across client+worker | Strict boundary: no client↔worker cross-import | Original architecture | Worker has its own `todayLocal` that produces UTC dates |
| `dlng_history` only (completed games) | `dlng_history` + `dlng_draft` (mid-game) | This phase | Players resume in-progress boards across reloads |

**Not outdated / no change needed:**
- `formatCountdown` local-midnight countdown — already correct (`setHours(24,0,0,0)`)
- `computeStats` day-diff rounding — `Math.round(diff / 86400000)` correctly handles DST transitions (a 23-hour DST day still rounds to 1)
- `isValidDate` in `route-resolver.ts` — UTC round-trip check is correct for archive URL validation (not date keying)

---

## Runtime State Inventory

This is a bug fix phase, not a rename/refactor. No stored data keys change names.

| Category | Items Found | Action Required |
|---|---|---|
| Stored data | `dlng_history` entries — written with `todayLocal()` (local) throughout; no UTC-displaced entries from random/archive flows | No migration — local date was always used for writes in the client |
| Stored data | `dlng_draft` — new key, does not exist yet | No migration |
| Live service config | None | — |
| OS-registered state | None | — |
| Secrets/env vars | None | — |
| Build artifacts | None | — |

**Nothing found in category:** OS-registered state, live service config, secrets/env vars, build artifacts — verified by code review. No state outside of localStorage and Cloudflare KV.

---

## Validation Architecture

### Test Framework
| Property | Value |
|---|---|
| Framework | vitest 2.1.9 + jsdom |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `npm test -- --reporter=verbose` |
| Full suite command | `npm test` |

**Pre-existing failure:** `tests/router.spec.ts` > "navigate(/archive) calls navigator.sendBeacon" — 1 test fails before this phase. Document in plan; do not regress it further.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|---|---|---|---|---|
| D-03 | `todayLocal()` returns local YYYY-MM-DD (not UTC) | unit | `npm test -- --reporter=verbose` | ❌ Wave 0 — `tests/date-helpers.spec.ts` |
| D-03 | `puzzleNumber()` is deterministic for same dateStr | unit | `npm test -- --reporter=verbose` | ❌ Wave 0 |
| D-03 | Duplicate helpers removed from `app.ts` / `welcome.ts` | static (TypeScript compile) | `npm run build` | n/a |
| D-04 | Worker guard rejects date > today + 1 day | unit | `npm test -- --reporter=verbose` | ❌ Wave 0 — `tests/worker-guard.spec.ts` |
| D-04 | Worker guard accepts date = today + 1 day (UTC+14 player) | unit | same | ❌ Wave 0 |
| D-06 | `saveDraft` / `loadDraft` round-trips correctly | unit | `npm test -- --reporter=verbose` | ❌ Wave 0 — `tests/storage-draft.spec.ts` |
| D-07 | `loadDraft` returns null when `draft.date !== todayLocal()` | unit | same | ❌ Wave 0 |
| D-07 | `clearDraft` wipes key | unit | same | ❌ Wave 0 |
| D-08 | `startRandomPuzzle` never calls `saveDraft` | unit/integration | manual verify + code review | n/a |
| Streak | `computeStats` streak stays alive when today is unplayed | unit | `npm test -- --reporter=verbose` | ❌ Wave 0 — `tests/completion-stats.spec.ts` |
| Streak | `computeStats` streak breaks when gap > 1 day | unit | same | ❌ Wave 0 |

### DST / Timezone Testing Strategy

vitest+jsdom runs in Node.js. To test `todayLocal()` across timezone boundaries:

- Use `vi.setSystemTime(new Date('2026-03-29T00:30:00+01:00'))` (BST: 00:30 local = 23:30 UTC previous day) and assert that `todayLocal()` returns the local date, not the UTC date. This is the exact failing scenario for #205.
- Use `vi.setSystemTime(new Date('2026-10-25T00:30:00Z'))` (clocks go back: ambiguous hour) to test DST fall-back.
- Set `TZ=Europe/London` for the test process (`cross-env TZ=Europe/London npm test`) to run the full suite under BST/GMT transition. [ASSUMED: cross-env approach — standard Node.js timezone override; verify cross-env is available or use `TZ=Europe/London npm test` directly on macOS/Linux]

**Alternative:** `vi.useFakeTimers()` + `vi.setSystemTime()` controls `new Date()`. This is the recommended vitest approach and avoids `cross-env`. [ASSUMED: vitest fake timer API — standard vitest feature, should be available at v2.1.x]

### Wave 0 Gaps

- [ ] `tests/date-helpers.spec.ts` — unit tests for `todayLocal`, `puzzleNumber`, `formatDate`, DST boundary cases
- [ ] `tests/storage-draft.spec.ts` — unit tests for `saveDraft`, `loadDraft`, `clearDraft`, stale-date discard, schema version mismatch
- [ ] `tests/worker-guard.spec.ts` — unit tests for the `isFuturePuzzleDate` helper (pure function, no Worker runtime needed)
- [ ] `tests/completion-stats.spec.ts` — unit tests for `computeStats` streak scenarios (today unplayed, gap in history, all same day)

---

## Security Domain

No authentication, session management, cryptography, or access control changes in this phase. The worker guard relaxation (D-04) widens acceptance by 1 day — this is intentional and does not expose the answer (puzzle generation is deterministic from date; the fix does not bypass answer validation). Input validation for `body.date` format (regex at `worker/index.ts:98`) is unchanged.

ASVS V5 (Input Validation): date format regex `^\d{4}-\d{2}-\d{2}$` remains in place. The guard only runs after format validation passes. No new input surfaces introduced.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|---|---|---|
| A1 | New module named `src/date-helpers.ts` | Architecture Patterns | Low — planner can rename; import paths must be updated consistently |
| A2 | New localStorage key named `dlng_draft` | Mid-Game Persistence | Low — planner can choose alternative; must update storage.ts and types.ts |
| A3 | `DraftState` schema with `v: 1` version field and listed fields | Mid-Game Persistence | Low — schema is internal; can change at any time before shipping |
| A4 | `isFuturePuzzleDate` as a named helper for the worker guard | Worker Guard Fix | Low — inline or any name works; behavior is what matters |
| A5 | `vi.setSystemTime()` for timezone tests | Validation Architecture | Low — standard vitest API at v2.x; fallback is `TZ=...` env var |
| A6 | `saveDraft()` called on every `toggleDigit` (no debounce) | Mid-Game Persistence | Low — object is tiny; if perf is observed issue, add debounce then |
| A7 | `formatDate` inline in `welcome.ts:131` should be replaced by import | Code Examples | Low — functional either way; consistency preferred |

---

## Open Questions

1. **Should `welcome.ts:131`'s inline `toLocaleDateString` call be replaced by `formatDate` from `date-helpers.ts`?**
   - What we know: `welcome.ts:131` has its own inline call `new Date(today + "T00:00:00").toLocaleDateString(...)` that duplicates `formatDate`'s logic exactly.
   - What's unclear: the CONTEXT.md only mentions removing the `todayLocal`/`puzzleNumber` duplicates explicitly; `formatDate` is listed as part of D-03 but `welcome.ts` doesn't currently have a `formatDate` function, only an inline call.
   - Recommendation: include it — consistency is more valuable than the tiny extra diff, and it means one canonical formatting path.

2. **Does `startReplayPuzzle` need a `clearDraft` call to prevent stale draft from loading on archive replay?**
   - What we know: `startReplayPuzzle` does not call `restoreDraft`. D-08 says random + archive start fresh. If draft restoration is gated inside `startDailyPuzzle` only, archive replays are already safe.
   - What's unclear: if a user abandons a daily mid-game, navigates to `/archive/<date>`, and returns to `/play`, the draft still exists. On `/play` re-entry, `startDailyPuzzle` runs, finds the draft, and restores it correctly. No issue.
   - Recommendation: no `clearDraft` call in `startReplayPuzzle`.

3. **Does the `feedbackKey` in draft need to store "correct"?**
   - What we know: if `result.correct`, `clearDraft()` is called immediately. A draft will never exist for a solved game.
   - Recommendation: `feedbackKey` only ever holds `"incorrect"` | `"error"` | `null`. No need to handle `"correct"` in the schema.

---

## Environment Availability

This phase requires no external tools. All dependencies are already installed.

| Dependency | Required By | Available | Version | Fallback |
|---|---|---|---|---|
| Node.js | vitest | ✓ | (existing) | — |
| vitest | test suite | ✓ | 2.1.9 | — |
| jsdom | test environment | ✓ | (vitest config) | — |
| TypeScript | compilation | ✓ | 6.0.2 | — |

Step 2.6: No external tool dependencies identified. All work is TypeScript source edits and new test files.

---

## Sources

### Primary (HIGH confidence)
- `src/app.ts` — date helpers at L96-114, game flow at L534-592, L599-692, boot at L860-928 [VERIFIED: read this session]
- `src/welcome.ts` — duplicate date helpers at L13-23, puzzle number display at L129-132 [VERIFIED: read this session]
- `src/worker/puzzle.ts:184-204` — worker `todayLocal` + `puzzleNumber` + `puzzleDate` [VERIFIED: read this session]
- `src/worker/index.ts:96-108` — `handleGuess` + future-puzzle guard at L101-103; also L137, L150 [VERIFIED: read this session]
- `src/completion.ts:45-93` — `computeStats` streak walk + `formatCountdown` [VERIFIED: read this session]
- `src/storage.ts` — `dlng_` key pattern, `loadHistory`/`recordGame` shape [VERIFIED: read this session]
- `src/types.ts` — `GameState`, `HistoryEntry`, `Prefs` interfaces [VERIFIED: read this session]
- `src/route-resolver.ts` — `isValidDate` round-trip check [VERIFIED: read this session]
- `vitest.config.ts` — jsdom environment, `tests/setup.ts` [VERIFIED: read this session]
- `docs/ARCHITECTURE.md` — localStorage key registry, strict client↔worker boundary [VERIFIED: read this session]
- `docs/CONVENTIONS.md` — data-* selectors, no cross-imports, module design patterns [VERIFIED: read this session]

### Secondary (MEDIUM confidence)
- Cloudflare Workers always run in UTC — confirmed by Cloudflare documentation (Workers execute in data centers globally; `new Date()` returns UTC because TZ is not set in the V8 isolate runtime). [CITED: developers.cloudflare.com/workers/runtime-apis/web-standards]

---

## Metadata

**Confidence breakdown:**
- Bug root cause analysis: HIGH — traced line-by-line in live source
- Standard stack (no new packages): HIGH — verified from package.json
- Architecture (module structure): HIGH — follows established patterns with no ambiguity
- Mid-game schema details: MEDIUM — logical design; exact field names are Claude's Discretion
- Worker guard exact implementation: MEDIUM — algorithm is clear; function signature is assumed
- Streak behavior: HIGH — verified by reading `computeStats` directly; recommendation matches code

**Research date:** 2026-05-29
**Valid until:** 2026-09-01 (stable codebase; only invalidated by changes to the files listed above)
