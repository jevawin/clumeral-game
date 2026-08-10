import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { saveActive, loadActive, clearActive, hasPlayerData } from '../src/storage.ts';
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

describe('loadActive fail-safe — forged cell contents (CR-01)', () => {
  // All forged-payload tests need a current date so the stale-date guard passes.
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  function forged(possibles: unknown[], guesses: unknown[] = [123], activeBox: unknown = 1, feedbackKey: unknown = null): void {
    vi.setSystemTime(new Date(TODAY + 'T10:00:00'));
    localStorage.setItem('dlng_active', JSON.stringify({ v: 1, date: TODAY, possibles, guesses, activeBox, feedbackKey }));
  }

  it('returns null when an inner array is empty (self-lock via size===0)', () => {
    forged([[], [4, 5], [7]]);
    expect(loadActive()).toBeNull();
  });

  it('returns null when a cell contains a non-integer string ("x")', () => {
    forged([[1, 2], [4, 'x'], [7]]);
    expect(loadActive()).toBeNull();
  });

  it('returns null when a cell contains an out-of-range integer (999)', () => {
    forged([[1], [5, 5, 5], ['x', 999]]);
    expect(loadActive()).toBeNull();
  });

  it('returns null when a cell contains a negative digit (-1)', () => {
    forged([[1], [-1, 5], [7]]);
    expect(loadActive()).toBeNull();
  });

  it('returns null when a cell contains a float (1.5)', () => {
    forged([[1], [1.5], [7]]);
    expect(loadActive()).toBeNull();
  });

  it('returns null when hundreds box contains 0 (violates no-zero-in-hundreds invariant)', () => {
    forged([[0, 1], [4, 5], [7]]);
    expect(loadActive()).toBeNull();
  });

  it('returns null when hundreds box is [0] only', () => {
    forged([[0], [4, 5], [7]]);
    expect(loadActive()).toBeNull();
  });

  it('returns null when a guess is outside 100–999 (e.g. 42)', () => {
    forged([[1], [4], [7]], [42]);
    expect(loadActive()).toBeNull();
  });

  it('returns null when a guess is a float (123.5)', () => {
    forged([[1], [4], [7]], [123.5]);
    expect(loadActive()).toBeNull();
  });

  it('returns null when a guess is a string ("abc")', () => {
    forged([[1], [4], [7]], ['abc']);
    expect(loadActive()).toBeNull();
  });

  it('returns null when activeBox is out of range (5)', () => {
    forged([[1], [4], [7]], [], 5);
    expect(loadActive()).toBeNull();
  });

  it('returns null when activeBox is a float (1.5)', () => {
    forged([[1], [4], [7]], [], 1.5);
    expect(loadActive()).toBeNull();
  });

  it('returns null when feedbackKey is an arbitrary string ("hacked")', () => {
    forged([[1], [4], [7]], [], null, 'hacked');
    expect(loadActive()).toBeNull();
  });

  it('returns null when feedbackKey is a number (123)', () => {
    forged([[1], [4], [7]], [], null, 123);
    expect(loadActive()).toBeNull();
  });

  it('accepts a valid payload with feedbackKey: "error"', () => {
    forged([[1, 2], [4, 5], [7]], [123], 1, 'error');
    expect(loadActive()).not.toBeNull();
  });

  it('accepts a valid payload with zeros in non-hundreds boxes', () => {
    forged([[1], [0, 4], [0, 7]], [], null, null);
    expect(loadActive()).not.toBeNull();
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

// The router's RTE-03 deep-link gate (#284). It used to read dlng_history alone,
// which bounced a first-time player from /play to /welcome on a mid-game refresh —
// their board was in dlng_active, but they had no history row until their first solve.
describe('hasPlayerData — router deep-link gate', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('is false for a stranger: no history, no active board', () => {
    vi.setSystemTime(new Date(TODAY + 'T10:00:00'));
    expect(hasPlayerData()).toBe(false);
  });

  it('is true for a returning player with history but no active board', () => {
    vi.setSystemTime(new Date(TODAY + 'T10:00:00'));
    localStorage.setItem('dlng_history', JSON.stringify([{ date: '2026-01-01', tries: 3 }]));
    expect(hasPlayerData()).toBe(true);
  });

  it("is true mid-game with no history at all — the first-timer's refresh (#284)", () => {
    vi.setSystemTime(new Date(TODAY + 'T10:00:00'));
    saveActive(makeState());
    expect(localStorage.getItem('dlng_history')).toBeNull();
    expect(hasPlayerData()).toBe(true);
  });

  it("is false when the only active board is yesterday's — a stale draft is not data", () => {
    vi.setSystemTime(new Date(YESTERDAY + 'T22:00:00'));
    saveActive(makeState({ date: YESTERDAY }));
    vi.setSystemTime(new Date(TODAY + 'T09:00:00'));
    expect(hasPlayerData()).toBe(false);
  });

  it('is false when the stored active board is forged — loadActive rejects it', () => {
    vi.setSystemTime(new Date(TODAY + 'T10:00:00'));
    localStorage.setItem('dlng_active', JSON.stringify({ v: 1, date: TODAY, possibles: 'nope', guesses: [], activeBox: null, feedbackKey: null }));
    expect(hasPlayerData()).toBe(false);
  });
});

// The play timer rides on the saved board (brief 30, 59, 121). Both fields are
// optional, and both drop the FIELD rather than the board when they fail
// validation — a forged elapsed must not cost a player their in-progress game.
describe('elapsed and idles on the saved board', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(TODAY + 'T10:00:00')); });
  afterEach(() => { vi.useRealTimers(); });

  it('round-trips a counted time', () => {
    saveActive(makeState({ elapsed: 240 }));
    expect(loadActive()!.elapsed).toBe(240);
  });

  it('round-trips an idle count', () => {
    saveActive(makeState({ idles: 2 }));
    expect(loadActive()!.idles).toBe(2);
  });

  it('accepts a board written before this shipped, with neither field', () => {
    saveActive(makeState());
    const loaded = loadActive();
    expect(loaded).not.toBeNull();
    expect(loaded!.elapsed).toBeUndefined();
    expect(loaded!.idles).toBeUndefined();
  });

  it('keeps the board and drops the field for every invalid elapsed', () => {
    for (const bad of [-1, 12.5, 86_401, '240', NaN, null]) {
      localStorage.setItem('dlng_active', JSON.stringify({ ...makeState(), elapsed: bad }));
      const loaded = loadActive();
      expect(loaded, `elapsed: ${String(bad)}`).not.toBeNull();
      expect(loaded!.possibles).toEqual([[1, 2, 3], [4, 5], [7]]);
      expect(loaded!.elapsed, `elapsed: ${String(bad)}`).toBeUndefined();
    }
  });

  it('keeps the board and drops the field for every invalid idles', () => {
    for (const bad of [-1, 2.5, 1001, '2', NaN, null]) {
      localStorage.setItem('dlng_active', JSON.stringify({ ...makeState(), idles: bad }));
      const loaded = loadActive();
      expect(loaded, `idles: ${String(bad)}`).not.toBeNull();
      expect(loaded!.possibles).toEqual([[1, 2, 3], [4, 5], [7]]);
      expect(loaded!.idles, `idles: ${String(bad)}`).toBeUndefined();
    }
  });

  it('the schema version is still 1 — bumping it throws away every in-progress board', () => {
    saveActive(makeState({ elapsed: 30 }));
    expect(JSON.parse(localStorage.getItem('dlng_active')!).v).toBe(1);
    expect(loadActive()!.v).toBe(1);
  });
});
