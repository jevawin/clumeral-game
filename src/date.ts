// Shared client date helpers. Pure computation. DO NOT import from worker/ — strict client/worker boundary.
// Single source of truth for puzzle-day keying on the client side (D-01, D-02, D-03).

// ─── Epoch ────────────────────────────────────────────────────────────────────

// DO NOT MODIFY — breaks puzzleNumberFor determinism (all puzzle numbers are anchored to this date).
export const EPOCH_DATE = '2026-03-08';


// ─── Date helpers ─────────────────────────────────────────────────────────────

/**
 * Formats any Date to local YYYY-MM-DD using LOCAL getters only.
 * Never uses getUTC*, never uses toISOString for keying — those return UTC dates,
 * which cause the puzzle-day to flip at UTC midnight instead of local midnight (bug #205).
 */
export function localDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Returns the browser-LOCAL "today" date as YYYY-MM-DD.
 * Used everywhere on the client for puzzle-day keying — single source of truth.
 */
export function todayKey(): string {
  return localDateKey(new Date());
}

/**
 * Returns the puzzle number for a given date string.
 * Anchors both dates at T00:00:00Z for epoch arithmetic (the Z is correct here —
 * this is ms-difference math on two fixed date strings, not date keying).
 * puzzleNumberFor(EPOCH_DATE) === 1 always.
 */
export function puzzleNumberFor(dateStr: string): number {
  const ms = new Date(dateStr + 'T00:00:00Z').getTime() - new Date(EPOCH_DATE + 'T00:00:00Z').getTime();
  return Math.max(1, Math.floor(ms / 86400000) + 1);
}

/**
 * Returns a human-readable en-GB date string (e.g. "8 March 2026").
 * Parses with no Z suffix so the displayed day matches the local day,
 * not UTC midnight (a Z suffix would shift the display date in negative-offset timezones).
 */
export function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}
