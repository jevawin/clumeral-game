// Clumeral — storage.ts
// localStorage helpers for prefs, game history, and active mid-game state.

import type { HistoryEntry, Prefs, ActiveState } from './types.ts';
import { todayKey } from './date.ts';

const STORAGE_HISTORY = "dlng_history";
const STORAGE_PREFS = "dlng_prefs";
const STORAGE_ACTIVE = "dlng_active";

// Max payload length guard for loadActive. ActiveState is tiny (< 200 bytes normally);
// 4096 bytes is a generous ceiling that still rejects any oversized/forged payload.
const ACTIVE_MAX_LEN = 4096;

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

export function recordGame(dateStr: string, tries: number, answer?: number): void {
  const history = loadHistory().filter((h) => h.date !== dateStr);
  history.unshift({ date: dateStr, tries, ...(answer != null && { answer }) });
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

    // Shape validation — possibles must be a length-3 array of arrays (T-05-08).
    if (!Array.isArray(d.possibles) || d.possibles.length !== 3 || !d.possibles.every(Array.isArray)) return null;

    // guesses must be an array.
    if (!Array.isArray(d.guesses)) return null;

    // activeBox must be a number or null (not a string or other type).
    if (d.activeBox !== null && typeof d.activeBox !== 'number') return null;

    return d as unknown as ActiveState;
  } catch {
    return null;
  }
}

export function clearActive(): void {
  try { localStorage.removeItem(STORAGE_ACTIVE); } catch { /* ignore */ }
}
