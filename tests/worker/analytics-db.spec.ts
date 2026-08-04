import { env } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';
import { getStats, rangeCutoff, recordEvent, startOfUTCDay } from '../../src/worker/analytics-db.ts';
import { VALID_EVENTS } from '../../src/worker/index.ts';

const DAY = 86_400_000;
// 2026-08-04T12:00:00Z — a fixed "now" so day bucketing is assertable.
const NOW = Date.UTC(2026, 7, 4, 12, 0, 0);
const db = () => env.ANALYTICS_DB;

async function insert(row: {
  ts: number;
  event: string;
  uid?: string;
  source?: string | null;
  hostname?: string;
  value?: number;
  newUser?: 0 | 1;
  sampleInterval?: number;
  backfilled?: 0 | 1;
}) {
  await db()
    .prepare(
      'INSERT INTO analytics_events (ts, event, uid, source, hostname, value, new_user, sample_interval, backfilled) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    )
    .bind(
      row.ts,
      row.event,
      row.uid ?? 'uid-1',
      row.source ?? null,
      row.hostname ?? 'clumeral.com',
      row.value ?? 0,
      row.newUser ?? 0,
      row.sampleInterval ?? 1,
      row.backfilled ?? 0,
    )
    .run();
}

describe('recordEvent', () => {
  // The brief's H5 fix: assert the stored row column by column, for every event
  // the Worker accepts. A write path that stores the wrong column is invisible
  // otherwise — the POST still returns 202 and the dashboard just reads oddly.
  //
  // These are hand-made inputs, so they pin the mapping, not what production
  // sends. The production-shape cases are below.
  it.each([...VALID_EVENTS])('stores %s with every column correct', async (event) => {
    const isSourced = event === 'undo_used' || event === 'reset_used';
    await recordEvent(
      db(),
      {
        event,
        uid: 'uid-abc',
        source: isSourced ? 'keyboard' : undefined,
        hostname: 'clumeral.com',
        value: 4,
        newUser: true,
      },
      NOW,
    );

    const row = await db().prepare('SELECT * FROM analytics_events').first();
    expect(row).toMatchObject({
      ts: NOW,
      event,
      uid: 'uid-abc',
      // NULL for everything except undo/reset — the same shape the backfill
      // produces via NULLIF, so the two sides of the cutover agree.
      source: isSourced ? 'keyboard' : null,
      hostname: 'clumeral.com',
      value: 4,
      new_user: 1,
      sample_interval: 1,
      backfilled: 0,
    });
  });

  it('accepts all ten documented events', () => {
    expect(VALID_EVENTS.size).toBe(10);
  });

  it('normalises an empty source to NULL', async () => {
    await recordEvent(db(), { event: 'undo_used', source: '', uid: 'u', hostname: 'clumeral.com' }, NOW);
    const row = await db().prepare('SELECT source FROM analytics_events').first();
    expect(row?.source).toBeNull();
  });

  // source is NOT undo/reset-only, whatever the column comment used to say.
  // router.ts sends route_change with the path and app.ts sends htp_opened with
  // 'manual', and route_change is the highest-volume event we record. The
  // per-event test above drives recordEvent with hand-made inputs, so on its own
  // it would happily "confirm" an invariant production does not hold.
  it.each([
    ['route_change', '/archive/2026-05-01?x=1'],
    ['htp_opened', 'manual'],
  ])('keeps the source production actually sends for %s', async (event, source) => {
    await recordEvent(db(), { event, source, uid: 'u', hostname: 'clumeral.com' }, NOW);
    const row = await db().prepare('SELECT source FROM analytics_events').first();
    expect(row?.source).toBe(source);
  });

  // The endpoint is public and unauthenticated, and D1 rows are permanent with no
  // prune step. Unbounded strings here are permanent storage handed to anyone.
  it('truncates an over-long uid and source', async () => {
    await recordEvent(
      db(),
      { event: 'route_change', uid: 'u'.repeat(5000), source: 's'.repeat(5000), hostname: 'clumeral.com' },
      NOW,
    );
    const row = await db().prepare('SELECT length(uid) AS u, length(source) AS s FROM analytics_events').first();
    expect(row).toEqual({ u: 64, s: 128 });
  });

  // The request body is cast, never validated, so value can be anything JSON
  // allows. NaN binds as NULL, trips NOT NULL, and drops the row into a swallowed
  // console.error — while writeDataPoint keeps it. That divergence would land
  // straight in the comparison that gates switching AE off.
  it.each([
    [{}, 0],
    ['nonsense', 0],
    [null, 0],
    [Infinity, 0],
    [7, 7],
  ])('stores a usable value for %s', async (value, expected) => {
    await recordEvent(
      db(),
      { event: 'puzzle_complete', uid: 'u', hostname: 'clumeral.com', value: value as number },
      NOW,
    );
    const row = await db().prepare('SELECT value FROM analytics_events').first();
    expect(row?.value).toBe(expected);
  });

  it('defaults value and new_user', async () => {
    await recordEvent(db(), { event: 'route_change', uid: 'u', hostname: 'clumeral.com' }, NOW);
    const row = await db().prepare('SELECT value, new_user FROM analytics_events').first();
    expect(row).toMatchObject({ value: 0, new_user: 0 });
  });

  // The CHECK constraint rejects a non-integer flag, and a fractional guess count
  // would be meaningless — truncate rather than let SQLite store a float in an
  // INTEGER column.
  it('truncates a fractional value', async () => {
    await recordEvent(db(), { event: 'puzzle_complete', uid: 'u', hostname: 'clumeral.com', value: 3.7 }, NOW);
    const row = await db().prepare('SELECT value FROM analytics_events').first();
    expect(row?.value).toBe(3);
  });

  it('rejects rather than silently succeeding when the table is missing', async () => {
    // Item 58 reframed: the caller must be able to see a D1 failure as a rejected
    // promise, because index.ts relies on catching it to keep the response 202.
    await db().prepare('DROP TABLE analytics_events').run();
    await expect(recordEvent(db(), { event: 'route_change', uid: 'u', hostname: 'x' }, NOW)).rejects.toThrow();
  });
});

describe('rangeCutoff', () => {
  it('covers whole UTC days, today included', () => {
    // 7d must be seven day-columns, not 168 hours: a rolling window would render
    // an eighth partial day that always reads as a slump.
    expect(rangeCutoff({ days: 7 }, NOW)).toBe(startOfUTCDay(NOW) - 6 * DAY);
    expect(rangeCutoff({ days: 1 }, NOW)).toBe(startOfUTCDay(NOW));
  });

  it('has no lower bound for all-time', () => {
    expect(rangeCutoff({ all: true }, NOW)).toBeNull();
  });
});

describe('getStats', () => {
  beforeEach(async () => {
    const today = startOfUTCDay(NOW);
    // Today
    await insert({ ts: today + 3600_000, event: 'puzzle_start', uid: 'a', newUser: 1 });
    await insert({ ts: today + 3600_000, event: 'puzzle_start', uid: 'b' });
    await insert({ ts: today + 3700_000, event: 'puzzle_complete', uid: 'a', value: 3 });
    await insert({ ts: today + 3800_000, event: 'undo_used', uid: 'a', source: 'keyboard' });
    await insert({ ts: today + 3900_000, event: 'undo_used', uid: 'b', source: 'button' });
    // Two days ago, and one sampled row standing for four events
    await insert({ ts: today - 2 * DAY + 1000, event: 'puzzle_start', uid: 'c', sampleInterval: 4 });
    // 40 days ago — outside 7d and 30d, inside 90d and all
    await insert({ ts: today - 40 * DAY, event: 'puzzle_start', uid: 'd' });
    // A different host, which must never appear
    await insert({ ts: today + 3600_000, event: 'puzzle_start', uid: 'z', hostname: 'staging.workers.dev' });
  });

  it('counts sampled rows by their interval, not as one row each', async () => {
    const stats = await getStats(db(), { days: 7 }, 'clumeral.com', NOW);
    const starts = stats.events.find((e) => e.event === 'puzzle_start');
    // 2 today + 1 row standing for 4 = 6, not 3.
    expect(starts?.count).toBe(6);
  });

  it('filters to the requesting hostname', async () => {
    const stats = await getStats(db(), { all: true }, 'clumeral.com', NOW);
    const total = stats.events.reduce((s, e) => s + e.count, 0);
    // The staging row is excluded; everything else is present.
    expect(total).toBe(10);
    expect(stats.uniqueUsers).toBe(4);
  });

  // The regression that matters: the AE version interpolated the hostname into
  // SQL. Bound, this returns nothing; interpolated, it would return everything.
  it('treats an injection attempt as a hostname', async () => {
    const stats = await getStats(db(), { all: true }, "' OR 1=1 --", NOW);
    expect(stats.events).toEqual([]);
    expect(stats.uniqueUsers).toBe(0);
    expect(stats.firstTs).toBeNull();
  });

  it('applies the day cutoff for a bounded range', async () => {
    const week = await getStats(db(), { days: 7 }, 'clumeral.com', NOW);
    const month = await getStats(db(), { days: 30 }, 'clumeral.com', NOW);
    const quarter = await getStats(db(), { days: 90 }, 'clumeral.com', NOW);
    expect(week.uniqueUsers).toBe(3); // a, b, c
    expect(month.uniqueUsers).toBe(3);
    expect(quarter.uniqueUsers).toBe(4); // + d, 40 days back
  });

  it('omits the cutoff entirely for all-time', async () => {
    // 400 days back is older than any range we offer; only "all" may reach it.
    await insert({ ts: startOfUTCDay(NOW) - 400 * DAY, event: 'puzzle_start', uid: 'ancient' });
    const all = await getStats(db(), { all: true }, 'clumeral.com', NOW);
    const quarter = await getStats(db(), { days: 90 }, 'clumeral.com', NOW);
    expect(all.uniqueUsers).toBe(5);
    expect(quarter.uniqueUsers).toBe(4);
  });

  it('buckets daily counts by UTC day', async () => {
    const stats = await getStats(db(), { days: 7 }, 'clumeral.com', NOW);
    const plays = stats.daily.filter((d) => d.event === 'puzzle_start');
    expect(plays).toEqual([
      { day: '2026-08-02', event: 'puzzle_start', count: 4 },
      { day: '2026-08-04', event: 'puzzle_start', count: 2 },
    ]);
  });

  it('counts new users separately from unique users', async () => {
    const stats = await getStats(db(), { days: 7 }, 'clumeral.com', NOW);
    expect(stats.uniqueUsers).toBe(3);
    expect(stats.newUsers).toBe(1);
  });

  it('splits undo and reset by source', async () => {
    const stats = await getStats(db(), { days: 7 }, 'clumeral.com', NOW);
    expect(stats.sourceSplit).toEqual(
      expect.arrayContaining([
        { event: 'undo_used', source: 'keyboard', count: 1 },
        { event: 'undo_used', source: 'button', count: 1 },
      ]),
    );
  });

  it('returns the guess distribution', async () => {
    const stats = await getStats(db(), { days: 7 }, 'clumeral.com', NOW);
    expect(stats.guessDistribution).toEqual([{ guesses: 3, count: 1 }]);
  });

  // firstTs drives the "All time · 5 Apr – 3 Aug" label and the chart's lower
  // bound. Taking it from the daily rows would be wrong: those are filtered to
  // puzzle_start by the renderer, so a day with only route_change events would
  // move the apparent start of collection.
  it('takes firstTs from the earliest row of any event type', async () => {
    const earlier = startOfUTCDay(NOW) - 500 * DAY;
    await insert({ ts: earlier, event: 'route_change', uid: 'r' });
    const stats = await getStats(db(), { all: true }, 'clumeral.com', NOW);
    expect(stats.firstTs).toBe(earlier);
  });

  it('ignores the selected range when reporting firstTs', async () => {
    const stats = await getStats(db(), { days: 7 }, 'clumeral.com', NOW);
    expect(stats.firstTs).toBe(startOfUTCDay(NOW) - 40 * DAY);
  });

  it('returns empty structures for a host with no rows', async () => {
    const stats = await getStats(db(), { all: true }, 'nothing.example', NOW);
    expect(stats).toEqual({
      events: [],
      daily: [],
      uniqueUsers: 0,
      newUsers: 0,
      guessDistribution: [],
      sourceSplit: [],
      firstTs: null,
    });
  });
});
