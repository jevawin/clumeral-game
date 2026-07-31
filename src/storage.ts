// Clumeral — storage.ts
// localStorage helpers for prefs, game history, and active mid-game state, plus
// the sessionStorage-backed undo stack.

import type { HistoryEntry, Prefs, ActiveState } from './types.ts';
import type { StoredEntry } from './undo-stack.ts';
import { HISTORY_LIMIT } from './undo-stack.ts';
import { todayKey } from './date.ts';

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

export function recordGame(dateStr: string, tries: number, answer?: number, archived?: boolean): void {
  const history = loadHistory().filter((h) => h.date !== dateStr);
  // Include archived only when true so entries stay lean (absence === live daily solve).
  history.push({ date: dateStr, tries, ...(answer != null && { answer }), ...(archived && { archived: true }) });
  // Keep stored history sorted date-descending so out-of-order inserts never create a
  // false gap when computeStats walks it (push + sort makes insertion position irrelevant).
  history.sort((a, b) => b.date.localeCompare(a.date));
  localStorage.setItem(STORAGE_HISTORY, JSON.stringify(history));
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

    return d as unknown as ActiveState;
  } catch {
    return null;
  }
}

export function clearActive(): void {
  try { localStorage.removeItem(STORAGE_ACTIVE); } catch { /* ignore */ }
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
  if (!validBoxes(stored)) return false;
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
