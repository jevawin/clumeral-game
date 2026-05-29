import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EPOCH_DATE, todayKey, localDateKey, puzzleNumberFor, formatDate } from '../src/date.ts';

// ─── todayKey (DST boundary) ──────────────────────────────────────────────────
//
// vitest runs in the Node.js process timezone, which is UTC in most CI/test environments.
// In UTC, getDate() (local getter) == getUTCDate(), so both return the same value.
// The key correctness guarantee is that the IMPLEMENTATION uses local getters (getDate),
// not UTC getters (getUTCDate) or toISOString() — proven by grep in the acceptance criteria.
//
// The DST-transition tests below assert UTC values (since the test runtime is UTC).
// In a +01:00 browser, 2026-03-29T00:30:00+01:00 is epoch 2026-03-28T23:30:00Z.
// getDate() (local) returns 29 in that +01:00 browser — the LOCAL date, not UTC.
// getUTCDate() returns 28 in that browser — the UTC date.
// Our implementation uses getDate(), so it will return the correct LOCAL date in browsers.

describe('todayKey (DST boundary)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns a YYYY-MM-DD string at BST spring-forward epoch (2026-03-28T23:30:00Z)', () => {
    // 2026-03-29T00:30:00+01:00 = 2026-03-28T23:30:00Z (UTC).
    // In UTC runtime: getDate() returns 28 (local == UTC in this environment).
    // In a +01:00 browser: getDate() returns 29 — correct local date for the player.
    // This test validates format and that the call does not throw.
    vi.setSystemTime(new Date('2026-03-29T00:30:00+01:00'));
    const result = todayKey();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // UTC runtime: epoch is 2026-03-28T23:30:00Z so local UTC date is 2026-03-28
    expect(result).toBe('2026-03-28');
  });

  it('returns a YYYY-MM-DD string on GMT fall-back day (2026-10-25T00:30:00Z)', () => {
    // 2026-10-25T00:30:00+00:00 = 2026-10-25T00:30:00Z
    // In UTC runtime and in a GMT browser: local date is 2026-10-25.
    vi.setSystemTime(new Date('2026-10-25T00:30:00+00:00'));
    expect(todayKey()).toBe('2026-10-25');
  });

  it('returns local date in UTC offset (UTC+00:00) — 2026-06-01', () => {
    vi.setSystemTime(new Date('2026-06-01T12:00:00+00:00'));
    expect(todayKey()).toBe('2026-06-01');
  });

  it('returns UTC date when system time is set to a UTC timestamp', () => {
    // 2026-06-01T12:00:00Z — in UTC runtime, local date is 2026-06-01
    vi.setSystemTime(new Date('2026-06-01T12:00:00Z'));
    expect(todayKey()).toBe('2026-06-01');
  });

  it('returns date for 2026-06-01 in UTC-05:00 system: epoch is 2026-06-02T04:30:00Z', () => {
    // 2026-06-01T23:30:00-05:00 = 2026-06-02T04:30:00Z
    // In UTC runtime: getDate() returns 2 (2026-06-02) — that is the UTC date.
    // In a -05:00 browser: getDate() returns 1 (2026-06-01) — local date for that player.
    // This test verifies we return what the local clock says, which in UTC runtime == UTC date.
    vi.setSystemTime(new Date('2026-06-01T23:30:00-05:00'));
    const result = todayKey();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // UTC runtime: epoch is 2026-06-02T04:30:00Z so local UTC date is 2026-06-02
    expect(result).toBe('2026-06-02');
  });

  it('agrees with localDateKey(new Date()) at a fixed system time', () => {
    vi.setSystemTime(new Date('2026-06-15T10:00:00Z'));
    expect(todayKey()).toBe(localDateKey(new Date()));
  });
});

// ─── localDateKey ─────────────────────────────────────────────────────────────

describe('localDateKey', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('formats a UTC-midnight Date to local YYYY-MM-DD (UTC runtime: local == UTC)', () => {
    // In UTC runtime, new Date at 12:00Z on 2026-06-01 returns 2026-06-01 for both local and UTC getters.
    vi.setSystemTime(new Date('2026-06-01T12:00:00Z'));
    const result = localDateKey(new Date());
    expect(result).toBe('2026-06-01');
  });

  it('zero-pads month (single-digit month)', () => {
    vi.setSystemTime(new Date('2026-03-08T12:00:00Z'));
    const result = localDateKey(new Date());
    // Month 3 must be zero-padded to '03'
    expect(result.split('-')[1]).toBe('03');
  });

  it('zero-pads day (single-digit day)', () => {
    vi.setSystemTime(new Date('2026-03-08T12:00:00Z'));
    const result = localDateKey(new Date());
    // Day 8 must be zero-padded to '08'
    expect(result.split('-')[2]).toBe('08');
  });

  it('produces YYYY-MM-DD format on any Date input', () => {
    vi.setSystemTime(new Date('2026-11-30T06:00:00Z'));
    const result = localDateKey(new Date());
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result).toBe('2026-11-30');
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
