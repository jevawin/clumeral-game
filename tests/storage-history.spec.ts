import { describe, it, expect } from 'vitest';
import { recordGame, loadHistory } from '../src/storage.ts';

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
    recordGame('2026-06-01', 1, 555); // same date, new tries + answer
    const history = loadHistory();
    const matches = history.filter((h) => h.date === '2026-06-01');
    expect(matches.length).toBe(1);
    expect(matches[0].tries).toBe(1);
    expect(matches[0].answer).toBe(555);
  });
});
