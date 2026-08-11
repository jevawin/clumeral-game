import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { demoAllowed, demoHistory, applyDemoParam } from '../src/demo-history.ts';
import { computePlayerStats } from '../src/player-stats.ts';

const TODAY = '2026-08-11';

describe('the production gate', () => {
  it('refuses on clumeral.com', () => {
    expect(demoAllowed('clumeral.com')).toBe(false);
  });

  it('allows preview, staging and localhost', () => {
    for (const host of [
      'dev-stats-tweaks-clumeral-game.jevawin.workers.dev',
      'staging-clumeral-game.jevawin.workers.dev',
      'localhost',
    ]) {
      expect(demoAllowed(host), host).toBe(true);
    }
  });

  it('seeds nothing when the URL is production, even with the parameter', () => {
    applyDemoParam(new URL('https://clumeral.com/solved?demo=stats'));
    expect(localStorage.getItem('dlng_history')).toBeNull();
  });
});

describe('the seeded history', () => {
  // Every assertion here is about the panel having something to show, so they
  // are written against the real counting rules rather than the raw rows.
  const stats = computePlayerStats(demoHistory(TODAY), TODAY);

  it('opens the reveal gate comfortably', () => {
    expect(stats.countableGames).toBeGreaterThan(10);
  });

  it('shows a live play streak with a longer best behind it', () => {
    expect(stats.playStreak).toBe(6);
    expect(stats.bestPlayStreak).toBe(9);
    expect(stats.bestPlayStreak).toBeGreaterThan(stats.playStreak);
  });

  it('shows a first-go streak that differs from the play streak', () => {
    // Otherwise the two numbers look like a duplicate rather than two stats.
    expect(stats.firstGoStreak).not.toBe(stats.playStreak);
    expect(stats.firstGoStreak).toBeGreaterThan(0);
  });

  it('fills every bucket of the goes chart, tail included', () => {
    const counts = Object.fromEntries(stats.goesDistribution.map((d) => [d.bucket, d.count]));
    for (const bucket of ['1', '2', '3', '4', '5', '6+']) {
      expect(counts[bucket], bucket).toBeGreaterThan(0);
    }
  });

  it('has an average time and a fastest first-go win to show', () => {
    expect(stats.avgTimeSeconds).not.toBeNull();
    expect(stats.fastestFirstGoSeconds).not.toBeNull();
  });

  it('excludes the over-thirty-minute game from the average, as a real one would', () => {
    // The 9-go day took 2210s. It shows its own time on its own panel but must
    // not reach the average — the rule that is otherwise invisible on screen.
    expect(stats.avgTimeSeconds!).toBeLessThan(600);
  });

  it('carries a row with no time, standing in for a pre-launch game', () => {
    expect(demoHistory(TODAY).some((h) => h.seconds === undefined && !h.archived)).toBe(true);
  });

  it('carries an archived row that changes no figure', () => {
    const rows = demoHistory(TODAY);
    expect(rows.some((h) => h.archived)).toBe(true);
    const withoutArchive = computePlayerStats(rows.filter((h) => !h.archived), TODAY);
    expect(withoutArchive).toEqual(stats);
  });

  it('is a first-go win today, so the hero shows the singular "1 go"', () => {
    expect(demoHistory(TODAY)[0].tries).toBe(1);
  });
});

describe('applying the parameter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(TODAY + 'T10:00:00'));
    history.replaceState(null, '', '/');
  });
  afterEach(() => { vi.useRealTimers(); });

  it('seeds the history and turns saving on', () => {
    expect(applyDemoParam(new URL('https://preview.example/solved?demo=stats'))).toBe(true);
    expect(JSON.parse(localStorage.getItem('dlng_history')!).length).toBeGreaterThan(10);
    expect(JSON.parse(localStorage.getItem('dlng_prefs')!)).toEqual({ saveScore: true });
  });

  it('clears it again on demo=clear', () => {
    localStorage.setItem('dlng_history', JSON.stringify(demoHistory(TODAY)));
    expect(applyDemoParam(new URL('https://preview.example/play?demo=clear'))).toBe(true);
    expect(localStorage.getItem('dlng_history')).toBeNull();
  });

  it('does nothing at all without the parameter', () => {
    expect(applyDemoParam(new URL('https://preview.example/solved'))).toBe(false);
    expect(localStorage.getItem('dlng_history')).toBeNull();
  });

  it('strips the parameter, so a reload does not reseed', () => {
    applyDemoParam(new URL('https://preview.example/solved?demo=stats&period=7'));
    expect(window.location.search).not.toContain('demo');
    // and leaves anything else in the query string alone
    expect(window.location.search).toContain('period=7');
    expect(window.location.pathname).toBe('/solved');
  });
});
