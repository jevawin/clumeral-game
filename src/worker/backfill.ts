// Analytics Engine → D1 backfill (plan §3.3, §3.4; PR 2 of the analytics migration).
//
// PR 1 started writing every event to D1 as well as to Analytics Engine. Everything
// that happened BEFORE that instant exists only in AE, which retains ~90 days and
// then deletes — so this import runs once, against data that is disappearing, and
// has to be right the first time. It is driven by a temporary per-minute cron and
// removed wholesale in PR 3.
//
// Four properties carry the whole design:
//
// 1. HARD CUTOFF. The import only ever touches rows older than the first live
//    dual-written row (`backfilled = 0`), so it cannot overlap or double-count the
//    live write path. That instant is discovered from the data, not typed in, and
//    frozen on the first run.
// 2. IDEMPOTENT BY CONSTRUCTION. Every window is delete-then-insert, and the
//    DELETE is filtered to `backfilled = 1` — it can never reach a live row.
//    Re-running any window at any point converges on the same rows, so a run killed
//    mid-batch is safe to retry and none of this depends on whether `db.batch()`
//    is transactional (plan P9, still unresolved).
// 3. BOUNDED. D1 allows 50 queries per invocation on the free plan (P7) and 100
//    bound parameters per query (P8, = 10 rows per INSERT). The batch is sized at
//    run time from AE's own per-day counts, because the peak day is 8× the mean
//    (P48) and a fixed batch would wedge permanently on it.
// 4. LOUD WHEN STUCK. A compare-and-set lock stops overlapping invocations, and
//    five consecutive failures halt the import rather than retrying once a minute
//    forever in silence.
//
// PRODUCTION ONLY, and the check is explicit. Pre-prod versions are uploaded and
// never deployed, so they should never fire `scheduled()` — but "should never" is
// not a check. An unset ENVIRONMENT means NO: absence of a signal is not permission.
//
// Every AE query form below was verified against the live SQL API on 2026-08-06
// before it was written down; the four that the plan assumed and got wrong are
// recorded in the plan's PR 2 build notes.

import { MAX_SOURCE, MAX_UID, startOfUTCDay } from './analytics-db.ts';

export interface BackfillEnv {
  ANALYTICS_DB: D1Database;
  /** 'production' or 'preprod'. Anything else — including unset — means do nothing. */
  ENVIRONMENT?: string;
  /** Worker secrets. The same pair /stats used to query AE with before PR 1. */
  CF_ACCOUNT_ID?: string;
  CF_API_TOKEN?: string;
}

/** One AE SQL query. Injected so tests can drive the importer without a network. */
export type AEQuery = (sql: string) => Promise<Record<string, unknown>[]>;

export type BackfillOutcome =
  | 'skipped-not-production'
  | 'missing-credentials'
  | 'no-state-row'
  | 'halted'
  | 'locked'
  | 'no-live-rows'
  | 'no-ae-rows'
  | 'done'
  | 'imported'
  | 'failed';

export interface BackfillResult {
  outcome: BackfillOutcome;
  /** Rows inserted this invocation. */
  rows?: number;
  /** UTC day keys touched this invocation, for the tail log. */
  days?: string[];
  /** Wall-clock ms, which is what Task 15 reads out of `wrangler tail`. */
  ms?: number;
  detail?: string;
}

const DAY_MS = 86_400_000;

/**
 * Rows per invocation. 39 INSERTs at 10 rows each, plus the window's guard SELECT
 * and its DELETE, is 41 statements — the same ceiling STATEMENT_BUDGET enforces
 * for multi-day batches, which matters because the single-oversized-day path
 * bypasses that check (it always takes at least one day).
 *
 * P49 said 450. That is 46 statements with its DELETE — over its own budget — and
 * 51 D1 queries on the discovery invocation, against a free-tier cap of 50. Task
 * 15 may raise this from measured CPU, but never past 41 statements' worth.
 */
export const MAX_ROWS_PER_RUN = 390;

/** 100 bound parameters per query ÷ 8 bound columns = 12; 10 leaves headroom (P8). */
export const INSERT_CHUNK = 10;

/**
 * Per-window statements allowed in one invocation, against D1's cap of 50 queries
 * (P7). Seven are reserved for the bookkeeping: the state read, the CAS, the
 * re-read inside the lock, the two discovery reads, and the two the verified
 * finish costs. Worst case is 48.
 *
 * Deliberately stricter than P49, which budgeted for a single DELETE and then
 * allowed multi-day batches — every extra day is another guard SELECT and another
 * DELETE.
 */
export const STATEMENT_BUDGET = 41;

/**
 * How far below Analytics Engine's own reported total the import may land and
 * still be called finished: 1%, floor 3 — the same band as the PR 3 comparison
 * gate. It exists for rows AE's retention deletes mid-run, which are genuinely
 * gone, not for a defect in the import.
 */
const SHORTFALL_TOLERANCE = (expected: number) => Math.max(3, Math.round(expected * 0.01));

/**
 * The most Analytics Engine's total may legitimately fall by while one import
 * runs. Retention deletes whole days from the old end, and a run takes ~30
 * minutes, so a day's worth is the honest ceiling: 5% of the whole window is
 * comfortably more than the ~80-row mean day and less than the 677-row peak.
 *
 * This is what stops "AE now says it holds fewer" from being an unbounded excuse.
 * Without a limit, the worse AE's answer, the more readily a broken import would
 * declare itself finished — and zero would always pass.
 */
const RETENTION_DROP_LIMIT = (expected: number) => Math.max(10, Math.round(expected * 0.05));

/** Backstop for a killed run, not the normal path — every exit releases the lock. */
export const LOCK_TTL_MS = 180_000;

export const MAX_CONSECUTIVE_FAILURES = 5;

/**
 * Days of AE counts fetched per sizing query — and, because `planDays` can take
 * every day it is shown, the real cap on days per batch and therefore on AE
 * subrequests per invocation (2 at discovery + 1 sizing + up to 10 fetches + 1 for
 * the verified finish = 14).
 * The statement budget alone would allow ~20 near-empty days. Lowering this is
 * always safe; raising it widens both the batch and the subrequest count.
 */
const DAY_LOOKAHEAD = 10;

const AE_DATASET = 'clumeral';

/**
 * The temporary cron expression that drives the import, matched in `scheduled()`.
 *
 * It must equal the second entry in `wrangler.jsonc`'s `triggers.crons` — this
 * string exists in two files and nothing but a test connects them, so
 * tests/wrangler-bindings.spec.ts asserts they agree. Removed in PR 3, together
 * with the entry itself.
 */
export const BACKFILL_CRON = '* * * * *';

// ── Day arithmetic ────────────────────────────────────────────────────────────

/** 'YYYY-MM-DD' for the UTC day containing `ms`. */
export function dayKey(ms: number): string {
  return new Date(startOfUTCDay(ms)).toISOString().slice(0, 10);
}

/** Midnight UTC at the start of a 'YYYY-MM-DD' key. */
export function dayStartMs(key: string): number {
  return Date.parse(`${key}T00:00:00.000Z`);
}

export function nextDayKey(key: string): string {
  return dayKey(dayStartMs(key) + DAY_MS);
}

// AE compares DateTime to DateTime only: a string literal is rejected outright
// ("cannot combine the DateTime and String types with the >= operator"), so every
// bound goes through toDateTime(<epoch seconds>). Verified live 2026-08-06.
const sec = (ms: number) => Math.floor(ms / 1000);

// ── The Analytics Engine SQL API ──────────────────────────────────────────────

/**
 * Numbers come back from AE as strings for aggregates (`COUNT()` → "677") and as
 * numbers for doubles. Everything is coerced rather than trusted.
 */
const num = (v: unknown) => Number(v ?? 0);

export function makeAEQuery(accountId: string, token: string, fetchImpl: typeof fetch = fetch): AEQuery {
  return async (sql: string) => {
    const res = await fetchImpl(`https://api.cloudflare.com/client/v4/accounts/${accountId}/analytics_engine/sql`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'text/plain' },
      body: sql,
    });
    if (!res.ok) {
      // The body carries the actual SQL complaint; the status alone says nothing.
      throw new Error(`AE query failed: ${res.status} ${(await res.text()).slice(0, 300)}`);
    }
    const body = (await res.json()) as { data?: Record<string, unknown>[] };
    return body.data ?? [];
  };
}

/**
 * How many rows AE holds below the cutoff — the total the import must land on.
 *
 * Null when AE answered with no row at all, and the caller must treat that as a
 * failure rather than as zero. Freezing this at 0 from one malformed 200 would
 * switch off the completion check for the entire import, silently, which is the
 * exact failure it exists to prevent.
 */
async function countBelowCutoff(ae: AEQuery, cutoffMs: number): Promise<number | null> {
  const [row] = await ae(`SELECT COUNT() AS n FROM ${AE_DATASET} WHERE timestamp < toDateTime(${sec(cutoffMs)})`);
  return row === undefined ? null : num(row.n);
}

/**
 * Rows left in a window, or null when AE answered with no row at all.
 *
 * That distinction is the point. A genuinely empty window returns one row reading
 * zero — verified live — where the grouped day-count query returns an empty list.
 * So "no days came back" is only evidence of completion if this agrees; a response
 * carrying no row is a malformed answer, not an empty dataset, and must never end
 * an import that cannot be restarted.
 */
async function countInWindow(ae: AEQuery, fromMs: number, toMs: number): Promise<number | null> {
  const [row] = await ae(
    `SELECT COUNT() AS n FROM ${AE_DATASET}
     WHERE timestamp >= toDateTime(${sec(fromMs)}) AND timestamp < toDateTime(${sec(toMs)})`,
  );
  return row === undefined ? null : num(row.n);
}

/** Epoch ms of the earliest surviving AE row, or null if the dataset is empty. */
async function earliestAERow(ae: AEQuery): Promise<number | null> {
  // COUNT(*) is rejected by AE — it must be COUNT() — and MIN(timestamp) returns a
  // 'YYYY-MM-DD HH:MM:SS' string, so it is converted server-side instead of parsed.
  // A missing row and a zero are conflated here deliberately: both mean "do not
  // start", both write no state, and the next minute retries. Everywhere the
  // distinction can affect stored data, it is made.
  const [row] = await ae(`SELECT toUnixTimestamp(MIN(timestamp)) AS lo FROM ${AE_DATASET}`);
  const lo = num(row?.lo);
  return lo > 0 ? lo * 1000 : null;
}

/** Per-day row counts from `fromMs` (inclusive) to `toMs` (exclusive), ascending. */
async function dayCounts(ae: AEQuery, fromMs: number, toMs: number): Promise<{ day: string; rows: number }[]> {
  const rows = await ae(
    `SELECT toStartOfDay(timestamp) AS day, COUNT() AS n FROM ${AE_DATASET}
     WHERE timestamp >= toDateTime(${sec(fromMs)}) AND timestamp < toDateTime(${sec(toMs)})
     GROUP BY day ORDER BY day ASC LIMIT ${DAY_LOOKAHEAD}`,
  );
  // Days with no rows are simply absent, which is how the cursor skips over gaps
  // rather than spending an invocation each on them.
  return rows.map((r) => ({ day: String(r.day).slice(0, 10), rows: num(r.n) }));
}

/** One row as AE returns it, mapped onto the analytics_events columns. */
export interface ImportRow {
  ts: number;
  event: string;
  uid: string;
  source: string | null;
  hostname: string;
  value: number;
  newUser: 0 | 1;
  sampleInterval: number;
}

/**
 * Raw rows for a time window, in a deterministic order.
 *
 * The ORDER BY is total-ish on purpose: `timestamp` alone is not a unique key
 * (AE stores whole seconds, and one user action writes several events in the same
 * second), and ties left unordered make windowing non-reproducible. Ordering by
 * every projected column leaves only genuinely identical rows interchangeable,
 * which they are.
 *
 * Note the ORDER BY names the `ts` alias, not `timestamp`: projecting
 * `toUnixTimestamp(timestamp)` makes the underlying column unaddressable in the
 * ORDER BY ("unable to find type of column: timestamp"). Verified live.
 */
async function fetchRows(ae: AEQuery, fromMs: number, toMs: number, limit: number): Promise<ImportRow[]> {
  const rows = await ae(
    `SELECT toUnixTimestamp(timestamp) AS ts, blob1, blob2, blob3, blob4, double1, double2, _sample_interval
     FROM ${AE_DATASET}
     WHERE timestamp >= toDateTime(${sec(fromMs)}) AND timestamp < toDateTime(${sec(toMs)})
     ORDER BY ts ASC, blob1 ASC, blob2 ASC, blob3 ASC, blob4 ASC, double1 ASC, double2 ASC
     LIMIT ${limit}`,
  );
  return rows.map(toImportRow);
}

/**
 * AE row → D1 row.
 *
 * `source` gets NULLIF(blob3, '') semantics (P31): AE wrote '' for "no source",
 * the live path writes NULL, and without normalising here the undo/reset split
 * would behave differently either side of the cutoff, permanently.
 *
 * The uid and source caps are the live path's, imported rather than restated, so
 * an imported row and a live row can never disagree about the same uid. No real
 * value comes near them (a uid is a 36-char UUID).
 *
 * Timestamps lose sub-second precision: AE stores whole seconds. Day bucketing,
 * which is all `/stats` reads, is unaffected.
 */
export function toImportRow(r: Record<string, unknown>): ImportRow {
  const value = Number(r.double1);
  const interval = Number(r._sample_interval);
  return {
    ts: num(r.ts) * 1000,
    event: String(r.blob1 ?? ''),
    uid: String(r.blob2 ?? '').slice(0, MAX_UID),
    source: r.blob3 ? String(r.blob3).slice(0, MAX_SOURCE) : null,
    hostname: String(r.blob4 ?? ''),
    value: Number.isFinite(value) ? Math.trunc(value) : 0,
    // The column carries CHECK (new_user IN (0, 1)); anything truthy is 1 rather
    // than something that would fail the constraint and lose the whole batch.
    newUser: r.double2 ? 1 : 0,
    // Sampling is real: the live dataset holds intervals of 1, 2, 3 and 10, and
    // COUNT() undercounts by 1.70% (P44). Never default this to a count of rows.
    sampleInterval: Number.isFinite(interval) && interval > 0 ? Math.trunc(interval) : 1,
  };
}

// ── Batch planning ────────────────────────────────────────────────────────────

export interface PlannedDay {
  day: string;
  /** Rows AE holds for the part of this day the import may touch. */
  rows: number;
}

/**
 * Whole days that fit one invocation, in order, always at least one.
 *
 * A day too big for the budget comes back on its own and is imported in
 * sub-windows. Both limits matter: rows bound CPU and the parameter cap, statements
 * bound D1's per-invocation query cap, and a day of 40 rows costs a statement pair
 * regardless of how few rows it holds.
 */
export function planDays(counts: { day: string; rows: number }[]): PlannedDay[] {
  const taken: PlannedDay[] = [];
  let rows = 0;
  let statements = 0;
  for (const c of counts) {
    // Its guard SELECT, its DELETE, and its INSERTs.
    const cost = 2 + Math.ceil(c.rows / INSERT_CHUNK);
    if (taken.length > 0 && (rows + c.rows > MAX_ROWS_PER_RUN || statements + cost > STATEMENT_BUDGET)) break;
    taken.push(c);
    rows += c.rows;
    statements += cost;
    // A day that overflows on its own is the only day in the batch: it will be
    // sub-windowed, and pairing it with another day would blow the same budget.
    if (rows >= MAX_ROWS_PER_RUN || statements >= STATEMENT_BUDGET) break;
  }
  return taken;
}

// ── The import itself ─────────────────────────────────────────────────────────

interface WindowResult {
  inserted: number;
  /** Where the next window starts, or null when the window reached `toMs`. */
  nextFromMs: number | null;
}

/**
 * Import one time window: delete what is there, insert what AE has.
 *
 * The window is closed at a whole second when it fills, never mid-second, and the
 * DELETE covers exactly the range being written. That is what makes a run killed
 * anywhere — including between the DELETE and the INSERT, or midway through a
 * multi-day batch — safe to retry: the retry re-deletes precisely what it is about
 * to rewrite.
 *
 * This is a deliberate departure from the plan's LIMIT/OFFSET sub-windows with a
 * once-per-day DELETE. That design is only idempotent if the cursor advances,
 * and a CPU kill advances nothing: the retry would re-insert the same offset
 * window with no DELETE in front of it and silently double those rows.
 */
async function importWindow(
  db: D1Database,
  ae: AEQuery,
  fromMs: number,
  toMs: number,
  expected: number,
): Promise<WindowResult> {
  const rows = await fetchRows(ae, fromMs, toMs, MAX_ROWS_PER_RUN);

  // The DELETE below is unconditional, so a short read is destructive: on a
  // re-run of a window that already imported cleanly, deleting and then
  // re-inserting fewer rows than were there DESTROYS the difference, silently and
  // permanently. AE has just told us, in the sizing query, how many rows this
  // window holds — if the row query disagrees, something changed underneath us
  // (retention deleting the oldest days, which is exactly where the import starts)
  // or the API misbehaved. Either way, do not delete.
  const wanted = Math.min(expected, MAX_ROWS_PER_RUN);
  if (rows.length !== wanted) {
    // Short: see above. Long: these rows are historical and immutable, so AE
    // returning more than it just counted is equally a sign the two answers cannot
    // both be trusted — and `planDays` sized this invocation's statement budget
    // from the count, so an over-return would also overrun it.
    throw new Error(
      `AE returned ${rows.length} rows for ${new Date(fromMs).toISOString()}–${new Date(toMs).toISOString()} ` +
        `but its own count query said ${expected}; refusing to delete-then-insert a window the two disagree about`,
    );
  }

  let end = toMs;
  let batch = rows;
  if (rows.length === MAX_ROWS_PER_RUN) {
    // The window filled, so there may be more rows in the last second we can see.
    // Drop that second entirely and let the next invocation start at it — taking
    // part of a second would leave the rest unreachable.
    const lastTs = rows[rows.length - 1].ts;
    const trimmed = rows.filter((r) => r.ts < lastTs);
    if (trimmed.length > 0) {
      batch = trimmed;
      end = lastTs;
    } else {
      // MAX_ROWS_PER_RUN rows inside one second. Unreachable with real traffic
      // (the busiest day on record is 677 rows across 86,400 seconds), but the
      // alternative to advancing is a cursor that never moves.
      console.error(
        `[backfill] ${MAX_ROWS_PER_RUN} rows share timestamp ${new Date(lastTs).toISOString()}; ` +
          `any beyond that are not imported`,
      );
      end = Math.min(lastTs + 1000, toMs);
    }
  }

  // The window's DELETE is unconditional, so the second guard is against what is
  // already there rather than against what AE says. A window imported cleanly by an
  // earlier invocation, re-run after AE's retention has removed some of those rows,
  // agrees with itself at the lower number — both AE queries return it — and the
  // delete-then-insert would quietly drop the difference. The import starts at the
  // retention edge, so this is the likeliest place for it to happen.
  const existing = await db
    .prepare('SELECT COUNT(*) AS n, MAX(ts) AS hi FROM analytics_events WHERE backfilled = 1 AND ts >= ? AND ts < ?')
    .bind(fromMs, end)
    .first<{ n: number; hi: number | null }>();
  if (Number(existing?.n ?? 0) > batch.length) {
    // We hold more rows for this range than AE can still give us, so rewriting it
    // could only lose data. Throwing would stall the import permanently at the
    // retention edge — precisely where this happens — and nothing could clear it,
    // so the window is kept instead.
    //
    // But "more rows" is not "all the rows". A previous invocation that inserted
    // and then died before its cursor write leaves a *prefix* of the window, and if
    // AE has shrunk below that prefix's count since, a plain skip would carry the
    // cursor past rows AE still holds — silently, and past the point of recovery.
    // MAX(ts) is what tells the two apart, and it costs nothing: the query is
    // already being made.
    //
    // This is exact under the invariant the importer maintains — the backfilled
    // rows inside a window not yet past the cursor are a contiguous prefix of it,
    // because every window is a contiguous delete-then-insert and both branches
    // below preserve that. A hole punched in the middle by hand would defeat it;
    // the completion check then halts on the shortfall rather than finishing.
    const heldTo = Number(existing?.hi ?? fromMs);
    const aeLast = batch.length > 0 ? batch[batch.length - 1].ts : fromMs;
    const covered = heldTo >= aeLast;
    const resume = covered ? end : Math.min(heldTo + 1000, end);
    console.warn(
      `[backfill] keeping ${existing?.n} imported rows for ${new Date(fromMs).toISOString()}–${new Date(end).toISOString()}; ` +
        `Analytics Engine now offers only ${batch.length} — ` +
        (covered
          ? 'skipping rather than replacing them with fewer'
          : `they stop at ${new Date(heldTo).toISOString()}, so resuming from there rather than skipping the rest`),
    );
    return { inserted: 0, nextFromMs: resume >= toMs ? null : resume };
  }

  const statements: D1PreparedStatement[] = [
    // backfilled = 1 is the whole safety property: a live dual-written row is
    // backfilled = 0 and is unreachable from here.
    db.prepare('DELETE FROM analytics_events WHERE backfilled = 1 AND ts >= ? AND ts < ?').bind(fromMs, end),
  ];
  for (let i = 0; i < batch.length; i += INSERT_CHUNK) {
    const chunk = batch.slice(i, i + INSERT_CHUNK);
    statements.push(
      db
        .prepare(
          `INSERT INTO analytics_events (ts, event, uid, source, hostname, value, new_user, sample_interval, backfilled)
           VALUES ${chunk.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, 1)').join(', ')}`,
        )
        .bind(
          ...chunk.flatMap((r) => [r.ts, r.event, r.uid, r.source, r.hostname, r.value, r.newUser, r.sampleInterval]),
        ),
    );
  }
  await db.batch(statements);

  return { inserted: batch.length, nextFromMs: end >= toMs ? null : end };
}

interface StateRow {
  cutoff_ms: number | null;
  start_day: string | null;
  next_day: string | null;
  sub_offset: number;
  done: number;
  lock_until: number;
  rows_written: number;
  consecutive_failures: number;
  /** AE's own row count below the cutoff, frozen at discovery. Null pre-migration 0007. */
  expected_rows: number | null;
}

/**
 * One invocation of the backfill. Called from `scheduled()` on the temporary
 * per-minute cron; returns rather than throws, so the cron handler cannot turn a
 * backfill problem into a failed cron invocation.
 */
export async function runBackfill(
  env: BackfillEnv,
  now: number = Date.now(),
  injectedQuery?: AEQuery,
): Promise<BackfillResult> {
  // Absence of a signal is not permission. An old deployed version with no
  // ENVIRONMENT var, or a pre-prod version that somehow fires a cron, does nothing.
  if (env.ENVIRONMENT !== 'production') return { outcome: 'skipped-not-production' };

  const ae = injectedQuery ?? makeAEQueryFromEnv(env);
  if (!ae) {
    // Loud, because the failure is otherwise invisible: the cron keeps firing, the
    // import never starts, and nothing anywhere says why.
    console.error('[backfill] CF_ACCOUNT_ID / CF_API_TOKEN are not set on this Worker — cannot query Analytics Engine');
    return { outcome: 'missing-credentials' };
  }

  try {
    return await runLocked(env.ANALYTICS_DB, ae, now);
  } catch (err) {
    // The outer net. Everything below the lock has its own handling; this catches
    // the bookkeeping around it — the state read, the CAS, and the failure-counter
    // update inside the inner catch — so that no D1 error anywhere can reject the
    // cron invocation and take the result log down with it.
    const detail = err instanceof Error ? err.message : String(err);
    console.error(`[backfill] failed outside the import: ${detail}`);
    return { outcome: 'failed', detail };
  }
}

async function runLocked(db: D1Database, ae: AEQuery, now: number): Promise<BackfillResult> {
  const state = await db.prepare('SELECT * FROM backfill_state WHERE id = 1').first<StateRow>();
  if (!state) {
    console.error('[backfill] no backfill_state row — migration 0006 seeds it; the import cannot run without it');
    return { outcome: 'no-state-row' };
  }
  if (state.done) return { outcome: 'done' };
  if (state.consecutive_failures >= MAX_CONSECUTIVE_FAILURES) {
    console.error(
      `[backfill] HALTED after ${state.consecutive_failures} consecutive failures at ${state.next_day ?? 'discovery'}. ` +
        'Nothing will retry until backfill_state.consecutive_failures is reset by hand.',
    );
    return { outcome: 'halted' };
  }

  // Compare-and-set: exactly one invocation can hold the lock, and taking it is
  // the same statement as testing it.
  const lock = await db
    .prepare('UPDATE backfill_state SET lock_until = ? WHERE id = 1 AND lock_until < ?')
    .bind(now + LOCK_TTL_MS, now)
    .run();
  if (lock.meta.changes !== 1) return { outcome: 'locked' };

  const started = now;
  // Re-read inside the lock. The snapshot above was taken before the CAS, so a run
  // that released between the two would leave this one working from a cursor that
  // has already moved — at best re-importing a window, at worst re-running
  // discovery and re-freezing the bounds against a smaller dataset.
  const current = (await db.prepare('SELECT * FROM backfill_state WHERE id = 1').first<StateRow>()) ?? state;
  try {
    const result = await importOnce(db, ae, current, now);
    return { ...result, ms: Date.now() - started };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    // The cursor is untouched, so the failed window is simply retried. Only the
    // failure counter and the lock move.
    await db
      .prepare('UPDATE backfill_state SET consecutive_failures = consecutive_failures + 1, lock_until = 0 WHERE id = 1')
      .run();
    console.error(`[backfill] failed at ${current.next_day ?? 'discovery'}: ${detail}`);
    return { outcome: 'failed', detail, ms: Date.now() - started };
  }
}

function makeAEQueryFromEnv(env: BackfillEnv): AEQuery | null {
  if (!env.CF_ACCOUNT_ID || !env.CF_API_TOKEN) return null;
  return makeAEQuery(env.CF_ACCOUNT_ID, env.CF_API_TOKEN);
}

/** Everything inside the lock. Throws on any failure; the caller counts it. */
async function importOnce(db: D1Database, ae: AEQuery, state: StateRow, now: number): Promise<BackfillResult> {
  let { cutoff_ms: cutoffMs, next_day: nextDay, expected_rows: expectedRows } = state;
  const subOffset = state.sub_offset;

  if (cutoffMs === null || !nextDay) {
    // ── First invocation: discover both bounds, freeze them, import nothing ──
    //
    // The upper bound is the earliest live row. If PR 1 is not live yet, or no
    // event has been recorded since it went live, there is nothing to be earlier
    // than — and importing against a cutoff of "now" would run the import straight
    // into the live window. Abort and wait.
    const live = await db
      .prepare('SELECT MIN(ts) AS lo FROM analytics_events WHERE backfilled = 0')
      .first<{ lo: number | null }>();
    if (!live?.lo) {
      console.warn('[backfill] no live rows in analytics_events yet — waiting for the dual write before importing');
      await release(db);
      return { outcome: 'no-live-rows' };
    }
    // The lower bound is AE's own earliest surviving row. It is frozen for the
    // same reason it is discovered: AE's retention window rolls forward daily, so
    // a recomputed lower bound would chase it and never finish.
    const aeStart = await earliestAERow(ae);
    if (aeStart === null) {
      console.warn('[backfill] Analytics Engine returned no rows — nothing to import');
      await release(db);
      return { outcome: 'no-ae-rows' };
    }

    cutoffMs = live.lo;
    nextDay = dayKey(aeStart);
    // What the finished import must add up to. Recorded now, from the same source
    // the rows come from, because "AE returned nothing" is otherwise
    // indistinguishable from "there is nothing left".
    expectedRows = await countBelowCutoff(ae, cutoffMs);
    if (expectedRows === null) {
      // Nothing has been written yet, so throwing here costs a minute and no data.
      throw new Error('Analytics Engine returned no row for the total below the cutoff — refusing to start without it');
    }
    // Committed on its own, before any insert: if this invocation dies during the
    // import, the next one must reuse these bounds rather than rediscover them
    // against a database that now holds imported rows.
    await db
      .prepare(
        'UPDATE backfill_state SET cutoff_ms = ?, start_day = ?, next_day = ?, sub_offset = 0, expected_rows = ? WHERE id = 1',
      )
      .bind(cutoffMs, nextDay, nextDay, expectedRows)
      .run();
    console.log(
      `[backfill] bounds frozen: ${nextDay} → cutoff ${new Date(cutoffMs).toISOString()}, ${expectedRows} rows to import`,
    );
  }

  // Every AE bound is exclusive of the cutoff second. Rounding the other way would
  // risk importing a row the live path already wrote; rounding this way risks
  // losing pre-cutover rows from the single second the cutover happened in.
  const ceiling = Math.min(now, cutoffMs);
  const from = dayStartMs(nextDay) + subOffset;

  // The cursor has passed the cutoff: nothing is left to read. Still verified,
  // because a clock running backwards would put `now` below the frozen cutoff and
  // reach this line part-way through the import.
  if (from >= ceiling) return finishVerified(db, ae, cutoffMs, nextDay, subOffset, 0, expectedRows);

  const counts = await dayCounts(ae, from, ceiling);
  if (counts.length === 0) {
    // Either the import is genuinely finished, or AE returned nothing while
    // holding something. Those are indistinguishable here, and getting it wrong
    // ends the import permanently — `done` is terminal — so it is confirmed with a
    // second, differently-shaped query before being believed. The cursor stays
    // where it is either way: a blip simply resumes next minute.
    const remaining = await countInWindow(ae, from, ceiling);
    if (remaining === null) {
      throw new Error('the day-count query returned no days and the count query returned no row — not treating that as finished');
    }
    if (remaining > 0) {
      throw new Error(`the day-count query returned no days, but AE says ${remaining} rows remain below the cutoff`);
    }
    console.log(`[backfill] no AE rows left before the cutoff (cursor ${nextDay}) — verifying the total`);
    return finishVerified(db, ae, cutoffMs, nextDay, subOffset, 0, expectedRows);
  }

  // Mid-day cursors pin the batch to that day; whole days are batched by budget.
  // `counts` only lists days that actually hold rows, so a cursor sitting in an
  // empty stretch jumps straight to the next day with data rather than spending an
  // invocation on each empty one.
  const days = subOffset > 0 ? counts.slice(0, 1) : planDays(counts);
  let inserted = 0;
  let cursorDay = nextDay;
  let cursorOffset = subOffset;
  const imported: string[] = [];

  for (const d of days) {
    const dayStart = dayStartMs(d.day);
    // `from` carries the sub-day offset, and only applies to the day it belongs
    // to: if the cursor's own day turned out to be empty and this is a later one,
    // dayStart is the later bound and the offset is irrelevant.
    const windowFrom = Math.max(dayStart, from);
    const windowTo = Math.min(dayStart + DAY_MS, ceiling);
    // d.rows counts exactly this window: the sizing query used the same `from`
    // (offset included) and the same ceiling, so for a resumed day it is the rows
    // remaining, not the whole day.
    const { inserted: n, nextFromMs } = await importWindow(db, ae, windowFrom, windowTo, d.rows);
    inserted += n;
    imported.push(d.day);
    if (nextFromMs === null) {
      cursorDay = nextDayKey(d.day);
      cursorOffset = 0;
    } else {
      // The day did not fit in one invocation; resume inside it next time.
      cursorDay = d.day;
      cursorOffset = nextFromMs - dayStart;
      break;
    }
  }

  const done = dayStartMs(cursorDay) + cursorOffset >= ceiling;
  console.log(
    `[backfill] +${inserted} rows over ${imported.join(', ')} → cursor ${cursorDay}` +
      `${cursorOffset > 0 ? `+${Math.round(cursorOffset / 1000)}s` : ''}${done ? ' (end of window)' : ''}`,
  );
  const result = done
    ? await finishVerified(db, ae, cutoffMs, cursorDay, cursorOffset, inserted, expectedRows)
    : await finish(db, cursorDay, cursorOffset, inserted, false);
  return { ...result, days: imported };
}

/**
 * Finish only if what landed matches what AE said it held.
 *
 * `done = 1` is terminal — every later invocation returns before touching AE — so
 * it must never be written from a single query's say-so. "The day-count query came
 * back empty" and "the import is finished" look identical, and an empty result is
 * not a failure, so nothing else in this file would ever notice: the import would
 * stop part-way, permanently, with a `console.log` as its only trace.
 *
 * On a shortfall the cursor is still committed (the work done is not repeated) but
 * `done` stays 0 and the failure counter goes up, so five of these halt the import
 * loudly instead of looping.
 */
async function finishVerified(
  db: D1Database,
  ae: AEQuery,
  cutoffMs: number,
  cursorDay: string,
  cursorOffset: number,
  inserted: number,
  expectedRows: number | null,
): Promise<BackfillResult> {
  const held = await db
    .prepare('SELECT COUNT(*) AS n FROM analytics_events WHERE backfilled = 1')
    .first<{ n: number }>();
  const imported = Number(held?.n ?? 0);
  let shortfall = expectedRows === null ? 0 : expectedRows - imported;

  if (expectedRows !== null && shortfall > SHORTFALL_TOLERANCE(expectedRows)) {
    // Before halting, ask AE what it holds NOW. Retention deletes as the import
    // runs, so rows counted at discovery can be legitimately gone by the end —
    // and if what remains is what we hold, nothing was lost by us. Without this
    // the halt is a one-way door: the cursor is past the ceiling, so every retry
    // re-fails identically and only a hand-edited state row can ever release it.
    const nowHolds = await countBelowCutoff(ae, cutoffMs);
    const drop = nowHolds === null ? Infinity : expectedRows - nowHolds;
    const retentionExplains =
      nowHolds !== null &&
      // A zero would satisfy every inequality below it. Whatever it means, it is
      // not evidence that an import which is provably short has finished.
      nowHolds > 0 &&
      // Bounded: retention removes days, not the archive.
      drop <= RETENTION_DROP_LIMIT(expectedRows) &&
      // And we must hold what AE still has, not merely less than it once had.
      imported >= nowHolds - SHORTFALL_TOLERANCE(nowHolds);

    if (retentionExplains) {
      console.warn(
        `[backfill] Analytics Engine held ${expectedRows} rows at discovery and holds ${nowHolds} now; ` +
          `D1 has ${imported}. The difference is retention deleting rows during the import, not a lost import.`,
      );
      shortfall = 0;
    } else if (nowHolds !== null && nowHolds < expectedRows) {
      console.error(
        `[backfill] Analytics Engine now reports ${nowHolds} rows below the cutoff against ${expectedRows} at ` +
          `discovery, and D1 holds ${imported}. That drop is too large to be retention during one run — not finishing on it.`,
      );
    }
  }

  if (expectedRows !== null && shortfall > SHORTFALL_TOLERANCE(expectedRows)) {
    const detail =
      `refusing to finish: Analytics Engine reported ${expectedRows} rows below the cutoff, ` +
      `D1 holds ${imported} — ${shortfall} missing, tolerance ${SHORTFALL_TOLERANCE(expectedRows)}. ` +
      `Cursor left at ${cursorDay}. Recovery is in docs/ANALYTICS.md; clearing consecutive_failures alone will not do it.`;
    console.error(`[backfill] ${detail}`);
    await db
      .prepare(
        `UPDATE backfill_state
           SET next_day = ?, sub_offset = ?, rows_written = rows_written + ?, done = 0,
               consecutive_failures = consecutive_failures + 1, lock_until = 0
         WHERE id = 1`,
      )
      .bind(cursorDay, cursorOffset, inserted)
      .run();
    return { outcome: 'failed', rows: inserted, detail };
  }

  if (shortfall > 0) {
    // Inside the band: AE's retention deleting rows the import had not reached yet
    // is the expected cause, and those rows are genuinely gone either way.
    console.warn(`[backfill] finished ${shortfall} rows below AE's reported total — inside tolerance, recording it`);
  } else if (expectedRows !== null && imported > expectedRows) {
    // The other direction. Delete-then-insert should make this impossible, and a
    // duplicate is exactly what cannot be undone once AE is gone, so it is said
    // out loud rather than passed over because the sign happened to be positive.
    console.error(
      `[backfill] D1 holds ${imported} imported rows against AE's reported ${expectedRows} — more than expected, check for duplicates`,
    );
  }
  return finish(db, cursorDay, cursorOffset, inserted, true);
}

/** Cursor, totals, failure reset and lock release — one statement, the commit point. */
async function finish(
  db: D1Database,
  nextDay: string,
  subOffset: number,
  inserted: number,
  done: boolean,
): Promise<BackfillResult> {
  await db
    .prepare(
      `UPDATE backfill_state
         SET next_day = ?, sub_offset = ?, rows_written = rows_written + ?, done = ?,
             consecutive_failures = 0, lock_until = 0
       WHERE id = 1`,
    )
    .bind(nextDay, subOffset, inserted, done ? 1 : 0)
    .run();
  // Reported by the invocation that actually finishes, not a minute later by the
  // no-op that follows it — `wrangler tail` is the only view of this.
  return { outcome: done ? 'done' : 'imported', rows: inserted };
}

/** Release the lock without touching the cursor — the abort paths. */
async function release(db: D1Database): Promise<void> {
  await db.prepare('UPDATE backfill_state SET lock_until = 0 WHERE id = 1').run();
}
