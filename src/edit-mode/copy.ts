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
  exitEditMode: 'Exit edit mode',
  undo: 'Undo',
  resetElement: 'Reset element',
  done: 'Done',
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
  saveFailed: 'Could not save. Your changes are still here — check the dev server is running and tap Done again.',

  /**
   * Brief item 75. Done is the seam between the two halves of this system, and
   * the second half is a command in a different app that nothing on screen
   * would otherwise mention.
   */
  saved: 'Saved. Tap /fold in Telegram to turn this into a pull request.',
} as const;

/** Brief item 42: surfaced, not silently tidied. It is Jamie's markup. */
export function conflictWarning(pairs: [string, string][]): string {
  const list = pairs.map(([a, b]) => `${a} and ${b}`).join(', ');
  return `This element already had ${list} fighting. CSS order decides the winner, so changes here may look unpredictable.`;
}
