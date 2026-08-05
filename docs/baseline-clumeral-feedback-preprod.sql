-- ONE-OFF. `clumeral-feedback-preprod` only, in the Cloudflare D1 console,
-- BEFORE the first pre-prod branch build.
--
-- ✅ ALREADY APPLIED AND VERIFIED by Jamie on 2026-08-05 — 2 rows, no 0001. This
-- file is kept as the record of what was applied, and for a rebuild. Do not
-- re-run it as part of merging; it is not a blocker.
--
-- This database is EMPTY, but it still needs a baseline. 0001 creates the
-- feedback table with host/status/github_issue/resolved_at already present;
-- 0003 and 0004 add those same columns and exist only for the older production
-- database. On a fresh database 0001 then 0003 fails with "duplicate column
-- name". Recording 0003 and 0004 as applied — WITHOUT running them — leaves the
-- first migration run to apply 0001 alone, which is correct and complete.
--
-- Do NOT add 0001 here: it genuinely has to run.
CREATE TABLE IF NOT EXISTS d1_migrations(
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT UNIQUE,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

INSERT OR IGNORE INTO d1_migrations (name) VALUES
  ('0003_add_host_column.sql'),
  ('0004_add_triage_columns.sql');

-- Verify: expect exactly these two names, and NOT 0001.
SELECT name FROM d1_migrations ORDER BY name;
