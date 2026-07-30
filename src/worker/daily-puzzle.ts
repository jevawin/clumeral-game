// Daily puzzle generation and KV caching.
//
// WRITE AUTHORITY (#257). The single PUZZLES namespace is shared by every
// deployment — preview URLs included — and KV entries here are write-once, so
// whichever deployment writes a date freezes it permanently for real players.
// That authority belongs to the cron and nowhere else:
//
//   readDailyPuzzle    request path — cache-first, generates EPHEMERALLY on a
//                      miss. Never writes.
//   ensureDailyPuzzle  cron path only — generates and persists on a miss.
//
// Two named functions rather than a persist flag, so every call site declares
// which one it is and a request handler cannot acquire write authority by
// passing the wrong argument.
//
// Why a miss is even possible on the request path: date-guard.ts deliberately
// tolerates today+1 so a UTC+14 player at local midnight is not locked out
// (#205). Before this split, that tolerance made every deployment a live writer
// of tomorrow's puzzle, every day. The cron now pre-generates tomorrow, so the
// tolerance path is a cache hit in normal operation; ephemeral generation is
// the fallback for the window before the first cron run, and for a cron outage.
//
// Ephemeral output is not a different puzzle: generation is deterministic from
// the date seed, so a pre-cron serve matches what the cron later stores, as long
// as the serving deployment's property set matches production's. A mismatched
// preview build can now only affect the player in front of it, transiently,
// instead of freezing a broken puzzle for everyone forever.

import { runFilterLoop, makeRng, dateSeedInt, todayUTC, puzzleNumber, nextUTCDate } from './puzzle.ts';

export interface StoredPuzzle {
  answer: number;
  clues: { propKey: string; label: string; operator: string; value: number | boolean }[];
  puzzleNumber: number;
}

/** The slice of KVNamespace this module needs. Narrow so tests can substitute
 *  a plain object and assert on writes. */
export interface PuzzleStore {
  get<T>(key: string, type: 'json'): Promise<T | null>;
  put(key: string, value: string): Promise<void>;
}

/** Deterministic from the date seed alone — no I/O, no persistence. */
export function generatePuzzle(date: string): StoredPuzzle {
  const rng = makeRng(dateSeedInt(date));
  const { answer, clues } = runFilterLoop(rng);
  return { answer, clues, puzzleNumber: puzzleNumber(date) };
}

/** Request path. Cache-first; generates ephemerally on a miss. NEVER writes. */
export async function readDailyPuzzle(store: PuzzleStore, date: string): Promise<StoredPuzzle> {
  const cached = await store.get<StoredPuzzle>(date, 'json');
  return cached ?? generatePuzzle(date);
}

/** Cron path. Cache-first; generates AND persists on a miss. The only writer.
 *  Never rewrites an existing entry — KV is write-once and the archive depends
 *  on it (see ARCHITECTURE.md). */
export async function ensureDailyPuzzle(store: PuzzleStore, date: string): Promise<StoredPuzzle> {
  const cached = await store.get<StoredPuzzle>(date, 'json');
  if (cached) return cached;

  const puzzle = generatePuzzle(date);
  await store.put(date, JSON.stringify(puzzle));
  return puzzle;
}

/** The dates the nightly cron is responsible for freezing: today and tomorrow.
 *  Tomorrow is what closes the #205 tolerance window. */
export function cronPuzzleDates(today: string): [string, string] {
  return [today, nextUTCDate(today)];
}

/** Nightly cron entry point. Idempotent — a re-run writes nothing. */
export async function runDailyCron(store: PuzzleStore, today: string = todayUTC()): Promise<void> {
  for (const date of cronPuzzleDates(today)) {
    await ensureDailyPuzzle(store, date);
  }
}
