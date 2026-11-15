import { describe, it, expect } from 'vitest';
import {
  computePlayerStats,
  formatDuration,
  speakDuration,
  REVEAL_AFTER_GAMES,
  goesByDay,
  todayMessage,
  messageCopy,
  ordinal,
  streakLine,
  MIN_EARLIER_TIMES,
  type PlayerStats,
} from '../src/player-stats.ts';
import type { HistoryEntry } from '../src/types.ts';

const TODAY = '2026-08-10';

// Days back from TODAY, as a local date key. Keeps the fixtures readable.
function day(back: number): string {
  const d = new Date(TODAY + 'T00:00:00');
  d.setDate(d.getDate() - back);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function stats(history: HistoryEntry[]) {
  return computePlayerStats(history, TODAY);
}

describe('streaks', () => {
  it('counts three consecutive days including today as a play streak of 3', () => {
    expect(stats([
      { date: day(0), tries: 2 },
      { date: day(1), tries: 4 },
      { date: day(2), tries: 1 },
    ]).playStreak).toBe(3);
  });

  it('counts the run since the gap, not the total', () => {
    expect(stats([
      { date: day(0), tries: 2 },
      { date: day(1), tries: 2 },
      { date: day(4), tries: 2 },
      { date: day(5), tries: 2 },
    ]).playStreak).toBe(2);
  });

  it('reports 0 for a run that ended two days ago, and keeps the best', () => {
    const s = stats([
      { date: day(2), tries: 2 },
      { date: day(3), tries: 2 },
      { date: day(4), tries: 2 },
    ]);
    expect(s.playStreak).toBe(0);
    expect(s.bestPlayStreak).toBe(3);
  });

  it('keeps a run ending yesterday alive', () => {
    expect(stats([
      { date: day(1), tries: 2 },
      { date: day(2), tries: 2 },
    ]).playStreak).toBe(2);
  });

  it('counts three consecutive first-go days as a first-go streak of 3', () => {
    expect(stats([
      { date: day(0), tries: 1 },
      { date: day(1), tries: 1 },
      { date: day(2), tries: 1 },
    ]).firstGoStreak).toBe(3);
  });

  it('breaks the first-go streak on a day played and missed (brief 6)', () => {
    const s = stats([
      { date: day(0), tries: 2 },
      { date: day(1), tries: 1 },
      { date: day(2), tries: 1 },
    ]);
    expect(s.firstGoStreak).toBe(0);
    expect(s.playStreak).toBe(3);
  });

  it('breaks the first-go streak on a missed day too (brief 6)', () => {
    expect(stats([
      { date: day(0), tries: 1 },
      { date: day(2), tries: 1 },
      { date: day(3), tries: 1 },
    ]).firstGoStreak).toBe(1);
  });

  it('never joins two first-go runs across a two-go day — the best is not a filtered walk', () => {
    // Filtering the two-go day out first would leave four consecutive first-go
    // rows and report a best of 4. It is two runs of two.
    const s = stats([
      { date: day(0), tries: 1 },
      { date: day(1), tries: 1 },
      { date: day(2), tries: 2 },
      { date: day(3), tries: 1 },
      { date: day(4), tries: 1 },
    ]);
    expect(s.firstGoStreak).toBe(2);
    expect(s.bestFirstGoStreak).toBe(2);
  });

  it('keeps both bests after the current streaks break', () => {
    const s = stats([
      { date: day(5), tries: 1 },
      { date: day(6), tries: 1 },
      { date: day(7), tries: 1 },
      { date: day(8), tries: 1 },
    ]);
    expect(s.playStreak).toBe(0);
    expect(s.firstGoStreak).toBe(0);
    expect(s.bestPlayStreak).toBe(4);
    expect(s.bestFirstGoStreak).toBe(4);
  });

  it('does not inflate a streak with a same-day duplicate', () => {
    expect(stats([
      { date: day(0), tries: 2 },
      { date: day(0), tries: 1 },
    ]).playStreak).toBeLessThanOrEqual(1);
  });

  it('walks a date-jumbled history correctly — it sorts a copy first', () => {
    const jumbled: HistoryEntry[] = [
      { date: day(2), tries: 2 },
      { date: day(0), tries: 2 },
      { date: day(1), tries: 2 },
    ];
    const seeded = JSON.stringify(jumbled);
    expect(stats(jumbled).playStreak).toBe(3);
    expect(JSON.stringify(jumbled)).toBe(seeded); // never mutates the caller's array
  });
});

describe('totals and averages', () => {
  it('counts countable rows only in plays', () => {
    expect(stats([
      { date: day(0), tries: 2 },
      { date: day(1), tries: 3, archived: true },
      { date: day(2), tries: 0, marker: true },
    ]).plays).toBe(1);
  });

  it('counts first-go wins and reads the percentage as a whole number', () => {
    const s = stats([
      { date: day(0), tries: 1 },
      { date: day(1), tries: 1 },
      { date: day(2), tries: 3 },
      { date: day(3), tries: 4 },
      { date: day(4), tries: 5 },
    ]);
    expect(s.firstGoWins).toBe(2);
    expect(s.firstGoPercent).toBe(40);
  });

  it('averages goes to one decimal place', () => {
    expect(stats([
      { date: day(0), tries: 2 },
      { date: day(1), tries: 3 },
      { date: day(2), tries: 2 },
    ]).avgGoes).toBe('2.3');
  });

  it('ignores rows with no time rather than reading them as zero (brief 61)', () => {
    expect(stats([
      { date: day(0), tries: 2, seconds: 200 },
      { date: day(1), tries: 2 },
      { date: day(2), tries: 2, seconds: 100 },
    ]).avgTimeSeconds).toBe(150);
  });

  it('counts a game over thirty minutes in the average (redesign brief 22)', () => {
    // The thirty-minute exclusion is gone: a long game is a real game, and the
    // average is the average of what you actually did. This is the test that
    // discriminates — a best-time test cannot, because a slow game can never
    // lower a minimum.
    const s = stats([
      { date: day(0), tries: 1, seconds: 2000 },
      { date: day(1), tries: 1, seconds: 60 },
    ]);
    expect(s.avgTimeSeconds).toBe(1030);
    expect(s.plays).toBe(2);
  });

  it('reports no average time as null, never 0', () => {
    expect(stats([{ date: day(0), tries: 2 }]).avgTimeSeconds).toBeNull();
  });

  it('reports empty history as zeros and nulls', () => {
    const s = stats([]);
    expect(s.plays).toBe(0);
    expect(s.playStreak).toBe(0);
    expect(s.avgGoes).toBeNull();
    expect(s.firstGoPercent).toBeNull();
    expect(s.avgTimeSeconds).toBeNull();
    expect(s.bestTimeSeconds).toBeNull();
  });
});

describe('best time (redesign brief 14)', () => {
  it('is the fastest solve of any number of goes, not first-go only', () => {
    expect(stats([
      { date: day(0), tries: 3, seconds: 90 },
      { date: day(1), tries: 1, seconds: 120 },
    ]).bestTimeSeconds).toBe(90);
  });

  it('applies no upper exclusion — a long game is still a real best', () => {
    expect(stats([{ date: day(0), tries: 2, seconds: 2400 }]).bestTimeSeconds).toBe(2400);
  });

  it('is null when no countable row carries a valid time', () => {
    expect(stats([
      { date: day(0), tries: 2 },
      { date: day(1), tries: 2, seconds: -5 },
    ]).bestTimeSeconds).toBeNull();
  });

  it('ignores archived rows and markers', () => {
    expect(stats([
      { date: day(0), tries: 2, seconds: 300 },
      { date: day(1), tries: 1, archived: true, seconds: 10 },
      { date: day(2), tries: 0, marker: true, seconds: 20 },
    ]).bestTimeSeconds).toBe(300);
  });
});

describe('the thirty-minute rule is gone, not merely unused (redesign brief 58)', () => {
  it('exports no OUTLIER_SECONDS', async () => {
    const playerStats = await import('../src/player-stats.ts');
    expect('OUTLIER_SECONDS' in playerStats).toBe(false);
  });
});

describe('exclusions', () => {
  it('an archived row changes no figure at all (brief 16)', () => {
    const base = stats([{ date: day(0), tries: 2 }]);
    const withArchive = stats([
      { date: day(0), tries: 2 },
      { date: day(1), tries: 1, archived: true, seconds: 10 },
    ]);
    expect(withArchive).toEqual(base);
  });

  it('a marker row changes no figure at all — its tries: 0 never reaches the average', () => {
    const base = stats([{ date: day(0), tries: 2 }]);
    const withMarker = stats([
      { date: day(0), tries: 2 },
      { date: day(1), tries: 0, marker: true },
    ]);
    expect(withMarker).toEqual(base);
    expect(withMarker.avgGoes).toBe('2.0');
  });

  it('a row that is both marker and archived is excluded once, not twice', () => {
    const s = stats([
      { date: day(0), tries: 2 },
      { date: day(1), tries: 0, marker: true, archived: true },
    ]);
    expect(s.plays).toBe(1);
    expect(s.countableGames).toBe(1);
  });

  it('a marker day breaks a play streak — it is not a played day', () => {
    expect(stats([
      { date: day(0), tries: 2 },
      { date: day(1), tries: 0, marker: true },
      { date: day(2), tries: 2 },
    ]).playStreak).toBe(1);
  });
});

describe('formatting', () => {
  it('formats a duration for the screen with unit letters', () => {
    expect(formatDuration(221)).toBe('3m 41s');
    expect(formatDuration(48)).toBe('0m 48s');
    expect(formatDuration(30)).toBe('0m 30s');
    expect(formatDuration(65)).toBe('1m 05s');
    expect(formatDuration(3840)).toBe('1h 04m');
    expect(formatDuration(null)).toBe('—');
  });

  // The time chart's own labels (time chart brief item 63): no room for 0m 41s.
  it('compact drops the zero minutes', () => {
    expect(formatDuration(41, { compact: true })).toBe('41s');
    expect(formatDuration(0, { compact: true })).toBe('0s');
    expect(formatDuration(59, { compact: true })).toBe('59s');
  });

  it('compact matches the default from a minute up', () => {
    for (const [s, out] of [
      [60, '1m 00s'],
      [69, '1m 09s'],
      [892, '14m 52s'],
      [3600, '1h 00m'],
      [3840, '1h 04m'],
    ] as const) {
      expect(formatDuration(s, { compact: true }), String(s)).toBe(out);
      expect(formatDuration(s), String(s)).toBe(out);
    }
  });

  it('the default is unchanged by the compact option', () => {
    expect(formatDuration(221)).toBe('3m 41s');
    expect(formatDuration(48)).toBe('0m 48s');
    expect(formatDuration(null, { compact: true })).toBe('—');
  });

  it('never uses a colon — 4:06 can read as four hours at a glance', () => {
    for (const s of [0, 48, 221, 3840, 86_400]) {
      expect(formatDuration(s), String(s)).not.toContain(':');
    }
  });

  it('spells a duration out for speech', () => {
    expect(speakDuration(221)).toBe('3 minutes 41 seconds');
    expect(speakDuration(48)).toBe('48 seconds');
    expect(speakDuration(60)).toBe('1 minute');
    expect(speakDuration(61)).toBe('1 minute 1 second');
    expect(speakDuration(3840)).toBe('1 hour 4 minutes');
    expect(speakDuration(7200)).toBe('2 hours');
  });
});

describe('the reveal gate', () => {
  it('hides at two countable games and reveals at three', () => {
    const two = stats([
      { date: day(0), tries: 2 },
      { date: day(1), tries: 2 },
    ]);
    const three = stats([
      { date: day(0), tries: 2 },
      { date: day(1), tries: 2 },
      { date: day(2), tries: 2 },
    ]);
    expect(two.countableGames > REVEAL_AFTER_GAMES).toBe(false);
    expect(three.countableGames > REVEAL_AFTER_GAMES).toBe(true);
  });

  it('does not let markers or archive replays open the gate', () => {
    const s = stats([
      { date: day(0), tries: 2 },
      { date: day(1), tries: 0, marker: true },
      { date: day(2), tries: 3, archived: true },
    ]);
    expect(s.countableGames > REVEAL_AFTER_GAMES).toBe(false);
  });
});

// ─── Results page redesign (plan Task 1) ─────────────────────────────────────

describe('the goes distribution is gone (results plan D3)', () => {
  it('is not a field of the stats any more', () => {
    expect('goesDistribution' in stats([{ date: day(0), tries: 2 }])).toBe(false);
  });
});

describe('goesByDay', () => {
  it('drops archived and marker rows, keeps today, and sorts ascending', () => {
    const days = goesByDay([
      { date: day(0), tries: 3 },
      { date: day(2), tries: 1 },
      { date: day(1), tries: 4, archived: true },
      { date: day(3), tries: 0, marker: true },
      { date: day(4), tries: 9 },
    ]);
    expect(days).toEqual([
      { date: day(4), goes: 9 },
      { date: day(2), goes: 1 },
      { date: day(0), goes: 3 },
    ]);
  });

  it('drops a row whose tries is 0, fractional or a string', () => {
    const days = goesByDay([
      { date: day(0), tries: 2 },
      { date: day(1), tries: 0 },
      { date: day(2), tries: 1.5 },
      { date: day(3), tries: '3' as unknown as number },
    ]);
    expect(days).toEqual([{ date: day(0), goes: 2 }]);
  });
});

describe('todayMessage', () => {
  // Earlier rows from one day back, oldest last, with the given times.
  function timed(times: (number | undefined)[], tries = 2): HistoryEntry[] {
    return times.map((s, i) => ({ date: day(i + 1), tries, ...(s === undefined ? {} : { seconds: s }) }));
  }

  it('needs three earlier times', () => {
    expect(MIN_EARLIER_TIMES).toBe(3);
  });

  it('fastest ever: beats the earlier best', () => {
    expect(todayMessage(timed([100, 90, 80]), TODAY, 2, 71)).toEqual({ kind: 'fastest', under: 9 });
  });

  it('equal to the best is not fastest; it falls to quicker', () => {
    expect(todayMessage(timed([100, 90, 80]), TODAY, 2, 80)).toEqual({ kind: 'quicker', by: 10 });
  });

  it('skips the time rungs with only two earlier times, even when today beats both', () => {
    expect(todayMessage(timed([100, 90]), TODAY, 1, 50)).toEqual({ kind: 'one-go', nth: 1 });
  });

  it('skips the time rungs with no time today', () => {
    expect(todayMessage(timed([100, 90, 80]), TODAY, 2, null)).toEqual({ kind: 'solve-number', n: 4 });
  });

  it('skips the time rungs when today is 0s (brief 94)', () => {
    expect(todayMessage(timed([100, 90, 80]), TODAY, 2, 0)).toEqual({ kind: 'solve-number', n: 4 });
  });

  it('skips the time rungs when earlier rows have no times', () => {
    expect(todayMessage(timed([undefined, undefined, undefined]), TODAY, 2, 30))
      .toEqual({ kind: 'solve-number', n: 4 });
  });

  it('does not count an earlier 0s row towards the three', () => {
    expect(todayMessage(timed([100, 90, 0]), TODAY, 2, 50)).toEqual({ kind: 'solve-number', n: 4 });
  });

  it("today's own row never moves a baseline (brief 18)", () => {
    const earlier = timed([100, 90, 80]);
    const withToday = [{ date: TODAY, tries: 2, seconds: 71 }, ...earlier];
    expect(todayMessage(withToday, TODAY, 2, 71)).toEqual(todayMessage(earlier, TODAY, 2, 71));
    expect(todayMessage(withToday, TODAY, 2, 71)).toEqual({ kind: 'fastest', under: 9 });
  });

  it('quicker: against the exact earlier mean', () => {
    expect(todayMessage(timed([60, 120, 120]), TODAY, 2, 83)).toEqual({ kind: 'quicker', by: 17 });
  });

  it('a difference that rounds to 0s is not quicker', () => {
    expect(todayMessage(timed([60, 60, 61]), TODAY, 2, 60)).toEqual({ kind: 'solve-number', n: 4 });
  });

  it('an earlier row with tries as a string is not counted', () => {
    const history: HistoryEntry[] = [
      { date: day(1), tries: 2 },
      { date: day(2), tries: '3' as unknown as number },
      { date: day(3), tries: 2 },
    ];
    const m = todayMessage(history, TODAY, 2, null);
    expect(m).toEqual({ kind: 'solve-number', n: goesByDay(history).length + 1 });
  });

  it('one-go: counts earlier one-go solves', () => {
    const history = timed([undefined, undefined, undefined, undefined, undefined, undefined, undefined], 1);
    expect(todayMessage(history, TODAY, 1, null)).toEqual({ kind: 'one-go', nth: 8 });
    expect(todayMessage([], TODAY, 1, null)).toEqual({ kind: 'one-go', nth: 1 });
  });

  it('fewer goes: below the earlier average as shown', () => {
    const history: HistoryEntry[] = [
      { date: day(1), tries: 2 },
      { date: day(2), tries: 3 },
      { date: day(3), tries: 2 },
    ];
    expect(todayMessage(history, TODAY, 2, null)).toEqual({ kind: 'fewer-goes', usual: '2.3' });
  });

  it('fewer goes compares with the average as shown: 2 against 2.04 says nothing (brief 89)', () => {
    const history: HistoryEntry[] = Array.from({ length: 25 }, (_, i) => ({ date: day(i + 1), tries: i === 0 ? 3 : 2 }));
    expect(todayMessage(history, TODAY, 2, null)).toEqual({ kind: 'solve-number', n: 26 });
  });

  it('solve number when nothing is beaten', () => {
    expect(todayMessage(timed([undefined, undefined]), TODAY, 3, null)).toEqual({ kind: 'solve-number', n: 3 });
  });

  it('null for tries that are not a whole number of at least 1', () => {
    expect(todayMessage([], TODAY, null, 30)).toBeNull();
    expect(todayMessage([], TODAY, 0, 30)).toBeNull();
    expect(todayMessage([], TODAY, 1.5, 30)).toBeNull();
  });
});

describe('messageCopy', () => {
  it('writes the five lines (brief 55, 93)', () => {
    expect(messageCopy({ kind: 'fastest', under: 9 }))
      .toEqual({ icon: 'icon-trophy', pre: '', bold: 'Your fastest ever', post: ', 9s under your best.' });
    expect(messageCopy({ kind: 'quicker', by: 17 }))
      .toEqual({ icon: 'icon-arrow-up', pre: '', bold: '17s quicker', post: ' than your average.' });
    expect(messageCopy({ kind: 'quicker', by: 65 }).bold).toBe('1m 05s quicker');
    expect(messageCopy({ kind: 'one-go', nth: 8 }))
      .toEqual({ icon: 'icon-tick', pre: '', bold: 'Straight in.', post: ' Your 8th one-go solve.' });
    expect(messageCopy({ kind: 'one-go', nth: 1 }).post).toBe(' Your first one-go solve.');
    expect(messageCopy({ kind: 'fewer-goes', usual: '2.3' }))
      .toEqual({ icon: 'icon-calculator', pre: '', bold: 'Fewer goes', post: ' than your usual 2.3.' });
    expect(messageCopy({ kind: 'solve-number', n: 30 }))
      .toEqual({ icon: 'icon-gamepad', pre: 'Solve number ', bold: '30', post: '.' });
  });
});

describe('ordinal', () => {
  it('uses English suffixes, and "first" for 1 (brief 90)', () => {
    const cases: [number, string][] = [
      [1, 'first'], [2, '2nd'], [3, '3rd'], [4, '4th'], [11, '11th'], [12, '12th'], [13, '13th'],
      [21, '21st'], [22, '22nd'], [23, '23rd'], [101, '101st'], [111, '111th'],
    ];
    for (const [n, out] of cases) expect(ordinal(n), String(n)).toBe(out);
  });
});

describe('streakLine', () => {
  function line(playStreak: number, firstGoStreak: number, bestPlayStreak = 30) {
    return streakLine({ playStreak, firstGoStreak, bestPlayStreak } as PlayerStats);
  }

  it('days played, no one-go part at a run of 1', () => {
    expect(line(30, 1)).toEqual({ figure: 30, label: '-day play streak', best: 30, oneGoRun: null });
  });

  it('shows the one-go run from 2', () => {
    expect(line(30, 2).oneGoRun).toBe(2);
  });

  it('switches the label when the runs match, and drops the one-go part', () => {
    expect(line(4, 4)).toEqual({ figure: 4, label: '-day 1-go streak', best: 30, oneGoRun: null });
  });

  it('reads the same at 1: "1-day play streak"', () => {
    expect(line(1, 0).label).toBe('-day play streak');
    expect(line(1, 1).label).toBe('-day 1-go streak');
  });
});
