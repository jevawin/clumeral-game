import { describe, it, expect } from 'vitest';
import { isDestructive, isDestructiveOptIn } from '../scripts/lint-migrations.mjs';

describe('isDestructive — must catch', () => {
  it('flags DROP TABLE regardless of case and whitespace', () => {
    expect(isDestructive('drop   table feedback;')).toBe(true);
    expect(isDestructive('DROP\nTABLE feedback;')).toBe(true);
  });

  it('flags DROP COLUMN, INDEX, VIEW and TRIGGER', () => {
    expect(isDestructive('ALTER TABLE feedback DROP COLUMN host;')).toBe(true);
    expect(isDestructive('DROP INDEX idx_feedback_status;')).toBe(true);
    expect(isDestructive('DROP VIEW v;')).toBe(true);
    expect(isDestructive('DROP TRIGGER t;')).toBe(true);
  });

  it('flags DELETE FROM — the statement reserved for the console', () => {
    expect(isDestructive("DELETE FROM feedback WHERE host <> 'clumeral.com';")).toBe(true);
  });

  it('flags RENAME, which breaks the currently-deployed code', () => {
    expect(isDestructive('ALTER TABLE feedback RENAME COLUMN host TO origin;')).toBe(true);
    expect(isDestructive('ALTER TABLE feedback RENAME TO fb;')).toBe(true);
  });

  it('flags REPLACE INTO and INSERT OR REPLACE', () => {
    expect(isDestructive('REPLACE INTO t VALUES (1);')).toBe(true);
    expect(isDestructive('INSERT OR REPLACE INTO t VALUES (1);')).toBe(true);
  });

  // The bypasses adversarial review found. All three failed the naive version.
  it('is not fooled by a -- inside a string literal', () => {
    expect(isDestructive("INSERT INTO n(b) VALUES ('a--b'); DROP TABLE feedback;")).toBe(true);
  });

  it('is not fooled by a block-comment opener inside a string literal', () => {
    expect(isDestructive("INSERT INTO n VALUES ('/*'); DROP TABLE feedback; INSERT INTO n VALUES ('*/');")).toBe(true);
  });

  it('sees through an interrupting comment', () => {
    expect(isDestructive('DROP /* sneaky */ TABLE feedback;')).toBe(true);
  });

  // SQLite makes COLUMN optional. Verified against a real D1: both of these drop
  // and rename the column, and both passed the first version of this lint.
  it('flags a column drop written without the COLUMN keyword', () => {
    expect(isDestructive('ALTER TABLE feedback DROP host;')).toBe(true);
    expect(isDestructive('ALTER TABLE feedback DROP "host";')).toBe(true);
    expect(isDestructive('ALTER TABLE main.feedback DROP host;')).toBe(true);
  });

  it('flags a column rename written without the COLUMN keyword', () => {
    expect(isDestructive('ALTER TABLE feedback RENAME host TO origin;')).toBe(true);
  });

  it('is not silenced by an unterminated bracket quote', () => {
    // A blanket blank-to-EOF here would swallow the DROP and report it clean.
    expect(isDestructive('CREATE TABLE [t (a INT); DROP TABLE feedback;')).toBe(true);
  });
});

describe('isDestructive — must NOT fire', () => {
  it('allows additive DDL', () => {
    expect(isDestructive('CREATE TABLE IF NOT EXISTS x (id INTEGER);')).toBe(false);
    expect(isDestructive('ALTER TABLE feedback ADD COLUMN host TEXT;')).toBe(false);
  });

  it('allows UPDATE, which is how a new column gets backfilled', () => {
    expect(isDestructive('ALTER TABLE t ADD COLUMN x INTEGER; UPDATE t SET x = 0;')).toBe(false);
  });

  it('ignores destructive words in comments', () => {
    expect(isDestructive('-- we will drop this table later\nCREATE TABLE t (id INTEGER);')).toBe(false);
  });

  it('ignores destructive words in quoted identifiers', () => {
    expect(isDestructive('CREATE TABLE "drop table" (id INTEGER);')).toBe(false);
    expect(isDestructive('CREATE TABLE `delete from` (id INTEGER);')).toBe(false);
    expect(isDestructive('CREATE TABLE [drop table] (id INTEGER);')).toBe(false);
  });

  it('ignores destructive words inside string values', () => {
    expect(isDestructive("INSERT INTO t(note) VALUES ('drop table feedback');")).toBe(false);
  });

  // The ALTER TABLE rules match on the verb rather than the object, so check they
  // do not swallow the additive form they sit next to.
  it('still allows ADD COLUMN on a table whose name contains a destructive word', () => {
    expect(isDestructive('ALTER TABLE drop_log ADD COLUMN note TEXT;')).toBe(false);
    expect(isDestructive('ALTER TABLE t ADD COLUMN dropdown TEXT;')).toBe(false);
    expect(isDestructive('ALTER TABLE t ADD COLUMN renamed_at TEXT;')).toBe(false);
  });
});

describe('isDestructiveOptIn', () => {
  it('recognises the opt-in suffix', () => {
    expect(isDestructiveOptIn('0009_remove_x.destructive.sql')).toBe(true);
  });
  it('rejects an ordinary name', () => {
    expect(isDestructiveOptIn('0009_remove_x.sql')).toBe(false);
  });
});
