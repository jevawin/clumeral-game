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
});
