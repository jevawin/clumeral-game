import { describe, it, expect } from 'vitest';
import {
  signature, exitDecision, stopOutcome, controlRowState, footerControls,
  countPatches, includesCssPatch, hasSomethingToSave, hasSomethingToDiscard,
  armOnTap, controlLabel, discardClosingLine,
} from '../src/edit-mode/pending.ts';
import { COPY } from '../src/edit-mode/copy.ts';
import { createHistory } from '../src/edit-mode/history.ts';
import type { Change } from '../src/edit-mode/history.ts';

// Plan task 2 and task 6. Brief items 11, 12, 13, 34, 40, 42.
//
// Driven through the REAL history module rather than hand-built arrays, because
// the case that matters — undo, then a different change — is about how
// history.ts actually behaves, not about string concatenation.

const sig = (entries: Change[], freeCss = '') => signature(entries, freeCss);

describe('is anything pending? (brief item 13)', () => {
  it('says yes once a change is made', () => {
    const history = createHistory();
    const before = sig(history.entries);
    history.record({ target: 'body>div', before: ['p-2'], after: ['p-4'], property: 'padding' }, 0);
    expect(sig(history.entries)).not.toBe(before);
  });

  it('still says yes after an undo and a DIFFERENT change of the same size', () => {
    // THE ONE THAT LOSES WORK. Counting entries would call this "not pending":
    // three entries at the save, three entries now. The pencil would then leave
    // edit mode posting nothing, and the change would die with the tab.
    const history = createHistory();
    history.record({ target: 'a', before: [], after: ['p-1'], property: 'padding' }, 0);
    history.record({ target: 'b', before: [], after: ['p-2'], property: 'padding' }, 1000);
    history.record({ target: 'c', before: [], after: ['p-3'], property: 'padding' }, 2000);
    const atSave = sig(history.entries);
    expect(history.entries).toHaveLength(3);

    history.undo();
    history.record({ target: 'd', before: [], after: ['m-9'], property: 'margin' }, 3000);

    expect(history.entries, 'the count is back to three').toHaveLength(3);
    expect(sig(history.entries), 'but the content is not').not.toBe(atSave);
  });

  it('notices a collapsed repeated step, which pushes no new entry', () => {
    // Holding + walks the scale and history.record collapses taps inside its
    // 600ms window, mutating the previous entry rather than appending. The
    // length never moves, so only content notices.
    const history = createHistory();
    history.record({ target: 'a', before: ['mt-1'], after: ['mt-2'], property: 'margin-top' }, 0);
    const atSave = sig(history.entries);
    history.record({ target: 'a', before: ['mt-2'], after: ['mt-3'], property: 'margin-top' }, 100);
    expect(history.entries).toHaveLength(1);
    expect(sig(history.entries)).not.toBe(atSave);
  });

  it('notices the free-CSS box changing on its own', () => {
    const history = createHistory();
    expect(sig(history.entries, 'margin-top: 1rem;')).not.toBe(sig(history.entries, ''));
  });

  it('says no when nothing has moved since the save', () => {
    const history = createHistory();
    history.record({ target: 'a', before: [], after: ['p-1'], property: 'padding' }, 0);
    const atSave = sig(history.entries);
    expect(sig(history.entries)).toBe(atSave);
  });
});

describe('tapping the pencil to leave (brief items 11, 12, 34)', () => {
  it('leaves without saving when nothing is pending', () => {
    expect(exitDecision(false, null)).toBe('leave');
  });

  it('leaves after a save that worked', () => {
    expect(exitDecision(true, true)).toBe('leave');
  });

  it('STAYS in the editor when the save failed', () => {
    // Brief item 11. Leaving would look like it worked, and the edits only
    // exist in the phone until a save succeeds.
    expect(exitDecision(true, false)).toBe('stay');
  });
});

describe('what Save & Stop reports (brief items 34, 40)', () => {
  it('reports stopped on a clean reply', () => {
    expect(stopOutcome('ok')).toBe('stopped');
  });

  it('reports STOPPED on a dropped connection', () => {
    // Brief item 40: a dead socket is what success looks like from the browser,
    // because the process it was talking to has exited.
    expect(stopOutcome('network-error')).toBe('stopped');
  });

  it('reports the failure only when a real error reply arrives', () => {
    expect(stopOutcome('http-error')).toBe('stopFailed');
  });
});

describe('which session controls are on screen (brief items 134, 135)', () => {
  const row = (stopped: boolean, somethingToSave: boolean, busy: boolean) =>
    controlRowState(stopped, somethingToSave, busy);

  it('shows Discard alone when there is nothing to save', () => {
    expect(row(false, false, false)).toEqual({
      discard: { visible: true, enabled: true },
      save: { visible: false, enabled: true },
    });
  });

  it('brings Save in as soon as there is something to save', () => {
    expect(row(false, true, false).save.visible).toBe(true);
  });

  it('SHOWS THE ROW IN EDIT MODE TOO, reversing the 2026-08-26 rule', () => {
    // The old rule hid the pill in edit mode because the pencil was the save
    // control there. Discard is not a save control - it is the permanent stop
    // button (Jamie, 2026-09-01: "if I start then change my mind I can stop the
    // server from the server rather than always devstop"). There is no mode
    // parameter left to hide it with (brief item 135).
    expect(controlRowState.length, 'no mode parameter').toBe(3);
    expect(row(false, false, false).discard.visible).toBe(true);
  });

  it('hides BOTH once the server has stopped, whatever else is true', () => {
    // Escape and the back gesture both reach setMode('play'), and neither may
    // resurrect a control pointing at a server that is no longer there. This
    // is the invariant that used to be carried by the mode parameter.
    const stopped = row(true, true, false);
    expect(stopped.discard.visible).toBe(false);
    expect(stopped.save.visible).toBe(false);
  });

  it('DISABLES rather than hides while a save or stop is in flight', () => {
    // A pencil save can still be running when Escape drops us into play mode.
    // A control that looks tappable but silently does nothing is this tool's
    // oldest complaint.
    const busy = row(false, true, true);
    expect(busy.discard).toEqual({ visible: true, enabled: false });
    expect(busy.save).toEqual({ visible: true, enabled: false });
  });
});

describe('which footer buttons are worth showing (brief item 134)', () => {
  it('shows neither with nothing selected', () => {
    // Both act on the selected element, so both are dead without one - even
    // with a full undo stack behind them.
    expect(footerControls(false, true, true)).toEqual({ undo: false, reset: false });
  });

  it('shows Undo only when there is a step to undo', () => {
    expect(footerControls(true, false, false).undo).toBe(false);
    expect(footerControls(true, true, false).undo).toBe(true);
  });

  it('shows Reset only when THIS element has been changed', () => {
    // Not "the history has something in it": resetting an untouched element is
    // a no-op that looks like a broken button.
    expect(footerControls(true, true, false).reset).toBe(false);
    expect(footerControls(true, true, true).reset).toBe(true);
  });

  it('shows both when both apply', () => {
    expect(footerControls(true, true, true)).toEqual({ undo: true, reset: true });
  });
});

// Plan task 3. Brief items 76, 121, 132, 152.
describe('is there anything worth posting? (brief item 121)', () => {
  const changed = (history: ReturnType<typeof createHistory>, at: string) =>
    signature(history.entries, '') !== at;

  it('says NO in a fresh session, where the pencil used to post nothing', () => {
    // THE WEDGE. A fresh session starts with savedSignature '' while the
    // signature of an empty history is '||', so they differed from the first
    // second. The pencil posted an empty session file, and with the server
    // stopped afterwards there was no way back into the editor at all.
    const history = createHistory();
    expect(hasSomethingToSave(countPatches(history.entries.length, '', false), true)).toBe(false);
    expect(exitDecision(false, null)).toBe('leave');
  });

  it('says NO after three edits are all undone', () => {
    // The case a sentinel-only fix misses (brief item 121). Initialising
    // savedSignature to signature([], '') fixes the fresh session and leaves
    // this one: the history is empty again, but it does not match the
    // signature recorded at the save, so the signature alone still says yes.
    const history = createHistory();
    history.record({ target: 'a', before: [], after: ['p-1'], property: 'padding' }, 0);
    history.record({ target: 'b', before: [], after: ['p-2'], property: 'padding' }, 1000);
    history.record({ target: 'c', before: [], after: ['p-3'], property: 'padding' }, 2000);
    const atSave = sig(history.entries);
    history.undo();
    history.undo();
    history.undo();

    expect(history.entries).toHaveLength(0);
    expect(changed(history, atSave), 'the signature still says yes').toBe(true);
    expect(hasSomethingToSave(countPatches(0, '', false), true)).toBe(false);
  });

  it('says yes when there are entries and they have moved since the save', () => {
    const history = createHistory();
    const atSave = sig(history.entries);
    history.record({ target: 'a', before: [], after: ['p-1'], property: 'padding' }, 0);
    expect(hasSomethingToSave(countPatches(history.entries.length, '', false), changed(history, atSave)))
      .toBe(true);
  });

  it('says NO when the entries have not moved since the save', () => {
    // Saved, and nothing touched since. Posting again would write a second
    // identical session file for /fold to trip over.
    const history = createHistory();
    history.record({ target: 'a', before: [], after: ['p-1'], property: 'padding' }, 0);
    const atSave = sig(history.entries);
    expect(hasSomethingToSave(countPatches(history.entries.length, '', false), changed(history, atSave)))
      .toBe(false);
  });

  it('counts the free-CSS box as a patch, but only with something selected', () => {
    // The css patch is recorded against the selected element's breadcrumb, so
    // typed CSS with nothing selected has nowhere to go.
    expect(includesCssPatch('margin-top: 1rem;', true)).toBe(true);
    expect(includesCssPatch('margin-top: 1rem;', false)).toBe(false);
    expect(includesCssPatch('', true)).toBe(false);
    expect(countPatches(0, 'margin-top: 1rem;', true)).toBe(1);
    expect(countPatches(2, 'margin-top: 1rem;', true)).toBe(3);
    expect(countPatches(2, 'margin-top: 1rem;', false)).toBe(2);
  });

  it('needs BOTH halves, so neither alone can post an empty set', () => {
    expect(hasSomethingToSave(0, true)).toBe(false);
    expect(hasSomethingToSave(3, false)).toBe(false);
    expect(hasSomethingToSave(3, true)).toBe(true);
  });
});

// Plan task 5. Brief items 24, 141, 143, and rev 2 H2.
describe('the two-tap gesture (brief item 24)', () => {
  it('arms on the first tap and acts on the second', () => {
    const first = armOnTap(null, 'discard');
    expect(first).toEqual({ armed: 'discard', act: null });
    expect(armOnTap(first.armed, 'discard')).toEqual({ armed: null, act: 'discard' });
  });

  it('ARMS THE OTHER ONE AND DISARMS THIS ONE', () => {
    // Brief item 141. Two armed buttons side by side, both asking a question,
    // both one tap from ending the session in opposite ways, is the exact
    // mistake this gesture exists to prevent.
    expect(armOnTap('discard', 'save')).toEqual({ armed: 'save', act: null });
    expect(armOnTap('save', 'discard')).toEqual({ armed: 'discard', act: null });
  });

  it('never acts on a first tap, from either control', () => {
    expect(armOnTap(null, 'save').act).toBeNull();
    expect(armOnTap(null, 'discard').act).toBeNull();
  });
});

describe('what each control says (brief item 143, rev 2 H2)', () => {
  it('says the plain word at rest', () => {
    expect(controlLabel('save', false, true)).toBe(COPY.stopControl);
    expect(controlLabel('discard', false, true)).toBe(COPY.discardControl);
  });

  it('asks the question when armed', () => {
    expect(controlLabel('save', true, true)).toBe(COPY.saveArmed);
    expect(controlLabel('discard', true, true)).toBe(COPY.discardArmed);
  });

  it('does not claim there is something to lose in a fresh session', () => {
    // Brief item 143. "Lose all and stop?" is a lie with nothing to lose, and
    // in a fresh session this button is only ever a way to stop the server.
    expect(controlLabel('discard', true, false)).toBe(COPY.discardArmedNothing);
  });

  it('STILL SAYS "lose all" after a save, because the edits are still there', () => {
    // The divergence rev 2's H2 found. Make three edits, tap Save, the save
    // succeeds: there is nothing left to SAVE, and asking that question would
    // have Discard offer "Stop the server?" while a screenful of visible work
    // sat on the page waiting to be thrown away.
    const savedAndUnchanged = hasSomethingToSave(countPatches(3, '', false), false);
    expect(savedAndUnchanged, 'nothing to save').toBe(false);
    expect(hasSomethingToDiscard(countPatches(3, '', false)), 'but plenty to lose').toBe(true);
    expect(controlLabel('discard', true, true)).toBe(COPY.discardArmed);
  });

  it('has nothing to discard only when there are no patches at all', () => {
    expect(hasSomethingToDiscard(0)).toBe(false);
    expect(hasSomethingToDiscard(1)).toBe(true);
  });
});

// Plan task 7, and rev 2 R13. Brief items 123, 140, 144.
describe('the last thing the page ever says after Discard', () => {
  it('says changes were discarded when there were changes and nothing banked', () => {
    expect(discardClosingLine('stopped', true, false)).toBe('discarded');
  });

  it('NAMES THE SAVED SESSIONS when earlier saves banked some', () => {
    // Brief item 123. Discard throws away what is in the phone; it cannot
    // reach a session file already written to the Pi. Saying "discarded"
    // alone would leave Jamie believing those were gone too - and nothing
    // else will ever mention them.
    expect(discardClosingLine('stopped', true, true)).toBe('discardedWithSaved');
  });

  it('does not claim to have discarded a fresh session, OR to have saved one', () => {
    // The whole reason this is two axes and not one. Discard is also the stop
    // button, so it is routinely tapped with nothing to throw away, and
    // "changes discarded" would be the last thing the page said about changes
    // that never existed.
    //
    // And NOT stoppedNothingSaved either, which rev 2's R13 sent this case to:
    // brief item 122 had since rewritten that line to always name the fold, so
    // it would end a fresh session telling Jamie to go and fold sessions that
    // were never written. That is his acceptance test 3, verbatim.
    expect(discardClosingLine('stopped', false, false)).toBe('stoppedNothing');
  });

  it('still names the fold when nothing was discarded but something was banked', () => {
    // Save with the pencil, then tap Discard. stoppedNothingSaved already says
    // both halves of this, which is what brief item 122 rewrote it for.
    expect(discardClosingLine('stopped', false, true)).toBe('stoppedNothingSaved');
  });

  it('says its own thing when the shutdown failed, on every combination', () => {
    // Brief item 140. stopFailed opens with "Saved", which is wrong twice
    // over here: nothing was saved, and the changes are gone on purpose.
    for (const discarded of [true, false]) {
      for (const banked of [true, false]) {
        expect(discardClosingLine('stopFailed', discarded, banked)).toBe('discardStopFailed');
      }
    }
  });
});
