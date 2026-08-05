-- Triage state for feedback rows (#225).
-- For fresh DBs these columns are in 0001; this is for the remote D1 that predates
-- them — same pattern as 0003_add_host_column.sql.
--
-- SQLite cannot add a NOT NULL column without a default, and cannot add one with a
-- non-constant default. A plain TEXT default 'open' is constant, so this is safe.
--
-- github_issue is the triage bot's memory: it tells "already filed as #271" from
-- "never seen", which is what stops follow-up feedback opening duplicate tickets.
-- Not re-runnable: ADD COLUMN fails with "duplicate column name" on a second pass.
-- Same as 0003. Run it once, against the remote, before deploying code that reads
-- these columns.
ALTER TABLE feedback ADD COLUMN status TEXT NOT NULL DEFAULT 'open';
ALTER TABLE feedback ADD COLUMN github_issue INTEGER;
ALTER TABLE feedback ADD COLUMN resolved_at TEXT;

-- No backfill statement is needed: NOT NULL DEFAULT 'open' sets every existing row
-- to 'open' as part of the ALTER, and the column can never hold NULL afterwards.
CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedback (status);
