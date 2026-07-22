---
quick_id: 260722-issue-225
slug: issue-225-feedback-triage
issue: 225
date: 2026-07-22
status: complete
pr: 264
---

# Summary — #225 feedback triage state

## Shipped

Migration `0004` (plus the same columns in `0001` for fresh DBs): `status`, `github_issue`,
`resolved_at`. Dashboard gains a status badge, Resolve/Reopen, a GitHub issue link and an
open/resolved filter, with resolved hidden by default. New `POST /feedback/:id/status`.
`db:migrate:remote` now takes the migration filename.

Two states only — richer outcomes live on the linked GitHub issue. `github_issue` is the
column that matters: it becomes the triage bot's memory.

## The DA review earned its keep

Verdict FIX FIRST — 2 HIGH, 2 MEDIUM, 9 LOW. All fixed.

**The one that mattered:** preview deploys could write production triage state. One D1
binding, no environment override, so every `*.workers.dev` deploy hits the production
feedback DB — and Cloudflare Access cannot cover `workers.dev` at all. My original design
note ("the `/feedback` prefix inherits the Access gate") was true only on `clumeral.com`,
and the same-origin check proves a request *is* same-origin, never *which* origin, so a
`curl` caller satisfies both sides. Fixed with `canWriteTriage()` — production and
localhost only, mirroring the inverse gate on `/api/dev/answer`, plus a
`Cf-Access-Jwt-Assertion` requirement so it fails closed if Access is ever removed.

**The one that was pure process:** the e2e spec failed on 4 of 5 engines. All projects
submitted the same message into one shared D1 under `fullyParallel`. I had only run
chromium — the agreed QA level — so I never saw it. Lesson: a spec placed in `e2e/specs/**`
runs the whole matrix regardless of what level was agreed for the *change*.

**The embarrassing one:** clearing the triage queue, which is the entire point of the
feature, rendered five invented sample submissions under a "no feedback yet" banner.

Also corrected a false premise I had propagated through code comments, docs and tests:
`0004` uses `NOT NULL DEFAULT 'open'`, so pre-migration rows backfill and `status` can
never be NULL. The `IS NULL` arm survives as a fail-visible guard, now labelled honestly.

## QA

209 unit (27 new) · 297 e2e across all 5 engines, 56 skipped · `tsc` clean. Hand-probed the
built worker for the CSRF guard, content-type handling, CRLF in `back`, and both empty
states. The host gate is unit-tested only — vite's own host check rejects a spoofed `Host`
header before the worker sees it, so it cannot be exercised end-to-end locally.

## Blocking follow-up

**Run the migration against remote BEFORE the merge to `main` reaches production.** Merging
deploys automatically, and code reading a missing column 500s every dashboard load.

```
npm run db:migrate:remote -- migrations/0004_add_triage_columns.sql
```

## Next

- [PR #263](https://github.com/jevawin/clumeral-game/pull/263) (roadmap cleanup) still open
- GitHub Projects board — user has re-run `gh auth refresh`; verify scopes then build
- The feedback → GitHub triage bot, on top of `github_issue`
