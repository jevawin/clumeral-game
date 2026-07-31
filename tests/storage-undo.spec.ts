import { describe, it, expect, beforeEach } from 'vitest';
import { saveUndo, loadUndo, clearUndo } from '../src/storage.ts';
import type { StoredEntry } from '../src/undo-stack.ts';

// The undo stack lives in sessionStorage, not localStorage: it should survive a
// reload and a tab restore, but must not outlive the tab. setup.ts only clears
// localStorage, so clear sessionStorage here.
beforeEach(() => sessionStorage.clear());

const SCOPE = 'date:2026-05-29';

function entries(): StoredEntry[] {
  return [
    { b: [[1, 2, 3], [0, 1, 2], [4, 5]], k: 'toggle' },
    { b: [[1, 2], [0, 1, 2], [4, 5]], k: 'reset' },
  ];
}

describe('saveUndo / loadUndo', () => {
  it('round-trips a stack', () => {
    saveUndo(SCOPE, entries());
    expect(loadUndo(SCOPE)).toEqual(entries());
  });

  it('returns null when nothing is stored', () => {
    expect(loadUndo(SCOPE)).toBeNull();
  });

  it('writes to sessionStorage, not localStorage', () => {
    saveUndo(SCOPE, entries());
    expect(sessionStorage.getItem('dlng_undo')).toBeTruthy();
    expect(localStorage.getItem('dlng_undo')).toBeNull();
  });

  it('clearUndo removes it', () => {
    saveUndo(SCOPE, entries());
    clearUndo();
    expect(loadUndo(SCOPE)).toBeNull();
  });

  it('saving an empty stack clears the key rather than storing an empty payload', () => {
    saveUndo(SCOPE, entries());
    saveUndo(SCOPE, []);
    expect(sessionStorage.getItem('dlng_undo')).toBeNull();
  });
});

// Scope is what stops one puzzle's stack being applied to another's board — the
// stack holds whole boards, so a cross-puzzle restore would be a real corruption.
describe('scope guard', () => {
  it('rejects a stack saved under a different date', () => {
    saveUndo('date:2026-05-28', entries());
    expect(loadUndo('date:2026-05-29')).toBeNull();
  });

  it('rejects a daily stack when a random puzzle asks for it', () => {
    saveUndo(SCOPE, entries());
    expect(loadUndo('random:abc123')).toBeNull();
  });

  it('rejects a different random token', () => {
    saveUndo('random:abc123', entries());
    expect(loadUndo('random:def456')).toBeNull();
  });
});

// sessionStorage is user-editable, so every field is validated on read — same
// discipline as loadActive.
describe('payload validation', () => {
  const store = (raw: string) => sessionStorage.setItem('dlng_undo', raw);

  it('rejects unparseable JSON', () => {
    store('{not json');
    expect(loadUndo(SCOPE)).toBeNull();
  });

  it('rejects a wrong schema version', () => {
    store(JSON.stringify({ v: 2, scope: SCOPE, e: entries() }));
    expect(loadUndo(SCOPE)).toBeNull();
  });

  it('rejects an oversized payload', () => {
    store(JSON.stringify({ v: 1, scope: SCOPE, e: entries() }) + ' '.repeat(200_000));
    expect(loadUndo(SCOPE)).toBeNull();
  });

  it('rejects entries that are not an array', () => {
    store(JSON.stringify({ v: 1, scope: SCOPE, e: 'nope' }));
    expect(loadUndo(SCOPE)).toBeNull();
  });

  it('rejects an unknown entry kind', () => {
    store(JSON.stringify({ v: 1, scope: SCOPE, e: [{ b: [[1], [0], [0]], k: 'redo' }] }));
    expect(loadUndo(SCOPE)).toBeNull();
  });

  it('rejects a board without exactly three boxes', () => {
    store(JSON.stringify({ v: 1, scope: SCOPE, e: [{ b: [[1], [0]], k: 'toggle' }] }));
    expect(loadUndo(SCOPE)).toBeNull();
  });

  it('rejects an empty box — the game can never produce one', () => {
    store(JSON.stringify({ v: 1, scope: SCOPE, e: [{ b: [[1], [], [0]], k: 'toggle' }] }));
    expect(loadUndo(SCOPE)).toBeNull();
  });

  it('rejects a zero in the hundreds box', () => {
    store(JSON.stringify({ v: 1, scope: SCOPE, e: [{ b: [[0, 1], [0], [0]], k: 'toggle' }] }));
    expect(loadUndo(SCOPE)).toBeNull();
  });

  it('rejects out-of-range digits', () => {
    store(JSON.stringify({ v: 1, scope: SCOPE, e: [{ b: [[1], [10], [0]], k: 'toggle' }] }));
    expect(loadUndo(SCOPE)).toBeNull();
  });

  it('rejects non-integer digits', () => {
    store(JSON.stringify({ v: 1, scope: SCOPE, e: [{ b: [[1], [1.5], [0]], k: 'toggle' }] }));
    expect(loadUndo(SCOPE)).toBeNull();
  });

  it('rejects a stack longer than the cap', () => {
    const many = Array.from({ length: 101 }, () => ({ b: [[1], [0], [0]], k: 'toggle' }));
    store(JSON.stringify({ v: 1, scope: SCOPE, e: many }));
    expect(loadUndo(SCOPE)).toBeNull();
  });

  it('accepts a valid payload at the boundary — a single-digit board', () => {
    store(JSON.stringify({ v: 1, scope: SCOPE, e: [{ b: [[9], [0], [0]], k: 'reset' }] }));
    expect(loadUndo(SCOPE)).toEqual([{ b: [[9], [0], [0]], k: 'reset' }]);
  });
});
