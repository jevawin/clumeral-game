import { describe, it, expect } from 'vitest';
import {
  signature, exitDecision, stopOutcome, stopPillState,
  countPatches, includesCssPatch, hasSomethingToSave,
} from '../src/edit-mode/pending.ts';
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

describe('what Save & Stop looks like right now (brief items 39, 61)', () => {
  it('is on screen in play mode while the server runs', () => {
    expect(stopPillState('play', false, false)).toEqual({ visible: true, enabled: true });
  });

  it('is hidden in edit mode, where the pencil is the save control', () => {
    expect(stopPillState('edit', false, false).visible).toBe(false);
  });

  it('COMES BACK when the editor closes', () => {
    // The regression this exists for. The panel hides the pill on entering edit
    // mode and never shows it again, so a single call at startup meant
    // Save & Stop vanished for good the first time the editor was opened —
    // leaving no way at all to stop the server from the page.
    expect(stopPillState('edit', false, false).visible).toBe(false);
    expect(stopPillState('play', false, false).visible).toBe(true);
  });

  it('stays gone once the server has stopped', () => {
    // Escape and the back gesture both call setMode('play'), and neither may
    // resurrect a pill pointing at a server that is no longer there.
    expect(stopPillState('play', true, false).visible).toBe(false);
  });

  it('is visible but disabled while a save or stop is in flight', () => {
    // Disabled rather than hidden. A pencil save can still be running when
    // Escape drops us into play mode, and a pill that looks tappable but
    // silently does nothing is this tool's oldest complaint.
    expect(stopPillState('play', false, true)).toEqual({ visible: true, enabled: false });
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
