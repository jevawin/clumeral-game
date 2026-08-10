import { describe, it, expect } from 'vitest';
import { createPlayTimer } from '../src/play-timer.ts';
import { MAX_STORED_SECONDS } from '../src/player-stats.ts';

// An injected clock, so nothing here waits on real time. `at` is the fake now.
function clock(start = 1_000_000) {
  let t = start;
  return {
    now: () => t,
    advance(ms: number) { t += ms; },
    set(ms: number) { t = ms; },
  };
}

describe('createPlayTimer', () => {
  it('reads 0 before any activity — it does not start on page load (brief 27)', () => {
    const c = clock();
    const timer = createPlayTimer({ now: c.now });
    c.advance(60_000);
    expect(timer.seconds()).toBe(0);
  });

  it('starts on the first action and counts the gap to the second', () => {
    const c = clock();
    const timer = createPlayTimer({ now: c.now });
    timer.activity();
    c.advance(30_000);
    timer.activity();
    expect(timer.seconds()).toBe(30);
  });

  it('adds up several gaps', () => {
    const c = clock();
    const timer = createPlayTimer({ now: c.now });
    timer.activity();
    c.advance(30_000);
    timer.activity();
    c.advance(45_000);
    timer.activity();
    expect(timer.seconds()).toBe(75);
  });

  it('throws away a gap over two minutes and counts an idle (brief 34, 50)', () => {
    const c = clock();
    const timer = createPlayTimer({ now: c.now });
    timer.activity();
    c.advance(121_000);
    timer.activity();
    expect(timer.seconds()).toBe(0);
    expect(timer.idles()).toBe(1);
  });

  it('counts a gap of exactly two minutes — the cut-off is MORE than two minutes', () => {
    const c = clock();
    const timer = createPlayTimer({ now: c.now });
    timer.activity();
    c.advance(120_000);
    timer.activity();
    expect(timer.seconds()).toBe(120);
    expect(timer.idles()).toBe(0);
  });

  it('starts counting again from the next action after an idle gap (brief 29)', () => {
    const c = clock();
    const timer = createPlayTimer({ now: c.now });
    timer.activity();
    c.advance(300_000);
    timer.activity();
    c.advance(20_000);
    timer.activity();
    expect(timer.seconds()).toBe(20);
    expect(timer.idles()).toBe(1);
  });

  it('banks time on hide, counts nothing while hidden, and resumes on show (brief 26)', () => {
    const c = clock();
    const timer = createPlayTimer({ now: c.now });
    timer.activity();
    c.advance(40_000);
    timer.hide();
    expect(timer.seconds()).toBe(40);
    c.advance(600_000);
    timer.show();
    expect(timer.seconds()).toBe(40);
    c.advance(10_000);
    timer.activity();
    expect(timer.seconds()).toBe(50);
  });

  it('banks nothing on hide after an over-long gap, and counts an idle', () => {
    const c = clock();
    const timer = createPlayTimer({ now: c.now });
    timer.activity();
    c.advance(200_000);
    timer.hide();
    expect(timer.seconds()).toBe(0);
    expect(timer.idles()).toBe(1);
  });

  it('an action while hidden does not resurrect the clock', () => {
    const c = clock();
    const timer = createPlayTimer({ now: c.now });
    timer.activity();
    c.advance(10_000);
    timer.activity();
    timer.hide();
    c.advance(30_000);
    timer.activity();
    expect(timer.seconds()).toBe(10);
  });

  it('reads whole seconds, floored, and never goes negative if the clock jumps back', () => {
    const c = clock();
    const timer = createPlayTimer({ now: c.now });
    timer.activity();
    c.advance(1_500);
    timer.activity();
    expect(timer.seconds()).toBe(1);
    c.advance(-500_000);
    timer.activity();
    expect(timer.seconds()).toBeGreaterThanOrEqual(0);
  });

  it('caps what it hands to storage at a day, but never at the outlier threshold', () => {
    const c = clock();
    const timer = createPlayTimer({ now: c.now });
    timer.activity();
    // Forty minutes of real play, in gaps the cut-off accepts.
    for (let i = 0; i < 20; i++) { c.advance(120_000); timer.activity(); }
    expect(timer.seconds()).toBe(2400);

    const long = createPlayTimer({ now: c.now, elapsed: MAX_STORED_SECONDS });
    long.activity();
    c.advance(60_000);
    long.activity();
    expect(long.seconds()).toBe(MAX_STORED_SECONDS);
  });

  it('restores a saved clock and carries on (brief 30)', () => {
    const c = clock();
    const timer = createPlayTimer({ now: c.now, elapsed: 240, idles: 1 });
    timer.activity();
    c.advance(30_000);
    timer.activity();
    expect(timer.seconds()).toBe(270);
    expect(timer.idles()).toBe(1);
  });

  it('ignores a forged restore value rather than trusting it', () => {
    const c = clock();
    const timer = createPlayTimer({ now: c.now, elapsed: -50, idles: -3 });
    expect(timer.seconds()).toBe(0);
    expect(timer.idles()).toBe(0);
  });

  it('labels the analytics source clean or idle-N (brief 38)', () => {
    const c = clock();
    const timer = createPlayTimer({ now: c.now });
    expect(timer.idleLabel()).toBe('clean');
    timer.activity();
    c.advance(200_000);
    timer.activity();
    c.advance(200_000);
    timer.activity();
    expect(timer.idles()).toBe(2);
    expect(timer.idleLabel()).toBe('idle-2');
  });
});

describe('coming back to the tab', () => {
  it('does not start the clock for a player who has never acted (brief 27)', () => {
    const c = clock();
    const timer = createPlayTimer({ now: c.now });
    timer.hide();
    c.advance(60_000);
    timer.show();
    c.advance(30_000);
    expect(timer.seconds()).toBe(0);
    timer.activity();
    expect(timer.seconds()).toBe(0);
  });

  it('discards a long stare after coming back, the same as any other idle gap', () => {
    const c = clock();
    const timer = createPlayTimer({ now: c.now });
    timer.activity();
    c.advance(20_000);
    timer.activity();
    timer.hide();
    c.advance(600_000);
    timer.show();
    c.advance(300_000);
    timer.activity();
    expect(timer.seconds()).toBe(20);
    expect(timer.idles()).toBe(1);
  });
});
