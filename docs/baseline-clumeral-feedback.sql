-- ONE-OFF. Production `clumeral-feedback` only, in the Cloudflare D1 console,
-- BEFORE the first automatic production migration run.
--
-- ✅ ALREADY APPLIED AND VERIFIED by Jamie on 2026-08-05 — 3 rows. This file is
-- kept as the record of what was applied, and for a rebuild. Do not re-run it as
-- part of merging; it is not a blocker.
--
-- 0001, 0003 and 0004 were applied by hand before wrangler's migrations tooling
-- was adopted. This records them as applied without re-running them: 0003 and
-- 0004 are ALTER TABLE ADD COLUMN and would fail on a second run.
--
-- The DDL matches wrangler's own, so `d1 migrations apply` adopts this table
-- rather than creating a different one.
-- Safe to run twice: INSERT OR IGNORE against a UNIQUE name.
CREATE TABLE IF NOT EXISTS d1_migrations(
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT UNIQUE,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

INSERT OR IGNORE INTO d1_migrations (name) VALUES
  ('0001_create_feedback.sql'),
  ('0003_add_host_column.sql'),
  ('0004_add_triage_columns.sql');

-- Verify: expect exactly these three names.
SELECT name FROM d1_migrations ORDER BY name;
