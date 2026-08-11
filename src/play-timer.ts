// Clumeral — play-timer.ts
// Best-effort "the player is actually here solving it" time. Pure counting core:
// an injected clock, no DOM, no globals, no ticking.
//
// No setInterval and nothing repeating. The timer is an accumulator driven by
// events: on each action it looks at the gap since the last one and either adds
// it or throws it away. A repeating tick would need starting, stopping and
// cleaning up across four code paths, would burn battery on a screen that is
// meant to be quiet, and is far harder to test than an injected clock. It would
// also give exactly the same number, because brief 29's rule is that an idle gap
// is discarded outright rather than paused.
//
// Known and accepted (brief 120): two tabs on the same puzzle each run their own
// timer and the last save wins. Not guarded.

import { IDLE_TIMEOUT_MS, MAX_STORED_SECONDS, validSeconds } from './player-stats.ts';

export interface PlayTimer {
  /** A real interaction: a digit toggle, a keypad press, undo, reset, submit. */
  activity(): void;
  /** The tab went away. Banks the gap up to now and stops the clock. */
  hide(): void;
  /** The tab came back. The clock restarts on the next action, not here. */
  show(): void;
  /** Counted whole seconds, always storable. */
  seconds(): number;
  /** How many times the idle cut-off has fired this game. */
  idles(): number;
  /** The analytics source label: 'clean' or `idle-${n}` (brief 38). */
  idleLabel(): string;
}

/**
 * Does this solve send a `puzzle_time` event?
 *
 * Its own function because the four conditions are the whole of brief 52, 132,
 * 141 and 122, and a condition quietly dropped from an `if` in the solve path
 * would be invisible — the event would simply start arriving from somewhere it
 * should not, and nobody would notice until the average looked wrong.
 *
 * Returns the seconds to send, or null to send nothing.
 */
export function playTimeToSend(opts: {
  isRandom: boolean;
  isArchiveSolve: boolean;
  saveScore: boolean;
  seconds: number;
}): number | null {
  // Randoms and archive replays are not daily play, so they stay out of the
  // average (brief 52, 132).
  if (opts.isRandom || opts.isArchiveSolve) return null;
  // Nothing about an opted-out player's play leaves the device (brief 141). The
  // cost is that the average is measured over opted-in players only, which is
  // worth remembering the first time that number looks surprising.
  if (!opts.saveScore) return null;
  // A junk value must not reach a number we will quote (brief 122).
  return validSeconds(opts.seconds);
}

export function createPlayTimer(opts: {
  now?: () => number;
  elapsed?: number;
  idles?: number;
} = {}): PlayTimer {
  const now = opts.now ?? Date.now;

  // A restored value is read back out of localStorage, so it gets the same
  // validation as everything else from there rather than being trusted.
  let elapsedMs = (validSeconds(opts.elapsed) ?? 0) * 1000;
  let idleCount =
    Number.isInteger(opts.idles) && (opts.idles as number) >= 0 ? (opts.idles as number) : 0;

  // null means the clock is not running: before the first action, and while the
  // tab is hidden.
  let last: number | null = null;
  let hidden = false;
  // Has the player acted at all? A restored board counts as started — they got
  // that elapsed time by playing. This is what stops show() resuming a clock
  // that has never run: opening the tab, switching away and coming back is not
  // solving, exactly as on first load (brief 27).
  let started = elapsedMs > 0;

  /** Close the open gap, adding it or discarding it. Returns nothing; the
   *  caller decides whether the clock keeps running afterwards. */
  function bank(at: number): void {
    if (last === null) return;
    const gap = at - last;
    // A backwards clock jump is not counted and is not an idle either — it is a
    // machine changing its mind about the time, not a player walking away.
    if (gap < 0) return;
    if (gap > IDLE_TIMEOUT_MS) { idleCount++; return; }
    elapsedMs += gap;
  }

  return {
    activity(): void {
      if (hidden) return;
      const at = now();
      bank(at);
      last = at;
      started = true;
    },
    hide(): void {
      if (hidden) return;
      bank(now());
      last = null;
      hidden = true;
    },
    show(): void {
      if (!hidden) return;
      hidden = false;
      // Coming back resumes the clock (brief 26) — but only for a player who had
      // already started. Time between returning and the next action is real
      // thinking time, and the idle cut-off still covers someone who comes back
      // and then wanders off again.
      last = started ? now() : null;
    },
    seconds(): number {
      const whole = Math.floor(Math.max(0, elapsedMs) / 1000);
      // Capped on read so what reaches storage is always storable. NOT capped at
      // OUTLIER_SECONDS: a genuinely long game keeps its real time and is left
      // out of the averages later (brief 31, 134).
      return Math.min(whole, MAX_STORED_SECONDS);
    },
    idles(): number {
      return idleCount;
    },
    idleLabel(): string {
      return idleCount === 0 ? 'clean' : `idle-${idleCount}`;
    },
  };
}
