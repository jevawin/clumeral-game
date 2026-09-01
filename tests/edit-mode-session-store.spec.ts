import { describe, it, expect, beforeEach } from 'vitest';
import { createSessionStore, storageKey } from '../src/edit-mode/session-store.ts';
import type { Change } from '../src/edit-mode/history.ts';

// C7 — an unfinished edit survives the tab going away (brief items 52-54, 105).
//
// Phone editing: Safari discards backgrounded tabs, the screen locks, a
// notification pulls him out. Losing twenty minutes of tweaks to an accidental
// app switch would make edit mode untrustworthy.

const BRANCH = 'dev/edit-mode-roundtrip';

const CHANGES: Change[] = [
  { target: 'main > div.card > button.submit-btn', property: 'margin-top', before: ['mt-4'], after: ['mt-6'] },
  { target: 'main > div.card', property: 'padding-inline', before: ['p-4'], after: ['p-4', 'px-6'] },
];

beforeEach(() => sessionStorage.clear());

describe('an unfinished edit comes back after a reload (brief item 52)', () => {
  it('restores the changes, the mode and the selection', () => {
    const store = createSessionStore(BRANCH, sessionStorage);
    store.save({ entries: CHANGES, mode: 'edit', selected: 'main > div.card' });

    // A new store, as if the page had just loaded.
    const restored = createSessionStore(BRANCH, sessionStorage).load();
    expect(restored.entries).toEqual(CHANGES);
    expect(restored.mode).toBe('edit');
    expect(restored.selected).toBe('main > div.card');
  });

  it('keeps the inverses, so back still has something to undo (item 105)', () => {
    // The browser still holds the pushed history entries after a reload. Saving
    // only the current class lists would leave back with entries it cannot
    // honour — it would appear to do nothing.
    const store = createSessionStore(BRANCH, sessionStorage);
    store.save({ entries: CHANGES, mode: 'edit', selected: null });
    expect(createSessionStore(BRANCH, sessionStorage).load().entries[0].before).toEqual(['mt-4']);
  });

  it('does not silently drop him back into play mode (item 53)', () => {
    const store = createSessionStore(BRANCH, sessionStorage);
    store.save({ entries: [], mode: 'edit', selected: null });
    expect(createSessionStore(BRANCH, sessionStorage).load().mode).toBe('edit');
  });

  it('starts in play mode when there is nothing saved', () => {
    expect(createSessionStore(BRANCH, sessionStorage).load()).toEqual({
      entries: [], mode: 'play', selected: null, savedSignature: '', freeCss: '',
    });
  });
});

describe('the key is the branch (finding L3)', () => {
  it('does not restore one branch-s edits against another-s markup', () => {
    // A patch set describes elements in ONE tree. Restored against a different
    // branch it would apply edits to whatever happened to match.
    createSessionStore(BRANCH, sessionStorage).save({ entries: CHANGES, mode: 'edit', selected: null });
    expect(createSessionStore('dev/other-thing', sessionStorage).load().entries).toEqual([]);
  });

  it('names the key after the branch', () => {
    expect(storageKey(BRANCH)).toBe('clumeral_edit_dev/edit-mode-roundtrip');
  });
});

describe('nothing unfinished reaches the Pi (brief item 54)', () => {
  it('uses sessionStorage, so it clears with the tab', () => {
    // localStorage would resurrect a stale edit days later against different
    // source. Jamie: "keep it on my phone not on the server."
    createSessionStore(BRANCH, sessionStorage).save({ entries: CHANGES, mode: 'edit', selected: null });
    expect(sessionStorage.getItem(storageKey(BRANCH))).toBeTruthy();
    expect(localStorage.getItem(storageKey(BRANCH))).toBeNull();
  });

  it('forgets everything when asked', () => {
    const store = createSessionStore(BRANCH, sessionStorage);
    store.save({ entries: CHANGES, mode: 'edit', selected: null });
    store.clear();
    expect(store.load().entries).toEqual([]);
  });
});

describe('when storage misbehaves', () => {
  it('starts clean rather than throwing on boot', () => {
    // A white screen is worse than a lost edit, and the GAME is underneath.
    sessionStorage.setItem(storageKey(BRANCH), '{ not json');
    expect(createSessionStore(BRANCH, sessionStorage).load().entries).toEqual([]);
  });

  it('ignores a saved shape it does not recognise', () => {
    sessionStorage.setItem(storageKey(BRANCH), JSON.stringify({ entries: 'nope', mode: 'sideways' }));
    const state = createSessionStore(BRANCH, sessionStorage).load();
    expect(state.entries).toEqual([]);
    expect(state.mode).toBe('play');
  });

  it('keeps working when saving is refused', () => {
    // Private mode, or the quota is full. The edit is still in memory and Done
    // still works; only the reload safety net is lost.
    const refusing = {
      getItem: () => null,
      setItem: () => { throw new Error('QuotaExceededError'); },
      removeItem: () => { throw new Error('QuotaExceededError'); },
    } as unknown as Storage;

    const store = createSessionStore(BRANCH, refusing);
    expect(() => store.save({ entries: CHANGES, mode: 'edit', selected: null })).not.toThrow();
    expect(() => store.clear()).not.toThrow();
  });
});

// Plan task 2 — the two fields that make "pending" survive a reload.
describe('the saved-signature marker (brief items 13, 42)', () => {
  it('round-trips the signature and the free-CSS box', () => {
    const store = createSessionStore(BRANCH, sessionStorage);
    store.save({
      entries: [], mode: 'play', selected: null,
      savedSignature: 'a=p-4||', freeCss: 'margin-top: 1rem;',
    });
    const back = createSessionStore(BRANCH, sessionStorage).load();
    expect(back.savedSignature).toBe('a=p-4||');
    expect(back.freeCss).toBe('margin-top: 1rem;');
  });

  it('falls back to empty when either field is the wrong type', () => {
    // A corrupt value must not throw on boot: the game is underneath, and a
    // white screen is worse than a lost marker.
    sessionStorage.setItem(
      storageKey(BRANCH),
      JSON.stringify({ entries: [], mode: 'play', selected: null, savedSignature: 7, freeCss: [] })
    );
    const state = createSessionStore(BRANCH, sessionStorage).load();
    expect(state.savedSignature).toBe('');
    expect(state.freeCss).toBe('');
  });

  it('defaults both when the key has never been written', () => {
    const state = createSessionStore('fresh-branch', sessionStorage).load();
    expect(state.savedSignature).toBe('');
    expect(state.freeCss).toBe('');
  });
});
