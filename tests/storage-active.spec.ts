import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { saveActive, loadActive, clearActive } from '../src/storage.ts';
import type { ActiveState } from '../src/types.ts';

// setup.ts runs localStorage.clear() before every test globally — no explicit clear needed here.

const TODAY = '2026-05-29';
const YESTERDAY = '2026-05-28';

function makeState(overrides: Partial<ActiveState> = {}): ActiveState {
  return {
    v: 1,
    date: TODAY,
    possibles: [[1, 2, 3], [4, 5], [7]],
    guesses: [123, 456],
    activeBox: 1,
    feedbackKey: 'incorrect',
    ...overrides,
  };
}

describe('saveActive / loadActive round-trip', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('round-trips a complete ActiveState (same local day)', () => {
    vi.setSystemTime(new Date(TODAY + 'T10:00:00'));
    const state = makeState();
    saveActive(state);
    const loaded = loadActive();
    expect(loaded).not.toBeNull();
    expect(loaded!.possibles).toEqual([[1, 2, 3], [4, 5], [7]]);
    expect(loaded!.guesses).toEqual([123, 456]);
    expect(loaded!.activeBox).toBe(1);
    expect(loaded!.feedbackKey).toBe('incorrect');
    expect(loaded!.v).toBe(1);
    expect(loaded!.date).toBe(TODAY);
  });

  it('round-trips activeBox: null', () => {
    vi.setSystemTime(new Date(TODAY + 'T10:00:00'));
    saveActive(makeState({ activeBox: null }));
    expect(loadActive()!.activeBox).toBeNull();
  });

  it('round-trips feedbackKey: null', () => {
    vi.setSystemTime(new Date(TODAY + 'T10:00:00'));
    saveActive(makeState({ feedbackKey: null }));
    expect(loadActive()!.feedbackKey).toBeNull();
  });

  it('round-trips empty guesses array', () => {
    vi.setSystemTime(new Date(TODAY + 'T10:00:00'));
    saveActive(makeState({ guesses: [] }));
    expect(loadActive()!.guesses).toEqual([]);
  });

  it('round-tripped object has no clues property (D-06 — never persist clues)', () => {
    vi.setSystemTime(new Date(TODAY + 'T10:00:00'));
    saveActive(makeState());
    const loaded = loadActive();
    expect(loaded).not.toBeNull();
    expect('clues' in loaded!).toBe(false);
  });
});

describe('loadActive fail-safe — missing / empty', () => {
  it('returns null when nothing is stored', () => {
    expect(loadActive()).toBeNull();
  });
});

describe('loadActive fail-safe — schema version', () => {
  it('returns null when v !== 1 (v: 2)', () => {
    localStorage.setItem('dlng_active', JSON.stringify({ v: 2, date: TODAY, possibles: [[1],[2],[3]], guesses: [], activeBox: null, feedbackKey: null }));
    expect(loadActive()).toBeNull();
  });

  it('returns null when v is missing entirely', () => {
    localStorage.setItem('dlng_active', JSON.stringify({ date: TODAY, possibles: [[1],[2],[3]], guesses: [], activeBox: null, feedbackKey: null }));
    expect(loadActive()).toBeNull();
  });
});

describe('loadActive fail-safe — stale date (D-07)', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('returns null when payload.date is yesterday (day-rollover discard)', () => {
    vi.setSystemTime(new Date(TODAY + 'T00:05:00'));
    const stale = makeState({ date: YESTERDAY });
    saveActive(stale);
    expect(loadActive()).toBeNull();
  });

  it('returns non-null when payload.date matches todayKey()', () => {
    vi.setSystemTime(new Date(TODAY + 'T10:00:00'));
    saveActive(makeState({ date: TODAY }));
    expect(loadActive()).not.toBeNull();
  });
});

describe('loadActive fail-safe — garbage/non-JSON input', () => {
  it('returns null and does NOT throw on non-JSON garbage', () => {
    localStorage.setItem('dlng_active', '{not json at all!!!');
    expect(() => loadActive()).not.toThrow();
    expect(loadActive()).toBeNull();
  });

  it('returns null on plain string value', () => {
    localStorage.setItem('dlng_active', 'hello world');
    expect(loadActive()).toBeNull();
  });
});

describe('loadActive fail-safe — wrong shape', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('returns null when possibles is missing', () => {
    vi.setSystemTime(new Date(TODAY + 'T10:00:00'));
    localStorage.setItem('dlng_active', JSON.stringify({ v: 1, date: TODAY, guesses: [], activeBox: null, feedbackKey: null }));
    expect(loadActive()).toBeNull();
  });

  it('returns null when possibles is not an array', () => {
    vi.setSystemTime(new Date(TODAY + 'T10:00:00'));
    localStorage.setItem('dlng_active', JSON.stringify({ v: 1, date: TODAY, possibles: 'bad', guesses: [], activeBox: null, feedbackKey: null }));
    expect(loadActive()).toBeNull();
  });

  it('returns null when possibles.length !== 3', () => {
    vi.setSystemTime(new Date(TODAY + 'T10:00:00'));
    localStorage.setItem('dlng_active', JSON.stringify({ v: 1, date: TODAY, possibles: [[1],[2]], guesses: [], activeBox: null, feedbackKey: null }));
    expect(loadActive()).toBeNull();
  });

  it('returns null when guesses is not an array', () => {
    vi.setSystemTime(new Date(TODAY + 'T10:00:00'));
    localStorage.setItem('dlng_active', JSON.stringify({ v: 1, date: TODAY, possibles: [[1],[2],[3]], guesses: 'bad', activeBox: null, feedbackKey: null }));
    expect(loadActive()).toBeNull();
  });

  it('returns null when activeBox is a string (not number|null)', () => {
    vi.setSystemTime(new Date(TODAY + 'T10:00:00'));
    localStorage.setItem('dlng_active', JSON.stringify({ v: 1, date: TODAY, possibles: [[1],[2],[3]], guesses: [], activeBox: 'open', feedbackKey: null }));
    expect(loadActive()).toBeNull();
  });
});

describe('loadActive fail-safe — oversized payload', () => {
  it('returns null when the stored value exceeds the max-length guard', () => {
    // Generate a payload well over 4096 bytes
    const bigString = 'x'.repeat(5000);
    localStorage.setItem('dlng_active', bigString);
    expect(loadActive()).toBeNull();
  });
});

describe('clearActive', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('removes the dlng_active key: after saveActive then clearActive, loadActive returns null', () => {
    vi.setSystemTime(new Date(TODAY + 'T10:00:00'));
    saveActive(makeState());
    clearActive();
    expect(loadActive()).toBeNull();
  });

  it('does not throw when called with nothing stored', () => {
    expect(() => clearActive()).not.toThrow();
  });
});
