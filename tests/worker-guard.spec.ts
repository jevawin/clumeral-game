import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isFuturePuzzleDate } from '../src/worker/date-guard.ts';
import { VALID_EVENTS } from '../src/worker/index.ts';

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

// The frontend cannot tell whether an event name is accepted: track() posts and
// swallows the failure, so a name missing from the allowlist records nothing
// while the feature looks perfectly healthy. This is the only automated proof.
describe('VALID_EVENTS allowlist', () => {
  it('accepts the board-control events', () => {
    expect(VALID_EVENTS.has('undo_used')).toBe(true);
    expect(VALID_EVENTS.has('reset_used')).toBe(true);
  });

  it('still accepts the events that were already there', () => {
    for (const name of ['puzzle_start', 'puzzle_complete', 'incorrect_guess', 'route_change']) {
      expect(VALID_EVENTS.has(name), name).toBe(true);
    }
  });

  it('accepts the play-timing event', () => {
    // Without this the Worker 400s the event, recordEvent never runs, and the
    // average time on /stats stays empty while the client looks healthy.
    expect(VALID_EVENTS.has('puzzle_time')).toBe(true);
  });

  it('is still an allowlist', () => {
    expect(VALID_EVENTS.has('made_up_event')).toBe(false);
  });
});
