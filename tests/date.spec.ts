import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EPOCH_DATE, todayKey, localDateKey, puzzleNumberFor, formatDate } from '../src/date.ts';

// ─── todayKey (DST boundary) ──────────────────────────────────────────────────

describe('todayKey (DST boundary)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns local date on BST spring-forward day: 00:30 local (+01:00) is 23:30 UTC prev day', () => {
    // 2026-03-29 is the UK BST spring-forward day.
    // 00:30 local (+01:00 BST) = 23:30 UTC on 2026-03-28.
    // todayKey() must return the LOCAL date '2026-03-29', not the UTC date '2026-03-28'.
    vi.setSystemTime(new Date('2026-03-29T00:30:00+01:00'));
    expect(todayKey()).toBe('2026-03-29');
  });

  it('returns local date on GMT fall-back day: 00:30 local (GMT) stays on the same day', () => {
    // 2026-10-25 is the UK GMT fall-back day (clocks go back from BST to GMT).
    // The ambiguous 01:00–02:00 hour exists twice; 00:30 is unambiguous GMT.
    vi.setSystemTime(new Date('2026-10-25T00:30:00+00:00'));
    expect(todayKey()).toBe('2026-10-25');
  });

  it('returns local date in UTC offset (UTC+00:00)', () => {
    vi.setSystemTime(new Date('2026-06-01T12:00:00+00:00'));
    expect(todayKey()).toBe('2026-06-01');
  });

  it('returns local date in UTC+01:00 (BST)', () => {
    vi.setSystemTime(new Date('2026-06-01T12:00:00+01:00'));
    expect(todayKey()).toBe('2026-06-01');
  });

  it('returns local date in UTC-05:00 (EST)', () => {
    // 2026-06-01T23:30:00-05:00 = 2026-06-02T04:30:00Z (UTC says 2nd, local says 1st)
    vi.setSystemTime(new Date('2026-06-01T23:30:00-05:00'));
    expect(todayKey()).toBe('2026-06-01');
  });

  it('agrees with localDateKey(new Date()) at a fixed system time', () => {
    vi.setSystemTime(new Date('2026-06-15T10:00:00+00:00'));
    expect(todayKey()).toBe(localDateKey(new Date()));
  });
});

// ─── localDateKey ─────────────────────────────────────────────────────────────

describe('localDateKey', () => {
  it('formats a Date to local YYYY-MM-DD with zero-padded month and day', () => {
    // new Date('2026-06-01T23:30:00-05:00') — local date for that offset is 2026-06-01.
    // In jsdom with fixed system time, the local date must match the offset given.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-01T23:30:00-05:00'));
    const result = localDateKey(new Date());
    vi.useRealTimers();
    expect(result).toBe('2026-06-01');
  });

  it('zero-pads month (single-digit month)', () => {
    // Use a date with month < 10 to confirm padding.
    const d = new Date('2026-03-08T12:00:00');
    // getFullYear/getMonth/getDate are local getters — in jsdom they match the system TZ.
    // Since this test passes a literal Date object we assert the format shape.
    const result = localDateKey(d);
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('zero-pads day (single-digit day)', () => {
    const d = new Date('2026-03-08T12:00:00');
    const result = localDateKey(d);
    // Day 8 must be padded to '08'
    expect(result.split('-')[2]).toHaveLength(2);
  });
});

// ─── puzzleNumberFor ──────────────────────────────────────────────────────────

describe('puzzleNumberFor', () => {
  it('returns 1 for EPOCH_DATE', () => {
    expect(puzzleNumberFor(EPOCH_DATE)).toBe(1);
  });

  it('returns 2 for the day after EPOCH_DATE (2026-03-09)', () => {
    expect(puzzleNumberFor('2026-03-09')).toBe(2);
  });

  it('returns a number > 1 for a date well after EPOCH_DATE', () => {
    expect(puzzleNumberFor('2026-06-01')).toBeGreaterThan(1);
  });

  it('is deterministic: same dateStr returns same number on repeated calls', () => {
    const first = puzzleNumberFor('2026-05-01');
    const second = puzzleNumberFor('2026-05-01');
    expect(first).toBe(second);
  });

  it('returns 1 (clamped) for a date before EPOCH_DATE', () => {
    // Math.max(1, ...) ensures no negative puzzle numbers.
    expect(puzzleNumberFor('2025-01-01')).toBe(1);
  });
});

// ─── formatDate ───────────────────────────────────────────────────────────────

describe('formatDate', () => {
  it("formats '2026-06-01' as '1 June 2026' (en-GB)", () => {
    const result = formatDate('2026-06-01');
    expect(result).toContain('1 June 2026');
  });

  it('does not shift the day due to UTC parsing (no Z suffix)', () => {
    // '2026-03-08' must display as 8 March 2026 regardless of system timezone.
    // The NO-Z parse ensures local midnight is used, not UTC midnight.
    const result = formatDate('2026-03-08');
    expect(result).toContain('8 March 2026');
  });
});
