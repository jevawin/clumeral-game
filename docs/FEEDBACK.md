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

Rows written before this migration have `status` NULL. That reads as **open** everywhere
(the Worker's filter is `status IS NULL OR status <> 'resolved'`), which is correct: they
were never triaged.

`github_issue` is the important column. It's what tells "already filed as #271" from
"never seen", so follow-up feedback about the same thing can join an existing ticket
instead of opening a duplicate. Set it whenever you file an issue from a row.

### Changing status

From the dashboard, click **Resolve** / **Reopen**. That posts to
`POST /feedback/:id/status`.

Two things about that route are deliberate and easy to break:

- **It lives under `/feedback`, not `/api/feedback`.** Cloudflare Access gates the
  `/feedback` path; `POST /api/feedback` is deliberately **public** so players can submit.
  A write route under the `api` prefix would inherit the public rule and let anyone
  change triage state. Don't move it.
- **It requires a same-origin `Origin` header.** Access proves who the caller is, not
  which page made the request — a signed-in admin's browser can be induced to POST from
  an attacker's page. A missing header is rejected too; the only legitimate caller is the
  dashboard's own form.

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
imported row. Name the file you mean.

## The debug payload

`collectDebug()` ([src/modals.ts](../src/modals.ts)) attaches the player's context so bugs can be reproduced from their exact state. The `history` field is the most useful — it's their full `dlng_history` (solve dates, tries, answers, and `archived` tags). That's how the streak bugs were diagnosed: replay the stored history through the stats logic.

## Process — feedback → triage → roadmap

The loop from raw feedback to shipped work:

1. **Review feedback.** Open the [`/feedback` dashboard](https://clumeral.com/feedback) — it shows
   the open queue by default. For anything actionable, create a GitHub issue, record its number on
   the row (`github_issue`), then hit **Resolve**. The row drops out of the default view and won't
   be re-triaged next visit.
2. **Review new GitHub issues.** Prioritise the open issues (including the ones just filed), then reflect the order in [ROADMAP.md](ROADMAP.md) — issue number + one-line title + trigger condition, newest priorities first.
3. **Work from the roadmap.** Pull the top _Now_ item and build it. Detail stays in the GitHub issue, not the roadmap.

Resolve means **triaged**, not shipped — the row is captured in GitHub, and the linked issue tracks
the rest. Don't wait for the fix to land before resolving; that's what leaves the queue stale.

Cadence is deliberately loose: volume is low (12 production rows as of 2026-07-22), so this is a
"when you think of it" pass, not a scheduled one.
