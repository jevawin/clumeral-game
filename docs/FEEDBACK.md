# Feedback

Where player feedback lives, how to read it, and the process for acting on it.

## Where it lives

Feedback is stored in **Cloudflare D1** (SQLite), database `clumeral-feedback`.

- Worker binding: `FEEDBACK_DB` ([wrangler.jsonc](../wrangler.jsonc))
- Database id: `4ecc6c31-c26c-4652-a1ae-7d1746bd816d`
- Migrated from the old Google Apps Script → Google Sheet webhook in [#213](https://github.com/jevawin/clumeral-game/issues/213) (2026-06). The Apps Script path is gone — don't assume feedback goes to a Sheet anymore.

## How it's submitted

Players submit through the feedback modal ([src/modals.ts](../src/modals.ts)).

1. The client gathers browser/storage context with `collectDebug()`.
2. It POSTs to `/api/feedback` — a **public** route ([src/worker/index.ts](../src/worker/index.ts)).
3. The Worker validates and caps the fields, then inserts one row. `host` is set server-side from the request hostname (drives the test-vs-real filter below).

## How to read it

Two ways.

### 1. Admin dashboard (normal use)

`GET https://clumeral.com/feedback`

- **Private.** Protected at the edge by Cloudflare Access (Zero Trust) on the `/feedback` path — there's no auth in code, it's an unlinked private dashboard.
- Newest first. Each row has a **Diagnostics** expander: host, userAgent, screen, tzOffset, localToday, history, prefs, active.
- Each row also has a triage footer: status badge, linked GitHub issue (if any), and a **Resolve** / **Reopen** button.
- `?all=1` — include test/preview rows (`*.workers.dev` / `localhost`). Default shows only production (`host = clumeral.com` or NULL).
- `?status=all` — include resolved rows. **Default hides them**, so the dashboard opens on the outstanding queue.
- `?limit=N` — rows to show (default 200, max 500).

### 2. Query D1 directly (read-only, safe)

```bash
wrangler d1 execute clumeral-feedback --remote --command \
  "SELECT id, created_at, category, message FROM feedback ORDER BY id DESC LIMIT 20;"
```

- `--remote` = production. `--local` = your local dev DB (seed it first with `npm run e2e:db`).
- To pull a debug payload for one row: `SELECT id, message, history, tz_offset, local_today, screen FROM feedback WHERE message LIKE '%streak%';`
- Reading is safe. **Never run `wrangler deploy`** — deployment is automatic on merge to `main`.

## Schema

Table `feedback` ([migrations/feedback/0001_create_feedback.sql](../migrations/feedback/0001_create_feedback.sql)):

| Column | Type | Notes |
|--------|------|-------|
| `id` | INTEGER | Primary key, autoincrement |
| `created_at` | TEXT | Defaults to `datetime('now')` |
| `category` | TEXT | `general` / `bug` / `praise` / `suggestion` / `other` (unknown → `other`) |
| `message` | TEXT | The player's feedback text |
| `puzzle_number` | TEXT | e.g. `#86` |
| `puzzle_date` | TEXT | `YYYY-MM-DD` |
| `device` | TEXT | iPhone / Android Phone / Desktop / iPad … |
| `browser` | TEXT | e.g. `Chrome 148.0.0.0` |
| `user_agent` | TEXT | Raw `navigator.userAgent` (capped 512) |
| `history` | TEXT | Raw `dlng_history` JSON, unparsed (capped 8192) |
| `prefs` | TEXT | Raw `dlng_prefs` JSON (capped 4096) |
| `active` | TEXT | Raw `dlng_active` JSON — mid-game state, if any (capped 4096) |
| `tz_offset` | INTEGER | `getTimezoneOffset()` minutes |
| `local_today` | TEXT | Player's local date key |
| `screen` | TEXT | Viewport size, e.g. `411x757` |
| `host` | TEXT | Request hostname, server-set. `clumeral.com` = real; `*.workers.dev` / `localhost` = test |
| `status` | TEXT | `open` (default) or `resolved`. Nothing else is accepted |
| `github_issue` | INTEGER | The issue this row produced, if any |
| `resolved_at` | TEXT | Set when a row is resolved, cleared when reopened |

The debug fields are individual columns, not one JSON blob. No PII is collected.

## Triage state (#225)

**Two states only: `open` and `resolved`.** Richer outcomes — wontfix, duplicate, in
progress — are carried by the **linked GitHub issue's own state**, not duplicated here.
One place to be wrong is better than two that disagree.

Existing rows were backfilled to `open` by the migration itself — `ADD COLUMN status TEXT
NOT NULL DEFAULT 'open'` sets every row as part of the ALTER, so `status` can never be
NULL. The Worker's filter is still written `status IS NULL OR status <> 'resolved'`: bare
`status <> 'resolved'` is NULL-not-true in SQL, so an unexpected value would *hide* a row
rather than surface it. Anything unrecognised falls **open**, staying visible in the queue.

`github_issue` is the important column. It's what tells "already filed as #271" from
"never seen", so follow-up feedback about the same thing can join an existing ticket
instead of opening a duplicate. Set it whenever you file an issue from a row.

### Changing status

From the dashboard, click **Resolve** / **Reopen**. That posts to
`POST /feedback/:id/status`.

Three things about that route are deliberate and easy to break:

- **It only works on `clumeral.com` and `localhost`.** Everywhere else it 404s. This is
  not an authentication measure — Access *does* cover `workers.dev` hosts when the policy
  pattern matches them.

  It *was* data isolation: there used to be a single D1 binding and no environment
  override, so every preview deploy wrote to the **production** feedback database and a
  signed-in admin resolving rows from a preview would have been mutating real triage
  state. **That is no longer true.** `env.preprod` in [wrangler.jsonc](../wrangler.jsonc)
  binds every non-production branch to `clumeral-feedback-preprod`, which is what
  [#260](https://github.com/jevawin/clumeral-game/issues/260) asked for. The host gate now
  stands on its own merits — it keeps the admin surface to one known origin — rather than
  as a stand-in for isolation.

  On production it additionally requires the `Cf-Access-Jwt-Assertion` header, so the
  route fails closed if the Access app is ever removed or re-scoped.
- **It lives under `/feedback`, not `/api/feedback`.** Cloudflare Access gates the
  `/feedback` path; `POST /api/feedback` is deliberately **public** so players can submit.
  A write route under the `api` prefix would inherit the public rule. Don't move it.
- **It requires a same-origin `Origin` header.** Access proves who the caller is, not
  which page made the request — a signed-in admin's browser can be induced to POST from
  an attacker's page. A missing header is rejected too; the only legitimate caller is the
  dashboard's own form. Note this only proves a request *is* same-origin, never *which*
  origin, so it is worth nothing without the host gate above.

Consequence worth knowing: **you cannot test Resolve/Reopen from a preview URL** — the
host gate 404s it there. Use localhost, or production after merge. The reason is now the
host gate alone; a preview's writes would land in `clumeral-feedback-preprod`, not in
production.

## The dashboard is production-only

`GET /feedback` on any non-canonical host **302s to `https://clumeral.com/feedback`**.
Preview deploys never render it.

Access is still the primary gate, but it is configured per hostname *pattern*, and preview
hostnames are open-ended — a URL exists for every branch ever pushed. On **2026-07-22** a
policy covering `*-clumeral-game.jevawin.workers.dev` left the bare
`clumeral-game.jevawin.workers.dev` serving 12 live submissions, diagnostics included, to
anyone who asked. The wildcard needed something before the hyphen.

The redirect needs no pattern, so a new branch name cannot outrun it. Keep both: the
redirect is the backstop, Access is the gate.

**Two policy shapes to get right**, because neither is covered by the code:

- `*.clumeral.com` does **not** match the apex `clumeral.com`. The canonical dashboard
  needs its own entry — this is the one that matters, since the redirect points *at* it.
- `*-clumeral-game.jevawin.workers.dev` does not match the bare
  `clumeral-game.jevawin.workers.dev`.

If Access is missing on the apex, `Cf-Access-Jwt-Assertion` never arrives and
**Resolve/Reopen returns 403 in production** — fail-closed by design, but it looks like a
broken button. Check the policy first.

To verify coverage from the terminal — a `302` to `cloudflareaccess.com` is good, a `200`
means exposed:

```bash
for u in https://clumeral.com/feedback \
         https://clumeral-game.jevawin.workers.dev/feedback \
         https://staging-clumeral-game.jevawin.workers.dev/feedback; do
  curl -s -o /dev/null -w "%{http_code}  $u\n" "$u"
done
```

To set `github_issue`, or to change state in bulk, go straight to D1:

```bash
wrangler d1 execute clumeral-feedback --remote --command \
  "UPDATE feedback SET github_issue = 271 WHERE id = 13;"
```

## Migrations

`migrations/feedback/` — applied in order. The directory is what maps these to the
`FEEDBACK_DB` binding, via `migrations_dir` in `wrangler.jsonc`:

- `0001_create_feedback.sql` — table + indexes. **Fresh DBs only** — this is the full current
  schema, and it's what `e2e:db` seeds from. New columns get added here *and* in a numbered
  migration for the remote.
- `0002_import_legacy_feedback.sql` — one-time import of the old Apps Script / Sheet rows
- `0003_add_host_column.sql` — adds `host` to the pre-existing remote DB and backfills `clumeral.com`
- `0004_add_triage_columns.sql` — adds `status`, `github_issue`, `resolved_at` (#225)

### Migrations apply themselves — do not run them by hand

**This changed with the pre-prod split.** Wrangler's own `d1 migrations apply` runs from
Cloudflare's builder: against `clumeral-feedback-preprod` when a branch builds, and against
`clumeral-feedback` when a pull request merges to `main`. Nobody runs a command, and the
dev bot never holds a Cloudflare credential.

To add a column: drop a numbered `.sql` file into `migrations/feedback/` and open a pull
request. Full rules — additive-only, the destructive-SQL lint, numbering — are in
[CLAUDE.md](../CLAUDE.md#environments-and-database-migrations).

The old "apply the migration against remote, **then** merge" instruction is gone, and
following it now would actively break the production build: applying a file by hand does
**not** write a `d1_migrations` ledger row, so the automatic run repeats the same file and
fails with `duplicate column name`.

`npm run db:migrate:remote` still exists as an emergency escape hatch. If you ever use it,
you must also insert the matching ledger row by hand, or the next merge fails:

```sql
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('000N_name.sql');
```

`0002` is the reason the escape hatch takes one filename rather than a directory: it is a
**one-time legacy import**, gitignored, and re-running it would duplicate every imported row.

Local commands ([package.json](../package.json)):

- `npm run e2e:db` — reset the **local** DB (drop + recreate from 0001), used by e2e.
- `npm run lint:migrations` — refuse destructive SQL. Touches no database.

## The debug payload

`collectDebug()` ([src/modals.ts](../src/modals.ts)) attaches the player's context so bugs can be reproduced from their exact state. The `history` field is the most useful — it's their full `dlng_history` (solve dates, tries, answers, and `archived` tags). That's how the streak bugs were diagnosed: replay the stored history through the stats logic.

## Process — feedback → triage → roadmap

The loop from raw feedback to shipped work:

1. **Review feedback.** Open the [`/feedback` dashboard](https://clumeral.com/feedback) — it shows
   the open queue by default. For anything actionable, create a GitHub issue, record its number on
   the row (`github_issue`), then hit **Resolve**. The row drops out of the default view and won't
   be re-triaged next visit.
2. **Review new GitHub issues.** New issues land in **Inbound** on the [Clumeral Roadmap board](https://github.com/users/jevawin/projects/3). Drag each to Now / Next / Future and drop it in the right position — column order *is* the priority order. Put any blocker or sequencing note in the **Trigger** field.
3. **Work from the roadmap.** Pull the top _Now_ item and build it. Detail stays in the GitHub issue, not the roadmap.

Resolve means **triaged**, not shipped — the row is captured in GitHub, and the linked issue tracks
the rest. Don't wait for the fix to land before resolving; that's what leaves the queue stale.

Cadence is deliberately loose: volume is low (12 production rows as of 2026-07-22), so this is a
"when you think of it" pass, not a scheduled one.
