-- Feedback submissions. Replaces the Google Apps Script endpoint (#213).
-- Written by the Worker (POST /api/feedback); read by the admin view (GET /api/feedback).
CREATE TABLE IF NOT EXISTS feedback (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  category      TEXT    NOT NULL,
  message       TEXT    NOT NULL,
  puzzle_number TEXT,
  puzzle_date   TEXT,
  device        TEXT,
  browser       TEXT,
  user_agent    TEXT,
  -- Raw localStorage strings, forwarded unparsed for server-side reproduction.
  history       TEXT,
  prefs         TEXT,
  active        TEXT,
  tz_offset     INTEGER,
  local_today   TEXT,
  screen        TEXT
);

CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback (created_at DESC);
