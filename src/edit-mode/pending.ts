// Clumeral edit mode — is there anything unsaved, and what to do about it.
//
// Three pure functions, extracted so the decisions this feature turns on can be
// tested without a DOM. overlay.ts is a wiring file with no seam of its own, and
// brief item 34 asks for exactly these cases: a failed save keeps you in the
// editor, a failed shutdown still reports the save as done, and the pending
// marker clears on a successful save.

import type { Change } from './history.ts';
import { COPY } from './copy.ts';

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
 * Does the free-CSS box become a patch right now?
 *
 * ONE CONDITION IN ONE PLACE, called by countPatches below and by save() in
 * overlay.ts. It used to be two hand-written copies of the same expression in a
 * file no test can import, and "they cannot disagree" was an assertion rather
 * than something the code enforced.
 *
 * It needs a selection because the css patch is recorded against the selected
 * element's breadcrumb. Typed CSS with nothing selected has nowhere to go.
 */
export function includesCssPatch(freeCss: string, hasSelection: boolean): boolean {
  return freeCss !== '' && hasSelection;
}

/** How many patches a save would post, right now. */
export function countPatches(entryCount: number, freeCss: string, hasSelection: boolean): number {
  return entryCount + (includesCssPatch(freeCss, hasSelection) ? 1 : 0);
}

/**
 * Is there anything worth posting?
 *
 * THE RULE, NOT A VALUE, and that distinction is brief item 121. The obvious
 * fix was to start savedSignature at signature([], '') instead of '', so a
 * fresh session compares equal and nothing is posted. That fixes the fresh
 * session and misses the one beside it: make three edits, then undo all three.
 * The history is empty again, the signature no longer matches the one recorded
 * at the save, and the tool would post an empty patch set - writing a session
 * file with nothing in it and, before Discard existed, wedging the pencil.
 *
 * Requiring BOTH covers the pair. Nothing to post is nothing to post, however
 * the history got back to empty.
 */
export function hasSomethingToSave(patchCount: number, signatureChanged: boolean): boolean {
  return patchCount > 0 && signatureChanged;
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

/** What the two session controls should be doing right now. */
export interface ControlRowState {
  discard: { visible: boolean; enabled: boolean };
  save: { visible: boolean; enabled: boolean };
}

/**
 * The whole rule for the control row, in one place.
 *
 * DISCARD IS ALWAYS THERE while the server runs, in play mode and in edit mode
 * alike. Jamie, 2026-09-01: "always show discard so it's a permanent stop
 * button as well as a discard all edits button. If I start then change my mind
 * I can stop the server from the server rather than always devstop."
 *
 * That REVERSES the 2026-08-26 rule that hid the pill in edit mode on the
 * grounds that the pencil was the save control there (brief item 135). It was a
 * good rule for Save and never applied to a stop button, which is what Discard
 * also is.
 *
 * SAVE COMES AND GOES with there being something to save, so the row is two
 * buttons when there is work and one when there is not.
 *
 * `stopped` beats both. Escape and the back gesture both reach setMode('play'),
 * and neither may resurrect a control pointing at a server that has gone.
 *
 * `busy` DISABLES rather than hides. A save started from the pencil can still
 * be in flight when Escape drops us into play mode, and a control that looks
 * tappable but silently does nothing is this tool's oldest complaint.
 */
export function controlRowState(
  stopped: boolean,
  somethingToSave: boolean,
  busy: boolean
): ControlRowState {
  return {
    discard: { visible: !stopped, enabled: !busy },
    save: { visible: !stopped && somethingToSave, enabled: !busy },
  };
}

/**
 * Which footer buttons are worth showing.
 *
 * Jamie, 2026-09-01: "only show undo and reset when selected an element and
 * something to undo or reset". Both act on the selected element, and a button
 * that cannot do anything is one more thing between him and the screen — on a
 * panel that already covers the bottom of his phone.
 *
 * Reset asks whether THIS element has an original recorded, not whether the
 * history has anything in it: resetting an untouched element is a no-op that
 * looks like a broken button.
 */
export function footerControls(
  hasSelection: boolean,
  canUndo: boolean,
  elementChanged: boolean
): { undo: boolean; reset: boolean } {
  return {
    undo: hasSelection && canUndo,
    reset: hasSelection && elementChanged,
  };
}

/**
 * Which control is waiting for its second tap, if either.
 *
 * Both of these end the session and neither has an undo, so neither may fire
 * on one stray tap of a phone screen in a pocket (brief item 24). A tap arms;
 * the label expands into a question; a second tap acts.
 */
export type ArmedControl = 'save' | 'discard' | null;

/**
 * The gesture, whole, as a function of what was armed and what was tapped.
 *
 * Tapping the OTHER control disarms this one (brief item 141). Two armed
 * buttons side by side, both asking a question, both one tap from ending the
 * session in opposite ways, is the exact shape of the mistake this gesture
 * exists to prevent.
 */
export function armOnTap(
  current: ArmedControl,
  tapped: 'save' | 'discard'
): { armed: ArmedControl; act: 'save' | 'discard' | null } {
  if (current === tapped) return { armed: null, act: tapped };
  return { armed: tapped, act: null };
}

/**
 * Is there anything for Discard to throw away?
 *
 * A DIFFERENT QUESTION FROM hasSomethingToSave, and they diverge exactly where
 * it matters (rev 2, H2). Make three edits and tap Save: the save succeeds, so
 * there is nothing left to save - but the three edits are still on the screen
 * and Discard is still about to throw them away. Asked the other question,
 * Discard would offer "Stop the server?" while a screenful of work sat there.
 *
 * They coincide only before the first save.
 */
export function hasSomethingToDiscard(patchCount: number): boolean {
  return patchCount > 0;
}

/**
 * What a control says right now.
 *
 * The armed labels are questions, and Discard asks a different one when there
 * is nothing to lose (brief item 143): "Lose all and stop?" would be a lie in
 * a fresh session, where the button is only a way to stop the server.
 */
export function controlLabel(
  control: 'save' | 'discard',
  armed: boolean,
  somethingToDiscard: boolean
): string {
  if (control === 'save') return armed ? COPY.saveArmed : COPY.stopControl;
  if (!armed) return COPY.discardControl;
  return somethingToDiscard ? COPY.discardArmed : COPY.discardArmedNothing;
}

/** Which of the four closing lines the page ends on. */
export type ClosingLine =
  | 'discarded' | 'discardedWithSaved' | 'stoppedNothingSaved' | 'discardStopFailed';

/**
 * The last thing the page will ever say, chosen on TWO axes (rev 2, R13).
 *
 * Was anything actually thrown away, and is anything already banked on the Pi?
 * They are independent, and treating them as one axis got both ends wrong:
 * ending a fresh session claiming to have discarded changes that never
 * existed, or saying "discarded" flatly while session files sat on the server
 * that Discard cannot reach and nothing else will ever mention.
 *
 * Nothing discarded but something banked reuses stoppedNothingSaved, which
 * already names the fold - that IS the same sentence.
 */
export function discardClosingLine(
  outcome: 'stopped' | 'stopFailed',
  anythingDiscarded: boolean,
  anythingBanked: boolean
): ClosingLine {
  if (outcome === 'stopFailed') return 'discardStopFailed';
  if (!anythingDiscarded) return 'stoppedNothingSaved';
  return anythingBanked ? 'discardedWithSaved' : 'discarded';
}
