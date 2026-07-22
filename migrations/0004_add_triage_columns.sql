-- Triage state for feedback rows (#225).
-- For fresh DBs these columns are in 0001; this is for the remote D1 that predates
-- them — same pattern as 0003_add_host_column.sql.
--
-- SQLite cannot add a NOT NULL column without a default, and cannot add one with a
-- non-constant default. A plain TEXT default 'open' is constant, so this is safe.
--
-- github_issue is the triage bot's memory: it tells "already filed as #271" from
-- "never seen", which is what stops follow-up feedback opening duplicate tickets.
ALTER TABLE feedback ADD COLUMN status TEXT NOT NULL DEFAULT 'open';
ALTER TABLE feedback ADD COLUMN github_issue INTEGER;
ALTER TABLE feedback ADD COLUMN resolved_at TEXT;

-- Defensive: the DEFAULT above already backfills existing rows, but an interrupted
-- or partially-applied run should still land on 'open' rather than NULL.
UPDATE feedback SET status = 'open' WHERE status IS NULL OR status = '';

CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedback (status);
