import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isFuturePuzzleDate } from '../src/worker/date-guard.ts';

describe('isFuturePuzzleDate (Phase 5 D-04, #205 server gate fix)', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  describe('system time 2026-05-29T12:00:00Z (worker UTC today = 2026-05-29)', () => {
    beforeEach(() => { vi.setSystemTime(new Date('2026-05-29T12:00:00Z')); });

    it('accepts today (2026-05-29 === todayUtc)', () => {
      expect(isFuturePuzzleDate('2026-05-29')).toBe(false);
    });

    it('accepts past date (2026-05-28 < todayUtc)', () => {
      expect(isFuturePuzzleDate('2026-05-28')).toBe(false);
    });

    it('accepts today+1 (2026-05-30 — UTC+14 local-midnight player edge, the #205 fix)', () => {
      expect(isFuturePuzzleDate('2026-05-30')).toBe(false);
    });

    it('rejects today+2 (2026-05-31 — true future, no tolerance)', () => {
      expect(isFuturePuzzleDate('2026-05-31')).toBe(true);
    });
  });

  describe('month-boundary edge: system time 2026-05-31T23:00:00Z (UTC today = 2026-05-31)', () => {
    beforeEach(() => { vi.setSystemTime(new Date('2026-05-31T23:00:00Z')); });

    it('accepts 2026-06-01 (today+1 across month rollover)', () => {
      expect(isFuturePuzzleDate('2026-06-01')).toBe(false);
    });

    it('rejects 2026-06-02 (today+2 across month rollover)', () => {
      expect(isFuturePuzzleDate('2026-06-02')).toBe(true);
    });
  });
});
