import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  generatePuzzle,
  readDailyPuzzle,
  ensureDailyPuzzle,
  cronPuzzleDates,
  runDailyCron,
  type PuzzleStore,
  type StoredPuzzle,
} from '../src/worker/daily-puzzle.ts';
import { puzzleNumber, nextUTCDate } from '../src/worker/puzzle.ts';

// Minimal KV stand-in that records every write. The whole point of #257 is
// *which code paths write*, so the spy on put() is the assertion that matters.
function fakeStore(seed: Record<string, StoredPuzzle> = {}) {
  const data = new Map<string, string>(
    Object.entries(seed).map(([k, v]) => [k, JSON.stringify(v)]),
  );
  const puts: { key: string; value: string }[] = [];
  const store: PuzzleStore & { puts: typeof puts; data: typeof data } = {
    puts,
    data,
    async get<T>(key: string): Promise<T | null> {
      const raw = data.get(key);
      return raw ? JSON.parse(raw) as T : null;
    },
    async put(key: string, value: string): Promise<void> {
      puts.push({ key, value });
      data.set(key, value);
    },
  };
  return store;
}

describe('generatePuzzle (deterministic from the date seed)', () => {
  it('returns the same answer and clues for the same date', () => {
    const a = generatePuzzle('2026-05-29');
    const b = generatePuzzle('2026-05-29');
    expect(a.answer).toBe(b.answer);
    expect(a.clues).toEqual(b.clues);
  });

  it('stamps the puzzle number for that date', () => {
    expect(generatePuzzle('2026-05-29').puzzleNumber).toBe(puzzleNumber('2026-05-29'));
  });

  it('gives different dates different puzzles', () => {
    expect(generatePuzzle('2026-05-29').answer).not.toBe(generatePuzzle('2030-01-01').answer);
  });
});

describe('readDailyPuzzle (request path — must never write)', () => {
  it('returns the stored puzzle on a cache hit', async () => {
    const stored: StoredPuzzle = { answer: 123, clues: [], puzzleNumber: 1 };
    const store = fakeStore({ '2026-05-29': stored });
    expect(await readDailyPuzzle(store, '2026-05-29')).toEqual(stored);
  });

  it('writes nothing on a cache hit', async () => {
    const store = fakeStore({ '2026-05-29': { answer: 123, clues: [], puzzleNumber: 1 } });
    await readDailyPuzzle(store, '2026-05-29');
    expect(store.puts).toEqual([]);
  });

  // The #257 fix. Previously a KV miss on the request path did a permanent put(),
  // so any deployment — preview included — could freeze a production puzzle.
  it('writes nothing on a cache MISS — generates ephemerally', async () => {
    const store = fakeStore();
    const puzzle = await readDailyPuzzle(store, '2026-05-30');
    expect(puzzle.answer).toBeGreaterThanOrEqual(100);
    expect(store.puts).toEqual([]);
    expect(store.data.has('2026-05-30')).toBe(false);
  });

  // An ephemeral serve must match what the cron later freezes, or a player who
  // arrives before the cron sees different clues from everyone after it.
  it('serves exactly what ensureDailyPuzzle would store for that date', async () => {
    const ephemeral = await readDailyPuzzle(fakeStore(), '2026-05-30');
    const persisted = await ensureDailyPuzzle(fakeStore(), '2026-05-30');
    expect(ephemeral).toEqual(persisted);
  });
});

describe('ensureDailyPuzzle (cron path — the only writer)', () => {
  it('generates and stores on a cache miss', async () => {
    const store = fakeStore();
    const puzzle = await ensureDailyPuzzle(store, '2026-05-30');
    expect(store.puts.map(p => p.key)).toEqual(['2026-05-30']);
    expect(JSON.parse(store.puts[0].value)).toEqual(puzzle);
  });

  // Archive integrity: KV is write-once. A puzzle already frozen is never
  // recomputed, so generator changes cannot rewrite history.
  it('does not rewrite an already-stored puzzle', async () => {
    const stored: StoredPuzzle = { answer: 111, clues: [], puzzleNumber: 1 };
    const store = fakeStore({ '2026-05-29': stored });
    const puzzle = await ensureDailyPuzzle(store, '2026-05-29');
    expect(puzzle).toEqual(stored);
    expect(store.puts).toEqual([]);
  });
});

describe('cronPuzzleDates', () => {
  it('covers today and tomorrow', () => {
    expect(cronPuzzleDates('2026-05-29')).toEqual(['2026-05-29', '2026-05-30']);
  });

  it('rolls over a month boundary', () => {
    expect(cronPuzzleDates('2026-05-31')).toEqual(['2026-05-31', '2026-06-01']);
  });

  it('rolls over a year boundary', () => {
    expect(cronPuzzleDates('2026-12-31')).toEqual(['2026-12-31', '2027-01-01']);
  });

  it('rolls over a leap day', () => {
    expect(cronPuzzleDates('2028-02-28')).toEqual(['2028-02-28', '2028-02-29']);
  });
});

describe('runDailyCron', () => {
  it('stores both today and tomorrow', async () => {
    const store = fakeStore();
    await runDailyCron(store, '2026-05-29');
    expect(store.puts.map(p => p.key)).toEqual(['2026-05-29', '2026-05-30']);
  });

  it('only stores the missing day when today is already frozen', async () => {
    const store = fakeStore({ '2026-05-29': { answer: 111, clues: [], puzzleNumber: 1 } });
    await runDailyCron(store, '2026-05-29');
    expect(store.puts.map(p => p.key)).toEqual(['2026-05-30']);
  });

  it('is idempotent — a second run writes nothing', async () => {
    const store = fakeStore();
    await runDailyCron(store, '2026-05-29');
    store.puts.length = 0;
    await runDailyCron(store, '2026-05-29');
    expect(store.puts).toEqual([]);
  });

  it('defaults to the worker UTC today', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-29T12:00:00Z'));
    const store = fakeStore();
    await runDailyCron(store);
    vi.useRealTimers();
    expect(store.puts.map(p => p.key)).toEqual(['2026-05-29', '2026-05-30']);
  });
});

// The +1 calendar day tolerance in date-guard.ts exists so a UTC+14 player at
// local midnight is not locked out (#205). It is the path that used to write.
describe('#205 tolerance path after the cron pre-generates tomorrow', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-05-29T12:00:00Z')); });
  afterEach(() => { vi.useRealTimers(); });

  it('serves today+1 from cache without writing', async () => {
    const store = fakeStore();
    await runDailyCron(store);          // nightly cron
    store.puts.length = 0;

    const puzzle = await readDailyPuzzle(store, '2026-05-30');  // UTC+14 player

    expect(puzzle).toEqual(JSON.parse(store.data.get('2026-05-30')!));
    expect(store.puts).toEqual([]);
  });
});

// The behavioural tests above prove the current handlers don't write. They
// cannot stop a NEW handler being added with a put() in it, which is exactly how
// #257 arose — the write was incidental to a read-through helper nobody re-read.
// Enforced structurally, in the spirit of token-parity.spec.ts.
describe('write authority is enforced, not just documented (#257)', () => {
  const workerSrc = readFileSync(resolve(__dirname, '../src/worker/index.ts'), 'utf8');

  it('index.ts never writes to the PUZZLES namespace directly', () => {
    expect(workerSrc).not.toMatch(/PUZZLES\s*\.\s*put\s*\(/);
  });

  it('index.ts does not import the persisting helper', () => {
    // runDailyCron is the sanctioned cron entry point; ensureDailyPuzzle is the
    // raw writer and has no business being reachable from a request handler.
    expect(workerSrc).not.toMatch(/\bensureDailyPuzzle\b/);
  });

  it('runDailyCron is used only by the scheduled handler', () => {
    const uses = workerSrc.match(/\brunDailyCron\b/g) ?? [];
    expect(uses).toHaveLength(2);  // the import, and the call in scheduled()
    expect(workerSrc).toMatch(/async scheduled\([^)]*\)[^{]*\{\s*await runDailyCron\(env\.PUZZLES\);\s*\}/);
  });
});

describe('nextUTCDate', () => {
  it('advances a day', () => {
    expect(nextUTCDate('2026-05-29')).toBe('2026-05-30');
  });

  it('advances across month, year and leap-day boundaries', () => {
    expect(nextUTCDate('2026-05-31')).toBe('2026-06-01');
    expect(nextUTCDate('2026-12-31')).toBe('2027-01-01');
    expect(nextUTCDate('2028-02-28')).toBe('2028-02-29');
    expect(nextUTCDate('2028-02-29')).toBe('2028-03-01');
  });
});
