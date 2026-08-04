// Schema-level guarantees: the indexes are actually used, and the CHECK
// constraints actually reject bad data.
//
// The index test is item 107 from the brief — "confirm with EXPLAIN QUERY PLAN
// rather than assuming". An unused index is invisible: the query returns the right
// answer either way, just by scanning the table, and only starts hurting once the
// archive is a year deep.
import { env } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';

async function plan(sql: string, ...params: unknown[]): Promise<string> {
  const { results } = await env.ANALYTICS_DB.prepare(`EXPLAIN QUERY PLAN ${sql}`)
    .bind(...params)
    .all();
  return results.map((r) => String(r.detail)).join(' | ');
}

async function seed(rows: number): Promise<void> {
  // ANALYZE-free: SQLite picks an index on shape, not statistics, for these
  // queries — but seeding real rows keeps the plan honest if that ever changes.
  const stmt = env.ANALYTICS_DB.prepare(
    'INSERT INTO analytics_events (ts, event, uid, source, hostname) VALUES (?, ?, ?, ?, ?)',
  );
  const batch = [];
  for (let i = 0; i < rows; i++) {
    batch.push(stmt.bind(1_754_000_000_000 + i * 60_000, 'puzzle_start', `uid-${i % 7}`, null, 'clumeral.com'));
  }
  await env.ANALYTICS_DB.batch(batch);
}

describe('analytics_events schema', () => {
  beforeEach(() => seed(50));

  it('uses an index for the daily-counts query', async () => {
    const detail = await plan(
      "SELECT strftime('%Y-%m-%d', ts / 1000, 'unixepoch') AS day, SUM(sample_interval) AS count FROM analytics_events WHERE hostname = ? AND event = ? AND ts >= ? GROUP BY day",
      'clumeral.com',
      'puzzle_start',
      0,
    );
    expect(detail).toContain('idx_analytics_host_ev_ts');
    expect(detail).not.toContain('SCAN analytics_events');
  });

  it('uses an index for the unique-users query', async () => {
    const detail = await plan(
      'SELECT COUNT(DISTINCT uid) AS total FROM analytics_events WHERE hostname = ? AND event = ? AND ts >= ?',
      'clumeral.com',
      'puzzle_start',
      0,
    );
    expect(detail).toContain('idx_analytics_host_ev_ts');
  });

  it('uses an index for the all-events and first-row queries', async () => {
    const events = await plan(
      'SELECT event, SUM(sample_interval) AS count FROM analytics_events WHERE hostname = ? AND ts >= ? GROUP BY event',
      'clumeral.com',
      0,
    );
    expect(events).toContain('idx_analytics_host_');

    const first = await plan('SELECT MIN(ts) AS first_ts FROM analytics_events WHERE hostname = ?', 'clumeral.com');
    expect(first).toContain('idx_analytics_host_ts');
  });

  it('rejects a new_user value outside 0 and 1', async () => {
    await expect(
      env.ANALYTICS_DB.prepare(
        'INSERT INTO analytics_events (ts, event, uid, hostname, new_user) VALUES (?, ?, ?, ?, ?)',
      )
        .bind(1, 'puzzle_start', 'u', 'clumeral.com', 2)
        .run(),
    ).rejects.toThrow();
  });

  it('rejects a backfilled value outside 0 and 1', async () => {
    await expect(
      env.ANALYTICS_DB.prepare(
        'INSERT INTO analytics_events (ts, event, uid, hostname, backfilled) VALUES (?, ?, ?, ?, ?)',
      )
        .bind(1, 'puzzle_start', 'u', 'clumeral.com', -1)
        .run(),
    ).rejects.toThrow();
  });
});

describe('backfill_state schema', () => {
  it('refuses a second row', async () => {
    await expect(env.ANALYTICS_DB.prepare('INSERT INTO backfill_state (id) VALUES (2)').run()).rejects.toThrow();
  });
});
