-- Feedback submissions. Replaces the Google Apps Script endpoint (#213).
-- Written by the Worker (POST /api/feedback); read by the admin view (GET /feedback).
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
  screen        TEXT,
  -- Request hostname at submit time (server-set). clumeral.com = real;
  -- *.workers.dev / localhost = test/preview. Drives the admin default filter.
  host          TEXT,
  -- Triage state (#225). 'open' or 'resolved' — nothing else is accepted by the
  -- Worker. Richer outcomes (wontfix, duplicate) are carried by the linked GitHub
  -- issue's own state, not duplicated here.
  status        TEXT    NOT NULL DEFAULT 'open',
  -- The GitHub issue this row produced, if any. This is the triage bot's memory:
  -- it distinguishes "already filed as #271" from "never seen", which is what lets
  -- follow-up feedback join an existing ticket instead of opening a duplicate.
  github_issue  INTEGER,
  resolved_at   TEXT
);

CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback (created_at DESC);
-- The dashboard and the bot both filter on status before anything else.
CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedback (status);
