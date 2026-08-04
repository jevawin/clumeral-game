// Proves the worker test project actually works: migrations applied, a real D1 to
// write to, a row readable back. Task 0's acceptance test.
import { env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';

describe('worker test harness', () => {
  it('applies the analytics migrations to an isolated D1', async () => {
    const { results } = await env.ANALYTICS_DB.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('analytics_events', 'backfill_state') ORDER BY name",
    ).all();
    expect(results.map((r) => r.name)).toEqual(['analytics_events', 'backfill_state']);
  });

  it('inserts and reads back a row', async () => {
    await env.ANALYTICS_DB.prepare(
      'INSERT INTO analytics_events (ts, event, uid, source, hostname, value, new_user) VALUES (?, ?, ?, ?, ?, ?, ?)',
    )
      .bind(1_754_000_000_000, 'puzzle_start', 'uid-1', null, 'clumeral.com', 0, 1)
      .run();

    const row = await env.ANALYTICS_DB.prepare(
      'SELECT event, uid, hostname, new_user, sample_interval, backfilled FROM analytics_events',
    ).first();

    expect(row).toEqual({
      event: 'puzzle_start',
      uid: 'uid-1',
      hostname: 'clumeral.com',
      new_user: 1,
      sample_interval: 1,
      backfilled: 0,
    });
  });

  // isolatedStorage means the previous test's row is rolled back. If this ever
  // fails, tests are sharing state and every row-count assertion below is suspect.
  it('isolates storage between tests', async () => {
    const row = await env.ANALYTICS_DB.prepare('SELECT COUNT(*) AS n FROM analytics_events').first();
    expect(row?.n).toBe(0);
  });

  // P34: the seed row is part of migration 0006. Without it the backfill's
  // conditional UPDATE ... WHERE id = 1 always reports 0 changes and every
  // invocation exits having imported nothing, with no error anywhere.
  it('seeds exactly one backfill_state row', async () => {
    const row = await env.ANALYTICS_DB.prepare(
      'SELECT COUNT(*) AS n, MIN(id) AS id, MIN(done) AS done FROM backfill_state',
    ).first();
    expect(row).toMatchObject({ n: 1, id: 1, done: 0 });
  });
});
