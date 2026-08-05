// Refuses destructive SQL in a migration unless the filename says it is intended.
//
// Wrangler applies migrations; it does not judge them. This runs BEFORE
// `wrangler d1 migrations apply`, reads only text, and touches no database — so
// it is safe for the dev bot to run locally and safe to run in CI.
//
// Deliberately NOT blocked: bare `UPDATE … SET`. Backfilling a newly added
// column is a legitimate additive pattern, and blocking it would turn routine
// migrations into failed deploys.
import { readdir, readFile } from 'node:fs/promises';
import { realpathSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// SQLite makes the COLUMN keyword OPTIONAL in both `ALTER TABLE x DROP [COLUMN] y`
// and `ALTER TABLE x RENAME [COLUMN] y TO z`. Matching only the spelled-out forms
// left `ALTER TABLE feedback DROP host;` passing the lint — verified against a real
// D1, which dropped the column happily. So the ALTER TABLE forms are matched on the
// verb alone, independently of what follows it.
const DESTRUCTIVE = new RegExp(
  [
    'drop\\s+(?:table|index|view|trigger|column|database)',
    'truncate',
    'delete\\s+from',
    'rename\\s+(?:to|column)',
    'replace\\s+into',
    'insert\\s+or\\s+replace',
    'pragma\\s+writable_schema',
    'attach\\s+database',
    // Any DROP or RENAME applied to a table, whatever the object spelling and
    // whatever the table name looks like. Scans to the statement terminator
    // rather than matching a single `\\S+` token: a schema-qualified or quoted
    // name is several tokens ("main"."feedback", [main].[feedback], main . x),
    // and each of those slipped a real column drop past the token version.
    'alter\\s+table\\b[^;]*?\\b(?:drop|rename)',
  ].map((p) => `\\b(?:${p})\\b`).join('|'),
  'i',
);

// Single left-to-right pass. Comments and quoted spans are mutually exclusive
// lexical states: stripping one class before the other lets a string containing
// "--" or "/*" swallow real SQL. That bypass hid a DROP TABLE in review.
export function strip(sql) {
  if (typeof sql !== 'string') throw new TypeError('strip: expected a SQL string');
  let out = '';
  for (let i = 0; i < sql.length; i++) {
    const c = sql[i];
    if (c === '-' && sql[i + 1] === '-') {
      while (i < sql.length && sql[i] !== '\n') i++;
      out += ' ';
    } else if (c === '/' && sql[i + 1] === '*') {
      i += 2;
      while (i < sql.length && !(sql[i] === '*' && sql[i + 1] === '/')) i++;
      i++;
      out += ' ';
    } else if (c === "'" || c === '"' || c === '`') {
      const q = c;
      i++;
      while (i < sql.length) {
        if (sql[i] === q) {
          if (sql[i + 1] === q) i++;   // doubled quote is an escape, not a close
          else break;
        }
        i++;
      }
      out += ' _q_ ';                  // a placeholder, NOT '' — keeps tokens apart
    } else if (c === '[') {
      const close = sql.indexOf(']', i);
      if (close === -1) {
        // Unterminated. Blanking to EOF here would swallow the rest of the file
        // and report it clean, so emit the remainder unchanged and let the regex
        // judge it.
        out += sql.slice(i);
        break;
      }
      i = close;
      out += ' _q_ ';
    } else {
      out += c;
    }
  }
  return out;
}

export function isDestructive(sqlText) {
  return DESTRUCTIVE.test(strip(sqlText));
}

export function isDestructiveOptIn(filename) {
  return filename.endsWith('.destructive.sql');
}

export async function lint(dirs) {
  const offenders = [];
  for (const dir of dirs) {
    for (const name of (await readdir(dir)).filter((f) => f.endsWith('.sql'))) {
      const sql = await readFile(path.join(dir, name), 'utf8');
      if (isDestructive(sql) && !isDestructiveOptIn(name)) offenders.push(path.join(dir, name));
    }
  }
  return offenders;
}

// Is this file being run directly, rather than imported by a test?
//
// Three things have to line up, and each one has silently failed open before:
//   - pathToFileURL, not a template string — import.meta.url is percent-encoded,
//     so a checkout path with a space made the naive comparison false;
//   - realpathSync — Node resolves symlinks in import.meta.url but not in
//     argv[1], so reaching the script through a symlinked path did the same;
//   - the argv[1] guard — it is undefined under `node -e`, and without the check
//     pathToFileURL throws and the module cannot be imported at all.
//
// Every one of those ends in "exit 0, nothing linted", after which migrate:prod's
// && chain happily applies the migration.
if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  const dirs = process.argv.slice(2);
  if (dirs.length === 0) {
    console.error('usage: node scripts/lint-migrations.mjs <dir> [dir...]');
    process.exitCode = 2;
  } else {
    lint(dirs)
      .then((offenders) => {
        if (offenders.length === 0) {
          console.log(`migrations clean: ${dirs.join(', ')}`);
          return;
        }
        console.error(
          `destructive SQL without an explicit opt-in:\n  ${offenders.join('\n  ')}\n` +
            'Rename to *.destructive.sql to confirm it is intended. ' +
            'Destructive migrations are added by Jamie only.',
        );
        process.exitCode = 1;
      })
      .catch((err) => {
        console.error(`lint failed: ${err.message}`);
        process.exitCode = 1;
      });
  }
}
