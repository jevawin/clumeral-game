import { describe, it, expect } from 'vitest';
import { computePlayerStats } from '../src/player-stats.ts';

// These two real-world shapes used to be asserted through completion.ts's four
// stat boxes. Those boxes are gone, and the rules they were testing moved into
// player-stats.ts — so the scenarios move with them rather than being deleted.
//
// Archive solves (date != today) are tagged `archived: true` and MUST NOT affect
// any daily stat. They are recorded only so archive replay and the archive goes
// column can detect a prior solve by date.

describe('archive solves excluded from daily stats', () => {
  it('every daily figure excludes an archived entry that fills a calendar gap', () => {
    // Today is 2026-06-08:
    //   2026-06-08  live, today, 2 goes
    //   2026-06-07  ARCHIVED, 10 goes — fills the gap, inflated goes
    //   2026-06-06  live, 4 goes
    //
    // Without the filter the archived row counts: plays 3, avg 5.3, streak 3.
    // With it, only the two live rows count, and 06-07 is a real gap again.
    const s = computePlayerStats([
      { date: '2026-06-08', tries: 2 },
      { date: '2026-06-07', tries: 10, archived: true },
      { date: '2026-06-06', tries: 4 },
    ], '2026-06-08');

    expect(s.plays).toBe(2);
    expect(s.avgGoes).toBe('3.0');       // (2 + 4) / 2
    expect(s.playStreak).toBe(1);        // today, then a real gap at 06-07
    expect(s.bestPlayStreak).toBe(1);
  });

  it('excludes an archived entry by its tag, not merely because it sits in a gap', () => {
    //   2026-06-08  live, today
    //   2026-06-07  live, yesterday
    //   2026-05-01  ARCHIVED — far outside the live run
    const s = computePlayerStats([
      { date: '2026-06-08', tries: 2 },
      { date: '2026-06-07', tries: 3 },
      { date: '2026-05-01', tries: 7, archived: true },
    ], '2026-06-08');

    expect(s.plays).toBe(2);
    expect(s.playStreak).toBe(2);
    expect(s.bestPlayStreak).toBe(2);
  });
});
