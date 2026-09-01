import { describe, it, expect } from 'vitest';
import { signature, exitDecision, stopOutcome } from '../src/edit-mode/pending.ts';
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
