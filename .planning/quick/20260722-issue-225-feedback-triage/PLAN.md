---
quick_id: 260722-issue-225
slug: issue-225-feedback-triage
issue: 225
date: 2026-07-22
status: in-progress
---

# #225 — Feedback open / resolved state for triage

Foundation for the feedback → GitHub triage bot. Without a resolved marker and an
issue link, every triage pass re-reads every row and can't tell "already filed" from
"never seen".

## Scope (agreed in discuss)

Status + issue link + migration-script fix. Not the four-state model — `wontfix` and
`duplicate` are better expressed by the linked GitHub issue's own state.

## Design decisions

**Write route lives under `/feedback`, not `/api/feedback`.**
`GET /feedback` is gated at the edge by Cloudflare Access. `POST /api/feedback` is
deliberately **public** so players can submit. A write route under `/api/feedback/...`
would inherit the public rule. `POST /feedback/:id/status` inherits the gated one.

**CSRF.** Access identity alone is not enough — an authenticated admin's browser can be
made to POST from an attacker page. The handler requires a same-origin `Origin` header.
Missing or mismatched → 403.

**The bot does not use this route.** GitHub Actions writes D1 directly via
`wrangler d1 execute --remote` with the existing `CLOUDFLARE_API_TOKEN` secret. The HTTP
write path is only for a human clicking in the dashboard. That keeps the bot independent
of the Access configuration.

**No-JS form POST.** The dashboard is a server-rendered page with no client bundle.
Keeping it a plain `<form>` + redirect avoids shipping JS to an admin-only page.

## Steps

1. **Migration** — add `status` (NOT NULL DEFAULT 'open'), `github_issue` (INTEGER),
   `resolved_at` (TEXT) to `0001_create_feedback.sql` for fresh DBs (this is what
   `e2e:db` seeds from — matches the existing `host` precedent), plus
   `0004_add_triage_columns.sql` for the already-created remote.
2. **Fix `db:migrate:remote`** — it runs only `0001` today, which is how `0003` had to be
   applied by hand. Run every migration in order.
3. **Worker** — extend `FeedbackRow`; `GET /feedback` selects the new columns and hides
   resolved by default (`?status=all|resolved` to widen); add `POST /feedback/:id/status`
   with Origin check, id/status validation, and a redirect back to the list.
4. **Dashboard** — status badge, Resolve / Reopen button per card, GitHub issue link when
   `github_issue` is set, and an open/resolved filter in the header.
5. **Tests** — unit for the status-update handler (validation, Origin, SQL shape); e2e for
   render + toggle + default filter against the local seeded D1.
6. **Docs** — `FEEDBACK.md` state model + triage process; drop the "#225 blocks this" caveat
   and the `db:migrate:remote` warning that this fixes.

## QA (agreed)

Unit + targeted e2e on chromium. No full 5-engine matrix — unlinked admin page, not
player-facing. Remote migration applied by hand and verified after merge to `main`.

## Review

DA review required (multi-file, new auth-adjacent route) → self-review → PR.
