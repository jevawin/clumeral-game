// Clumeral — player-stats.ts
// The counting rules. History rows in, every displayed figure out. Pure: no DOM,
// no localStorage, no clock of its own — so #163 (streaks on the game screen) and
// #148 (the share picture) can import it without dragging either along.
//
// Named player-stats, not stats: src/worker/stats.ts is the team's /stats
// dashboard, and two files called stats.ts doing unrelated jobs is how the wrong
// one gets edited.

import type { HistoryEntry } from './types.ts';

// ─── Shared constants ────────────────────────────────────────────────────────
//
// Two thresholds, not one, and the difference matters. The brief named 1800
// seconds for two different jobs and the two disagreed: a 65-minute game either
// shows "1h 05m" (brief 134) or shows a dash (brief 122), and it is one or the
// other. So they are split.

/** Validity bound. A stored time outside 0–86400 whole seconds is *unknown*: it
 *  shows as a dash, sends no event, never counts as zero, never enters an
 *  average, never becomes a fastest win. A day is comfortably absurd enough to
 *  catch a forged value while leaving a real long game alone (brief 122). */
export const MAX_STORED_SECONDS = 86_400;

/** Exclusion threshold. A *valid* time above thirty minutes still shows on its
 *  own panel, formatted with hours, and is left out of the average time and out
 *  of fastest first-go win (brief 31, 134). */
export const OUTLIER_SECONDS = 1800;

/** Two minutes with no action and the clock stops; the gap is thrown away
 *  entirely rather than paused (brief 34, 50). */
export const IDLE_TIMEOUT_MS = 120_000;

/** Streaks and all-time appear from the third countable game — the comparison is
 *  countableGames > REVEAL_AFTER_GAMES, so 1 and 2 hide and 3 reveals
 *  (brief 19, 131). */
export const REVEAL_AFTER_GAMES = 2;

/** Buckets for the goes chart. Nothing caps how many goes a player can take, so
 *  the tail collapses into one row (brief 133). */
export const GOES_BUCKETS: readonly string[] = ['1', '2', '3', '4', '5', '6+'];

/**
 * The stored time for one game, or null when it is unknown.
 *
 * Deliberately does NOT apply OUTLIER_SECONDS: 2000 is valid and shows on the
 * panel. The exclusion happens where averages are worked out, not here.
 */
export function validSeconds(value: unknown): number | null {
  if (typeof value !== 'number') return null;
  if (!Number.isInteger(value)) return null;
  if (value < 0 || value > MAX_STORED_SECONDS) return null;
  return value;
}
