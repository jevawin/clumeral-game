import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  recordSolve,
  loadHistory,
  loadPrefs,
  persistPrefs,
  hasPlayerData,
  saveActive,
  clearActive,
} from '../src/storage.ts';

// setup.ts clears localStorage before every test.

const TODAY = '2026-08-10';
const SEEDED = [
  { date: '2026-08-09', tries: 2, answer: 314, seconds: 200 },
  { date: '2026-08-08', tries: 1, answer: 271, seconds: 90 },
];

function seed(): void {
  localStorage.setItem('dlng_history', JSON.stringify(SEEDED));
}

describe('the preference itself', () => {
  it('defaults to on', () => {
    expect(loadPrefs().saveScore).toBe(true);
  });

  it('persists an untick immediately, and deletes nothing', () => {
    seed();
    const before = localStorage.getItem('dlng_history');
    persistPrefs(false);
    expect(loadPrefs().saveScore).toBe(false);
    // The single most important assertion in this file: the preference and the
    // deletion are separate events, and unticking is not the deletion.
    expect(localStorage.getItem('dlng_history')).toBe(before);
  });

  it('does not resurrect deleted history when it is ticked again', () => {
    persistPrefs(false);
    recordSolve(TODAY, 2, { saveScore: false });
    persistPrefs(true);
    expect(loadHistory()).toEqual([{ date: TODAY, tries: 0, marker: true }]);
  });
});

describe('solving with saving on', () => {
  it('records the game with its answer and its time', () => {
    seed();
    recordSolve(TODAY, 2, { saveScore: true, answer: 512, seconds: 221 });
    const row = loadHistory().find((h) => h.date === TODAY)!;
    expect(row).toEqual({ date: TODAY, tries: 2, answer: 512, seconds: 221 });
    expect(loadHistory().length).toBe(3); // the seeded rows survive
  });

  it('leaves the seeded history untouched when the box was unticked and re-ticked', () => {
    seed();
    persistPrefs(false);
    persistPrefs(true);
    recordSolve(TODAY, 2, { saveScore: true, answer: 512, seconds: 221 });
    expect(loadHistory().length).toBe(3);
    expect(loadHistory().find((h) => h.date === '2026-08-09')!.tries).toBe(2);
  });
});

describe('solving with saving off', () => {
  it('deletes the stored results (brief 65)', () => {
    seed();
    recordSolve(TODAY, 2, { saveScore: false, answer: 512, seconds: 221 });
    expect(loadHistory().some((h) => h.date === '2026-08-09')).toBe(false);
    expect(loadHistory().some((h) => h.date === '2026-08-08')).toBe(false);
  });

  it('leaves a day-only marker for the day just solved: no goes, no answer, no time', () => {
    seed();
    recordSolve(TODAY, 2, { saveScore: false, answer: 512, seconds: 221 });
    expect(loadHistory()).toEqual([{ date: TODAY, tries: 0, marker: true }]);
  });

  it('keeps today unreplayable — hasPlayerData stays true after the delete', () => {
    // hasPlayerData needs history or a mid-game board, and solving clears the
    // board. Without the marker the router would send this player to /welcome
    // and hand them today's puzzle again (brief 66, 125).
    vi.useFakeTimers();
    vi.setSystemTime(new Date(TODAY + 'T10:00:00'));
    seed();
    saveActive({ v: 1, date: TODAY, possibles: [[1], [2], [3]], guesses: [], activeBox: null, feedbackKey: null });
    recordSolve(TODAY, 2, { saveScore: false });
    clearActive();
    expect(hasPlayerData()).toBe(true);
    vi.useRealTimers();
  });

  it('marks an archive solve as archived, so the archive page still knows', () => {
    recordSolve('2026-07-01', 3, { saveScore: false, archived: true });
    expect(loadHistory()).toEqual([{ date: '2026-07-01', tries: 0, marker: true, archived: true }]);
  });
});

describe('what does NOT trigger a deletion', () => {
  it('an incorrect guess deletes nothing — the rule runs on a solve, not on any submit', () => {
    seed();
    const before = localStorage.getItem('dlng_history');
    persistPrefs(false);
    // No recordSolve: handleGuess only reaches it on a correct answer.
    expect(localStorage.getItem('dlng_history')).toBe(before);
  });

  it('abandoning the puzzle after unticking deletes nothing', () => {
    seed();
    const before = localStorage.getItem('dlng_history');
    persistPrefs(false);
    // Session ends here.
    expect(localStorage.getItem('dlng_history')).toBe(before);
    // And the next game they solve with it still unticked does delete, because
    // the rule is read at solve time from the stored preference.
    recordSolve(TODAY, 2, { saveScore: loadPrefs().saveScore });
    expect(loadHistory()).toEqual([{ date: TODAY, tries: 0, marker: true }]);
  });
});

describe('an archive solve with saving off', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(TODAY + 'T10:00:00')); });
  afterEach(() => { vi.useRealTimers(); });

  it("keeps a marker for today, so today's puzzle does not become replayable again", () => {
    // Solve today with saving ON, then untick and solve an ARCHIVE puzzle. The
    // deletion is right — they asked us to forget — but taking today's row with
    // it would let them replay a day they had already finished.
    recordSolve(TODAY, 2, { saveScore: true, answer: 512, seconds: 60 });
    recordSolve('2026-07-01', 3, { saveScore: false, archived: true });

    const rows = loadHistory();
    expect(rows).toEqual([
      { date: TODAY, tries: 0, marker: true },
      { date: '2026-07-01', tries: 0, marker: true, archived: true },
    ]);
    // No results survive — just the two days.
    expect(rows.every((r) => r.answer === undefined && r.seconds === undefined)).toBe(true);
    expect(hasPlayerData()).toBe(true);
  });

  it('writes one marker, not two, when the archive date IS today', () => {
    recordSolve(TODAY, 2, { saveScore: true, answer: 512 });
    recordSolve(TODAY, 2, { saveScore: false });
    expect(loadHistory()).toEqual([{ date: TODAY, tries: 0, marker: true }]);
  });

  it('adds no today marker when today was never played', () => {
    seed();
    recordSolve('2026-07-01', 3, { saveScore: false, archived: true });
    expect(loadHistory()).toEqual([{ date: '2026-07-01', tries: 0, marker: true, archived: true }]);
  });
});

describe('a marker meets the code that reads tries', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(TODAY + 'T10:00:00')); });
  afterEach(() => { vi.useRealTimers(); });

  it("carries tries: 0 so nothing that sums goes reads undefined, and a marker flag so nothing shows the 0", () => {
    recordSolve(TODAY, 4, { saveScore: false });
    const row = loadHistory()[0];
    expect(row.tries).toBe(0);
    expect(row.marker).toBe(true);
    expect(row.answer).toBeUndefined();
    expect(row.seconds).toBeUndefined();
  });
});
