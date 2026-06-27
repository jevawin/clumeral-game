import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EPOCH_DATE, todayKey, localDateKey, puzzleNumberFor, formatDate } from '../src/date.ts';

// ─── todayKey (DST boundary) ──────────────────────────────────────────────────
//
// todayKey() is LOCAL-keyed: it uses local getters (getDate/getMonth/getFullYear via
// localDateKey), NOT getUTC* or toISOString. So its result depends on the runner's
// timezone. To stay deterministic on any machine — a UTC CI runner OR a UTC+ dev box —
// each test below PINS process.env.TZ to a specific zone, then asserts the true LOCAL
// date that a player's browser clock would show in that zone. Node re-reads process.env.TZ
// on the next Date operation, so setting it before vi.setSystemTime() takes effect.

describe('todayKey (DST boundary)', () => {
  const ORIGINAL_TZ = process.env.TZ;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    process.env.TZ = ORIGINAL_TZ;
  });

  it('keys to the LOCAL date at a UTC+01:00 instant (epoch 2026-03-28T23:30:00Z → 2026-03-29)', () => {
    // Europe/Madrid is CET (+01:00) on 2026-03-28. Epoch 23:30Z is local 2026-03-29T00:30.
    // Local date (29) differs from the UTC date (28) — todayKey must return the LOCAL date.
    process.env.TZ = 'Europe/Madrid';
    vi.setSystemTime(new Date('2026-03-28T23:30:00Z'));
    const result = todayKey();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result).toBe('2026-03-29');
  });

  it('keys to the LOCAL date on the GMT fall-back day (2026-10-25T00:30:00Z, London)', () => {
    // Europe/London is BST (+01:00) at 00:30Z on the 2026-10-25 fall-back day (clocks go
    // back at 02:00 BST). Local time is 01:30, so the local date is 2026-10-25.
    process.env.TZ = 'Europe/London';
    vi.setSystemTime(new Date('2026-10-25T00:30:00Z'));
    expect(todayKey()).toBe('2026-10-25');
  });

  it('keys to the LOCAL date in a UTC+00:00 zone (2026-06-01)', () => {
    process.env.TZ = 'UTC';
    vi.setSystemTime(new Date('2026-06-01T12:00:00Z'));
    expect(todayKey()).toBe('2026-06-01');
  });

  it('stays on the same date just before UTC midnight (2026-06-01T23:59:00Z, UTC zone)', () => {
    process.env.TZ = 'UTC';
    vi.setSystemTime(new Date('2026-06-01T23:59:00Z'));
    expect(todayKey()).toBe('2026-06-01');
  });

  it('keys to the LOCAL date at a UTC-05:00 instant (epoch 2026-06-02T04:30:00Z → 2026-06-01)', () => {
    // America/Lima is -05:00 year-round (no DST). Epoch 04:30Z is local 2026-06-01T23:30.
    // Local date (1 June) differs from the UTC date (2 June) — todayKey must return LOCAL.
    process.env.TZ = 'America/Lima';
    vi.setSystemTime(new Date('2026-06-02T04:30:00Z'));
    const result = todayKey();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result).toBe('2026-06-01');
  });

  it('agrees with localDateKey(new Date()) at a fixed system time', () => {
    vi.setSystemTime(new Date('2026-06-15T10:00:00Z'));
    expect(todayKey()).toBe(localDateKey(new Date()));
  });
});

// ─── localDateKey ─────────────────────────────────────────────────────────────

describe('localDateKey', () => {
  // Pin TZ to UTC so "local == UTC" holds regardless of the runner's timezone.
  const ORIGINAL_TZ = process.env.TZ;

  beforeEach(() => {
    process.env.TZ = 'UTC';
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    process.env.TZ = ORIGINAL_TZ;
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
