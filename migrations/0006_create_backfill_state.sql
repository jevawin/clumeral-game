-- Backfill cursor and lock (plan P17). One row, forever — the CHECK (id = 1)
-- makes a second row impossible rather than merely unlikely.
--
-- The backfill imports pre-cutover history out of Analytics Engine into
-- analytics_events. It runs from scheduled() on a temporary per-minute cron and is
-- removed once the import is verified.
CREATE TABLE IF NOT EXISTS backfill_state (
  id                   INTEGER PRIMARY KEY CHECK (id = 1),
  -- Both bounds are discovered on the first invocation and then frozen, never
  -- recomputed. cutoff_ms is the earliest live (backfilled = 0) row — the instant
  -- dual writes went live — so the import can never overlap live data. start_day
  -- is the earliest surviving AE row's UTC day. Frozen because the AE retention
  -- window rolls forward daily; a recomputed lower bound would chase it forever.
  cutoff_ms            INTEGER,
  start_day            TEXT,
  next_day             TEXT,                       -- 'YYYY-MM-DD' UTC, next day to import
  -- Offset within next_day when a single day is too large for one invocation and
  -- is imported in LIMIT/OFFSET sub-windows. 0 means "start of the day", which is
  -- also when that day's DELETE runs.
  sub_offset           INTEGER NOT NULL DEFAULT 0,
  done                 INTEGER NOT NULL DEFAULT 0 CHECK (done IN (0, 1)),
  -- Compare-and-set lock. Held as an epoch-ms deadline so a killed run cannot
  -- wedge the backfill permanently; released explicitly on every normal exit.
  lock_until           INTEGER NOT NULL DEFAULT 0,
  rows_written         INTEGER NOT NULL DEFAULT 0,
  -- Stops a wedged backfill retrying once a minute forever and silently. Above 5
  -- the run halts and logs loudly.
  consecutive_failures INTEGER NOT NULL DEFAULT 0
);

-- The singleton row is part of the migration, not optional (plan P34). The lock is
-- acquired with a conditional UPDATE ... WHERE id = 1; with no row to update,
-- meta.changes is always 0, every invocation exits, and the backfill runs 1,440
-- times a day importing nothing, with no error anywhere.
INSERT OR IGNORE INTO backfill_state (id) VALUES (1);
