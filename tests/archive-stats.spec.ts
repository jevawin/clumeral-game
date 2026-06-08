import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// computeStats is module-private in completion.ts. Tested indirectly via renderCompletion:
// seed dlng_history, call renderCompletion, assert the rendered stat-box values.
// Stat box order: index 0 = Played, 1 = Avg tries, 2 = Streak, 3 = Best streak.
// This mirrors the harness in completion-stats.spec.ts (no private export).

function setupDOM(): void {
  document.body.innerHTML = `
    <div data-completion-octo></div>
    <h2 data-completion-heading></h2>
    <p data-completion-subheading></p>
    <div data-completion-stats></div>
    <p data-completion-countdown></p>
    <button data-completion-feedback></button>
    <div data-completion-links></div>
  `;
}

// Read a numeric stat-box value by index (the first span renders the number).
function getStat(index: number): string {
  const stats = document.querySelector('[data-completion-stats]')!;
  const boxes = stats.querySelectorAll('div');
  return boxes[index]?.querySelector('span')?.textContent ?? '';
}

const getPlayed = () => getStat(0);
const getAvgTries = () => getStat(1);
const getStreak = () => getStat(2);
const getBestStreak = () => getStat(3);

describe('archive solves excluded from daily stats', () => {
  beforeEach(() => {
    setupDOM();
    vi.resetModules();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('all four daily stats exclude an archived entry that fills a calendar gap', async () => {
    // Today is 2026-06-08. History (newest-first) mixes live + one archived solve that
    // sits in the calendar gap between today and the live entry two days ago:
    //   2026-06-08  live, today, 2 tries
    //   2026-06-07  ARCHIVED, 10 tries — fills the gap, inflated tries
    //   2026-06-06  live, 4 tries
    //
    // Without the fix the archived 06-07 entry counts: played 3, avg 5.3, streak 3, best 3.
    // With the fix only the two live entries count: played 2, avg 3.0, streak 1
    // (today, then a real gap at 06-07 once the archive entry is excluded), best 1.
    // This single test pins all four stats at once.
    vi.setSystemTime(new Date('2026-06-08T10:00:00'));
    localStorage.setItem('dlng_history', JSON.stringify([
      { date: '2026-06-08', tries: 2 },
      { date: '2026-06-07', tries: 10, archived: true },
      { date: '2026-06-06', tries: 4 },
    ]));
    const mod = await import('../src/completion.ts');
    mod.renderCompletion(42, 2, false);

    expect(getPlayed()).toBe('2');       // only the two live entries
    expect(getAvgTries()).toBe('3.0');   // (2 + 4) / 2
    expect(getStreak()).toBe('1');       // today, then a real gap at 06-07
    expect(getBestStreak()).toBe('1');
  });

  it('Played counts only live entries when an archived entry sits outside the live run', async () => {
    // Guard test: live consecutive run plus one archived entry on a date OUTSIDE the run.
    // Proves the filter excludes archived entries by tag, not merely because of a gap.
    //   2026-06-08  live, today
    //   2026-06-07  live, yesterday
    //   2026-05-01  ARCHIVED — far outside the live run
    vi.setSystemTime(new Date('2026-06-08T10:00:00'));
    localStorage.setItem('dlng_history', JSON.stringify([
      { date: '2026-06-08', tries: 2 },
      { date: '2026-06-07', tries: 3 },
      { date: '2026-05-01', tries: 7, archived: true },
    ]));
    const mod = await import('../src/completion.ts');
    mod.renderCompletion(42, 2, false);

    expect(getPlayed()).toBe('2');       // archived 05-01 excluded
    expect(getStreak()).toBe('2');       // two consecutive live days
    expect(getBestStreak()).toBe('2');
  });
});
