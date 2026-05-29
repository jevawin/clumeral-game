# Phase 5: Timezone + State-Persistence Bug Cluster — Pattern Map

**Mapped:** 2026-05-29
**Files analyzed:** 9 (1 new source, 5 modified source, 4 new test)
**Analogs found:** 9 / 9

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/date-helpers.ts` | utility | transform | `src/worker/puzzle.ts` (L184–204) | role-match (pure computation, same function shapes) |
| `src/app.ts` | controller | request-response | itself — remove helpers, add import + draft hooks | self-modification |
| `src/welcome.ts` | component | request-response | itself — remove helpers, add import | self-modification |
| `src/storage.ts` | utility | CRUD | itself — add `saveDraft`/`loadDraft`/`clearDraft` | self-modification |
| `src/types.ts` | model | — | itself — add `DraftState` interface | self-modification |
| `src/worker/index.ts` | controller | request-response | itself — replace guard with `isFuturePuzzleDate` | self-modification |
| `tests/date-helpers.spec.ts` | test | transform | `tests/resolve-route.spec.ts` | exact (pure-function unit tests, no DOM) |
| `tests/storage-draft.spec.ts` | test | CRUD | `tests/resolve-route.spec.ts` + `tests/setup.ts` | exact (localStorage tests use `beforeEach` clear pattern from setup.ts) |
| `tests/worker-guard.spec.ts` | test | request-response | `tests/resolve-route.spec.ts` | exact (pure-function unit tests, no DOM) |
| `tests/completion-stats.spec.ts` | test | transform | `tests/completion-links.spec.ts` | exact (imports module under test, exercises exported functions) |

---

## Pattern Assignments

### `src/date-helpers.ts` (utility, transform) — NEW FILE

**Analog:** `src/worker/puzzle.ts` lines 184–204 (same three functions, same logic)

**Imports pattern** — no imports (pure computation, zero dependencies):
```typescript
// src/date-helpers.ts
// Shared client-side date helpers. Pure computation — no browser APIs, no imports.
// DO NOT import from worker/ — strict client↔worker boundary (CONVENTIONS).
```

**Core pattern** — copy verbatim from `src/worker/puzzle.ts` L184–204, with two adjustments:
1. Remove the `export` on `todayLocal` (it's already there in the worker copy — keep it)
2. Keep `EPOCH_DATE` as an export so `app.ts` and `welcome.ts` can import it:

```typescript
// src/worker/puzzle.ts lines 184-204 (exact source to copy from)
export function todayLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const EPOCH_DATE = '2026-03-08'; // Move to export; worker keeps its own private copy

export function puzzleNumber(dateStr: string): number {
  const ms = new Date(dateStr + 'T00:00:00Z').getTime() - new Date(EPOCH_DATE + 'T00:00:00Z').getTime();
  return Math.max(1, Math.floor(ms / 86400000) + 1);
}
```

**Additional export** — `formatDate` does not exist in worker; copy from `src/app.ts` L108–114:
```typescript
// src/app.ts lines 108-113 (source for formatDate)
export function formatDate(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
```

**EPOCH_DATE comment** — copy the "DO NOT MODIFY" guard from `src/worker/puzzle.ts` L193:
```typescript
// src/worker/puzzle.ts line 193
const EPOCH_DATE = '2026-03-08'; // equivalent comment must say: DO NOT MODIFY — breaks puzzleNumber determinism
```

---

### `src/app.ts` (controller, request-response) — MODIFIED

**What changes:** Remove date helper block (L96–114) and `EPOCH_DATE` constant (L51). Add import. Add `saveDraft`/`clearDraft` call sites.

**Imports pattern** — follow existing import block (L4–14). Add one line after `recordGame` import:
```typescript
// src/app.ts lines 4-14 (existing import block — add date-helpers line after storage import)
import type { GameState, ClueData } from './types.ts';
import { launchBubbles } from './bubbles.ts';
import { loadPrefs, persistPrefs, loadHistory, recordGame } from './storage.ts';
// ADD: import { EPOCH_DATE, todayLocal, puzzleNumber, formatDate } from './date-helpers.ts';
// ADD: import { saveDraft, loadDraft, clearDraft } from './storage.ts';  ← extend existing storage import
```

Note: extend the existing `storage.ts` import, do not add a second import from the same module.

**Helper removal** — delete these blocks entirely:
- `const EPOCH_DATE = "2026-03-08";` at L51
- The entire `// ─── Date helpers ─────` section (L96–114)

**Draft save hook** — after `gameState.guesses.push(guess)` at L679 (inside the `else` branch of `handleGuess`):
```typescript
// src/app.ts lines 678-684 (existing incorrect-guess branch — add saveDraft after push)
    } else {
      gameState.guesses.push(guess);
      // saveDraft(...) goes here — after push, before renderFeedback
      track("incorrect_guess");
      renderFeedback("incorrect");
      renderHistory(gameState.guesses);
      sadOcto();
```

**Draft clear hook** — after `recordGame` at L651 (inside `result.correct` branch):
```typescript
// src/app.ts lines 649-671 (existing correct-guess branch — add clearDraft after recordGame)
      if (!gameState.isRandom && saveScore && gameState.date) {
        recordGame(gameState.date, tries, guess);
      }
      // clearDraft() goes here

      const isArchiveSolve = !!gameState.date && gameState.date !== todayLocal();
```

**Draft restore hook** — inside `startDailyPuzzle` (L534–551), after the `if (entry)` block and before `gameState = { ... }`:
```typescript
// src/app.ts lines 534-551 (startDailyPuzzle — restore goes between entry check and gameState reset)
function startDailyPuzzle(date: string, num: number, clues: ClueData[]): void {
  renderClues(clues); // line 535 — clues in DOM before restore

  const entry = todayEntry(); // line 537
  if (entry) {
    // ... already solved path, unchanged
    return;
  }

  // HERE: attempt restoreDraft() before gameState = { ... }

  gameState = { answer: null, guesses: [], solved: false, puzzleNum: num, date };
  resetPuzzleUI();
```

---

### `src/welcome.ts` (component, request-response) — MODIFIED

**What changes:** Remove `EPOCH_DATE` constant (L13) and helper functions (L15–23). Replace inline `toLocaleDateString` call (L131) with `formatDate`. Add import.

**Imports pattern** — follow existing import at L6. Add one line:
```typescript
// src/welcome.ts line 6 (existing import — add date-helpers below it)
import { navigate } from './router.ts';
// ADD: import { todayLocal, puzzleNumber, formatDate } from './date-helpers.ts';
```

**Helper removal** — delete entirely:
- `const EPOCH_DATE = "2026-03-08";` at L13
- `function todayLocal(): string { ... }` at L15–18
- `function puzzleNumber(dateStr: string): number { ... }` at L20–23

**Inline call replacement** — L131 currently reads:
```typescript
// src/welcome.ts line 131 (current — replace with formatDate import)
const formattedDate = new Date(today + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
// Replace with:
const formattedDate = formatDate(today);
```

---

### `src/storage.ts` (utility, CRUD) — MODIFIED

**What changes:** Add `STORAGE_DRAFT` constant, `DraftState` import, and three new exported functions.

**Analog:** itself — follow the exact `loadHistory` / `recordGame` patterns already in the file.

**Imports pattern** — extend existing import at L4:
```typescript
// src/storage.ts line 4 (current)
import type { HistoryEntry, Prefs } from './types.ts';
// Extend to:
import type { HistoryEntry, Prefs, DraftState } from './types.ts';
```

**Key constant pattern** — follow L6–7:
```typescript
// src/storage.ts lines 6-7 (existing key pattern to copy)
const STORAGE_HISTORY = "dlng_history";
const STORAGE_PREFS = "dlng_prefs";
// ADD after line 7:
const STORAGE_DRAFT = "dlng_draft";
```

**saveDraft pattern** — model on `persistPrefs` (L17–19), which is the simplest fire-and-forget write:
```typescript
// src/storage.ts lines 17-19 (persistPrefs — template for saveDraft)
export function persistPrefs(saveScore: boolean): void {
  localStorage.setItem(STORAGE_PREFS, JSON.stringify({ saveScore }));
}
// saveDraft wraps in try/catch because draft write is non-critical (quota exceeded must not crash)
```

**loadDraft pattern** — model on `loadHistory` (L21–26) with the try/catch silent-fallback:
```typescript
// src/storage.ts lines 21-26 (loadHistory — template for loadDraft)
export function loadHistory(): HistoryEntry[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_HISTORY) || "[]") || [];
  } catch {
    return [];
  }
}
// loadDraft follows same shape but also checks v === 1 and draft.date === todayLocal()
```

**clearDraft pattern** — no existing analog for removeItem; follow the `try { ... } catch { /* ignore */ }` idiom:
```typescript
// Pattern: one-liner removeItem wrapped in try/catch (same silent-fallback convention)
export function clearDraft(): void {
  try { localStorage.removeItem(STORAGE_DRAFT); } catch { /* ignore */ }
}
```

**Full three-function block to add** (source: RESEARCH.md "Storage helpers" section, adapted to match existing file style):
```typescript
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
    if (d?.v !== 1) return null; // schema version mismatch — discard
    if (d.date !== todayLocal()) return null; // stale draft (yesterday's game) — discard
    return d;
  } catch {
    return null;
  }
}

export function clearDraft(): void {
  try { localStorage.removeItem(STORAGE_DRAFT); } catch { /* ignore */ }
}
```

Note: `loadDraft` needs `todayLocal` — import it from `./date-helpers.ts`. Add that import to `storage.ts`.

---

### `src/types.ts` (model) — MODIFIED

**What changes:** Add `DraftState` interface.

**Analog:** existing `HistoryEntry` and `Prefs` interfaces in the same file (L19–27).

**Interface pattern** — follow existing interface style (no `readonly`, flat fields, explicit types):
```typescript
// src/types.ts lines 19-27 (HistoryEntry + Prefs — template for DraftState)
export interface HistoryEntry {
  date: string;
  tries: number;
  answer?: number;
}

export interface Prefs {
  saveScore: boolean;
}
```

**DraftState to add:**
```typescript
export interface DraftState {
  v: 1;                       // schema version — bump if shape changes
  date: string;               // YYYY-MM-DD local date (must match todayLocal() on restore)
  possibles: number[][];      // Set<number>[] per box serialized as arrays
  guesses: number[];          // wrong guesses submitted this session
  activeBox: number | null;   // 0 | 1 | 2 | null
  feedbackKey: string | null; // "incorrect" | "error" | null
}
```

---

### `src/worker/index.ts` (controller, request-response) — MODIFIED

**What changes:** Extract a `isFuturePuzzleDate` helper and replace the two guard call sites that should get 1-day tolerance. Leave the `/solution` guard (`date >= todayLocal()`) unchanged.

**Analog:** existing `handleGuess` guard at L101–103 (the code being replaced).

**Guard location 1** — `handleGuess`, L101–103:
```typescript
// src/worker/index.ts lines 101-103 (current guard to replace)
if (body.date > todayLocal()) {
  return json({ error: 'Cannot guess future puzzles' }, 400);
}
// Replace with:
if (isFuturePuzzleDate(body.date)) {
  return json({ error: 'Cannot guess future puzzles' }, 400);
}
```

**Guard location 2** — `GET /api/puzzle/:num`, L137:
```typescript
// src/worker/index.ts line 137 (current guard to replace)
if (date > todayLocal()) return json({ error: 'Puzzle not available yet' }, 400);
// Replace with:
if (isFuturePuzzleDate(date)) return json({ error: 'Puzzle not available yet' }, 400);
```

**Guard location 3** — `/solution` at L150 — leave unchanged (`date >= todayLocal()` protects today's answer; no tolerance allowed):
```typescript
// src/worker/index.ts line 150 (DO NOT change — protects today's answer)
if (date >= todayLocal()) return json({ error: 'Solution not available' }, 403);
```

**Helper function pattern** — place near the top of the file, after the `json()` helper (L31–35), before `getDailyPuzzle`:
```typescript
// src/worker/index.ts lines 31-35 (json helper — add isFuturePuzzleDate after this block)
function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// ADD after json():
// Worker runs UTC; client local date can be up to 1 day ahead (UTC+14).
// Allow one calendar day of tolerance so a local-midnight player past their midnight
// but before UTC midnight is not rejected. Deliberate — see Phase 5 D-04.
function isFuturePuzzleDate(date: string): boolean {
  const todayUtc = todayLocal(); // worker's todayLocal returns UTC date
  if (date <= todayUtc) return false;
  const tomorrow = new Date(todayUtc + 'T00:00:00Z');
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const tomorrowStr = tomorrow.toISOString().slice(0, 10);
  return date > tomorrowStr;
}
```

---

### `tests/date-helpers.spec.ts` (test, transform) — NEW FILE

**Analog:** `tests/resolve-route.spec.ts` — pure-function unit tests, no DOM setup, no vi.mock needed.

**Imports pattern** (from `tests/resolve-route.spec.ts` L1–2):
```typescript
import { describe, it, expect } from 'vitest';
import { resolveRoute, isValidDate, type ResolveCtx } from '../src/route-resolver.ts';
// Mirror for date-helpers:
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { todayLocal, puzzleNumber, formatDate, EPOCH_DATE } from '../src/date-helpers.ts';
```

**Fake timer pattern for timezone tests** — `vi.useFakeTimers()` + `vi.setSystemTime()`. No analog exists yet; use vitest docs pattern:
```typescript
describe('todayLocal (DST boundary)', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('returns local YYYY-MM-DD, not UTC, at 00:30 BST (23:30 UTC prev day)', () => {
    // 2026-03-29 is the BST clock-change day. 00:30 local = 23:30 UTC (2026-03-28).
    vi.setSystemTime(new Date('2026-03-29T00:30:00+01:00'));
    expect(todayLocal()).toBe('2026-03-29'); // local date, not '2026-03-28'
  });
});
```

**Pure determinism test pattern** (from `tests/resolve-route.spec.ts` style — one assertion per `it`):
```typescript
describe('puzzleNumber', () => {
  it('returns 1 for EPOCH_DATE', () => {
    expect(puzzleNumber(EPOCH_DATE)).toBe(1);
  });

  it('returns 2 for the day after EPOCH_DATE', () => {
    expect(puzzleNumber('2026-03-09')).toBe(2);
  });
});
```

---

### `tests/storage-draft.spec.ts` (test, CRUD) — NEW FILE

**Analog:** `tests/resolve-route.spec.ts` structure + `tests/setup.ts` for `localStorage.clear()` in `beforeEach`.

**`beforeEach` pattern** — `tests/setup.ts` runs `localStorage.clear()` globally before every test. The storage tests can rely on this (setup.ts is registered in `vitest.config.ts`). No need to call `localStorage.clear()` explicitly in this file.

**Imports pattern:**
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { saveDraft, loadDraft, clearDraft } from '../src/storage.ts';
import type { DraftState } from '../src/types.ts';
```

**Fake timer pattern** — needed for `loadDraft`'s stale-date check (which calls `todayLocal()` internally):
```typescript
beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

it('loadDraft returns null when draft.date does not match todayLocal()', () => {
  vi.setSystemTime(new Date('2026-05-29T10:00:00'));
  const stale: DraftState = { v: 1, date: '2026-05-28', possibles: [[1],[2],[3]], guesses: [], activeBox: null, feedbackKey: null };
  saveDraft(stale);
  expect(loadDraft()).toBeNull();
});
```

**Schema version guard test:**
```typescript
it('loadDraft returns null when v !== 1', () => {
  localStorage.setItem('dlng_draft', JSON.stringify({ v: 2, date: '2026-05-29' }));
  expect(loadDraft()).toBeNull();
});
```

---

### `tests/worker-guard.spec.ts` (test, request-response) — NEW FILE

**Analog:** `tests/resolve-route.spec.ts` — pure-function unit tests. The `isFuturePuzzleDate` function is module-private in `worker/index.ts`, so it must be extracted to a named export or tested via a thin wrapper. The planner should ensure `isFuturePuzzleDate` is either exported from `worker/index.ts` or extracted to a small `worker/date-guard.ts` helper file that can be imported in tests.

**Imports pattern:**
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
// If extracted to worker/date-guard.ts:
import { isFuturePuzzleDate } from '../src/worker/date-guard.ts';
```

**Fake timer pattern** — same as above; `isFuturePuzzleDate` calls `todayLocal()` which calls `new Date()`:
```typescript
beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

it('accepts date equal to today UTC', () => {
  vi.setSystemTime(new Date('2026-05-29T12:00:00Z'));
  expect(isFuturePuzzleDate('2026-05-29')).toBe(false);
});

it('accepts date one day ahead (UTC+14 player at local midnight)', () => {
  vi.setSystemTime(new Date('2026-05-29T12:00:00Z')); // worker sees 2026-05-29
  expect(isFuturePuzzleDate('2026-05-30')).toBe(false); // one day ahead — allowed
});

it('rejects date two days ahead', () => {
  vi.setSystemTime(new Date('2026-05-29T12:00:00Z'));
  expect(isFuturePuzzleDate('2026-05-31')).toBe(true);
});
```

---

### `tests/completion-stats.spec.ts` (test, transform) — NEW FILE

**Analog:** `tests/completion-links.spec.ts` — imports the module under test dynamically, sets up DOM in `beforeEach`, uses `vi.resetModules()`.

**DOM setup pattern** (from `tests/completion-links.spec.ts` L3–13):
```typescript
function setupDOM(): void {
  document.body.innerHTML = `
    <div data-completion-octo></div>
    <h2 data-completion-heading></h2>
    <p data-completion-subheading></p>
    <div data-completion-stats></div>
    <p data-completion-countdown></p>
    <button data-completion-feedback></button>
    <div data-completion-links></div>
  `;
}
```

**Dynamic import pattern** (from `tests/completion-links.spec.ts` L16–21):
```typescript
describe('computeStats (streak logic)', () => {
  beforeEach(() => {
    setupDOM();
    vi.resetModules();
  });
```

**Note:** `computeStats` is currently module-private in `completion.ts`. The planner must either export it or test it indirectly via `renderCompletion` (which calls `loadHistory()` then `computeStats`). The indirect approach avoids exporting a private function — stub `localStorage` with specific history entries, call `renderCompletion`, then assert on `[data-completion-stats]` innerHTML.

**localStorage stub pattern** for streak tests:
```typescript
it('streak stays alive when today is unplayed (most recent entry is yesterday)', async () => {
  // Seed history: today unplayed, yesterday played, day before played.
  vi.setSystemTime(new Date('2026-05-29T10:00:00'));
  localStorage.setItem('dlng_history', JSON.stringify([
    { date: '2026-05-28', tries: 3 },
    { date: '2026-05-27', tries: 4 },
  ]));
  const mod = await import('../src/completion.ts');
  mod.renderCompletion(42, 3, false);
  const stats = document.querySelector('[data-completion-stats]')!;
  // streak box is the 3rd stat box (index 2)
  const boxes = stats.querySelectorAll('div');
  expect(boxes[2].querySelector('span')?.textContent).toBe('2'); // streak = 2
});
```

---

## Shared Patterns

### `dlng_` localStorage key convention
**Source:** `src/storage.ts` L6–7
**Apply to:** `src/storage.ts` new `STORAGE_DRAFT` constant, `src/types.ts` new key name
```typescript
// src/storage.ts lines 6-7
const STORAGE_HISTORY = "dlng_history";
const STORAGE_PREFS = "dlng_prefs";
// New key must follow same pattern: "dlng_draft"
```

### Try/catch silent-fallback for localStorage
**Source:** `src/storage.ts` L21–26 (`loadHistory`)
**Apply to:** All three new storage functions (`saveDraft`, `loadDraft`, `clearDraft`)
```typescript
// src/storage.ts lines 21-26
export function loadHistory(): HistoryEntry[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_HISTORY) || "[]") || [];
  } catch {
    return [];
  }
}
```

### Section header comment style
**Source:** `src/app.ts` L96 (and throughout all source files)
**Apply to:** New sections in `storage.ts` and `date-helpers.ts`
```typescript
// ─── Section Name ─────────────────────────────────────────────────────────────
```

### Local-midnight date parsing (no Z suffix)
**Source:** `src/completion.ts` L59
**Apply to:** Any new code in `tests/completion-stats.spec.ts` or `src/date-helpers.ts` that parses stored date strings
```typescript
// src/completion.ts line 59 — correct pattern
const d = new Date(entry.date + 'T00:00:00'); // local midnight — avoids UTC date shift
// NEVER: new Date(entry.date + 'T00:00:00Z') — that's UTC midnight, wrong for local streak math
```

### Idempotent render-from-state pattern
**Source:** `src/app.ts` `startDailyPuzzle` (L534–551), `renderAllBoxes`, `renderHistory`
**Apply to:** Draft restore path — call existing renderers after rebuilding state, do not write new DOM logic
```typescript
// Pattern: restore state → call existing idempotent renderers
// 1. Rebuild gameState from draft
// 2. Call renderAllBoxes() — reads possibles, redraws boxes
// 3. Call renderHistory(gameState.guesses) — reads guesses, redraws history
// 4. If draft.activeBox !== null, call openBox(draft.activeBox)
// These renderers already exist and are guaranteed to produce correct output from state alone.
```

### vi.useFakeTimers + vi.setSystemTime pattern
**Source:** vitest docs (no existing test uses it yet — this phase introduces the pattern)
**Apply to:** `tests/date-helpers.spec.ts`, `tests/storage-draft.spec.ts`, `tests/worker-guard.spec.ts`
```typescript
beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });
// Inside test:
vi.setSystemTime(new Date('2026-03-29T00:30:00+01:00'));
```

---

## No Analog Found

All files have analogs in the codebase. No entries.

---

## Key Constraints for Planner

- **Client↔worker boundary is strict.** `src/date-helpers.ts` must NOT be imported from `src/worker/`. The worker keeps its own `todayLocal` / `puzzleNumber` in `src/worker/puzzle.ts`. These are intentionally separate copies.
- **`isFuturePuzzleDate` testability.** This private worker helper needs to be exported or extracted to be unit-tested. The planner must decide: export from `worker/index.ts` (simplest) or create `src/worker/date-guard.ts` (cleanest). Either is acceptable; document the choice.
- **`computeStats` is private.** Test it indirectly via `renderCompletion` + `localStorage` seed, or export it. Exporting is simpler; indirect testing avoids API surface change.
- **Pre-existing test failure.** `tests/router.spec.ts` > "navigate(/archive) calls navigator.sendBeacon" already fails before this phase. Do not regress it further; document in the plan.
- **Draft restore order.** `restoreDraft()` must be called only after `renderClues(clues)` in `startDailyPuzzle`. Clue elements must be in the DOM before box renderers are invoked.

---

## Metadata

**Analog search scope:** `src/`, `tests/`
**Files scanned:** 20 source files + 4 test files
**Pattern extraction date:** 2026-05-29
