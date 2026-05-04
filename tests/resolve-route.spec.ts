import { describe, it, expect } from 'vitest';
import { resolveRoute, isValidDate, type ResolveCtx } from '../src/route-resolver.ts';

function ctx(over: Partial<ResolveCtx> = {}): ResolveCtx {
  return {
    hasData: true,
    todayEntry: null,
    todayLocal: '2026-05-03',
    midInteraction: false,
    ...over,
  };
}

describe('resolveRoute (RTE-03, ARC-03)', () => {
  it('RTE-03: /play with no Clumeral data → welcome', () => {
    expect(resolveRoute('/play', ctx({ hasData: false }))).toEqual({ kind: 'welcome' });
  });

  it('RTE-03: /play with today already solved → play (solved-replay; back-from-/solved should not loop)', () => {
    const todayEntry = { date: '2026-05-03', tries: 2 };
    expect(resolveRoute('/play', ctx({ hasData: true, todayEntry }))).toEqual({ kind: 'play' });
  });

  it('RTE-03: /solved with no/stale today entry → welcome', () => {
    expect(resolveRoute('/solved', ctx({ todayEntry: null }))).toEqual({ kind: 'welcome' });
  });

  it('RTE-03: /welcome → welcome (passthrough)', () => {
    expect(resolveRoute('/welcome', ctx())).toEqual({ kind: 'welcome' });
  });

  it('RTE-03: /play with data + unsolved → play', () => {
    expect(resolveRoute('/play', ctx({ hasData: true, todayEntry: null }))).toEqual({ kind: 'play' });
  });

  it('ARC-03: /archive/2099-01-01 (future) → archive', () => {
    expect(resolveRoute('/archive/2099-01-01', ctx())).toEqual({ kind: 'archive' });
  });

  it('ARC-03: /archive/not-a-date → archive', () => {
    expect(resolveRoute('/archive/not-a-date', ctx())).toEqual({ kind: 'archive' });
  });

  it('ARC-03: /archive/<past-valid-date> → archive-date', () => {
    expect(resolveRoute('/archive/2026-04-01', ctx())).toEqual({ kind: 'archive-date', date: '2026-04-01' });
  });

  it('ARC-03: /archive (bare) → archive', () => {
    expect(resolveRoute('/archive', ctx())).toEqual({ kind: 'archive' });
  });

  it('ARC-03: /unknown/path → welcome (fallback)', () => {
    expect(resolveRoute('/totally/made-up', ctx())).toEqual({ kind: 'welcome' });
  });

  it('ARC-03: rejects 2026-02-31 as invalid → archive', () => {
    expect(isValidDate('2026-02-31')).toBe(false);
    expect(resolveRoute('/archive/2026-02-31', ctx())).toEqual({ kind: 'archive' });
  });
});
