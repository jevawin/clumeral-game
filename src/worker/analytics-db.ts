// Analytics storage — the D1 replacement for Analytics Engine.
//
// Why this exists: AE retains ~90 days and then deletes. Measured 2026-08-04, the
// oldest surviving row was 2026-05-04, so "all time" was already impossible and we
// were losing history daily. D1 keeps rows for good.
//
// Two rules run through the whole file:
//
// 1. Every value is bound, never interpolated. The AE query builder interpolated
//    the hostname straight into SQL; that is a live injection path here, where the
//    same string reaches a database that can be written to.
// 2. Every count is SUM(sample_interval), never COUNT(). AE sampled: the live
//    dataset held intervals of 1, 2, 3 and 10, and COUNT() undercounted the total
//    by 1.70%. Rows we write ourselves carry interval 1, so the sum is exact for
//    them and correctly weighted for imported ones.
//
// The exception to rule 2 is COUNT(DISTINCT uid). A sampled row stands for several
// events but still names exactly one uid — the other users are unknowable. So
// unique/new-user figures over the imported window are a floor, not a total. This
// is a real limitation of the source data, documented in docs/ANALYTICS.md, and it
// cannot be corrected after the fact.

export interface AnalyticsEvent {
  event: string;
  uid: string;
  source?: string | null;
  hostname: string;
  value?: number;
  newUser?: boolean;
}

/** Rolling window in whole UTC days, or every row ever stored. */
export type StatsRange = { days: number } | { all: true };

export interface StatsResult {
  events: { event: string; count: number }[];
  daily: { day: string; event: string; count: number }[];
  uniqueUsers: number;
  newUsers: number;
  guessDistribution: { guesses: number; count: number }[];
  sourceSplit: { event: string; source: string | null; count: number }[];
  /** Epoch ms of the earliest stored row for this host, or null when there are none. */
  firstTs: number | null;
}

const DAY_MS = 86_400_000;

/** The ranges the dashboard offers. */
export const DEFAULT_RANGE: StatsRange = { days: 30 };

/**
 * Parse `?period=` for both /stats and /api/stats — one parser, because two
 * drifted: /api/stats clamped with Math.min(Number(raw), 90) and /stats added a
 * `|| 90` on top, so `?period=all` became NaN, failed the clamp, and fell through
 * to a query the page then labelled "Last 90 days" while actually returning
 * all-time. Anything unrecognised is 30 days.
 */
export function parsePeriod(raw: string | null): StatsRange {
  if (raw === 'all') return { all: true };
  if (raw === '7' || raw === '30' || raw === '90') return { days: Number(raw) };
  return DEFAULT_RANGE;
}

/** Midnight UTC at the start of the day containing `ms`. */
export function startOfUTCDay(ms: number): number {
  return Math.floor(ms / DAY_MS) * DAY_MS;
}

/**
 * Epoch-ms lower bound for a range, or null for all-time.
 *
 * Whole UTC days, not a rolling 24h multiple: "7d" means seven day-columns on the
 * chart, today included, not 168 hours ending now — which would render eight bars,
 * the first of them a partial day that always looks like a slump.
 */
export function rangeCutoff(range: StatsRange, now: number): number | null {
  if ('all' in range) return null;
  return startOfUTCDay(now) - (range.days - 1) * DAY_MS;
}

// POST /api/event is public and unauthenticated, and D1 keeps rows for good with
// no prune step — so an unbounded string here is permanent storage handed to
// anyone. AE was self-expiring and free, which is why item 19 was comfortable
// leaving the endpoint open; that reasoning does not carry over. Truncate rather
// than reject: a client sending an over-long uid is far more likely to be a bug
// than an attack, and dropping the event would lose a real play.
const MAX_UID = 64;
const MAX_SOURCE = 128;

/**
 * Store one event.
 *
 * `source` is normalised to NULL when absent or empty, matching the NULLIF the
 * backfill applies on import — AE wrote '' for the absent case, and without the
 * same normalisation live and imported rows would carry different values for the
 * same meaning.
 *
 * It is NOT undo/reset-only. `route_change` sends the path and `htp_opened` sends
 * 'manual' (src/router.ts:79, src/app.ts:1489), and route_change is the highest
 * volume event we record — so most rows carry a source. Only the undo/reset split
 * is read back today.
 *
 * async so that a synchronous throw — an unbound ANALYTICS_DB, say — comes back as
 * a rejected promise. The caller's .catch() is what keeps the event POST at 202;
 * a sync throw would blow past it into the route's own catch and turn every event
 * into a 400.
 */
export async function recordEvent(db: D1Database, e: AnalyticsEvent, now: number = Date.now()) {
  // The body is cast, never validated, so value can be anything JSON allows.
  // NaN binds as NULL and trips the NOT NULL constraint — which would drop the
  // row into a swallowed console.error while writeDataPoint kept it, putting a
  // divergence into the very comparison that gates AE removal.
  const value = Number(e.value);
  return db
    .prepare(
      'INSERT INTO analytics_events (ts, event, uid, source, hostname, value, new_user) VALUES (?, ?, ?, ?, ?, ?, ?)',
    )
    .bind(
      now,
      e.event,
      String(e.uid).slice(0, MAX_UID),
      e.source ? String(e.source).slice(0, MAX_SOURCE) : null,
      e.hostname,
      Number.isFinite(value) ? Math.trunc(value) : 0,
      e.newUser ? 1 : 0,
    )
    .run();
}

// SQLite has no toStartOfDay. ts is epoch ms and integer division truncates, which
// is what we want — UTC by definition, matching the puzzle day boundary.
const DAY_EXPR = "strftime('%Y-%m-%d', ts / 1000, 'unixepoch')";

/**
 * Every figure the dashboard shows, in one round trip.
 *
 * Seven statements, batched. The seventh (firstTs) exists because the period label
 * and the chart's lower bound both need the earliest stored day when the range is
 * "all", and deriving it from the daily rows would be wrong: the renderer filters
 * those to puzzle_start, so a day holding only route_change events would move the
 * apparent start of collection.
 */
export async function getStats(
  db: D1Database,
  range: StatsRange,
  hostname: string,
  now: number = Date.now(),
): Promise<StatsResult> {
  const cutoff = rangeCutoff(range, now);

  // All-time omits the clause outright rather than passing 1=1 or a zero cutoff.
  // (The AE version's "1=1" branch is how today's ?period=all silently returns
  // all-time while the page claims to show 90 days.)
  const timeSQL = cutoff === null ? '' : ' AND ts >= ?';
  const args: unknown[] = cutoff === null ? [hostname] : [hostname, cutoff];
  const where = `WHERE hostname = ?${timeSQL}`;

  const q = (sql: string) => db.prepare(sql).bind(...args);

  const [events, daily, uniqueUsers, newUsers, guessDistribution, sourceSplit, first] = await db.batch([
    q(`SELECT event, SUM(sample_interval) AS count FROM analytics_events ${where} GROUP BY event ORDER BY count DESC`),
    q(
      `SELECT ${DAY_EXPR} AS day, event, SUM(sample_interval) AS count FROM analytics_events ${where} GROUP BY day, event ORDER BY day ASC`,
    ),
    // COUNT(DISTINCT ...), not SUM — see the file header. A floor over imported rows.
    q(`SELECT COUNT(DISTINCT uid) AS total FROM analytics_events ${where} AND event = 'puzzle_start'`),
    q(
      `SELECT COUNT(DISTINCT uid) AS total FROM analytics_events ${where} AND event = 'puzzle_start' AND new_user = 1`,
    ),
    q(
      `SELECT value AS guesses, SUM(sample_interval) AS count FROM analytics_events ${where} AND event = 'puzzle_complete' GROUP BY value ORDER BY value ASC`,
    ),
    // The undo/reset split by trigger. Comparing keyboard against button is the
    // entire reason these two events carry a source at all.
    q(
      `SELECT event, source, SUM(sample_interval) AS count FROM analytics_events ${where} AND event IN ('undo_used', 'reset_used') GROUP BY event, source ORDER BY count DESC`,
    ),
    // Deliberately not time-filtered: this is "when did collection start for this
    // host", which is a property of the archive, not of the selected range.
    db.prepare('SELECT MIN(ts) AS first_ts FROM analytics_events WHERE hostname = ?').bind(hostname),
  ]);

  const rows = <T>(r: D1Result) => (r.results ?? []) as T[];
  const num = (v: unknown) => Number(v ?? 0);

  return {
    events: rows<{ event: string; count: number }>(events).map((r) => ({ event: r.event, count: num(r.count) })),
    daily: rows<{ day: string; event: string; count: number }>(daily).map((r) => ({
      day: r.day,
      event: r.event,
      count: num(r.count),
    })),
    uniqueUsers: num(rows<{ total: number }>(uniqueUsers)[0]?.total),
    newUsers: num(rows<{ total: number }>(newUsers)[0]?.total),
    guessDistribution: rows<{ guesses: number; count: number }>(guessDistribution).map((r) => ({
      guesses: num(r.guesses),
      count: num(r.count),
    })),
    sourceSplit: rows<{ event: string; source: string | null; count: number }>(sourceSplit).map((r) => ({
      event: r.event,
      source: r.source,
      count: num(r.count),
    })),
    firstTs: rows<{ first_ts: number | null }>(first)[0]?.first_ts ?? null,
  };
}
