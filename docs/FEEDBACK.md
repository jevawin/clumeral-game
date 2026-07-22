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

Table `feedback` ([migrations/0001_create_feedback.sql](../migrations/0001_create_feedback.sql)):

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
  pattern matches them. It is **data isolation**: there is a single D1 binding and no
  environment override in [wrangler.jsonc](../wrangler.jsonc), so every preview deploy is
  bound to the **production** feedback database. A signed-in admin resolving rows from
  staging would be mutating real triage state. [#260](https://github.com/jevawin/clumeral-game/issues/260)
  — a real staging Worker with its own D1 — is the actual fix.
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

Consequence worth knowing: **you cannot test Resolve/Reopen from a preview URL.** Use
localhost, or production after merge.

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

`migrations/` — applied in order:

- `0001_create_feedback.sql` — table + indexes. **Fresh DBs only** — this is the full current
  schema, and it's what `e2e:db` seeds from. New columns get added here *and* in a numbered
  migration for the remote.
- `0002_import_legacy_feedback.sql` — one-time import of the old Apps Script / Sheet rows
- `0003_add_host_column.sql` — adds `host` to the pre-existing remote DB and backfills `clumeral.com`
- `0004_add_triage_columns.sql` — adds `status`, `github_issue`, `resolved_at` (#225)

Commands ([package.json](../package.json)):

- `npm run e2e:db` — reset the **local** DB (drop + recreate from 0001), used by e2e.
- `npm run db:migrate:remote -- migrations/000N_name.sql` — apply **one** migration to remote production D1.

The remote script takes the file as an argument on purpose. It can't just run every migration
in order: `0002` is a **one-time legacy import**, and re-running it would duplicate every
imported row. Name the file you mean. Migrations are not re-runnable either — a second
`ADD COLUMN` fails with `duplicate column name`.

### Apply the migration BEFORE merging to main

Merging to `main` deploys automatically. If the code lands before the columns exist, every
dashboard load throws `no such column: status` and returns a 500. Player submissions keep
working (the INSERT names no new columns), but triage is dead until you catch up.

So the order is: run the migration against remote, **then** merge.

```bash
npm run db:migrate:remote -- migrations/0004_add_triage_columns.sql
```

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
