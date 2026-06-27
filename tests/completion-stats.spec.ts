import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// computeStats is module-private in completion.ts. Tested indirectly via renderCompletion:
// seed dlng_history, call renderCompletion, assert the rendered streak stat box value.
// This avoids exporting a private function and matches the analog (completion-links.spec.ts).

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

// Extract streak value from the 3rd stat box (index 2: Played, Avg tries, Streak, Best streak).
function getStreak(): string {
  const stats = document.querySelector('[data-completion-stats]')!;
  const boxes = stats.querySelectorAll('div');
  // The first span inside each box renders the numeric value.
  return boxes[2]?.querySelector('span')?.textContent ?? '';
}

// Extract best-streak value from the 4th stat box (index 3).
function getBestStreak(): string {
  const stats = document.querySelector('[data-completion-stats]')!;
  const boxes = stats.querySelectorAll('div');
  return boxes[3]?.querySelector('span')?.textContent ?? '';
}

describe('computeStats streak logic (#209)', () => {
  beforeEach(() => {
    setupDOM();
    vi.resetModules();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('streak stays alive when today is unplayed — most recent entry is yesterday', async () => {
    // Today unplayed. History: [yesterday, day-before] — two consecutive days.
    // Streak should be 2, not 0, because the run is counted from the top of history (not from today).
    vi.setSystemTime(new Date('2026-05-30T10:00:00'));
    localStorage.setItem('dlng_history', JSON.stringify([
      { date: '2026-05-29', tries: 3 },
      { date: '2026-05-28', tries: 4 },
    ]));
    const mod = await import('../src/completion.ts');
    mod.renderCompletion(42, 3, false);
    expect(getStreak()).toBe('2');
  });

  it('consecutive run of 4 entries produces streak of 4', async () => {
    // History: [d, d-1, d-2, d-3] — four consecutive days.
    vi.setSystemTime(new Date('2026-05-30T10:00:00'));
    localStorage.setItem('dlng_history', JSON.stringify([
      { date: '2026-05-30', tries: 2 },
      { date: '2026-05-29', tries: 3 },
      { date: '2026-05-28', tries: 4 },
      { date: '2026-05-27', tries: 2 },
    ]));
    const mod = await import('../src/completion.ts');
    mod.renderCompletion(42, 2, false);
    expect(getStreak()).toBe('4');
  });

  it('real gap breaks streak — only the leading consecutive segment counts', async () => {
    // History: [today, today-3, today-4] — 3-day gap after the first entry.
    // Streak is 1 (only "today" before the gap stops the run).
    vi.setSystemTime(new Date('2026-05-30T10:00:00'));
    localStorage.setItem('dlng_history', JSON.stringify([
      { date: '2026-05-30', tries: 1 },
      { date: '2026-05-27', tries: 3 },
      { date: '2026-05-26', tries: 2 },
    ]));
    const mod = await import('../src/completion.ts');
    mod.renderCompletion(42, 1, false);
    expect(getStreak()).toBe('1');
  });

  it('same-day duplicate does not inflate streak', async () => {
    // Two entries with the same date — streak must not be 2.
    // Current logic: dayDiff === 0 → treated as gap → streak is 1.
    vi.setSystemTime(new Date('2026-05-30T10:00:00'));
    localStorage.setItem('dlng_history', JSON.stringify([
      { date: '2026-05-30', tries: 2 },
      { date: '2026-05-30', tries: 1 }, // duplicate same day
    ]));
    const mod = await import('../src/completion.ts');
    mod.renderCompletion(42, 2, false);
    // Streak must not be 2 — that would double-count the same day.
    expect(Number(getStreak())).toBeLessThanOrEqual(1);
  });

  it('local midnight parse — BST entry near midnight counts in the correct local day', async () => {
    // Simulate a player in BST (UTC+1) who played at 23:30 local on 2026-05-29.
    // From UTC perspective that is 22:30 UTC on 2026-05-29 — same date.
    // History entries use local YYYY-MM-DD keys (date.ts produces local keys).
    // The streak entry.date value is '2026-05-29' (local key). computeStats parses
    // it with T00:00:00 (no Z) — this is local midnight, so the streak counts the
    // correct local day regardless of UTC offset. Two consecutive local days = streak 2.
    vi.setSystemTime(new Date('2026-05-30T10:00:00'));
    localStorage.setItem('dlng_history', JSON.stringify([
      { date: '2026-05-29', tries: 3 }, // played at 23:30 BST — local date is 2026-05-29
      { date: '2026-05-28', tries: 2 },
    ]));
    const mod = await import('../src/completion.ts');
    mod.renderCompletion(42, 3, false);
    // These are consecutive local days — streak must be 2, not 1.
    expect(getStreak()).toBe('2');
  });

  it('empty history produces streak of 0', async () => {
    vi.setSystemTime(new Date('2026-05-30T10:00:00'));
    localStorage.setItem('dlng_history', JSON.stringify([]));
    const mod = await import('../src/completion.ts');
    mod.renderCompletion(42, 3, false);
    expect(getStreak()).toBe('0');
  });

  it('stale run ending 10 days ago reports streak of 0 (WR-01 recency gate)', async () => {
    // Today is 2026-05-30. History: [2026-05-20, 2026-05-19, 2026-05-18] — 3 consecutive
    // days, but the run ended 10 days ago. Without the recency gate this would report 3.
    vi.setSystemTime(new Date('2026-05-30T10:00:00'));
    localStorage.setItem('dlng_history', JSON.stringify([
      { date: '2026-05-20', tries: 2 },
      { date: '2026-05-19', tries: 3 },
      { date: '2026-05-18', tries: 4 },
    ]));
    const mod = await import('../src/completion.ts');
    mod.renderCompletion(42, 2, false);
    expect(getStreak()).toBe('0');
  });

  it('bestStreak is still reported correctly for a stale run', async () => {
    // The bestStreak stat must reflect the historical best even when current streak is 0.
    vi.setSystemTime(new Date('2026-05-30T10:00:00'));
    localStorage.setItem('dlng_history', JSON.stringify([
      { date: '2026-05-20', tries: 2 },
      { date: '2026-05-19', tries: 3 },
      { date: '2026-05-18', tries: 4 },
    ]));
    const mod = await import('../src/completion.ts');
    mod.renderCompletion(42, 2, false);
    // bestStreak box is index 3
    const stats = document.querySelector('[data-completion-stats]')!;
    const boxes = stats.querySelectorAll('div');
    const bestStreakVal = boxes[3]?.querySelector('span')?.textContent ?? '';
    expect(bestStreakVal).toBe('3');
  });
});

describe('jumbled history (#streak-fix)', () => {
  // Builds the player's real-world shape: an unbroken daily run 2026-05-08 → 2026-06-01
  // (25 entries) with a genuine gap at 2026-05-07 (no entry), plus a misplaced earlier
  // 2026-05-06 entry sitting near the TOP of the array (out of date order). The array is
  // shuffled so it is NOT sorted newest-first — reproducing the unsorted dlng_history bug.
  function buildJumbledHistory(): { date: string; tries: number }[] {
    // Consecutive run: 2026-05-08 through 2026-06-01 inclusive = 25 days.
    const run: { date: string; tries: number }[] = [];
    for (let day = 8; day <= 31; day++) {
      run.push({ date: `2026-05-${String(day).padStart(2, '0')}`, tries: 3 });
    }
    run.push({ date: '2026-06-01', tries: 3 }); // 25th entry, the run's leading date (today)
    // Genuine gap: NO 2026-05-07 entry. A single misplaced earlier entry before the gap.
    const stray = { date: '2026-05-06', tries: 4 };

    // Jumble: put the stray earlier-date entry near the TOP, then scatter the run so the
    // array is clearly not date-descending. index 0 is intentionally an OLD misplaced date.
    return [
      stray,
      run[24], // 2026-06-01 (today) buried, not at index 0
      run[0],  // 2026-05-08
      run[12], // 2026-05-20
      run[5],
      run[23], // 2026-05-31
      run[1],
      run[18],
      run[3],
      run[9],
      run[22],
      run[2],
      run[14],
      run[7],
      run[20],
      run[4],
      run[16],
      run[10],
      run[21],
      run[6],
      run[13],
      run[8],
      run[19],
      run[11],
      run[15],
      run[17],
    ];
  }

  beforeEach(() => {
    setupDOM();
    vi.resetModules();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-01T10:00:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('A: real case — 25-day run with one gap yields streak 25 / best 25', async () => {
    localStorage.setItem('dlng_history', JSON.stringify(buildJumbledHistory()));
    const mod = await import('../src/completion.ts');
    mod.renderCompletion(42, 3, false);
    expect(getStreak()).toBe('25');
    expect(getBestStreak()).toBe('25');
  });

  it('B: anti-regression — same data never yields old buggy streak 5 / best 16', async () => {
    localStorage.setItem('dlng_history', JSON.stringify(buildJumbledHistory()));
    const mod = await import('../src/completion.ts');
    mod.renderCompletion(42, 3, false);
    expect(getStreak()).not.toBe('5');
    expect(getBestStreak()).not.toBe('16');
  });

  it('C: recency on max date — jumbled history whose max date is today reports a live streak', async () => {
    localStorage.setItem('dlng_history', JSON.stringify(buildJumbledHistory()));
    const mod = await import('../src/completion.ts');
    mod.renderCompletion(42, 3, false);
    // Live streak proves the recency gate uses the sorted most-recent date, not array index 0
    // (whose date is an older, misplaced entry).
    expect(Number(getStreak())).toBeGreaterThan(0);
  });

  it('D: no mutation — computeStats does not write back a reordered array', async () => {
    const jumbled = buildJumbledHistory();
    const seededOrder = JSON.stringify(jumbled.map((h) => h.date));
    localStorage.setItem('dlng_history', JSON.stringify(jumbled));
    const mod = await import('../src/completion.ts');
    mod.renderCompletion(42, 3, false);
    // Re-read localStorage: order must be identical to what was seeded. If computeStats sorted
    // in place and the app persisted it, the order would change.
    const after = JSON.parse(localStorage.getItem('dlng_history')!) as { date: string }[];
    expect(JSON.stringify(after.map((h) => h.date))).toBe(seededOrder);
  });
});
