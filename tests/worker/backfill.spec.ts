// The backfill runs once, against data Analytics Engine is actively deleting, and
// writes it into a database nothing can restore from. So the tests here are not
// about coverage — they are about the four properties the import cannot be wrong
// about: the hard cutoff, idempotency under a kill at any point, the query budget,
// and failing loudly instead of silently.
//
// AE is injected rather than mocked call-by-call: `fakeAE` answers the same three
// query shapes the real API does, computed from an in-memory row set, so a test
// that changes the window bounds gets different rows back for the right reason.
// The shapes themselves (COUNT() not COUNT(*), toDateTime bounds, aggregates
// returned as strings, second-precision timestamps) were verified against the live
// API on 2026-08-06 before this file was written.
import { env } from 'cloudflare:test';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BACKFILL_CRON,
  INSERT_CHUNK,
  MAX_CONSECUTIVE_FAILURES,
  MAX_ROWS_PER_RUN,
  STATEMENT_BUDGET,
  dayKey,
  nextDayKey,
  planDays,
  runBackfill,
  type AEQuery,
} from '../../src/worker/backfill.ts';
import worker from '../../src/worker/index.ts';

const db = () => env.ANALYTICS_DB;

// 2026-08-04T12:00:00Z. Everything below is anchored to this so day bucketing is
// assertable rather than dependent on when the suite runs.
const NOW = Date.UTC(2026, 7, 4, 12, 0, 0);
/** The instant the dual write went live, in the middle of 2026-08-04. */
const CUTOFF = Date.UTC(2026, 7, 4, 0, 30, 0);

interface AERow {
  ts: number; // epoch ms; AE itself stores whole seconds
  blob1?: string;
  blob2?: string;
  blob3?: string;
  blob4?: string;
  double1?: number;
  double2?: number;
  si?: number;
}

/** An AE row set that answers the three query shapes backfill.ts sends. */
function fakeAE(rows: AERow[]) {
  const calls: string[] = [];
  const full = rows.map((r) => ({
    ts: Math.floor(r.ts / 1000),
    blob1: r.blob1 ?? 'puzzle_start',
    blob2: r.blob2 ?? 'uid-1',
    blob3: r.blob3 ?? '',
    blob4: r.blob4 ?? 'clumeral.com',
    double1: r.double1 ?? 0,
    double2: r.double2 ?? 0,
    _sample_interval: r.si ?? 1,
  }));

  const query: AEQuery = async (sql) => {
    calls.push(sql);
    if (sql.includes('MIN(timestamp)')) {
      // AE returns 0 for an empty dataset, not null.
      const lo = full.length === 0 ? 0 : Math.min(...full.map((r) => r.ts));
      return [{ lo }];
    }
    // The discovery total: everything below the cutoff, with no lower bound.
    const total = sql.match(/^SELECT COUNT\(\) AS n FROM \w+ WHERE timestamp < toDateTime\((\d+)\)$/m);
    if (total) return [{ n: String(full.filter((r) => r.ts < Number(total[1])).length) }];

    const bounds = sql.match(/timestamp >= toDateTime\((\d+)\) AND timestamp < toDateTime\((\d+)\)/);
    if (!bounds) throw new Error(`fakeAE: unrecognised query ${sql}`);
    const [from, to] = [Number(bounds[1]), Number(bounds[2])];
    const limit = Number(sql.match(/LIMIT (\d+)/)?.[1] ?? 1e9);
    const inWindow = full.filter((r) => r.ts >= from && r.ts < to);

    // A bounded COUNT() — the completion cross-check. Matched on the start of the
    // statement, not on `COUNT() AS n`, which the day-count query also contains.
    // A genuinely empty window returns one row reading zero, which is what makes
    // it a usable second opinion.
    if (sql.trimStart().startsWith('SELECT COUNT() AS n')) return [{ n: String(inWindow.length) }];

    if (sql.includes('toStartOfDay')) {
      const byDay = new Map<string, number>();
      for (const r of inWindow) {
        const day = dayKey(r.ts * 1000);
        byDay.set(day, (byDay.get(day) ?? 0) + 1);
      }
      return [...byDay.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(0, limit)
        // Aggregates come back as strings from the real API.
        .map(([day, n]) => ({ day: `${day} 00:00:00`, n: String(n) }));
    }

    // ts numerically, then the blobs lexicographically - the same total order the
    // real query's ORDER BY produces. Joining ts into the string would sort it as
    // text, which only happens to agree while every timestamp has the same digit
    // count.
    const rest = (r: (typeof full)[number]) => [r.blob1, r.blob2, r.blob3, r.blob4, r.double1, r.double2].join('|');
    return [...inWindow]
      .sort((a, b) => a.ts - b.ts || rest(a).localeCompare(rest(b)))
      .slice(0, limit);
  };

  return Object.assign(query, { calls });
}

const prodEnv = (overrides: Record<string, unknown> = {}) => ({
  ANALYTICS_DB: db(),
  ENVIRONMENT: 'production',
  ...overrides,
});

async function insertLive(ts: number, extra: { hostname?: string; backfilled?: 0 | 1 } = {}) {
  await db()
    .prepare(
      'INSERT INTO analytics_events (ts, event, uid, source, hostname, value, new_user, sample_interval, backfilled) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    )
    .bind(ts, 'puzzle_start', 'live-uid', null, extra.hostname ?? 'clumeral.com', 0, 0, 1, extra.backfilled ?? 0)
    .run();
}

const state = () =>
  db()
    .prepare('SELECT * FROM backfill_state WHERE id = 1')
    .first<{
      cutoff_ms: number | null;
      start_day: string | null;
      next_day: string | null;
      sub_offset: number;
      done: number;
      lock_until: number;
      rows_written: number;
      consecutive_failures: number;
      expected_rows: number | null;
    }>();

const rowCount = async (where = '1 = 1') =>
  Number((await db().prepare(`SELECT COUNT(*) AS n FROM analytics_events WHERE ${where}`).first<{ n: number }>())?.n);

/** Rewind the cursor to re-run a window — a killed run, from the retry's point of view. */
async function rewind(nextDay: string, subOffset = 0) {
  await db().prepare('UPDATE backfill_state SET next_day = ?, sub_offset = ?, done = 0 WHERE id = 1').bind(nextDay, subOffset).run();
}

// Captured rather than asserted through `console.error` itself: in workerd the
// console methods are bound natives, so reading the property back after spying
// hands you the original and every assertion fails as "not a spy".
let errors: string[];
let warnings: string[];

beforeEach(() => {
  errors = [];
  warnings = [];
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation((...parts: unknown[]) => {
    warnings.push(parts.join(' '));
  });
  vi.spyOn(console, 'error').mockImplementation((...parts: unknown[]) => {
    errors.push(parts.join(' '));
  });
  return () => vi.restoreAllMocks();
});

describe('the production gate', () => {
  // Pre-prod versions are uploaded and never deployed, so they should never fire
  // scheduled() at all — but "should never" is not a check, and pre-prod silently
  // importing real history would make its numbers useless for testing.
  it.each(['preprod', undefined, '', 'PRODUCTION'])('does nothing when ENVIRONMENT is %s', async (value) => {
    const ae = fakeAE([{ ts: Date.UTC(2026, 7, 1) }]);
    await insertLive(CUTOFF);
    const result = await runBackfill(prodEnv({ ENVIRONMENT: value }), NOW, ae);
    expect(result.outcome).toBe('skipped-not-production');
    expect(ae.calls).toEqual([]);
    expect(await rowCount('backfilled = 1')).toBe(0);
  });

  it('reports missing Worker secrets rather than sending an undefined token', async () => {
    const result = await runBackfill({ ANALYTICS_DB: db(), ENVIRONMENT: 'production' }, NOW);
    expect(result.outcome).toBe('missing-credentials');
    expect(errors.join('\n')).toContain('CF_ACCOUNT_ID');
  });
});

describe('bounds discovery', () => {
  it('aborts rather than backfilling into a void when no live row exists', async () => {
    const ae = fakeAE([{ ts: Date.UTC(2026, 7, 1) }]);
    const result = await runBackfill(prodEnv(), NOW, ae);
    expect(result.outcome).toBe('no-live-rows');
    expect(await rowCount()).toBe(0);
    const s = await state();
    expect(s?.cutoff_ms).toBeNull();
    // The abort still releases the lock, or the next invocation would find it held.
    expect(s?.lock_until).toBe(0);
  });

  it('aborts when Analytics Engine has nothing to import', async () => {
    await insertLive(CUTOFF);
    const result = await runBackfill(prodEnv(), NOW, fakeAE([]));
    expect(result.outcome).toBe('no-ae-rows');
    expect(await rowCount('backfilled = 1')).toBe(0);
    expect((await state())?.cutoff_ms).toBeNull();
  });

  it('freezes both bounds on the first invocation and never recomputes them', async () => {
    await insertLive(CUTOFF);
    const ae = fakeAE([{ ts: Date.UTC(2026, 7, 1, 6) }, { ts: Date.UTC(2026, 7, 2, 6) }]);
    await runBackfill(prodEnv(), NOW, ae);

    const first = await state();
    expect(first?.cutoff_ms).toBe(CUTOFF);
    expect(first?.start_day).toBe('2026-08-01');

    // A live row earlier than the frozen cutoff, and an AE row earlier than the
    // frozen start day. Recomputing either would move the bounds; both must hold.
    await insertLive(CUTOFF - 60_000);
    await runBackfill(prodEnv(), NOW, fakeAE([{ ts: Date.UTC(2026, 6, 20, 6) }]), );

    const second = await state();
    expect(second?.cutoff_ms).toBe(CUTOFF);
    expect(second?.start_day).toBe('2026-08-01');
  });
});

describe('importing', () => {
  beforeEach(() => insertLive(CUTOFF));

  it('maps every column, normalises source, and keeps the sample interval', async () => {
    const ae = fakeAE([
      { ts: Date.UTC(2026, 7, 1, 6, 0, 0), blob1: 'puzzle_complete', blob2: 'uid-a', blob3: '', double1: 4, double2: 1, si: 3 },
      { ts: Date.UTC(2026, 7, 1, 6, 0, 1), blob1: 'undo_used', blob2: 'uid-b', blob3: 'keyboard' },
    ]);
    await runBackfill(prodEnv(), NOW, ae);

    const rows = await db()
      .prepare('SELECT * FROM analytics_events WHERE backfilled = 1 ORDER BY ts ASC')
      .all<Record<string, unknown>>();
    expect(rows.results).toHaveLength(2);
    expect(rows.results[0]).toMatchObject({
      ts: Date.UTC(2026, 7, 1, 6, 0, 0),
      event: 'puzzle_complete',
      uid: 'uid-a',
      // P31: AE stores '' for "no source"; the live path stores NULL. Without this
      // the undo/reset split would read differently either side of the cutoff.
      source: null,
      hostname: 'clumeral.com',
      value: 4,
      new_user: 1,
      sample_interval: 3,
      backfilled: 1,
    });
    expect(rows.results[1]).toMatchObject({ event: 'undo_used', source: 'keyboard', sample_interval: 1 });
  });

  it('imports every hostname, not just production', async () => {
    const ae = fakeAE([
      { ts: Date.UTC(2026, 7, 1, 6), blob4: 'clumeral.com' },
      { ts: Date.UTC(2026, 7, 1, 7), blob4: 'staging-clumeral-game.jevawin.workers.dev' },
    ]);
    await runBackfill(prodEnv(), NOW, ae);
    const hosts = await db().prepare('SELECT DISTINCT hostname FROM analytics_events WHERE backfilled = 1').all<{ hostname: string }>();
    expect(hosts.results.map((r) => r.hostname).sort()).toEqual([
      'clumeral.com',
      'staging-clumeral-game.jevawin.workers.dev',
    ]);
  });

  it('never imports a row at or after the cutoff', async () => {
    const ae = fakeAE([
      { ts: CUTOFF - 60_000 },
      { ts: CUTOFF },
      { ts: CUTOFF + 60_000 },
      { ts: NOW },
    ]);
    let result = await runBackfill(prodEnv(), NOW, ae);
    while (result.outcome === 'imported') result = await runBackfill(prodEnv(), NOW, ae);

    const imported = await db().prepare('SELECT ts FROM analytics_events WHERE backfilled = 1').all<{ ts: number }>();
    expect(imported.results).toHaveLength(1);
    expect(imported.results[0].ts).toBe(CUTOFF - 60_000);
  });

  it('batches several small days into one invocation and advances past them', async () => {
    const ae = fakeAE([
      { ts: Date.UTC(2026, 7, 1, 6) },
      { ts: Date.UTC(2026, 7, 2, 6) },
      { ts: Date.UTC(2026, 7, 3, 6) },
    ]);
    const result = await runBackfill(prodEnv(), NOW, ae);
    expect(result.days).toEqual(['2026-08-01', '2026-08-02', '2026-08-03']);
    expect(result.rows).toBe(3);
    expect((await state())?.next_day).toBe('2026-08-04');
  });

  it('skips empty days instead of spending an invocation on each', async () => {
    // A three-week gap: the cursor must jump it in one run, not 21.
    const ae = fakeAE([{ ts: Date.UTC(2026, 6, 10, 6) }, { ts: Date.UTC(2026, 7, 1, 6) }]);
    const result = await runBackfill(prodEnv(), NOW, ae);
    expect(result.days).toEqual(['2026-07-10', '2026-08-01']);
    expect(await rowCount('backfilled = 1')).toBe(2);
  });

  it('finishes: done is set, and later invocations are a no-op', async () => {
    const ae = fakeAE([{ ts: Date.UTC(2026, 7, 1, 6) }]);
    // Two invocations, not one: importing the last day with rows leaves the cursor
    // at the next day, and only the following run's count query can tell the
    // difference between "no rows left" and "not there yet". Finishing on the
    // evidence rather than on the absence of a further row is the point.
    await runBackfill(prodEnv(), NOW, ae);
    expect((await state())?.done).toBe(0);
    expect(await runBackfill(prodEnv(), NOW, ae)).toMatchObject({ outcome: 'done' });
    expect((await state())?.done).toBe(1);

    const callsBefore = ae.calls.length;
    const after = await runBackfill(prodEnv(), NOW, ae);
    expect(after.outcome).toBe('done');
    // A no-op means no AE subrequest and no D1 write, 1,440 times a day.
    expect(ae.calls).toHaveLength(callsBefore);
  });
});

describe('idempotency', () => {
  beforeEach(() => insertLive(CUTOFF));

  it('re-running the same day window leaves the row count unchanged', async () => {
    const ae = fakeAE([
      { ts: Date.UTC(2026, 7, 1, 6), blob2: 'uid-a' },
      { ts: Date.UTC(2026, 7, 1, 7), blob2: 'uid-b' },
    ]);
    await runBackfill(prodEnv(), NOW, ae);
    const first = await rowCount('backfilled = 1');
    expect(first).toBe(2);

    await rewind('2026-08-01');
    await runBackfill(prodEnv(), NOW, ae);
    expect(await rowCount('backfilled = 1')).toBe(first);
  });

  it('never deletes a live row, even one inside an imported day', async () => {
    // A live row dated inside the imported window — which is exactly what the
    // cutoff day looks like, and what a DELETE without `backfilled = 1` would eat.
    await insertLive(Date.UTC(2026, 7, 1, 8), { hostname: 'clumeral.com' });
    const ae = fakeAE([{ ts: Date.UTC(2026, 7, 1, 6) }]);

    await runBackfill(prodEnv(), NOW, ae);
    await rewind('2026-08-01');
    await runBackfill(prodEnv(), NOW, ae);

    expect(await rowCount('backfilled = 0')).toBe(2); // the cutoff row and this one
    expect(await rowCount('backfilled = 1')).toBe(1);
  });
});

describe('a day too large for one invocation', () => {
  // MAX_ROWS_PER_RUN + a bit, spread one second apart so the window can close on a
  // whole second. The busiest real day is 677 rows (P48), so this is the shape of
  // the data, not a hypothetical.
  const BIG_DAY = Date.UTC(2026, 7, 1);
  const bigRows = Array.from({ length: MAX_ROWS_PER_RUN + 120 }, (_, i) => ({
    ts: BIG_DAY + 6 * 3_600_000 + i * 1000,
    blob2: `uid-${i}`,
  }));

  beforeEach(() => insertLive(CUTOFF));

  it('imports it in sub-windows without losing or duplicating a row', async () => {
    const ae = fakeAE(bigRows);

    const first = await runBackfill(prodEnv(), NOW, ae);
    expect(first.rows).toBe(MAX_ROWS_PER_RUN - 1); // the last whole second is left for the next window
    let s = await state();
    expect(s?.next_day).toBe('2026-08-01');
    expect(s?.sub_offset).toBeGreaterThan(0);

    let result = await runBackfill(prodEnv(), NOW, ae);
    while (result.outcome === 'imported' && (await state())?.done === 0) {
      result = await runBackfill(prodEnv(), NOW, ae);
    }

    expect(await rowCount('backfilled = 1')).toBe(bigRows.length);
    const distinct = await db()
      .prepare('SELECT COUNT(DISTINCT uid) AS n FROM analytics_events WHERE backfilled = 1')
      .first<{ n: number }>();
    expect(distinct?.n).toBe(bigRows.length);
    s = await state();
    expect(s?.done).toBe(1);
  });

  it('re-running a sub-window is safe - its DELETE covers exactly what it rewrites', async () => {
    const ae = fakeAE(bigRows);
    await runBackfill(prodEnv(), NOW, ae);
    const afterFirst = await rowCount('backfilled = 1');
    const cursor = await state();

    // The second window runs, then is retried from the same cursor — a run killed
    // after its insert but before the cursor write. The first window's rows must
    // survive it, and the second window's must not double.
    await runBackfill(prodEnv(), NOW, ae);
    const afterSecond = await rowCount('backfilled = 1');
    await rewind(cursor!.next_day!, cursor!.sub_offset);
    await runBackfill(prodEnv(), NOW, ae);

    expect(await rowCount('backfilled = 1')).toBe(afterSecond);
    expect(afterSecond).toBeGreaterThan(afterFirst);
  });
});

describe('the lock', () => {
  beforeEach(() => insertLive(CUTOFF));

  it('rejects a second invocation while one is running', async () => {
    const ae = fakeAE([{ ts: Date.UTC(2026, 7, 1, 6) }]);
    await db().prepare('UPDATE backfill_state SET lock_until = ? WHERE id = 1').bind(NOW + 60_000).run();

    const result = await runBackfill(prodEnv(), NOW, ae);
    expect(result.outcome).toBe('locked');
    expect(ae.calls).toEqual([]);
    expect(await rowCount('backfilled = 1')).toBe(0);
  });

  it('is released on success, so the next invocation is not idled out', async () => {
    const ae = fakeAE([{ ts: Date.UTC(2026, 7, 1, 6) }]);
    await runBackfill(prodEnv(), NOW, ae);
    expect((await state())?.lock_until).toBe(0);
  });

  it('is taken again once a stale lock expires', async () => {
    const ae = fakeAE([{ ts: Date.UTC(2026, 7, 1, 6) }]);
    await db().prepare('UPDATE backfill_state SET lock_until = ? WHERE id = 1').bind(NOW - 1).run();
    const result = await runBackfill(prodEnv(), NOW, ae);
    expect(result.outcome).toBe('imported');
  });
});

describe('failure handling', () => {
  /** A D1 whose batch() — and only batch() — fails: the import, not the bookkeeping. */
  const brokenWrites = (real: D1Database): D1Database =>
    ({
      prepare: (sql: string) => real.prepare(sql),
      batch: async () => {
        throw new Error('D1_ERROR: simulated write failure');
      },
      exec: (sql: string) => real.exec(sql),
      dump: () => real.dump(),
    }) as unknown as D1Database;

  beforeEach(() => insertLive(CUTOFF));

  it('does not advance the cursor when the insert throws', async () => {
    const ae = fakeAE([{ ts: Date.UTC(2026, 7, 1, 6) }, { ts: Date.UTC(2026, 7, 2, 6) }]);
    // Discovery first, so the cursor exists to be left alone.
    await runBackfill(prodEnv({ ANALYTICS_DB: brokenWrites(db()) }), NOW, ae);
    const before = await state();
    expect(before?.next_day).toBe('2026-08-01');

    const result = await runBackfill(prodEnv({ ANALYTICS_DB: brokenWrites(db()) }), NOW, ae);
    expect(result.outcome).toBe('failed');

    const after = await state();
    expect(after?.next_day).toBe('2026-08-01');
    expect(after?.sub_offset).toBe(0);
    expect(after?.rows_written).toBe(0);
    expect(after?.consecutive_failures).toBeGreaterThan(0);
    // Released, or a failure would also wedge the lock for its full TTL.
    expect(after?.lock_until).toBe(0);
    expect(await rowCount('backfilled = 1')).toBe(0);
  });

  it('resets the failure count after a good run', async () => {
    const ae = fakeAE([{ ts: Date.UTC(2026, 7, 1, 6) }]);
    // Both fail: discovery does not stop for the day, it freezes the bounds and
    // then imports in the same invocation, so the first run reaches the insert too.
    await runBackfill(prodEnv({ ANALYTICS_DB: brokenWrites(db()) }), NOW, ae);
    await runBackfill(prodEnv({ ANALYTICS_DB: brokenWrites(db()) }), NOW, ae);
    expect((await state())?.consecutive_failures).toBe(2);

    await runBackfill(prodEnv(), NOW, ae);
    expect((await state())?.consecutive_failures).toBe(0);
  });

  it(`halts loudly after ${MAX_CONSECUTIVE_FAILURES} consecutive failures instead of retrying every minute forever`, async () => {
    const ae = fakeAE([{ ts: Date.UTC(2026, 7, 1, 6) }]);
    await db()
      .prepare('UPDATE backfill_state SET consecutive_failures = ? WHERE id = 1')
      .bind(MAX_CONSECUTIVE_FAILURES)
      .run();

    const result = await runBackfill(prodEnv(), NOW, ae);
    expect(result.outcome).toBe('halted');
    expect(ae.calls).toEqual([]);
    expect(errors.join('\n')).toContain('HALTED');
  });

  it('says so when the state row is missing rather than looping in silence', async () => {
    await db().prepare('DELETE FROM backfill_state WHERE id = 1').run();
    const result = await runBackfill(prodEnv(), NOW, fakeAE([]));
    expect(result.outcome).toBe('no-state-row');
    expect(errors.join('\n')).toContain('backfill_state');
  });
});

describe('planDays - the query budget', () => {
  it('takes whole days while they fit', () => {
    const days = planDays([
      { day: 'a', rows: 100 },
      { day: 'b', rows: 100 },
      { day: 'c', rows: 100 },
    ]);
    expect(days).toHaveLength(3);
  });

  it('stops before exceeding the row cap', () => {
    const days = planDays([
      { day: 'a', rows: 300 },
      { day: 'b', rows: 300 },
    ]);
    expect(days.map((d) => d.day)).toEqual(['a']);
  });

  it('stops well short of 40 near-empty days, which cost two statements each', () => {
    // Rows alone would have waved all 40 through: one DELETE and one INSERT each
    // is 80 statements for 40 rows.
    const days = planDays(Array.from({ length: 40 }, (_, i) => ({ day: `d${i}`, rows: 1 })));
    expect(days.length).toBeLessThan(40);
    expect(days.reduce((n, d) => n + 1 + Math.ceil(d.rows / INSERT_CHUNK), 0)).toBeLessThanOrEqual(STATEMENT_BUDGET);
  });

  it('always takes at least one day, however big', () => {
    const days = planDays([{ day: 'huge', rows: MAX_ROWS_PER_RUN * 10 }, { day: 'b', rows: 1 }]);
    expect(days.map((d) => d.day)).toEqual(['huge']);
  });
});

// The dispatch is one `===` against a string that lives in two files, and getting
// it wrong is not subtle: the daily puzzle job would run 1,440 times a day, or the
// backfill would never start. wrangler-bindings.spec.ts checks the two strings
// agree; this checks the branch actually goes where it says.
describe('scheduled() cron dispatch', () => {
  const touched = { puzzles: false, analytics: false };
  const stubEnv = () =>
    ({
      PUZZLES: new Proxy(
        {},
        {
          get: () => () => {
            touched.puzzles = true;
            throw new Error('KV unavailable in this test');
          },
        },
      ),
      ANALYTICS_DB: new Proxy(
        {},
        {
          get: () => () => {
            touched.analytics = true;
            throw new Error('D1 unavailable in this test');
          },
        },
      ),
      ENVIRONMENT: 'production',
      // Present, so the backfill gets past its credential check and reaches D1 —
      // otherwise this test would pass without the dispatch working at all.
      CF_ACCOUNT_ID: 'account',
      CF_API_TOKEN: 'token',
    }) as unknown as Parameters<NonNullable<typeof worker.scheduled>>[1];

  beforeEach(() => {
    touched.puzzles = false;
    touched.analytics = false;
  });

  it('sends the per-minute expression to the backfill and nowhere near the puzzles', async () => {
    await worker.scheduled!({ cron: BACKFILL_CRON } as ScheduledEvent, stubEnv(), {} as ExecutionContext);
    expect(touched.analytics).toBe(true);
    expect(touched.puzzles).toBe(false);
  });

  it.each(['0 0 * * *', '30 4 * * *'])('sends %s to the daily puzzle job, not the backfill', async (cron) => {
    // Anything unrecognised keeps the behaviour that predates the backfill.
    await expect(
      worker.scheduled!({ cron } as ScheduledEvent, stubEnv(), {} as ExecutionContext),
    ).rejects.toThrow(/could not freeze/);
    expect(touched.puzzles).toBe(true);
    expect(touched.analytics).toBe(false);
  });
});

describe('day arithmetic', () => {
  it('bucket boundaries are UTC and roll over correctly', () => {
    expect(dayKey(Date.UTC(2026, 7, 4, 23, 59, 59))).toBe('2026-08-04');
    expect(nextDayKey('2026-08-31')).toBe('2026-09-01');
    expect(nextDayKey('2026-12-31')).toBe('2027-01-01');
  });
});

// D1's free tier allows 50 queries per invocation and 100 bound parameters per
// query. Asserting planDays against STATEMENT_BUDGET only checks the code against
// its own constant — it stayed green while the real discovery path issued 51. This
// counts what actually reaches D1.
describe('the real per-invocation query count', () => {
  function countingDb(real: D1Database) {
    const counts = { queries: 0, maxBind: 0 };
    interface Wrapped {
      __real: D1PreparedStatement;
      bind: (...args: unknown[]) => Wrapped;
      run: () => Promise<unknown>;
      first: (col?: string) => Promise<unknown>;
      all: () => Promise<unknown>;
    }
    const wrap = (stmt: D1PreparedStatement): Wrapped => ({
      __real: stmt,
      bind: (...args: unknown[]) => {
        counts.maxBind = Math.max(counts.maxBind, args.length);
        return wrap(stmt.bind(...args));
      },
      run: () => {
        counts.queries++;
        return stmt.run();
      },
      first: (col?: string) => {
        counts.queries++;
        return col === undefined ? stmt.first() : stmt.first(col);
      },
      all: () => {
        counts.queries++;
        return stmt.all();
      },
    });
    const db = {
      prepare: (sql: string) => wrap(real.prepare(sql)),
      // Every statement in a batch is its own query against the cap.
      batch: (stmts: Wrapped[]) => {
        counts.queries += stmts.length;
        return real.batch(stmts.map((s) => s.__real));
      },
    } as unknown as D1Database;
    return { db, counts };
  }

  const runWithCounter = async (ae: ReturnType<typeof fakeAE>) => {
    const { db: counted, counts } = countingDb(db());
    const result = await runBackfill(prodEnv({ ANALYTICS_DB: counted }), NOW, ae);
    return { result, counts };
  };

  beforeEach(() => insertLive(CUTOFF));

  it('stays inside 50 on the discovery invocation, which pays for two extra reads', async () => {
    // An oversized first day — P48 records the historical earliest surviving day
    // at 523 rows, so this is the shape invocation 1 actually meets.
    const ae = fakeAE(
      Array.from({ length: MAX_ROWS_PER_RUN + 200 }, (_, i) => ({
        ts: Date.UTC(2026, 7, 1, 6) + i * 1000,
        blob2: `uid-${i}`,
      })),
    );
    const { result, counts } = await runWithCounter(ae);
    expect(result.outcome).toBe('imported');
    // 48 is the worst case the constants allow; asserting the real ceiling rather
    // than D1's 50 means a regression that eats the headroom fails here instead of
    // in production, one query short of the cap.
    expect(counts.queries).toBeLessThanOrEqual(48);
    expect(counts.maxBind).toBeLessThanOrEqual(100);
  });

  it('stays inside 50 on a maxed multi-day batch', async () => {
    // Many small days: the path where DELETEs, not rows, are what exhausts the cap.
    const rows = [];
    for (let day = 1; day <= 30; day++) {
      for (let i = 0; i < 12; i++) rows.push({ ts: Date.UTC(2026, 6, day, 6) + i * 1000, blob2: `uid-${day}-${i}` });
    }
    const ae = fakeAE(rows);
    await runWithCounter(ae); // discovery
    const { result, counts } = await runWithCounter(ae);
    expect(result.outcome).toBe('imported');
    expect(counts.queries).toBeLessThanOrEqual(48);
    expect(counts.maxBind).toBeLessThanOrEqual(100);
  });

  it('stays inside 50 on the path that binds: discovery, a full window and the verified finish', async () => {
    // Every cost in one invocation — the combination neither of the first two
    // review passes counted end to end. A full window's worth of rows, all inside
    // the cutoff day, so this single invocation discovers the bounds, imports the
    // maximum, reaches the ceiling and runs the verified finish.
    const rows = Array.from({ length: MAX_ROWS_PER_RUN - 1 }, (_, i) => ({
      ts: CUTOFF - (MAX_ROWS_PER_RUN - i) * 1000,
      blob2: `uid-${i}`,
    }));
    const { result, counts } = await runWithCounter(fakeAE(rows));

    // Prove the path really was the expensive one rather than trusting the setup.
    expect(result.outcome).toBe('done');
    expect(result.rows).toBe(MAX_ROWS_PER_RUN - 1);
    expect(counts.queries).toBeGreaterThan(45);
    expect(counts.queries).toBeLessThanOrEqual(48);
    expect(counts.maxBind).toBeLessThanOrEqual(100);
  });
});

// Both of these are silent, permanent data loss on a source that is being deleted.
// Neither was caught by the first round of tests.
describe('trusting Analytics Engine', () => {
  beforeEach(() => insertLive(CUTOFF));

  /** Wrap an AE query so the nth matching call misbehaves. */
  function sabotage(ae: ReturnType<typeof fakeAE>, when: (sql: string) => boolean, reply: unknown[]) {
    let armed = true;
    const wrapped: AEQuery = async (sql) => {
      if (armed && when(sql)) {
        armed = false;
        return reply as Record<string, unknown>[];
      }
      return ae(sql);
    };
    return wrapped;
  }

  it('does not call the import finished because one count query came back empty', async () => {
    const ae = fakeAE([
      { ts: Date.UTC(2026, 7, 1, 6) },
      { ts: Date.UTC(2026, 7, 2, 6) },
      { ts: Date.UTC(2026, 7, 3, 6) },
    ]);
    // Discovery imports 2026-08-01..03 in one batch, so start from a state where
    // work remains: cap the batch by rewinding after the first run.
    await runBackfill(prodEnv(), NOW, ae);
    await rewind('2026-08-02');
    await db().prepare('DELETE FROM analytics_events WHERE backfilled = 1 AND ts >= ?').bind(Date.UTC(2026, 7, 2)).run();

    // Now AE returns no days at all — the shape that used to mean "finished".
    const blip = sabotage(ae, (sql) => sql.includes('toStartOfDay'), []);
    const result = await runBackfill(prodEnv(), NOW, blip);

    expect(result.outcome).toBe('failed');
    expect((await state())?.done).toBe(0);
    expect((await state())?.next_day).toBe('2026-08-02');
    expect(errors.join('\n')).toContain('rows remain below the cutoff');

    // And it recovers on its own once AE answers properly again.
    expect((await runBackfill(prodEnv(), NOW, ae)).outcome).toBe('imported');
    expect(await rowCount('backfilled = 1')).toBe(3);
    expect((await runBackfill(prodEnv(), NOW, ae)).outcome).toBe('done');
    expect((await state())?.done).toBe(1);
  });

  it('does not delete an imported window when the row query comes back short', async () => {
    const ae = fakeAE([
      { ts: Date.UTC(2026, 7, 1, 6), blob2: 'uid-a' },
      { ts: Date.UTC(2026, 7, 1, 7), blob2: 'uid-b' },
      { ts: Date.UTC(2026, 7, 1, 8), blob2: 'uid-c' },
    ]);
    await runBackfill(prodEnv(), NOW, ae);
    expect(await rowCount('backfilled = 1')).toBe(3);

    // A re-run — a run killed before its cursor write — where AE now returns less
    // than its own count query just promised. Deleting and re-inserting that would
    // destroy the difference, permanently, with the source gone.
    await rewind('2026-08-01');
    const short = sabotage(ae, (sql) => sql.includes('blob1, blob2'), []);
    const result = await runBackfill(prodEnv(), NOW, short);

    expect(result.outcome).toBe('failed');
    expect(result.detail).toContain('refusing to delete-then-insert');
    expect(await rowCount('backfilled = 1')).toBe(3);
    expect((await state())?.next_day).toBe('2026-08-01');
  });

  it('treats a response carrying no row at all as a failure, not as an empty dataset', async () => {
    const ae = fakeAE([{ ts: Date.UTC(2026, 7, 1, 6) }, { ts: Date.UTC(2026, 7, 2, 6) }]);
    await runBackfill(prodEnv(), NOW, ae);
    await rewind('2026-08-03');

    // Both AE queries answer with an empty list — a 200 whose shape is wrong, which
    // `makeAEQuery`'s `body.data ?? []` turns into exactly this.
    const silent: AEQuery = async () => [];
    const result = await runBackfill(prodEnv(), NOW, silent);

    expect(result.outcome).toBe('failed');
    expect((await state())?.done).toBe(0);
    expect(errors.join('\n')).toContain('not treating that as finished');
  });

  it('refuses to start when the discovery total comes back with no row', async () => {
    const ae = fakeAE([{ ts: Date.UTC(2026, 7, 1, 6) }]);
    // Only the unbounded discovery total misbehaves. Reading that as zero would
    // switch off the completion check for the whole import, permanently, and
    // nothing later would notice — the shortfall would always be negative.
    const blind = sabotage(ae, (sql) => /^SELECT COUNT\(\) AS n FROM \w+ WHERE timestamp </.test(sql.trimStart()), []);
    const result = await runBackfill(prodEnv(), NOW, blind);

    expect(result.outcome).toBe('failed');
    const s = await state();
    expect(s?.expected_rows).toBeNull();
    expect(s?.cutoff_ms).toBeNull();
    expect(await rowCount('backfilled = 1')).toBe(0);
  });

  it('halts rather than finishing when rows are missing and AE still holds them', async () => {
    const rows = Array.from({ length: 40 }, (_, i) => ({ ts: Date.UTC(2026, 7, 1, 6) + i * 1000, blob2: `uid-${i}` }));
    const ae = fakeAE(rows);
    await runBackfill(prodEnv(), NOW, ae);
    expect(await rowCount('backfilled = 1')).toBe(40);

    // Rows disappear from D1 without the cursor knowing — the shape of any bug
    // that loses part of the import. AE still has all 40, so this is not retention.
    await db().prepare('DELETE FROM analytics_events WHERE backfilled = 1 AND ts >= ?').bind(Date.UTC(2026, 7, 1, 6, 0, 10)).run();

    let result = await runBackfill(prodEnv(), NOW, ae);
    expect(result.outcome).toBe('failed');
    expect(errors.join('\n')).toContain('refusing to finish');
    expect((await state())?.done).toBe(0);

    // And it halts loudly rather than retrying every minute forever.
    for (let i = 0; i < MAX_CONSECUTIVE_FAILURES; i++) result = await runBackfill(prodEnv(), NOW, ae);
    expect(result.outcome).toBe('halted');
  });

  it('finishes when the missing rows are ones AE has since deleted', async () => {
    const rows = Array.from({ length: 40 }, (_, i) => ({ ts: Date.UTC(2026, 7, 1, 6) + i * 1000, blob2: `uid-${i}` }));
    await runBackfill(prodEnv(), NOW, fakeAE(rows));

    // Retention removes the oldest few from AE *and* they are not in D1 — the state
    // an import interrupted at the retention edge really lands in. The rows are
    // gone from the source, so halting forever would be a one-way door for no gain.
    await db().prepare('DELETE FROM analytics_events WHERE backfilled = 1 AND ts < ?').bind(Date.UTC(2026, 7, 1, 6, 0, 4)).run();

    const result = await runBackfill(prodEnv(), NOW, fakeAE(rows.slice(4)));
    expect(result.outcome).toBe('done');
    expect((await state())?.done).toBe(1);
  });

  it.each([
    ['a drop too large to be one run of retention', 20],
    ['an empty dataset, which would otherwise satisfy every inequality', 40],
  ])('does not accept %s as a reason to finish short', async (_label, removed) => {
    const rows = Array.from({ length: 40 }, (_, i) => ({ ts: Date.UTC(2026, 7, 1, 6) + i * 1000, blob2: `uid-${i}` }));
    await runBackfill(prodEnv(), NOW, fakeAE(rows));
    await db().prepare('DELETE FROM analytics_events WHERE backfilled = 1 AND ts < ?').bind(Date.UTC(2026, 7, 1, 6, 0, removed)).run();

    // AE claiming to hold far less than it did is not evidence that an import
    // known to be short has finished — and the worse the claim, the less it may
    // be believed. Zero in particular passes every naive comparison.
    const result = await runBackfill(prodEnv(), NOW, fakeAE(rows.slice(removed)));
    expect(result.outcome).toBe('failed');
    expect((await state())?.done).toBe(0);
    expect(errors.join('\n')).toMatch(/too large to be retention|refusing to finish/);
  });

  it('keeps an imported window rather than replacing it with fewer rows, and moves on', async () => {
    const rows = Array.from({ length: 20 }, (_, i) => ({ ts: Date.UTC(2026, 7, 1, 6) + i * 1000, blob2: `uid-${i}` }));
    await runBackfill(prodEnv(), NOW, fakeAE(rows));
    expect(await rowCount('backfilled = 1')).toBe(20);

    // A re-run of a window AE has since shrunk. Both AE queries now agree at the
    // lower number, so the count guard is satisfied — only what D1 already holds
    // can catch this, and delete-then-insert would drop the difference for good.
    // Skipping keeps the rows AND lets the cursor advance: failing here would stall
    // the import at the retention edge with nothing able to clear it.
    await rewind('2026-08-01');
    const result = await runBackfill(prodEnv(), NOW, fakeAE(rows.slice(0, 12)));

    expect(result.outcome).not.toBe('failed');
    expect(await rowCount('backfilled = 1')).toBe(20);
    expect((await state())?.next_day).not.toBe('2026-08-01');
    expect(warnings.join('\n')).toContain('skipping rather than replacing them with fewer');
  });

  it('records what Analytics Engine said it held, so the total can be checked', async () => {
    const ae = fakeAE([{ ts: Date.UTC(2026, 7, 1, 6) }, { ts: Date.UTC(2026, 7, 2, 6) }, { ts: NOW }]);
    await runBackfill(prodEnv(), NOW, ae);
    // The row at NOW is above the cutoff and is not part of the target.
    expect((await state())?.expected_rows).toBe(2);
  });
});
