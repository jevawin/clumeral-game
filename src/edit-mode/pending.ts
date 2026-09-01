// Clumeral edit mode — is there anything unsaved, and what to do about it.
//
// Three pure functions, extracted so the decisions this feature turns on can be
// tested without a DOM. overlay.ts is a wiring file with no seam of its own, and
// brief item 34 asks for exactly these cases: a failed save keeps you in the
// editor, a failed shutdown still reports the save as done, and the pending
// marker clears on a successful save.

import type { Change } from './history.ts';

/**
 * A fingerprint of everything that would be written by a save.
 *
 * DERIVED FROM THE ENTRIES' CONTENT, NOT THEIR COUNT, and the difference loses
 * work. Save at three entries, tap back once to undo, then make a different
 * change: the count is three again, so a count-based check says nothing is
 * pending, the pencil leaves the editor posting nothing, and the change dies
 * with the tab. Back-gesture undo is a normal path here — nextBackAction returns
 * 'undo' for as long as entries remain — not a corner case.
 *
 * A count also misses history.record() collapsing a repeated step inside its
 * 600ms window: that mutates the previous entry's `after` in place and pushes
 * nothing, so the length never moves.
 */
export function signature(entries: readonly Change[], freeCss: string): string {
  return `${entries.map((e) => `${e.target}=${e.after.join(' ')}`).join('|')}||${freeCss}`;
}

/**
 * Tapping the pencil to leave edit mode: does it actually leave?
 *
 * `saveOk` is null when no save was attempted, because nothing was pending
 * (brief item 12).
 *
 * Staying put on a failed save is brief item 11, and it is the one rule here
 * that exists to protect work rather than to feel tidy. The edits live in the
 * phone until a save succeeds, so leaving the editor after a failure would make
 * a lost session look like a finished one.
 */
export function exitDecision(pending: boolean, saveOk: boolean | null): 'leave' | 'stay' {
  if (!pending) return 'leave';
  return saveOk ? 'leave' : 'stay';
}

/**
 * What Save & Stop reports.
 *
 * A NETWORK ERROR COUNTS AS SUCCESS (brief item 40). A dropped connection is
 * exactly what a successful shutdown looks like from the browser — the process
 * exits and the socket dies. Treating it as failure would routinely show
 * "the server did not stop" for a shutdown that worked perfectly, and that is
 * the last thing the page will ever say.
 */
export function stopOutcome(
  result: 'ok' | 'network-error' | 'http-error'
): 'stopped' | 'stopFailed' {
  return result === 'http-error' ? 'stopFailed' : 'stopped';
}
