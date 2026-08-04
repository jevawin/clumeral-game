-- Analytics fixture for the local e2e database (npm run e2e:db).
--
-- Dates are relative to today, not hardcoded: /stats renders a rolling window
-- ending on the current UTC day, so a fixed-date fixture would drift out of the
-- 7-day range overnight and the chart assertions would start passing or failing
-- depending on when CI ran.
--
-- Every row is stamped at noon UTC on its day, which keeps day bucketing away from
-- the midnight boundary in either direction.
--
-- The shape the e2e specs rely on:
--   * earliest row is exactly 100 days ago -> "All" renders 101 bars
--   * day -3 has no rows at all            -> a zero-day stub inside the 7d range
--   * today has plays                      -> the most recent bar is non-zero
--   * one row carries sample_interval = 4  -> counts must sum intervals, not rows
--   * one row belongs to another hostname  -> must never appear on clumeral.com
DELETE FROM analytics_events;

-- Helper shape, repeated inline because SQLite has no parameterised macros:
--   (unixepoch(date('now', '-N days')) + 43200) * 1000  =  noon UTC, N days back

-- Today: two plays, one completion, an undo by each trigger.
INSERT INTO analytics_events (ts, event, uid, source, hostname, value, new_user, sample_interval) VALUES
  ((unixepoch(date('now')) + 43200) * 1000, 'puzzle_start',    'e2e-a', NULL,       'localhost', 0, 1, 1),
  ((unixepoch(date('now')) + 43200) * 1000, 'puzzle_start',    'e2e-b', NULL,       'localhost', 0, 0, 1),
  ((unixepoch(date('now')) + 43260) * 1000, 'puzzle_complete', 'e2e-a', NULL,       'localhost', 3, 0, 1),
  ((unixepoch(date('now')) + 43320) * 1000, 'undo_used',       'e2e-a', 'keyboard', 'localhost', 0, 0, 1),
  ((unixepoch(date('now')) + 43380) * 1000, 'undo_used',       'e2e-b', 'button',   'localhost', 0, 0, 1),
  ((unixepoch(date('now')) + 43440) * 1000, 'reset_used',      'e2e-b', 'button',   'localhost', 0, 0, 1),
  ((unixepoch(date('now')) + 43500) * 1000, 'htp_opened',      'e2e-a', NULL,       'localhost', 0, 0, 1);

-- Yesterday and the day before.
INSERT INTO analytics_events (ts, event, uid, source, hostname, value, new_user, sample_interval) VALUES
  ((unixepoch(date('now', '-1 days')) + 43200) * 1000, 'puzzle_start',    'e2e-c', NULL, 'localhost', 0, 1, 1),
  ((unixepoch(date('now', '-1 days')) + 43260) * 1000, 'puzzle_complete', 'e2e-c', NULL, 'localhost', 5, 0, 1),
  ((unixepoch(date('now', '-2 days')) + 43200) * 1000, 'puzzle_start',    'e2e-d', NULL, 'localhost', 0, 1, 1);

-- Day -3 is deliberately empty: the 7-day chart must show a zero-day stub.

-- Days -4 to -6, with one sampled row standing for four events.
INSERT INTO analytics_events (ts, event, uid, source, hostname, value, new_user, sample_interval) VALUES
  ((unixepoch(date('now', '-4 days')) + 43200) * 1000, 'puzzle_start', 'e2e-e', NULL, 'localhost', 0, 1, 4),
  ((unixepoch(date('now', '-5 days')) + 43200) * 1000, 'puzzle_start', 'e2e-f', NULL, 'localhost', 0, 0, 1),
  ((unixepoch(date('now', '-6 days')) + 43200) * 1000, 'puzzle_start', 'e2e-g', NULL, 'localhost', 0, 1, 1);

-- Older rows so the 30d, 90d and All ranges each cover more than the one before.
-- Marked backfilled = 1, which is also what the imported archive will look like.
INSERT INTO analytics_events (ts, event, uid, source, hostname, value, new_user, sample_interval, backfilled) VALUES
  ((unixepoch(date('now', '-20 days'))  + 43200) * 1000, 'puzzle_start', 'e2e-h', NULL, 'localhost', 0, 1, 1, 1),
  ((unixepoch(date('now', '-45 days'))  + 43200) * 1000, 'puzzle_start', 'e2e-i', NULL, 'localhost', 0, 1, 1, 1),
  ((unixepoch(date('now', '-100 days')) + 43200) * 1000, 'puzzle_start', 'e2e-j', NULL, 'localhost', 0, 1, 1, 1);

-- Another hostname. /stats is locked to the host it is called from, so this row
-- exists purely to prove it never leaks into the localhost figures.
INSERT INTO analytics_events (ts, event, uid, source, hostname, value, new_user, sample_interval) VALUES
  ((unixepoch(date('now')) + 43200) * 1000, 'puzzle_start', 'e2e-other', NULL, 'staging-clumeral-game.jevawin.workers.dev', 0, 1, 1);
