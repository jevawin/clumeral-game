# Clumeral pre-prod / prod split — Implementation Plan (v2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Repo:** `jevawin/clumeral-game`.
**Spec:** `2026-08-05-clumeral-preprod-split-design.md` (v2). Read it first — §9
lists what the previous version of this plan got wrong, and why.

**Goal:** Branch previews stop reading and writing production data, and a schema
change ships end-to-end from a bot pull request with no human command and no
Cloudflare credential issued to the bot.

**Architecture:** One Worker, two environments. `wrangler.jsonc` gains
`env.preprod` — same Worker name, its own D1 databases. The environment is
selected at **build** time via `CLOUDFLARE_ENV`. Migrations are applied by
**wrangler's own** `d1 migrations apply`, using a per-binding `migrations_dir`,
run from Cloudflare's builder.

**Tech Stack:** Cloudflare Workers, Workers Builds, D1, wrangler 4.80.0, Node 22,
vitest (two projects — jsdom for `tests/**`, workers pool for `tests/worker/**`).

## ⚠️ Base branch — read before the first command

**Branch from `dev/analytics-range-chart`, not from `staging` or `main`.**
Migrations 0005/0006, the `ANALYTICS_DB` binding, the split `e2e:db:*` scripts,
`vitest.workers.config.ts` and `tests/worker/` exist only there. On `staging`
half the edits below have nothing to edit and `git mv` will fail mid-script.

Confirm before starting:

```bash
git branch --show-current           # expect dev/analytics-range-chart or a branch off it
ls migrations/                      # expect 0001, 0003, 0004, 0005, 0006
grep -c ANALYTICS_DB wrangler.jsonc # expect 1
```

If any check fails, stop and ask.

## Global Constraints

- **Never run a remote database command.** The guard hook blocks
  `wrangler d1 … --remote`; that is correct and stays. Local work uses `--local`.
  Every remote command in this plan runs in Cloudflare's builder or is pasted by
  Jamie into the D1 console.
- **A wrangler `env` block does NOT inherit `d1_databases`, `kv_namespaces`,
  `analytics_engine_datasets` or `vars`.** Omitting one gives `undefined` and only
  a *warning* — the deploy succeeds with a missing binding. Every one of those
  keys must be restated in `env.preprod`, including the ones being shared
  unchanged.
- **`--env` does nothing on the generated `dist/clumeral_game/wrangler.json`.**
  That file is already flattened and has no `env` key. `CLOUDFLARE_ENV` at build
  time is the real switch. `--env` *is* correct on commands that read the source
  `wrangler.jsonc` at the repo root — i.e. the migration commands.
- **Migrations are additive-only.** They run before the new version is live.
- **Both environments share the Worker name**, so `wrangler deploy --env preprod`
  would overwrite production. Pre-prod is reached only by `versions upload`.
- **Verification is by positive assertion.** An isolation failure is silent.

## Database IDs (supplied by Jamie 2026-08-05, use verbatim)

| Database | ID |
|---|---|
| `clumeral-feedback` | `4ecc6c31-c26c-4652-a1ae-7d1746bd816d` |
| `clumeral-analytics` | `6e076e77-0937-4e3c-9756-3898a2b48ad6` |
| `clumeral-feedback-preprod` | `b46da472-0b93-4d1d-bb2f-a5480830d3aa` |
| `clumeral-analytics-preprod` | `789714c9-307b-45cf-baba-b219807d09d8` |

`clumeral-feedback`'s id matches the one already in `wrangler.jsonc` — check that
before trusting the other three.

---

## File Structure

| File | Responsibility |
|---|---|
| `migrations/feedback/*.sql` | Feedback schema. `migrations_dir` for `FEEDBACK_DB`. |
| `migrations/analytics/*.sql` | Analytics schema. `migrations_dir` for `ANALYTICS_DB`. |
| `scripts/lint-migrations.mjs` | Refuses destructive SQL without an explicit filename opt-in. Pure text analysis, **no database access**. |
| `tests/lint-migrations.spec.ts` | Tests the lint in both directions — bypasses and false positives. |
| `tests/wrangler-bindings.spec.ts` | Extended: asserts `env.preprod` restates every non-inheritable key and never points at a production database. |
| `wrangler.jsonc` | Adds `env.preprod` and `migrations_dir` per D1 binding. |
| `vitest.workers.config.ts` | Repointed at `migrations/analytics` — `readD1Migrations` does not recurse. |
| `package.json` | `migrate:prod`, `migrate:preprod`, `lint:migrations`; `e2e:db:*` paths updated. |
| `docs/baseline-*.sql` | One-off ledger seeds for the two feedback databases. |
| `CLAUDE.md` | Environment layout and migration rules for the bot. |

---

## Task 1: Split migrations by database

Wrangler's `migrations_dir` is configured **per D1 binding**, so each database
needs its own directory. Directory membership becomes the mapping.

**Files:**
- Move: `migrations/{0001_create_feedback,0003_add_host_column,0004_add_triage_columns}.sql` → `migrations/feedback/`
- Move: `migrations/{0005_create_analytics_events,0006_create_backfill_state}.sql` → `migrations/analytics/`
- Modify: `package.json`, `vitest.workers.config.ts`, `docs/FEEDBACK.md`, `docs/ANALYTICS.md`

**Interfaces:**
- Produces: two migration directories, consumed by Task 3's `migrations_dir`
  config and Task 2's lint. Numbering stays **global** across both directories
  (the next migration is `0007_*`, wherever it lives).

- [ ] **Step 1: Move the files with `git mv`**

```bash
set -e
cd "$(git rev-parse --show-toplevel)"
mkdir -p migrations/feedback migrations/analytics
git mv migrations/0001_create_feedback.sql         migrations/feedback/
git mv migrations/0003_add_host_column.sql         migrations/feedback/
git mv migrations/0004_add_triage_columns.sql      migrations/feedback/
git mv migrations/0005_create_analytics_events.sql migrations/analytics/
git mv migrations/0006_create_backfill_state.sql   migrations/analytics/
```

`set -e` matters: without it a failed `git mv` carries on and commits a half-move.

- [ ] **Step 2: Find every reference to the migrations directory**

Run: `grep -rn "migrations" --include='*.json' --include='*.ts' --include='*.mjs' --include='*.yml' --include='*.md' . | grep -v node_modules | grep -v '^\./migrations/'`

Search for `migrations`, **not** `migrations/0`. The critical hit
(`vitest.workers.config.ts`) contains `path.join(__dirname, 'migrations')` with no
digit, so the narrower pattern misses it and the check reads as a clean pass.

Expected hits, all fixed in the next two steps: `package.json`,
`vitest.workers.config.ts`, `docs/FEEDBACK.md`, `docs/ANALYTICS.md`,
`docs/work/2026-08-04-analytics-range-chart-plan.md`.

- [ ] **Step 3: Repoint `vitest.workers.config.ts`**

`readD1Migrations` does **not** recurse — it is a flat
`readdirSync(...).filter(name => name.endsWith('.sql'))`. After the move,
`migrations/` holds only directories, so it returns `[]`, no migrations are
applied to the test database, and every spec in `tests/worker/` fails against an
empty D1.

Change line 24 from `path.join(__dirname, 'migrations')` to
`path.join(__dirname, 'migrations/analytics')`, and drop the now-redundant
`/^000[56]_/` filter on the following line.

- [ ] **Step 4: Update `package.json` e2e scripts**

```json
"e2e:db:feedback": "wrangler d1 execute clumeral-feedback --local --command=\"DROP TABLE IF EXISTS feedback;\" && wrangler d1 execute clumeral-feedback --local --file=migrations/feedback/0001_create_feedback.sql",
"e2e:db:analytics": "wrangler d1 execute clumeral-analytics --local --command=\"DROP TABLE IF EXISTS analytics_events; DROP TABLE IF EXISTS backfill_state;\" && wrangler d1 execute clumeral-analytics --local --file=migrations/analytics/0005_create_analytics_events.sql && wrangler d1 execute clumeral-analytics --local --file=migrations/analytics/0006_create_backfill_state.sql && wrangler d1 execute clumeral-analytics --local --file=tests/fixtures/analytics-seed.sql",
```

Note `e2e:db:feedback` deliberately applies **0001 only** — 0003 and 0004 are
`ALTER TABLE ADD COLUMN` for columns 0001 already creates, so they fail on a
fresh database. That is pre-existing behaviour; do not "fix" it by adding them.

- [ ] **Step 5: Fix the documentation links**

In `docs/FEEDBACK.md` and `docs/ANALYTICS.md`, update every `migrations/NNNN_*`
path to its new location. `docs/FEEDBACK.md:49` is a relative markdown link and
becomes a 404 otherwise.

- [ ] **Step 6: Prove nothing broke — both vitest projects and the local DB setup**

Run: `npm run e2e:db && npx vitest run`
Expected: both exit 0. The vitest run is the load-bearing check here — it is what
catches the `readD1Migrations` breakage, and Task 1 is the only place it can be
caught early.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor(migrations): one directory per database, for wrangler migrations_dir"
```

---

## Task 2: Destructive-SQL lint

Wrangler applies migrations; it does not judge them. This is the one piece we
write, and it touches **no database** — pure text analysis over the migration
directories.

**Files:**
- Create: `scripts/lint-migrations.mjs`
- Create: `tests/lint-migrations.spec.ts`

**Interfaces:**

```js
export function strip(sql)             // (string) => string   comments+quoted spans blanked
export function isDestructive(sqlText) // (string) => boolean
export function isDestructiveOptIn(filename) // (string) => boolean
export async function lint(dirs)       // (string[]) => Promise<string[]>  offending files
```

- [ ] **Step 1: Write the failing tests**

Create `tests/lint-migrations.spec.ts`:

```ts
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
});

describe('isDestructiveOptIn', () => {
  it('recognises the opt-in suffix', () => {
    expect(isDestructiveOptIn('0009_remove_x.destructive.sql')).toBe(true);
  });
  it('rejects an ordinary name', () => {
    expect(isDestructiveOptIn('0009_remove_x.sql')).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/lint-migrations.spec.ts`
Expected: FAIL — cannot resolve `../scripts/lint-migrations.mjs`.

- [ ] **Step 3: Write the lint**

Create `scripts/lint-migrations.mjs`:

```js
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
import path from 'node:path';

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
      while (i < sql.length && sql[i] !== ']') i++;
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

if (import.meta.url === `file://${process.argv[1]}`) {
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
```

`process.exitCode` rather than `process.exit()` — `process.exit` can truncate a
`console.error` write when stderr is a pipe, which it is in a build container,
leaving a red build with no message.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run tests/lint-migrations.spec.ts`
Expected: PASS — 15 tests.

- [ ] **Step 5: Prove it passes on the real migrations, then prove it can fail**

```bash
node scripts/lint-migrations.mjs migrations/feedback migrations/analytics; echo "clean exit=$?"
printf 'DROP TABLE feedback;\n' > migrations/feedback/9999_tmp.sql
node scripts/lint-migrations.mjs migrations/feedback migrations/analytics; echo "dirty exit=$?"
rm migrations/feedback/9999_tmp.sql
```

Expected: `clean exit=0`, then `dirty exit=1` naming the file. Both halves — a
lint that always passes is indistinguishable from a lint that never runs.

- [ ] **Step 6: Commit**

```bash
git add scripts/lint-migrations.mjs tests/lint-migrations.spec.ts
git commit -m "feat(migrations): destructive-SQL lint with a single-pass SQL tokeniser"
```

---

## Task 3: `env.preprod` and `migrations_dir`

**Files:**
- Modify: `wrangler.jsonc`
- Modify: `tests/wrangler-bindings.spec.ts`

Extend the existing spec rather than adding a second file — it already solves the
JSONC-parsing problem, and two comment-strippers with different regexes will
drift. Note it reads the config via `join(process.cwd(), 'wrangler.jsonc')`,
**not** `import.meta.url`: under the jsdom environment `import.meta.url` is not a
`file:` URL and `readFileSync` rejects it. The file documents this at lines 11-13.

- [ ] **Step 1: Write the failing tests**

Append to `tests/wrangler-bindings.spec.ts`:

```ts
describe('env.preprod', () => {
  const preprod = cfg.env?.preprod;

  // Keys wrangler does NOT inherit into an env block. Omitting one yields an
  // undefined binding and only a WARNING, so the deploy succeeds and the Worker
  // throws at runtime. Verified against wrangler's own `notInheritable` list.
  const NOT_INHERITED = ['d1_databases', 'kv_namespaces', 'analytics_engine_datasets', 'vars'];

  it('exists', () => {
    expect(preprod).toBeDefined();
  });

  it('restates every non-inheritable key the top level defines', () => {
    for (const key of NOT_INHERITED) {
      if (cfg[key] === undefined) continue;
      expect(preprod[key], `${key} is not inherited and must be restated`).toBeDefined();
    }
  });

  it('keeps the production Worker name, so preview URLs do not change', () => {
    expect(preprod.name).toBe(cfg.name);
  });

  it('has no placeholder ids anywhere in the file', () => {
    expect(readFileSync(join(process.cwd(), 'wrangler.jsonc'), 'utf8')).not.toMatch(/REPLACE_WITH/);
  });

  it('never binds a D1 database that production also binds', () => {
    const prod = Object.fromEntries(cfg.d1_databases.map((d) => [d.binding, d.database_id]));
    for (const d of preprod.d1_databases) {
      expect(d.database_id, `${d.binding} points at production`).not.toBe(prod[d.binding]);
    }
  });

  it('binds the same set of D1 bindings as production', () => {
    expect(preprod.d1_databases.map((d) => d.binding).sort())
      .toEqual(cfg.d1_databases.map((d) => d.binding).sort());
  });

  // Sharing is asserted POSITIVELY. Expressing it by omission is what made the
  // previous version of this plan encode a missing-binding bug as a passing test.
  it('shares the production PUZZLES namespace explicitly', () => {
    expect(preprod.kv_namespaces).toHaveLength(cfg.kv_namespaces.length);
    expect(preprod.kv_namespaces[0].id).toBe(cfg.kv_namespaces[0].id);
    expect(preprod.kv_namespaces[0].binding).toBe(cfg.kv_namespaces[0].binding);
  });

  it('shares the production Analytics Engine dataset explicitly', () => {
    expect(preprod.analytics_engine_datasets[0].dataset)
      .toBe(cfg.analytics_engine_datasets[0].dataset);
  });

  it('gives every D1 binding a migrations_dir, in both environments', () => {
    for (const d of [...cfg.d1_databases, ...preprod.d1_databases]) {
      expect(d.migrations_dir, `${d.binding} has no migrations_dir`).toMatch(/^migrations\//);
    }
  });

  it('labels each environment', () => {
    expect(cfg.vars.ENVIRONMENT).toBe('production');
    expect(preprod.vars.ENVIRONMENT).toBe('preprod');
  });

  it('gives preprod no cron triggers', () => {
    expect(preprod.triggers?.crons ?? []).toEqual([]);
  });

  it('leaves the production cron intact', () => {
    expect(cfg.triggers.crons).toContain('0 0 * * *');
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/wrangler-bindings.spec.ts`
Expected: FAIL — `preprod` undefined.

- [ ] **Step 3: Add `migrations_dir` and `vars` to the top level, and fix the analytics entry**

Add `"migrations_dir": "migrations/feedback"` to the `FEEDBACK_DB` entry. Replace
the whole `ANALYTICS_DB` entry — comment included, because its reasoning is now
wrong:

```jsonc
{
  // Analytics events, migrated off Analytics Engine.
  //
  // Prod and pre-prod have SEPARATE databases (see env.preprod below). The
  // earlier design shared one database across hostnames to avoid maintaining a
  // second migration target; wrangler's own migrations tooling removed that
  // cost, so they are now genuinely split and preview traffic can no longer
  // reach production analytics.
  //
  // The `hostname` column stays on analytics_events regardless: /stats filters
  // on it and it costs nothing. Do not remove it.
  "binding": "ANALYTICS_DB",
  "database_name": "clumeral-analytics",
  "database_id": "6e076e77-0937-4e3c-9756-3898a2b48ad6",
  "migrations_dir": "migrations/analytics"
}
```

Add at the top level, as a sibling of `triggers`:

```jsonc
"vars": { "ENVIRONMENT": "production" },
```

- [ ] **Step 4: Add `env.preprod`**

```jsonc
"env": {
  // Pre-prod: every non-production branch build. ONE shared environment, not one
  // per branch. Spec: docs/superpowers/specs/2026-08-05-clumeral-preprod-split-design.md
  //
  // ⚠️ `name` is DELIBERATELY the production name. Pre-prod is not a second
  // Worker — it is the same Worker, reached only by `wrangler versions upload`,
  // which uploads a version without deploying it. That keeps preview URLs
  // unchanged and keeps HMAC_SECRET (a per-Worker secret) available.
  //
  // ⚠️ THE FLIP SIDE: `wrangler deploy --env preprod` would OVERWRITE PRODUCTION.
  // Nothing in Cloudflare prevents it. Never deploy this environment.
  //
  // ⚠️ Every key below is one wrangler does NOT inherit from the top level
  // (d1_databases, kv_namespaces, analytics_engine_datasets, vars). Omitting one
  // gives an undefined binding and only a WARNING — the deploy succeeds and the
  // Worker throws at runtime. PUZZLES and the AE dataset are repeated here on
  // purpose: they are SHARED with production, and repeating them is how that is
  // expressed.
  "preprod": {
    "name": "clumeral-game",
    "vars": { "ENVIRONMENT": "preprod" },
    "d1_databases": [
      {
        "binding": "FEEDBACK_DB",
        "database_name": "clumeral-feedback-preprod",
        "database_id": "b46da472-0b93-4d1d-bb2f-a5480830d3aa",
        "migrations_dir": "migrations/feedback"
      },
      {
        "binding": "ANALYTICS_DB",
        "database_name": "clumeral-analytics-preprod",
        "database_id": "789714c9-307b-45cf-baba-b219807d09d8",
        "migrations_dir": "migrations/analytics"
      }
    ],
    // SHARED with production, restated because it is not inherited. Safe because
    // PUZZLES entries are write-once and src/worker/daily-puzzle.ts (#257) gives
    // write authority to the cron alone — and a version that is never deployed
    // never runs scheduled(). Anything that later gives pre-prod a deployment
    // with a cron must give it its own namespace in the same change.
    "kv_namespaces": [{ "binding": "PUZZLES", "id": "d07cfc9a455943e3839967475925a468" }],
    // SHARED, restated for the same reason. Not split because the dataset is
    // being retired by migrations 0005/0006.
    "analytics_engine_datasets": [{ "binding": "ANALYTICS", "dataset": "clumeral" }],
    // Belt-and-braces only: triggers attach to a DEPLOYMENT, and pre-prod
    // versions are never deployed.
    "triggers": { "crons": [] }
  }
}
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run tests/wrangler-bindings.spec.ts`
Expected: PASS.

- [ ] **Step 6: Prove wrangler resolves the environment as intended**

```bash
npx wrangler deploy --env preprod --dry-run --outdir /tmp/preprod-dryrun
```

Expected: exits 0 and the printed bindings list shows `clumeral-feedback-preprod`
and `clumeral-analytics-preprod`, plus `PUZZLES` and `ANALYTICS`. **Read the
binding list — do not accept the exit code alone.** A missing non-inheritable key
produces a warning and still exits 0; the binding simply will not be listed.
`--dry-run` deploys nothing.

- [ ] **Step 7: Commit**

```bash
git add wrangler.jsonc tests/wrangler-bindings.spec.ts
git commit -m "feat(config): preprod environment sharing the Worker, with its own D1 databases"
```

---

## Task 4: npm scripts

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add the scripts**

```json
"lint:migrations": "node scripts/lint-migrations.mjs migrations/feedback migrations/analytics",
"migrate:prod": "npm run lint:migrations && npx wrangler d1 migrations apply FEEDBACK_DB --remote && npx wrangler d1 migrations apply ANALYTICS_DB --remote",
"migrate:preprod": "npm run lint:migrations && npx wrangler d1 migrations apply FEEDBACK_DB --remote --env preprod && npx wrangler d1 migrations apply ANALYTICS_DB --remote --env preprod",
```

Three deliberate details:

- `--env preprod` **is** correct here. These commands read the source
  `wrangler.jsonc` at the repo root, which has `env` blocks — unlike the
  generated `dist/clumeral_game/wrangler.json` that the upload step reads.
- The lint runs **first**, so a destructive migration is refused before anything
  touches a database.
- `&&` throughout: a failure anywhere fails the whole command, so no version is
  uploaded and no deploy happens.

- [ ] **Step 2: Verify the lint gate fires without any database access**

```bash
printf 'DROP TABLE feedback;\n' > migrations/feedback/9999_tmp.sql
npm run lint:migrations; echo "exit=$?"
rm migrations/feedback/9999_tmp.sql
```

Expected: `exit=1`. Do **not** run `migrate:preprod` locally to test this — it
would attempt a remote D1 command, which the guard hook blocks and which the bot
has no credentials for. The lint is the only part of that chain that can be
exercised here, and it is the only part we wrote.

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "feat(scripts): lint:migrations, migrate:prod and migrate:preprod"
```

---

## Task 5: Baseline SQL for both feedback databases

`0003` and `0004` are `ALTER TABLE … ADD COLUMN` for columns `0001` already
creates. They exist only for the remote D1 that predates them, and they **fail on
a fresh database** with `duplicate column name`. So:

- **production** `clumeral-feedback` — 0001, 0003, 0004 are all already applied by
  hand. Record all three.
- **pre-prod** `clumeral-feedback-preprod` — brand new. Record 0003 and 0004 as
  applied *without running them*, so the first migration run applies 0001 alone.

Both analytics databases need nothing: 0005 and 0006 are
`CREATE TABLE IF NOT EXISTS` and apply cleanly from scratch.

These are remote writes, so the bot does not run them. Jamie pastes them into the
D1 console (Storage & Databases → D1 → *database* → Console).

**Files:**
- Create: `docs/baseline-clumeral-feedback.sql`
- Create: `docs/baseline-clumeral-feedback-preprod.sql`

- [ ] **Step 1: Write the production baseline**

`docs/baseline-clumeral-feedback.sql`:

```sql
-- ONE-OFF. Production `clumeral-feedback` only, in the Cloudflare D1 console,
-- BEFORE the first automatic production migration run.
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
```

- [ ] **Step 2: Write the pre-prod baseline**

`docs/baseline-clumeral-feedback-preprod.sql`:

```sql
-- ONE-OFF. `clumeral-feedback-preprod` only, in the Cloudflare D1 console,
-- BEFORE the first pre-prod branch build.
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
```

- [ ] **Step 3: Note in the pull request that both baselines are ALREADY DONE**

**✅ Both were run by Jamie in the D1 console on 2026-08-05 and verified:**
`clumeral-feedback` returns exactly `0001_create_feedback.sql`,
`0003_add_host_column.sql`, `0004_add_triage_columns.sql`;
`clumeral-feedback-preprod` returns exactly `0003_add_host_column.sql`,
`0004_add_triage_columns.sql` (no `0001` — deliberately, so it runs).

The two `.sql` files are still committed, as the record of what was applied and
for a rebuild. **Do not ask Jamie to run them again**, and do not raise them as a
merge blocker. Say this in the pull request description instead:

> Migration-ledger baselines were applied on 2026-08-05 and verified (3 rows in
> `clumeral-feedback`, 2 in `clumeral-feedback-preprod`). `docs/baseline-*.sql`
> are committed as the record. No action needed before merge.

- [ ] **Step 4: Commit**

```bash
git add docs/baseline-clumeral-feedback.sql docs/baseline-clumeral-feedback-preprod.sql
git commit -m "docs: one-off migration-ledger baselines for both feedback databases"
```

---

## Task 6: Confine the Analytics Engine backfill to production

**Files:**
- Modify: whichever module owns the backfill entry point
- Test: alongside that module

- [ ] **Step 1: Find it**

Run: `grep -rn "backfill" src/ --include='*.ts'`

At the time of writing this returns only comment references — there is no
`backfill_state` read or write and no `runBackfill`. **If that is still true, do
Step 2 only and stop.** The `ENVIRONMENT` vars it depends on are already added in
Task 3, so nothing is left dangling either way.

- [ ] **Step 2: Record the requirement where the implementer will see it**

Add to the comment block at the top of `migrations/analytics/0006_create_backfill_state.sql`:

```sql
-- ⚠️ The backfill MUST run in production only. Gate it on env.ENVIRONMENT ===
-- 'production'. An unset value must mean NO — absence of a signal is not
-- permission. Pre-prod importing real Analytics Engine history would make its
-- numbers useless for testing, silently.
```

- [ ] **Step 3: If the backfill does exist, write the failing test and the guard**

```ts
import { describe, it, expect } from 'vitest';
import { shouldBackfill } from '../src/worker/<module>.ts';

describe('shouldBackfill', () => {
  it('runs in production', () => {
    expect(shouldBackfill({ ENVIRONMENT: 'production' })).toBe(true);
  });
  it('does not run in pre-prod', () => {
    expect(shouldBackfill({ ENVIRONMENT: 'preprod' })).toBe(false);
  });
  it('does not run when the environment is unset', () => {
    expect(shouldBackfill({})).toBe(false);
  });
});
```

```ts
export function shouldBackfill(env: { ENVIRONMENT?: string }): boolean {
  return env.ENVIRONMENT === 'production';
}
```

Call it at the top of the backfill entry point and return early when false.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(analytics): confine the AE backfill to production"
```

---

## Task 7: Documentation

**Files:**
- Modify: `CLAUDE.md`
- Create: `docs/superpowers/specs/2026-08-05-clumeral-preprod-split-design.md`
- Create: `docs/superpowers/plans/2026-08-05-clumeral-preprod-split.md`

- [ ] **Step 1: Add to `CLAUDE.md`**

```markdown
## Environments and database migrations

**One Worker, two environments.** Pre-prod is not a second Worker — it is the same
`clumeral-game` Worker, and pre-prod builds are *versions* of it, uploaded but
never deployed. That is why preview URLs are unchanged and why `HMAC_SECRET` (a
per-Worker secret) is available in both.

- **production** — the `main` branch. `clumeral-feedback`, `clumeral-analytics`,
  the daily cron.
- **preprod** — every other branch, sharing one environment.
  `clumeral-feedback-preprod`, `clumeral-analytics-preprod`.

`PUZZLES` KV and the Analytics Engine dataset are **shared** by both, and are
restated in `env.preprod` because wrangler does not inherit them. Sharing PUZZLES
is safe only because pre-prod versions are never deployed and so never run
`scheduled()`, and the cron is the sole writer (`src/worker/daily-puzzle.ts`,
#257).

**To add a table or column:** drop a `.sql` file into `migrations/feedback/` or
`migrations/analytics/` — the directory chooses the database, via `migrations_dir`
in `wrangler.jsonc`. Number it after the highest existing migration, across both
directories. `wrangler d1 migrations apply` applies it automatically: to pre-prod
when your branch builds, to production when the pull request merges. Nobody runs
a command.

**Rules:**
- **Never run wrangler against a remote database.** The guard hook blocks
  `wrangler d1 … --remote` and that is correct. Use `--local`.
- **Never `wrangler deploy --env preprod`.** Both environments share the Worker
  name, so it would overwrite production. Pre-prod is reached only by
  `versions upload`.
- **Migrations are additive only.** They run before the new version is live, so
  they must leave the currently-deployed code working. Add columns and tables;
  never drop or rename in the same pull request as the code that stops using them.
- **Destructive SQL is refused** by `npm run lint:migrations` unless the file is
  named `*.destructive.sql`. Only Jamie adds one. `UPDATE … SET` is allowed —
  backfilling a new column is additive.
- **Adding a new wrangler binding?** It must be added to `env.preprod` too.
  `d1_databases`, `kv_namespaces`, `analytics_engine_datasets` and `vars` are
  **not inherited** by an env block, and omitting one is only a warning — the
  deploy succeeds and the Worker throws at runtime.
- Creating a new *database* is still a human step. Declare the binding and say so
  in the pull request.
```

- [ ] **Step 2: Add the spec and this plan under `docs/superpowers/`**

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md docs/superpowers
git commit -m "docs: environment layout, migration rules, and the pre-prod split spec"
```

---

## Task 8: Open the pull request

- [ ] **Step 1: Full check**

Run: `npm run lint:migrations && npm run e2e:db && npx vitest run && npx tsc --noEmit && npx wrangler deploy --env preprod --dry-run --outdir /tmp/preprod-dryrun`

Expected: all succeed. Note `tsc --noEmit` covers `src/` only — `tsconfig.json`
does not include `tests/` or `scripts/` — so it is **not** evidence about the new
files. Vitest is what exercises those.

- [ ] **Step 2: Open the pull request — TARGET `dev/analytics-range-chart`**

**Not `staging`, not `main`.** This work unblocks that branch: its
`ANALYTICS_DB` id is a placeholder, so it cannot preview-deploy until the split
lands. Branching from it and merging back keeps the split a reviewable diff on
its own while putting it where it is needed, and avoids rebasing a five-file
`git mv` across an active branch.

**Jamie merges this one himself.** A pull request into a `dev/` branch is not
covered by the rulesets that protect `main` and `staging`, so the bot could
otherwise self-merge — which would bypass the review gate that is the whole
containment model. Do not merge it.

The description must carry, in this order:

1. That both migration-ledger baselines are **already applied and verified**
   (Task 5 Step 3) — no action needed before merge.
2. The dashboard command changes, and that they are applied in **two separate
   stages**, not together:
   - **Stage A, after this merges:** Version command only →
     `CLOUDFLARE_ENV=preprod npm run build && npm run migrate:preprod && cd dist/clumeral_game && npx wrangler versions upload --config wrangler.json`
   - **Stage B, only after a preview write is confirmed to land in
     `clumeral-feedback-preprod` and NOT in `clumeral-feedback`:** Deploy command
     → `npm run migrate:prod && npm run deploy`
   - Build command: unchanged in both stages.
   Deploy and Version are independent fields and fire on different branches, so
   pre-prod can be proven with production untouched. Do not change both at once.
3. That `CLOUDFLARE_ENV` — not `--env` — is what switches the build, because the
   generated `dist/clumeral_game/wrangler.json` is flattened and has no `env` key.
   A `--env` flag there is a silent no-op that ships production bindings.
4. That the Version command must not be changed **before** this merges — until
   `env.preprod` exists, `CLOUDFLARE_ENV=preprod` points at nothing and branch
   builds break.

---

## Verification — after the dashboard change, not before

- [ ] Push a throwaway branch. Assert the preview URL is still
      `<branch>-clumeral-game.jevawin.workers.dev`.
- [ ] Submit feedback from that preview. Assert the row **exists** in
      `clumeral-feedback-preprod` **and does not exist** in `clumeral-feedback`.
      Both halves — presence in pre-prod does not prove absence from production.
- [ ] Open `/stats` on the preview URL and assert it reads pre-prod.
- [ ] Re-run the same branch build with no new migrations. Assert
      `d1 migrations apply` reports nothing to apply.
- [ ] Merge to `main`. Assert production migrations apply and `d1_migrations` in
      `clumeral-feedback` holds exactly the three baselined rows.
- [ ] **Only once all of the above pass**, Jamie runs the production cleanup in
      the D1 console: `DELETE FROM feedback WHERE host <> 'clumeral.com';`.
      Earlier is pointless — previews would still be writing to production.
