import { describe, it, expect } from 'vitest';
import {
  computePlayerStats,
  formatDuration,
  speakDuration,
  REVEAL_AFTER_GAMES,
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

describe('the goes chart', () => {
  it('returns six buckets in order, zeros included, with the tail in 6+', () => {
    const s = stats([
      { date: day(0), tries: 1 },
      { date: day(1), tries: 1 },
      { date: day(2), tries: 3 },
      { date: day(3), tries: 7 },
      { date: day(4), tries: 12 },
    ]);
    expect(s.goesDistribution).toEqual([
      { bucket: '1', count: 2 },
      { bucket: '2', count: 0 },
      { bucket: '3', count: 1 },
      { bucket: '4', count: 0 },
      { bucket: '5', count: 0 },
      { bucket: '6+', count: 2 },
    ]);
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
