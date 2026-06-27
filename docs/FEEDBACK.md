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
- `?all=1` — include test/preview rows (`*.workers.dev` / `localhost`). Default shows only production (`host = clumeral.com` or NULL).
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

The debug fields are individual columns, not one JSON blob. No PII is collected.

## Migrations

`migrations/` — applied in order:

- `0001_create_feedback.sql` — table + `created_at` index
- `0002_import_legacy_feedback.sql` — one-time import of the old Apps Script / Sheet rows
- `0003_add_host_column.sql` — adds `host` to the pre-existing remote DB and backfills `clumeral.com`

Commands ([package.json](../package.json)):

- `npm run e2e:db` — reset the **local** DB (drop + recreate from 0001), used by e2e.
- `npm run db:migrate:remote` — apply migrations to **remote** production D1.

Caveat: `db:migrate:remote` currently runs **only** `0001`. For a new migration, run it explicitly:
`wrangler d1 execute clumeral-feedback --remote --file=migrations/000N_name.sql` — or extend that script.

## The debug payload

`collectDebug()` ([src/modals.ts](../src/modals.ts)) attaches the player's context so bugs can be reproduced from their exact state. The `history` field is the most useful — it's their full `dlng_history` (solve dates, tries, answers, and `archived` tags). That's how the streak bugs were diagnosed: replay the stored history through the stats logic.

## Process — status: read-only, no triage state yet

Today feedback is **read-only**. There's no way to mark an item open or resolved, so the same submissions get re-read and re-triaged each visit. We read the dashboard and act ad hoc.

Tracked: [#225 — Feedback: add open / resolved state for triage](https://github.com/jevawin/clumeral-game/issues/225). **P2, scheduled for when we start actively tackling feedback.**

When we build that (issue #225), flesh out the real process **here**:

- The state model (open / resolved / others) and how a row moves between states.
- Who triages and how often.
- How a feedback item becomes a roadmap issue (link back to [ROADMAP-ISSUES.md](ROADMAP-ISSUES.md)).
- Any new columns / migrations added for status.

This section is the placeholder for that process — update it then.
