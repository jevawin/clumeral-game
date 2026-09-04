// Clumeral edit mode — every word the tool says.
//
// In one file because two of these are load-bearing (brief §8): the Done-failed
// message is the one that loses work if it is wrong, and the empty-search
// message is the one that turns a dead end into the intended next step.
//
// The only reader is Jamie, so the register is terse. Two moments earn full
// sentences because getting them wrong loses work.
//
// tests/edit-mode-safety.spec.ts asserts these strings are ABSENT from the
// production bundle. They are pinned there rather than module paths because
// production JS is minified: paths vanish, copy does not.

export const COPY = {
  /** Brief item 71. */
  enterEditMode: 'Edit mode',
  exitEditMode: 'Save and exit edit mode',
  undo: 'Undo',
  // "Reset", not "Reset element" — Jamie, 2026-08-26. The shorter label fits
  // the footer on one row. The Save button that sat beside it is gone: the
  // pencil saves and leaves (brief item 1).
  resetElement: 'Reset',
  searchPlaceholder: 'Search classes',

  /**
   * Brief item 72. Not a bare "no results": the design treats the edge of the
   * scale as information, so it says what to do instead.
   */
  searchEmpty: 'Nothing on the scale matches. Describe what you want in words instead.',

  /**
   * Brief item 99. The class is not in this build, so it did nothing. Covers a
   * typo in the raw field, which search cannot protect against.
   */
  classNotInBuild: 'That class is not in this build.',

  /**
   * Brief item 73. The game reset the class after the change, so its fold-back
   * target is a condition in code, not a literal in the markup.
   */
  runtimeControlled:
    'The game reset this class after your change. It is set in code, so the bot will need to change a condition rather than a class.',

  /**
   * Brief item 74. THE one that loses work, so it is explicit that nothing is
   * lost yet — the edit lives on the phone until Done succeeds (item 54).
   */
  saveFailed: 'Could not save. Your changes are still here — check the dev server is running and tap the pencil again.',

  /**
   * Brief item 75. Saving is the seam between the two halves of this system,
   * and the second half happens in a different app that nothing on screen would
   * otherwise mention.
   *
   * NOT "/fold" — that command does not exist yet (brief item 62). Naming it
   * would leave Jamie tapping something that does nothing.
   */
  saved: 'Saved. Ask the bot in Telegram to fold this into a pull request.',

  /** The control that saves and then stops the dev server (brief item 26). */
  stopControl: 'Save & Stop',

  /**
   * The control that throws the session away and then stops the dev server
   * (brief item 30). ALWAYS on screen while the server runs, so it is the stop
   * button as well as the discard button — Jamie, 2026-09-01: "if I start then
   * change my mind I can stop the server from the server".
   */
  discardControl: 'Discard',

  /**
   * The second half of each control's two-tap gesture (brief item 24).
   *
   * A tap arms; the label expands to a question; a second tap acts. Both of
   * these end the session, and there is no undo for either, so neither may fire
   * on a single stray tap on a phone.
   */
  saveArmed: 'Save and stop?',
  discardArmed: 'Lose all and stop?',
  /**
   * The same gesture with nothing to lose (brief item 143). "Lose all" would be
   * a lie in a fresh session, and the button is the only way to stop the server
   * there — so it says what it will actually do.
   */
  discardArmedNothing: 'Stop the server?',

  /**
   * Brief item 27. THE LAST THING THIS PAGE WILL EVER SAY — the server it was
   * served from has gone — so it carries both next steps rather than one.
   */
  stopped:
    'Saved and the server has stopped. Ask the bot in Telegram to fold this into a pull request, or tap /dev to start again.',

  /**
   * Brief item 28. The work is safe and only the stop failed, so this must not
   * read like a lost session.
   */
  stopFailed: 'Saved, but the server did not stop. Use /devstop in Telegram.',

  /**
   * The same moment as `stopped`, but nothing was pending, so nothing was
   * written. Both other messages open with "Saved" — claiming one here would
   * send Jamie looking for a session that does not exist.
   *
   * It still names the fold, because this line IS reachable with a session on
   * disk (brief item 122): save with the pencil, then tap the control. Nothing
   * was pending at that second tap, but a session file was written moments
   * earlier and nothing else will ever mention it. Wording settled by Jamie,
   * 2026-09-03.
   */
  stoppedNothingSaved: 'The server has stopped. Sessions you saved earlier are still there — ask the bot in Telegram to fold them, or tap /dev to start another.',

  /**
   * Discard's closing line, when nothing had been banked (brief item 144).
   *
   * THE LAST THING THIS PAGE WILL EVER SAY, like `stopped`, so it carries the
   * way back as well as the outcome. It does NOT time out: item 41 asked for a
   * four-second revert and item 144 withdrew it, because a terminal message
   * that vanishes leaves a dead page saying nothing at all.
   */
  discarded: 'Changes discarded and the server has stopped. Tap /dev in Telegram to start again.',

  /**
   * The same, when earlier saves DID bank sessions (brief items 123, 144).
   *
   * Discard throws away what is in the phone. It cannot reach a session file
   * already written to the Pi, and saying "discarded" alone would leave Jamie
   * believing those were gone too.
   */
  discardedWithSaved: 'Changes discarded and the server has stopped. Sessions you saved earlier are still there — ask the bot in Telegram to fold them, or tap /dev to start again.',

  /**
   * Discard, when the shutdown itself failed (brief item 140).
   *
   * `stopFailed` opens with "Saved", which is wrong on both counts here:
   * nothing was saved, and the changes are gone on purpose.
   */
  discardStopFailed: 'Changes discarded, but the server did not stop. Use /devstop in Telegram.',

  /**
   * Brief item 46. The pencil is a glyph with no visible text, so its label is
   * an aria-label Jamie will never see on a phone. This line is the only actual
   * warning that a tap writes a file.
   */
  pencilHint: 'The pencil saves your changes and leaves the editor.',
} as const;

/** Brief item 42: surfaced, not silently tidied. It is Jamie's markup. */
export function conflictWarning(pairs: [string, string][]): string {
  const list = pairs.map(([a, b]) => `${a} and ${b}`).join(', ');
  return `This element already had ${list} fighting. CSS order decides the winner, so changes here may look unpredictable.`;
}
