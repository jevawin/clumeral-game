// Clumeral — storage.ts
// localStorage helpers for prefs, game history, and active mid-game state, plus
// the sessionStorage-backed undo stack.

import type { HistoryEntry, Prefs, ActiveState } from './types.ts';
import type { StoredEntry } from './undo-stack.ts';
import { HISTORY_LIMIT } from './undo-stack.ts';
import { todayKey } from './date.ts';
import { validSeconds } from './player-stats.ts';

const STORAGE_HISTORY = "dlng_history";
const STORAGE_PREFS = "dlng_prefs";
const STORAGE_ACTIVE = "dlng_active";
const STORAGE_UNDO = "dlng_undo";   // sessionStorage — see the undo stack section below

// Max payload length guard for loadActive. ActiveState is tiny (< 200 bytes normally);
// 4096 bytes is a generous ceiling that still rejects any oversized/forged payload.
const ACTIVE_MAX_LEN = 4096;

// The undo stack holds up to HISTORY_LIMIT whole boards, so its ceiling is much
// higher than ActiveState's. Derived from HISTORY_LIMIT rather than duplicated:
// a hardcoded copy that fell behind would reject every stack a newer build wrote.
const UNDO_MAX_ENTRIES = HISTORY_LIMIT;
const UNDO_MAX_LEN = 32768;

// A board is three boxes, each a non-empty array of integer digits 0–9, with the
// hundreds box (index 0) forbidding 0 — the invariant startingBoard() establishes
// in undo-stack.ts. Rejects forged payloads with empty boxes, floats, or
// out-of-range values. Shared by loadActive and loadUndo, which both store boards.
function validBoxes(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    value.every(
      (box, i) =>
        Array.isArray(box) &&
        box.length >= 1 &&
        (box as unknown[]).every(
          (n) => Number.isInteger(n) && (n as number) >= 0 && (n as number) <= 9 && !(i === 0 && n === 0),
        ),
    )
  );
}

export function loadPrefs(): Prefs {
  try {
    return { saveScore: true, ...JSON.parse(localStorage.getItem(STORAGE_PREFS) || "{}") };
  } catch {
    return { saveScore: true };
  }
}

export function persistPrefs(saveScore: boolean): void {
  localStorage.setItem(STORAGE_PREFS, JSON.stringify({ saveScore }));
}

export function loadHistory(): HistoryEntry[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_HISTORY) || "[]") || [];
  } catch {
    return [];
  }
}

// Keep stored history sorted date-descending so out-of-order inserts never create a
// false gap when the streak walk reads it (push + sort makes insertion position
// irrelevant). Shared by recordGame and recordMarker, which both replace by date.
function writeHistory(dateStr: string, entry: HistoryEntry): void {
  const history = loadHistory().filter((h) => h.date !== dateStr);
  history.push(entry);
  history.sort((a, b) => b.date.localeCompare(a.date));
  localStorage.setItem(STORAGE_HISTORY, JSON.stringify(history));
}

/**
 * Record a solved game.
 *
 * `answer`, `archived` and `seconds` are an options object rather than three
 * positional arguments — a fourth positional flag is a bug waiting to happen.
 */
export function recordGame(
  dateStr: string,
  tries: number,
  opts: { answer?: number; archived?: boolean; seconds?: number } = {},
): void {
  const { answer, archived, seconds } = opts;
  // Include each optional field only when it has a value so entries stay lean
  // (absence of `archived` === live daily solve; absence of `seconds` === unknown).
  writeHistory(dateStr, {
    date: dateStr,
    tries,
    ...(answer != null && { answer }),
    ...(archived && { archived: true }),
    ...(validSeconds(seconds) !== null && { seconds }),
  });
}

/**
 * Write the day-only marker for a player with score saving off (brief 71): the
 * date and nothing else. It exists only so a refresh does not hand today's
 * puzzle back, and every figure filters markers out before counting anything.
 *
 * `tries` is present and zero deliberately (brief 123) — the code that averages
 * goes adds `tries` up, and a missing number there poisons the average silently.
 */
export function recordMarker(dateStr: string, archived = false): void {
  writeHistory(dateStr, { date: dateStr, tries: 0, marker: true, ...(archived && { archived: true }) });
}

/**
 * Delete the stored results, optionally leaving a day-only marker behind for one
 * date.
 *
 * The marker looks contradictory in a function called delete, and it is
 * load-bearing: hasPlayerData() returns true only if dlng_history exists or a
 * mid-game board does, and solving clears the mid-game board. So deleting
 * history right after solving today would leave neither, the router would send
 * the player to /welcome, and today's puzzle would become replayable. The marker
 * holds the date and nothing else, which is exactly what a player who opted out
 * gets anyway (brief 66, 71).
 *
 * The marker is written whenever a date is given, whether or not the deleted
 * history held a row for it. The only caller is the solve path, where the date
 * IS the day just finished and no row was ever written for it — saving is off,
 * so recordGame never ran. Writing it only when a row already existed (as the
 * plan's Task 1 first described) would leave that player with nothing, which is
 * the replay bug this exists to prevent.
 */
export function deleteHistory(keepMarkerFor?: string, archived = false): void {
  try {
    localStorage.removeItem(STORAGE_HISTORY);
    if (typeof keepMarkerFor === 'string' && keepMarkerFor) recordMarker(keepMarkerFor, archived);
  } catch { /* private mode / disabled storage — nothing to delete */ }
}

/**
 * The save-my-scores rule, stated once so it cannot drift.
 *
 * At the moment a correct answer lands: saving on records the game; saving off
 * deletes the stored history and leaves a day-only marker for the puzzle just
 * solved. That is the whole mechanism (brief 65). It holds no state between
 * sessions and needs no "pending deletion" flag — the rule is read at solve time
 * from the stored preference, not from something armed earlier in a session that
 * no longer exists.
 *
 * One call rather than two, because writing a marker on top of history that is
 * about to be deleted and then deleting it would be two steps that have to
 * agree. One call that does both cannot disagree with itself.
 */
export function recordSolve(
  dateStr: string,
  tries: number,
  opts: { saveScore: boolean; answer?: number; archived?: boolean; seconds?: number },
): void {
  if (opts.saveScore) {
    recordGame(dateStr, tries, { answer: opts.answer, archived: opts.archived, seconds: opts.seconds });
    return;
  }
  deleteHistory(dateStr, opts.archived === true);
}


// ─── Active mid-game state (D-06 / D-07) ──────────────────────────────────────
// Persists the board state between page loads so a player can resume mid-game.
// dlng_active is attacker-controllable localStorage — loadActive validates every
// field before returning anything to the app (T-05-08, T-05-09, T-05-11).

export function saveActive(state: ActiveState): void {
  // Payload is tiny (< 200 bytes) so no debounce or size throttle needed (Pitfall 5).
  // Wrap in try/catch — quota exceeded must never crash the game (non-critical write).
  try {
    localStorage.setItem(STORAGE_ACTIVE, JSON.stringify(state));
  } catch { /* quota exceeded — non-critical */ }
}

export function loadActive(): ActiveState | null {
  try {
    const raw = localStorage.getItem(STORAGE_ACTIVE);
    if (!raw) return null;

    // Reject oversized payloads before parse — protects against DoS via huge stored strings (T-05-09).
    if (raw.length > ACTIVE_MAX_LEN) return null;

    const d = JSON.parse(raw) as Record<string, unknown>;

    // Schema version guard — discard if shape has changed (T-05-08).
    if (d?.v !== 1) return null;

    // Stale-date guard — discard any state from a previous day (D-07, T-05-11).
    // Embedded here so callers cannot accidentally skip this check (RESEARCH Pitfall 4).
    if (typeof d.date !== 'string' || d.date !== todayKey()) return null;

    // Shape and cell validation (T-05-08, CR-01) — shared with loadUndo, which
    // stores whole boards too.
    if (!validBoxes(d.possibles)) return null;

    // guesses must be an array of integers in the valid puzzle range (100–999).
    if (!Array.isArray(d.guesses)) return null;
    if (!(d.guesses as unknown[]).every((g) => Number.isInteger(g) && (g as number) >= 100 && (g as number) <= 999)) return null;

    // activeBox must be null or an integer in the valid box range 0–2 (WR-04).
    // Rejecting out-of-range values prevents openBox(5) throwing on restore.
    if (d.activeBox !== null && !(Number.isInteger(d.activeBox) && (d.activeBox as number) >= 0 && (d.activeBox as number) <= 2)) return null;

    // feedbackKey must be one of the documented sentinel values (WR-03).
    if (d.feedbackKey !== null && d.feedbackKey !== 'incorrect' && d.feedbackKey !== 'error') return null;

    // elapsed and idles drop the FIELD when invalid, not the whole board — unlike
    // every check above. Those fields are load-bearing: a bad `possibles` means an
    // unusable board. These two are decoration, and throwing away a real mid-game
    // board because someone typed a float into `elapsed` is the worse outcome
    // (brief 121). An absent or rejected value simply means the clock restarts.
    const state = d as unknown as ActiveState;
    if (validSeconds(d.elapsed) === null) delete state.elapsed;
    if (!(Number.isInteger(d.idles) && (d.idles as number) >= 0 && (d.idles as number) <= 1000)) {
      delete state.idles;
    }

    return state;
  } catch {
    return null;
  }
}

export function clearActive(): void {
  try { localStorage.removeItem(STORAGE_ACTIVE); } catch { /* ignore */ }
}

// Does this browser hold anything worth returning to? Backs the router's RTE-03
// deep-link gate (docs/URL-ARCHITECTURE.md) — see the note there on why history
// alone was not enough.
//
// History alone missed the player who has never finished a puzzle: no history
// row exists until recordGame runs, so a first-timer refreshing mid-game failed
// the gate and was bounced from /play to /welcome with their board still sitting
// in dlng_active (#284). A restorable draft is data, so it counts here.
//
// A stranger following a shared /play link still has neither, so the redirect
// they exist for is unchanged. loadActive's date and schema guards do the work:
// yesterday's leftovers and forged payloads return null and so don't count.
export function hasPlayerData(): boolean {
  try {
    if (localStorage.getItem(STORAGE_HISTORY)) return true;
  } catch { /* private mode / disabled storage — fall through to the draft check */ }
  return loadActive() !== null;
}

// ─── Undo stack (#251) ───────────────────────────────────────────────────────
//
// sessionStorage, NOT localStorage, and deliberately so: the stack should survive
// a reload and a tab restore — otherwise a mis-tapped Reset followed by a refresh
// is unrecoverable — but it has no business outliving the tab. Yesterday's undo
// steps are noise, and the board itself already restores from dlng_active.
//
// `scope` identifies which puzzle the stack belongs to ("date:2026-05-29",
// "random:<token>"). The entries hold whole boards, so applying one puzzle's
// stack to another's board would silently corrupt it — the scope check is what
// prevents that, and it replaces loadActive's today-only date guard.

// Digit-order-insensitive board comparison. Sets serialise in insertion order,
// and re-adding a digit puts it at the end, so two identical boards can produce
// differently-ordered arrays.
function sameBoard(stored: unknown, current: number[][]): boolean {
  // Both sides validated. `current` comes from trusted callers today, so this is
  // belt-and-braces — but without it a malformed `current` would throw into
  // loadUndo's catch and read as "no stored stack" rather than as the bug it is.
  if (!validBoxes(stored) || !validBoxes(current)) return false;
  const asc = (a: number, b: number) => a - b;
  return (stored as number[][]).every((box, i) => {
    const x = [...box].sort(asc);
    const y = [...current[i]].sort(asc);
    return x.length === y.length && x.every((d, j) => d === y[j]);
  });
}

/**
 * Save the stack for `scope`, along with `current` — the board the stack
 * describes. An empty stack removes the key rather than storing an empty
 * payload: nothing to restore is the same state as nothing stored.
 */
export function saveUndo(scope: string, entries: StoredEntry[], current: number[][]): void {
  try {
    if (entries.length === 0) {
      sessionStorage.removeItem(STORAGE_UNDO);
      return;
    }
    sessionStorage.setItem(STORAGE_UNDO, JSON.stringify({ v: 1, scope, e: entries, cur: current }));
  } catch { /* quota exceeded — non-critical, undo just won't survive a reload */ }
}

/**
 * Returns the stored stack, or null if absent, stale, invalid, or describing a
 * different board than `current`.
 *
 * The board check is not belt-and-braces, it is load-bearing. This store is
 * per-tab but the board's own store (dlng_active) is shared across tabs, so
 * scope alone cannot tell you the two came from the same place: play in tab A,
 * play on in tab B, then reload tab A and the scopes still match while the
 * boards have diverged. Undoing then jumps the board back by however many moves
 * tab B made, in one press, with no redo.
 */
export function loadUndo(scope: string, current: number[][]): StoredEntry[] | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_UNDO);
    if (!raw) return null;

    // Reject oversized payloads before parse. A full stack of 100 boards is
    // roughly 5KB, so 32KB is generous and still rejects a DoS-sized string.
    if (raw.length > UNDO_MAX_LEN) return null;

    const d = JSON.parse(raw) as Record<string, unknown>;
    if (d?.v !== 1) return null;

    // Wrong puzzle — discard rather than apply another board's history.
    if (typeof d.scope !== 'string' || d.scope !== scope) return null;

    // Right puzzle, wrong board — another tab has moved the game on since this
    // stack was written.
    if (!sameBoard(d.cur, current)) return null;

    if (!Array.isArray(d.e) || d.e.length > UNDO_MAX_ENTRIES) return null;

    const entriesOk = (d.e as unknown[]).every((entry) => {
      if (typeof entry !== 'object' || entry === null) return false;
      const { b, k } = entry as Record<string, unknown>;
      return (k === 'toggle' || k === 'reset') && validBoxes(b);
    });
    if (!entriesOk) return null;

    return d.e as StoredEntry[];
  } catch {
    return null;
  }
}

export function clearUndo(): void {
  try { sessionStorage.removeItem(STORAGE_UNDO); } catch { /* ignore */ }
}
