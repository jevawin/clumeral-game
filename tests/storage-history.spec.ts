import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { recordGame, recordMarker, deleteHistory, loadHistory } from '../src/storage.ts';
import { validSeconds, MAX_STORED_SECONDS } from '../src/player-stats.ts';

// setup.ts runs localStorage.clear() before every test globally — no explicit clear needed here.

describe('recordGame — sort on write (#streak-fix)', () => {
  it('E: persists dlng_history sorted strictly date-descending after an out-of-order insert', () => {
    // Seed a few in-order (newest-first) entries.
    localStorage.setItem('dlng_history', JSON.stringify([
      { date: '2026-06-03', tries: 2 },
      { date: '2026-06-02', tries: 3 },
      { date: '2026-06-01', tries: 4 },
    ]));
    // Record an OUT-OF-ORDER older date — must not land at the top.
    recordGame('2026-05-30', 5);
    const history = loadHistory();
    // Every entry's date must be >= the next entry's date (date-descending) by localeCompare.
    for (let i = 0; i < history.length - 1; i++) {
      expect(history[i].date.localeCompare(history[i + 1].date)).toBeGreaterThanOrEqual(0);
    }
    // The newest must still be the chronological max.
    expect(history[0].date).toBe('2026-06-03');
    expect(history[history.length - 1].date).toBe('2026-05-30');
  });

  it('F: dedupe preserved — re-recording a date keeps one entry with the latest tries and answer', () => {
    localStorage.setItem('dlng_history', JSON.stringify([
      { date: '2026-06-02', tries: 3 },
      { date: '2026-06-01', tries: 4 },
    ]));
    recordGame('2026-06-01', 1, { answer: 555 }); // same date, new tries + answer
    const history = loadHistory();
    const matches = history.filter((h) => h.date === '2026-06-01');
    expect(matches.length).toBe(1);
    expect(matches[0].tries).toBe(1);
    expect(matches[0].answer).toBe(555);
  });
});

describe('recordGame — the counted time (player stats)', () => {
  it('stores seconds when given', () => {
    recordGame('2026-08-10', 2, { answer: 314, seconds: 221 });
    expect(loadHistory()[0].seconds).toBe(221);
  });

  it('omits the key entirely when no time is given', () => {
    recordGame('2026-08-10', 2, { answer: 314 });
    expect('seconds' in loadHistory()[0]).toBe(false);
  });

  it('omits the key when the time is not storable', () => {
    recordGame('2026-08-10', 2, { seconds: -1 });
    expect('seconds' in loadHistory()[0]).toBe(false);
  });

  it('keeps a time above the outlier threshold — that exclusion happens later, not here', () => {
    recordGame('2026-08-10', 1, { seconds: 2000 });
    expect(loadHistory()[0].seconds).toBe(2000);
  });

  it('a row written before this change round-trips unchanged', () => {
    localStorage.setItem('dlng_history', JSON.stringify([{ date: '2026-08-01', tries: 3, answer: 421 }]));
    expect(loadHistory()[0]).toEqual({ date: '2026-08-01', tries: 3, answer: 421 });
  });
});

describe('recordMarker — the day-only marker (brief 71, 123)', () => {
  it('writes exactly the date, tries 0 and the marker flag', () => {
    recordMarker('2026-08-10');
    expect(loadHistory()).toEqual([{ date: '2026-08-10', tries: 0, marker: true }]);
  });

  it('adds archived: true when the solve was an archive replay', () => {
    recordMarker('2026-07-01', true);
    expect(loadHistory()[0]).toEqual({ date: '2026-07-01', tries: 0, marker: true, archived: true });
  });

  it('replaces an existing row for the same date, like recordGame does', () => {
    recordGame('2026-08-10', 4, { answer: 512 });
    recordMarker('2026-08-10');
    const rows = loadHistory().filter((h) => h.date === '2026-08-10');
    expect(rows.length).toBe(1);
    expect(rows[0]).toEqual({ date: '2026-08-10', tries: 0, marker: true });
  });
});

describe('deleteHistory', () => {
  // deleteHistory now reads todayKey() to decide whether to keep a marker for
  // today, so these are pinned to a fixed day rather than the machine's.
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-08-10T10:00:00')); });
  afterEach(() => { vi.useRealTimers(); });

  it('leaves exactly one marker row for the date it is given', () => {
    localStorage.setItem('dlng_history', JSON.stringify([
      { date: '2026-08-10', tries: 2 },
      { date: '2026-08-09', tries: 5 },
    ]));
    deleteHistory('2026-08-10');
    expect(loadHistory()).toEqual([{ date: '2026-08-10', tries: 0, marker: true }]);
  });

  it('writes the marker even when the deleted history had no row for that date', () => {
    // The solve path's real shape: saving is off, so nothing was ever recorded
    // for today. Without the marker, today's puzzle becomes replayable.
    localStorage.setItem('dlng_history', JSON.stringify([{ date: '2026-08-09', tries: 5 }]));
    deleteHistory('2026-08-10');
    expect(loadHistory()).toEqual([{ date: '2026-08-10', tries: 0, marker: true }]);
  });

  it('carries archived through to the marker', () => {
    deleteHistory('2026-07-01', true);
    expect(loadHistory()[0].archived).toBe(true);
  });

  it('removes dlng_history entirely when given no date', () => {
    localStorage.setItem('dlng_history', JSON.stringify([{ date: '2026-08-09', tries: 5 }]));
    deleteHistory();
    expect(localStorage.getItem('dlng_history')).toBeNull();
  });

  it('leaves prefs and the mid-game board alone', () => {
    localStorage.setItem('dlng_history', JSON.stringify([{ date: '2026-08-09', tries: 5 }]));
    localStorage.setItem('dlng_prefs', JSON.stringify({ saveScore: false }));
    localStorage.setItem('dlng_active', 'anything');
    deleteHistory('2026-08-10');
    expect(localStorage.getItem('dlng_prefs')).toBe(JSON.stringify({ saveScore: false }));
    expect(localStorage.getItem('dlng_active')).toBe('anything');
  });
});

describe('validSeconds', () => {
  it('accepts whole seconds from 0 to a day', () => {
    expect(validSeconds(0)).toBe(0);
    expect(validSeconds(221)).toBe(221);
    expect(validSeconds(MAX_STORED_SECONDS)).toBe(86_400);
  });

  it('rejects anything else as unknown', () => {
    for (const bad of [-1, 12.5, 86_401, '221', NaN, undefined, null]) {
      expect(validSeconds(bad)).toBeNull();
    }
  });

  it('treats a time above the outlier threshold as valid — the two limits are different jobs', () => {
    expect(validSeconds(2000)).toBe(2000);
  });
});
