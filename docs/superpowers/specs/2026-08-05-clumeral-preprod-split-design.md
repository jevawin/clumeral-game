# Split pre-prod from prod on Cloudflare — design (v2)

**Date:** 2026-08-05 (v2 after adversarial review — v1 is in git history and had
four fatal defects; see §9)
**Repo this belongs to:** `jevawin/clumeral-game`. Commit to that repo's
`docs/superpowers/specs/`.
**Status:** design, approved 2026-08-05.

---

## 1. Problem

Cloudflare Workers Builds is connected to `jevawin/clumeral-game`:

| Setting | Value |
|---|---|
| Build command | `npm install && npm run build` |
| Deploy command (production branch `main`) | `npm run deploy` |
| Version command (non-production branches) | `cd dist/clumeral_game && npx wrangler versions upload --config wrangler.json` |
| Builds for non-production branches | Enabled |
| Preview URLs | `<branch>-clumeral-game.jevawin.workers.dev` |

`wrangler.jsonc` declares **one** binding set and **no `env` blocks**: `PUZZLES`
KV, `FEEDBACK_DB`, `ANALYTICS_DB` (id still a placeholder), the `clumeral`
Analytics Engine dataset, and a daily cron.

**Consequence:** a version uploaded from a branch carries the bindings of the
config it was built from. There is only one such set, and it is production's. So
**every branch preview reads and writes the production D1 and KV.**

Two problems follow:

1. **Reviewing a branch deploy protects production code, not production data.**
   By the time the preview URL is opened, its writes have already landed live.
2. **The dev bot cannot ship a feature needing a new table** without a human
   running a remote `wrangler d1` command.

## 2. Goals

1. A branch preview can never read or write production data.
2. A schema change ships end-to-end from a bot pull request — no human command,
   **no Cloudflare credential issued to the bot**.
3. Exactly one shared pre-prod environment.

## 3. Non-goals

- Per-branch isolated databases.
- A Cloudflare API token for the dev bot.
- Any change to the GitHub containment model. It is proven and stays.
- Automating creation of new D1 *databases*. That stays a human act.
- A separate pre-prod Worker. See §4.1.

## 4. Design

### 4.1 One Worker, two environments

Pre-prod is **not** a second Worker. It is the same `clumeral-game` Worker, and
pre-prod builds are **versions** of it — which is what `wrangler versions upload`
already produces today. A version is uploaded but not deployed, so production
keeps serving whatever was last deployed.

`wrangler.jsonc` gains `env.preprod` with **`"name": "clumeral-game"` set
explicitly**, so the environment does not acquire the automatic `-preprod` name
suffix.

Consequences, all of which simplify the design:

- **Secrets are shared.** `HMAC_SECRET` is a per-Worker secret; a separate
  pre-prod Worker would not have it, and its absence fails *silently* —
  `TextEncoder.encode(undefined)` yields `""`, making the key `SHA-256("")` and
  every signed token forgeable. One Worker removes that failure entirely.
- **Preview URLs are unchanged** (`<branch>-clumeral-game.jevawin.workers.dev`),
  so there is no URL migration and no DNS-label length concern.
- **The cron cannot run in pre-prod by construction.** Triggers attach to a
  *deployment*, not to an uploaded version. Pre-prod versions are never deployed.
  `env.preprod` still sets `"triggers": { "crons": [] }` as belt-and-braces, but
  that is not the mechanism.

> **⚠️ Footgun this introduces.** Both environments share a Worker name, so
> `wrangler deploy --env preprod` would **overwrite production**. Nothing in
> Cloudflare prevents it. Pre-prod must only ever be reached by
> `versions upload`. State this in the config comment and in `CLAUDE.md`.

**Verified:** wrangler 4.80.0 accepts an explicit `name` inside an `env` block
and resolves that environment's bindings (dry-run, 2026-08-05).
**Not verified:** that the resulting Worker name is unsuffixed — the dry-run does
not print it. Confirm by observation on the first pre-prod build.

### 4.2 Non-inheritable keys must be repeated

**This is the defect that killed v1 and it is not obvious.** A wrangler `env`
block does **not** inherit these keys from the top level — verified against
wrangler's own source (`notInheritable`, `cli.js:4049-4070`, `4966`/`5029`/
`5089`/`5149`):

- `d1_databases`
- `kv_namespaces`
- `analytics_engine_datasets`
- `vars`

Omitting one yields **`undefined`**, and wrangler emits only a **warning**, not
an error — so the deploy succeeds and the binding is simply missing at runtime.
`src/worker/index.ts` uses `env.PUZZLES` and `env.ANALYTICS`, so an omitted
binding means every puzzle request and every `/api/event` throws.

⇒ `env.preprod` must **repeat** `kv_namespaces` (same `PUZZLES` id — sharing is
intended, see §4.5) and `analytics_engine_datasets` (same dataset), and declare
its own `d1_databases` and `vars`.

⇒ Sharing must be asserted **positively** in a test (`preprod id === prod id`),
never expressed by omission. v1 encoded the bug as a passing test.

`triggers`, `assets`, `name`, `main` and `compatibility_date` **are** inheritable.

### 4.3 The environment switch is a BUILD-time variable

The deploy commands run against `dist/clumeral_game/wrangler.json` — the config
**generated by `@cloudflare/vite-plugin`**, already flattened for one
environment, with no `env` key at all. Passing `--env preprod` to a command
reading that file is a **silent no-op**: wrangler treats a missing env as a
warning when `rawConfig.env` is absent, appends a name suffix, and uploads with
**production bindings** — looking exactly like success.

The plugin reads **`CLOUDFLARE_ENV`** during config resolution. So the switch
belongs on the build, not on wrangler:

```
Deploy  (main):     npm run migrate:prod && npm run deploy
Version (branches): CLOUDFLARE_ENV=preprod npm run build \
                    && npm run migrate:preprod \
                    && cd dist/clumeral_game && npx wrangler versions upload --config wrangler.json
```

**Two different mechanisms, deliberately — do not "unify" them:**

- The **build** uses `CLOUDFLARE_ENV`, because it consumes the generated config.
- The **migration** step uses `--env preprod`, because it reads the *source*
  `wrangler.jsonc` at the repo root, which does have `env` blocks.

### 4.4 Migrations: wrangler's own, not a hand-rolled runner

v1 hand-rolled a migration runner. Wrangler already has one:
`wrangler d1 migrations create | list | apply`, with a per-D1-binding
**`migrations_dir`** and a ledger table (`migrations_table`, default
`d1_migrations`, DDL `id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE,
applied_at TIMESTAMP …`). Verified in the installed wrangler 4.80.0.

Using it deletes an entire class of defects that adversarial review found in the
hand-rolled version: SQL injection through migration filenames, lexicographic
ordering bugs, a concurrency "lock" that was only bookkeeping, fragile `--json`
parsing, and a baseline probe that would have falsely refused an empty database.

- `migrations_dir` is set **per D1 binding**: `migrations/feedback` for
  `FEEDBACK_DB`, `migrations/analytics` for `ANALYTICS_DB`. Directory membership
  is the database mapping — a manifest can be forgotten, a directory cannot.
- Applying is `npx wrangler d1 migrations apply <BINDING> --remote [--env preprod]`.
- Running inside Cloudflare's builder means **Cloudflare's own credentials** do
  it. The bot never holds one, and its guard hook's block on
  `wrangler d1 … --remote` stays exactly as it is.

**What we still write ourselves: a destructive-SQL lint.** A pure function over
the migrations directories, run as its own npm script with **no database
access**. It refuses `DROP TABLE/INDEX/VIEW/TRIGGER/COLUMN`, `DELETE FROM`,
`TRUNCATE`, `RENAME TO`/`RENAME COLUMN`, `REPLACE INTO`/`INSERT OR REPLACE`,
`PRAGMA writable_schema` and `ATTACH DATABASE`, unless the filename ends
`.destructive.sql`.

- Comments and quoted spans must be recognised in **one left-to-right pass**.
  Stripping comments before strings lets `VALUES ('a--b'); DROP TABLE feedback;`
  hide a real drop; handling only single quotes makes `CREATE TABLE "drop table"`
  a false positive. Both directions need tests.
- Bare `UPDATE … SET` is deliberately **not** blocked: backfilling a
  newly-added column is a legitimate additive pattern, and blocking it would turn
  routine migrations into failed deploys.

**Additive-only rule.** Migrations run *before* the new version is live, so a
migration must leave the currently-deployed code working. Add columns and tables;
never remove or rename in the same pull request as the code that stops using
them.

### 4.5 KV — `PUZZLES` is shared, and must be repeated to stay shared

Pre-prod gets no `PUZZLES` namespace of its own and needs no seeding script, but
per §4.2 the binding must be **restated** in `env.preprod` with the same id.

Safe because `src/worker/daily-puzzle.ts` (#257) already gives write authority to
the cron alone: `readDailyPuzzle` (request path) generates ephemerally on a miss
and never writes; `ensureDailyPuzzle` (cron path) is the only writer, called only
from `scheduled`. Pre-prod versions are never deployed and so never run
`scheduled`. Anything that later gives pre-prod a deployment with a cron must
give it its own namespace in the same change.

### 4.6 Analytics

- The `ANALYTICS_DB` placeholder is replaced by **two** real ids.
  `clumeral-analytics` has never existed remotely — only locally, via
  `npm run e2e:db:analytics` — so there is nothing to untangle.
- The `wrangler.jsonc` comment justifying one shared analytics database becomes
  **wrong** once split. Rewrite it in the same change.
- The Analytics Engine **dataset** is *not* split — it is being retired by
  migrations 0005/0006, so splitting a resource on its way out is work with no
  lifetime. Per §4.2 it must still be **repeated** in `env.preprod`.
- The AE → D1 **backfill runs against production only.** Pre-prod must never
  import real history. Gate it on `ENVIRONMENT`, and make an unset value mean
  **no** — absence of a signal is not permission.
- The `hostname` column on `analytics_events` stays. Now belt-and-braces rather
  than the isolation mechanism, but `/stats` filters on it.

### 4.7 Baselining — BOTH environments, not just production

v1 claimed the new databases needed no baseline. That was wrong.
`0001_create_feedback.sql` already creates `host`, `status`, `github_issue` and
`resolved_at`; `0003` and `0004` are `ALTER TABLE … ADD COLUMN` for those same
columns, kept for the remote D1 that predates them. On a **fresh** database,
0001 then 0003 fails with `duplicate column name`. The repo documents this in
`vitest.workers.config.ts:19-23`.

| Database | Baseline needed | Rows to insert into `d1_migrations` |
|---|---|---|
| `clumeral-feedback` (prod) | yes | `0001`, `0003`, `0004` — all already applied by hand |
| `clumeral-feedback-preprod` | yes | `0003`, `0004` — so the first run applies 0001 only |
| `clumeral-analytics` (prod) | no | empty; 0005/0006 are `CREATE TABLE IF NOT EXISTS` |
| `clumeral-analytics-preprod` | no | as above |

Baselining is a **remote write**, so the bot does not do it. Jamie pastes the SQL
into the D1 console. Both feedback baselines must be done **before** the first
build that runs migrations.

### 4.8 Bot-facing documentation

`CLAUDE.md` gains the environment layout, "add a migration file and it is applied
for you", "never run wrangler against a remote database", the additive-only rule,
the destructive-SQL naming convention, and the §4.1 footgun. Instruction goes in
the repo, not into a chat message.

## 5. Prerequisite — the base branch

Migrations 0005/0006, the `ANALYTICS_DB` binding, the split `e2e:db:*` scripts,
`vitest.workers.config.ts` and `tests/worker/` exist **only on
`dev/analytics-range-chart`**, not on `staging` or `main`. This work must branch
from it, or that branch must land first. It is a hard prerequisite, not a
rebase hazard.

## 6. Risks

1. **A non-inheritable key is forgotten** → a missing binding, a warning nobody
   reads, and a runtime throw. Mitigated by a test asserting every top-level
   binding key is present in `env.preprod`.
2. **`wrangler deploy --env preprod` overwrites production** (§4.1). Mitigated by
   documentation only. There is no technical guard; say so plainly.
3. **`CLOUDFLARE_ENV` omitted from the version command** → previews silently
   return to production bindings. Mitigated by the §7 verification, which asserts
   a write does *not* reach production.
4. **Moving migration files breaks `readD1Migrations`**, which does not recurse.
   `vitest.workers.config.ts` must be repointed in the same change.

## 7. Verification

Every check is a **positive assertion**. A clean deploy proves nothing; an
isolation failure is silent by construction.

1. Submit feedback from a preview URL. Assert the row **exists** in
   `clumeral-feedback-preprod` **and does not exist** in `clumeral-feedback`.
   Both halves — presence in pre-prod does not prove absence from prod.
2. Assert the preview URL scheme is unchanged and the Worker name is unsuffixed.
3. Assert `/stats` from a preview URL reads pre-prod.
4. Re-run a branch build with no new migrations; assert `migrations apply`
   reports nothing to apply.
5. Assert the destructive lint rejects a `DROP TABLE` file not named
   `.destructive.sql`, and accepts one that is.
6. Assert the lint is not fooled by `VALUES ('a--b'); DROP TABLE feedback;` and
   does not false-positive on `CREATE TABLE "drop table"`.
7. Merge to `main`; assert production migrations apply and `d1_migrations` in
   `clumeral-feedback` holds exactly the three baselined rows.
8. **Only after all of the above pass**, Jamie runs the production cleanup:
   `DELETE FROM feedback WHERE host <> 'clumeral.com';`. Earlier is pointless —
   previews would still be writing to production and the table would refill.

## 8. Sequencing

| Phase | Owner | Work |
|---|---|---|
| 0 | Jamie | Land or branch from `dev/analytics-range-chart`. Baseline both feedback databases (§4.7). |
| 1 | Dev bot | Pull request: `env.preprod`, `migrations_dir`, destructive lint, config tests, doc updates. |
| 2 | Jamie | Change the deploy and version commands in the dashboard (§4.3). |
| 3 | Both | §7 verification. |

## 9. What v1 got wrong

Recorded so the same ground is not re-covered:

1. Assumed `--env` on the *generated* config would switch environments. It is a
   silent no-op; `CLOUDFLARE_ENV` at build time is the real mechanism.
2. Assumed `env` blocks inherit bindings. They do not — and v1 codified that
   error as a passing test asserting `preprod.kv_namespaces` was undefined.
3. Planned against a base state that exists only on an unmerged branch.
4. Claimed fresh databases need no baseline; 0003/0004 fail on a fresh database.
5. Hand-rolled a migration runner that wrangler already provides, and the
   hand-rolled version carried injection, ordering and concurrency defects.
6. Proposed a separate pre-prod Worker, which would have silently lost
   `HMAC_SECRET` and produced forgeable tokens.

The common thread: **behaviour was inferred from config files rather than
confirmed against the tool.** Every claim in v2 that concerns wrangler's
behaviour cites either its source or a dry-run, or is explicitly marked
unverified.
