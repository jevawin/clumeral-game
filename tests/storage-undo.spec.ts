import { describe, it, expect, beforeEach } from 'vitest';
import { saveUndo, loadUndo, clearUndo } from '../src/storage.ts';
import type { StoredEntry } from '../src/undo-stack.ts';

// The undo stack lives in sessionStorage, not localStorage: it should survive a
// reload and a tab restore, but must not outlive the tab. setup.ts only clears
// localStorage, so clear sessionStorage here.
beforeEach(() => sessionStorage.clear());

const SCOPE = 'date:2026-05-29';

// The board the stack describes. saveUndo stores it; loadUndo refuses to hand the
// stack back unless the caller's board matches.
const BOARD: number[][] = [[1, 2], [0, 1, 2], [4, 5]];

function entries(): StoredEntry[] {
  return [
    { b: [[1, 2, 3], [0, 1, 2], [4, 5]], k: 'toggle' },
    { b: [[1, 2], [0, 1, 2], [4, 5]], k: 'reset' },
  ];
}

describe('saveUndo / loadUndo', () => {
  it('round-trips a stack', () => {
    saveUndo(SCOPE, entries(), BOARD);
    expect(loadUndo(SCOPE, BOARD)).toEqual(entries());
  });

  it('returns null when nothing is stored', () => {
    expect(loadUndo(SCOPE, BOARD)).toBeNull();
  });

  it('writes to sessionStorage, not localStorage', () => {
    saveUndo(SCOPE, entries(), BOARD);
    expect(sessionStorage.getItem('dlng_undo')).toBeTruthy();
    expect(localStorage.getItem('dlng_undo')).toBeNull();
  });

  it('clearUndo removes it', () => {
    saveUndo(SCOPE, entries(), BOARD);
    clearUndo();
    expect(loadUndo(SCOPE, BOARD)).toBeNull();
  });

  it('saving an empty stack clears the key rather than storing an empty payload', () => {
    saveUndo(SCOPE, entries(), BOARD);
    saveUndo(SCOPE, [], BOARD);
    expect(sessionStorage.getItem('dlng_undo')).toBeNull();
  });
});

// Scope is what stops one puzzle's stack being applied to another's board — the
// stack holds whole boards, so a cross-puzzle restore would be a real corruption.
describe('scope guard', () => {
  it('rejects a stack saved under a different date', () => {
    saveUndo('date:2026-05-28', entries(), BOARD);
    expect(loadUndo('date:2026-05-29', BOARD)).toBeNull();
  });

  it('rejects a daily stack when a random puzzle asks for it', () => {
    saveUndo(SCOPE, entries(), BOARD);
    expect(loadUndo('random:abc123', BOARD)).toBeNull();
  });

  it('rejects a different random token', () => {
    saveUndo('random:abc123', entries(), BOARD);
    expect(loadUndo('random:def456', BOARD)).toBeNull();
  });
});

// The scope check alone is not enough. This store is per-tab, but the board's
// own store (dlng_active) is shared across tabs, so two tabs on the same puzzle
// produce matching scopes over diverged boards. Without the board check, undoing
// after a reload jumps back by however many moves the other tab made — in one
// press, with no redo.
describe('board guard', () => {
  it('rejects a stack whose board has moved on', () => {
    saveUndo(SCOPE, entries(), BOARD);
    const movedOn = [[1, 2], [0, 1, 2], [4]];   // another tab eliminated the 5
    expect(loadUndo(SCOPE, movedOn)).toBeNull();
  });

  it('rejects when a box gained a digit as well as when it lost one', () => {
    saveUndo(SCOPE, entries(), BOARD);
    expect(loadUndo(SCOPE, [[1, 2], [0, 1, 2], [4, 5, 6]])).toBeNull();
  });

  it('accepts the same board written in a different digit order', () => {
    // Sets serialise in insertion order, and re-adding a digit puts it last, so
    // an identical board can come back with its digits shuffled.
    saveUndo(SCOPE, entries(), [[2, 1], [2, 0, 1], [5, 4]]);
    expect(loadUndo(SCOPE, BOARD)).toEqual(entries());
  });

  it('rejects a payload with no board recorded at all', () => {
    sessionStorage.setItem('dlng_undo', JSON.stringify({ v: 1, scope: SCOPE, e: entries() }));
    expect(loadUndo(SCOPE, BOARD)).toBeNull();
  });
});

// sessionStorage is user-editable, so every field is validated on read — same
// discipline as loadActive.
describe('payload validation', () => {
  const store = (raw: string) => sessionStorage.setItem('dlng_undo', raw);

  it('rejects unparseable JSON', () => {
    store('{not json');
    expect(loadUndo(SCOPE, BOARD)).toBeNull();
  });

  it('rejects a wrong schema version', () => {
    store(JSON.stringify({ v: 2, scope: SCOPE, e: entries() }));
    expect(loadUndo(SCOPE, BOARD)).toBeNull();
  });

  it('rejects an oversized payload', () => {
    store(JSON.stringify({ v: 1, scope: SCOPE, cur: BOARD, e: entries() }) + ' '.repeat(200_000));
    expect(loadUndo(SCOPE, BOARD)).toBeNull();
  });

  it('rejects entries that are not an array', () => {
    store(JSON.stringify({ v: 1, scope: SCOPE, cur: BOARD, e: 'nope' }));
    expect(loadUndo(SCOPE, BOARD)).toBeNull();
  });

  it('rejects an unknown entry kind', () => {
    store(JSON.stringify({ v: 1, scope: SCOPE, cur: BOARD, e: [{ b: [[1], [0], [0]], k: 'redo' }] }));
    expect(loadUndo(SCOPE, BOARD)).toBeNull();
  });

  it('rejects a board without exactly three boxes', () => {
    store(JSON.stringify({ v: 1, scope: SCOPE, cur: BOARD, e: [{ b: [[1], [0]], k: 'toggle' }] }));
    expect(loadUndo(SCOPE, BOARD)).toBeNull();
  });

  it('rejects an empty box — the game can never produce one', () => {
    store(JSON.stringify({ v: 1, scope: SCOPE, cur: BOARD, e: [{ b: [[1], [], [0]], k: 'toggle' }] }));
    expect(loadUndo(SCOPE, BOARD)).toBeNull();
  });

  it('rejects a zero in the hundreds box', () => {
    store(JSON.stringify({ v: 1, scope: SCOPE, cur: BOARD, e: [{ b: [[0, 1], [0], [0]], k: 'toggle' }] }));
    expect(loadUndo(SCOPE, BOARD)).toBeNull();
  });

  it('rejects out-of-range digits', () => {
    store(JSON.stringify({ v: 1, scope: SCOPE, cur: BOARD, e: [{ b: [[1], [10], [0]], k: 'toggle' }] }));
    expect(loadUndo(SCOPE, BOARD)).toBeNull();
  });

  it('rejects non-integer digits', () => {
    store(JSON.stringify({ v: 1, scope: SCOPE, cur: BOARD, e: [{ b: [[1], [1.5], [0]], k: 'toggle' }] }));
    expect(loadUndo(SCOPE, BOARD)).toBeNull();
  });

  it('rejects a stack longer than the cap', () => {
    const many = Array.from({ length: 101 }, () => ({ b: [[1], [0], [0]], k: 'toggle' }));
    store(JSON.stringify({ v: 1, scope: SCOPE, cur: BOARD, e: many }));
    expect(loadUndo(SCOPE, BOARD)).toBeNull();
  });

  it('accepts a valid payload at the boundary — a single-digit board', () => {
    store(JSON.stringify({ v: 1, scope: SCOPE, cur: BOARD, e: [{ b: [[9], [0], [0]], k: 'reset' }] }));
    expect(loadUndo(SCOPE, BOARD)).toEqual([{ b: [[9], [0], [0]], k: 'reset' }]);
  });
});
