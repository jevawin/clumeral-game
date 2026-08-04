-- Analytics events, migrated off Analytics Engine (plan §3.3).
-- Written by the Worker (POST /api/event, dual-written alongside writeDataPoint);
-- read by the stats dashboard (GET /stats, GET /api/stats).
--
-- Why D1 at all: Analytics Engine retains ~90 days and then deletes. Measured
-- 2026-08-04, the oldest surviving AE row was 2026-05-04 — we were already losing
-- history every day. D1 keeps rows indefinitely, which is what "all time" needs.
--
-- Column types signed off by Jamie 2026-08-04 (plan P41). AUTOINCREMENT is
-- deliberately absent: plain INTEGER PRIMARY KEY is the rowid alias, and we never
-- need ids that are guaranteed never to be reused.
CREATE TABLE IF NOT EXISTS analytics_events (
  id              INTEGER PRIMARY KEY,        -- rowid alias; no AUTOINCREMENT [P41]
  ts              INTEGER NOT NULL,           -- UTC epoch ms
  event           TEXT    NOT NULL,           -- AE blob1; one of VALID_EVENTS
  uid             TEXT    NOT NULL,           -- AE blob2; retained indefinitely
  -- AE blob3. 'keyboard' or 'button' on undo_used/reset_used, NULL otherwise.
  -- AE stored '' for the not-applicable case; the backfill applies NULLIF(blob3,'')
  -- on import so live and backfilled rows mean the same thing (plan P31).
  source          TEXT,
  -- AE blob4. Load-bearing: without it staging and preview traffic merges into
  -- production numbers. /stats filters on it, locked to the requesting host.
  hostname        TEXT    NOT NULL,
  value           INTEGER NOT NULL DEFAULT 0, -- AE double1; guess counts, INTEGER not REAL [P41]
  -- AE double2. CHECK rather than a bare INTEGER so a bad insert fails at the
  -- source instead of quietly skewing the new-user count.
  new_user        INTEGER NOT NULL DEFAULT 0 CHECK (new_user   IN (0, 1)),
  -- AE's _sample_interval. Sampling is real, not theoretical: measured 2026-08-04
  -- the live dataset held intervals of 1, 2, 3 and 10, and COUNT() undercounted by
  -- 1.70%. Every read sums this column rather than counting rows. Live dual-written
  -- rows are unsampled, hence DEFAULT 1.
  sample_interval INTEGER NOT NULL DEFAULT 1,
  -- 1 = imported from Analytics Engine, 0 = written live. The backfill's DELETE
  -- filters on this, which is what makes re-running a day window safe: it can
  -- never touch a live row.
  backfilled      INTEGER NOT NULL DEFAULT 0 CHECK (backfilled IN (0, 1))
);

-- Both indexes lead with hostname because every read filters on it first.
-- EXPLAIN QUERY PLAN against a seeded table, measured 2026-08-04 and asserted in
-- tests/worker/schema.spec.ts:
--   daily counts  -> SEARCH USING INDEX idx_analytics_host_ev_ts (hostname=? AND event=? AND ts>?)
--   unique users  -> SEARCH USING INDEX idx_analytics_host_ev_ts (hostname=? AND event=? AND ts>?)
--   event totals  -> SEARCH USING INDEX idx_analytics_host_ts (hostname=? AND ts>?)
--   MIN(ts)       -> SEARCH USING COVERING INDEX idx_analytics_host_ts (hostname=?)
-- No full table scan on any of them.
-- Note each index adds a written row per insert, so one event costs 3 rows written
-- against D1's 100k/day free-tier ceiling. At ~80 events/day that is ~0.24%.
CREATE INDEX IF NOT EXISTS idx_analytics_host_ts    ON analytics_events (hostname, ts);
CREATE INDEX IF NOT EXISTS idx_analytics_host_ev_ts ON analytics_events (hostname, event, ts);
