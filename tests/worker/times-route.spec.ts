// GET /api/times/:num through the real fetch handler (time chart brief items 33, 35, 37,
// 42, 91, 118). The privacy rule lives here: the route returns a time and its count,
// nothing else, for any change to it — not just this build.
import { env } from 'cloudflare:test';
import { describe, expect, it, vi } from 'vitest';
import { MAX_UID } from '../../src/worker/analytics-db.ts';
import { puzzleNumber, todayUTC } from '../../src/worker/puzzle.ts';
import worker from '../../src/worker/index.ts';

const ctx = { waitUntil() {}, passThroughOnException() {} } as unknown as ExecutionContext;

// The workers test env binds only ANALYTICS_DB. A request that falls through every
// route reaches env.ASSETS.fetch, so it is stubbed and asserted on.
function makeEnv() {
  const assets = vi.fn(async () => new Response('asset'));
  return { env: { ...env, ASSETS: { fetch: assets } } as never, assets };
}

// Today's puzzle, so the window around its date holds a row stamped now.
const NUM = puzzleNumber(todayUTC());
const NOW = Date.now();

async function seed(r: { value: number; uid?: string; hostname?: string; num?: number; ts?: number }) {
  await env.ANALYTICS_DB.prepare(
    'INSERT INTO analytics_events (ts, event, uid, source, hostname, value, new_user, sample_interval, puzzle_num) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
  )
    .bind(r.ts ?? NOW, 'puzzle_time', r.uid ?? 'stranger', 'clean', r.hostname ?? 'clumeral.com', r.value, 0, 1, r.num ?? NUM)
    .run();
}

async function get(path: string, init: RequestInit = {}, host = 'clumeral.com') {
  const { env: e, assets } = makeEnv();
  const res = await worker.fetch(new Request(`https://${host}${path}`, init), e, ctx);
  return { res, assets };
}

describe('GET /api/times/:num', () => {
  // Item 37, as a hard rule. A future uid, timestamp or idle label fails this.
  it('returns only (second, count) pairs', async () => {
    await seed({ value: 41 });
    await seed({ value: 69, uid: 'other' });
    const { res } = await get(`/api/times/${NUM}`);
    const body = (await res.json()) as { times: Record<string, unknown>[] };
    expect(Object.keys(body)).toEqual(['times']);
    expect(body.times).toHaveLength(2);
    for (const row of body.times) expect(Object.keys(row).sort()).toEqual(['count', 'second']);
    expect(body.times).toEqual([
      { second: 41, count: 1 },
      { second: 69, count: 1 },
    ]);
  });

  it('is sent no-store, as JSON', async () => {
    const { res } = await get(`/api/times/${NUM}`);
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(res.headers.get('Content-Type')).toBe('application/json');
  });

  it('excludes the uid in X-Clumeral-Uid, and nothing without it', async () => {
    await seed({ value: 41, uid: 'me' });
    await seed({ value: 69 });
    const withUid = await get(`/api/times/${NUM}`, { headers: { 'X-Clumeral-Uid': 'me' } });
    expect(await withUid.res.json()).toEqual({ times: [{ second: 69, count: 1 }] });
    const without = await get(`/api/times/${NUM}`);
    expect(((await without.res.json()) as { times: unknown[] }).times).toHaveLength(2);
  });

  // recordEvent truncates the stored uid to MAX_UID, so the route must truncate
  // the header the same way or an over-long uid would never match its own row.
  it('truncates an over-long header uid so it still matches its stored row', async () => {
    const long = 'u'.repeat(MAX_UID + 50);
    await seed({ value: 41, uid: long.slice(0, MAX_UID) });
    await seed({ value: 69 });
    const { res } = await get(`/api/times/${NUM}`, { headers: { 'X-Clumeral-Uid': long } });
    expect(await res.json()).toEqual({ times: [{ second: 69, count: 1 }] });
  });

  it('reads the hostname from the request URL', async () => {
    await seed({ value: 41, hostname: 'clumeral.com' });
    await seed({ value: 69, hostname: 'a.workers.dev' });
    const prod = await get(`/api/times/${NUM}`, {}, 'clumeral.com');
    expect(await prod.res.json()).toEqual({ times: [{ second: 41, count: 1 }] });
    const preview = await get(`/api/times/${NUM}`, {}, 'a.workers.dev');
    expect(await preview.res.json()).toEqual({ times: [{ second: 69, count: 1 }] });
  });

  it('rejects puzzle 0 and a far-future number', async () => {
    for (const num of [0, NUM + 30]) {
      const { res } = await get(`/api/times/${num}`);
      expect(res.status, String(num)).toBe(400);
      expect(res.headers.get('Cache-Control')).toBe('no-store');
    }
  });

  // Item 33: a past puzzle's times are harmless, so the route answers for them.
  it('answers for a past puzzle', async () => {
    await seed({ value: 41, num: NUM - 3, ts: NOW - 3 * 86_400_000 });
    const { res } = await get(`/api/times/${NUM - 3}`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ times: [{ second: 41, count: 1 }] });
  });

  it('does not serve a non-numeric path or a POST', async () => {
    const abc = await get('/api/times/abc');
    expect(abc.assets).toHaveBeenCalledOnce();
    expect(await abc.res.text()).toBe('asset');
    const post = await get(`/api/times/${NUM}`, { method: 'POST' });
    expect(post.assets).toHaveBeenCalledOnce();
    expect(await post.res.text()).toBe('asset');
  });
});
