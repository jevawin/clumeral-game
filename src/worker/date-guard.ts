// Worker-side future-puzzle date guard with +1 calendar day tolerance.
//
// Deliberate: a player in UTC+14 (Kiribati) is up to 14h ahead of UTC. At local
// midnight they see "tomorrow" locally while the worker still sees "today" in UTC.
// Rejecting their date would break the game for the first ~14h of each UTC day.
// Tolerance is bounded to exactly +1 calendar day — today+2 and beyond is still rejected.
//
// This does NOT expose tomorrow's answer: the /solution guard (date >= todayLocal())
// is left unchanged in index.ts (Pitfall 6 — puzzle generation is on-demand +
// deterministic from date; serving clues for +1 date leaks nothing).
//
// Phase 5 D-04 fix for issue #205 (worker gate rejects local-midnight players).
//
// Note: todayLocal() in puzzle.ts uses local-time methods (getFullYear/Month/Date).
// Cloudflare Workers always run UTC so those methods equal UTC in production.
// For testability via vi.setSystemTime(), this module uses UTC methods directly —
// behaviour is identical in production but respects fake-timer timezone in tests.

// Returns the current UTC wall date as YYYY-MM-DD.
function todayUtcStr(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

// Returns false when date should be allowed (today, past, or today+1).
// Returns true when date is today+2 or later (true future — reject).
// PRECONDITION: date must be a well-formed YYYY-MM-DD string — string comparison is
// used internally and behaves correctly only for that format (WR-06).
// Malformed input (wrong length, non-digit characters, e.g. "2026-5-9") returns true
// (reject) as a fail-safe so a bad caller cannot accidentally allow a forged date.
export function isFuturePuzzleDate(date: string): boolean {
  // Fail-safe: reject any date that is not a valid YYYY-MM-DD shape.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return true;

  const todayUtc = todayUtcStr();
  if (date <= todayUtc) return false;
  const tomorrow = new Date(todayUtc + 'T00:00:00Z');
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const tomorrowStr = tomorrow.toISOString().slice(0, 10);
  return date > tomorrowStr;
}
