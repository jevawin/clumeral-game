-- Add the host column to an already-created feedback table (#213).
-- For fresh DBs the column is in 0001; this is for the remote D1 that predates it.
-- Backfill existing rows to clumeral.com — all prior feedback (incl. the legacy
-- import) came from production.
ALTER TABLE feedback ADD COLUMN host TEXT;
UPDATE feedback SET host = 'clumeral.com' WHERE host IS NULL;
