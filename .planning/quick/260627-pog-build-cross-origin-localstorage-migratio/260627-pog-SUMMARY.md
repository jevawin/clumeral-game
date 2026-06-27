---
quick_id: 260627-pog
slug: build-cross-origin-localstorage-migratio
description: Build cross-origin localStorage migration page at /migrate
date: 2026-06-27
status: complete
branch: dev/migrate-page
pr: https://github.com/jevawin/clumeral-game/pull/230
commits:
  - a843783 Add /migrate cross-origin localStorage hand-off page
  - 26fae34 docs(260627-pog): quick-task plan
  - (review) Apply review fixes to /migrate page
---

# Summary — /migrate cross-origin localStorage hand-off

## Built

- `public/migrate.html` — self-contained static page (no build deps, origin-independent).
  Symmetric export/import driven by the URL fragment.
- `src/worker/index.ts` — serves `migrate.html` at the clean `/migrate` path,
  ahead of the SPA catch-all (keeps it out of the resolver).
- `wrangler.jsonc` — `/migrate` added to `run_worker_first`.

## Key decisions

- Migrates `dlng_history`, `dlng_colour`, `dlng_theme`, `dlng_prefs`, `dlng_active`.
  Skips `dlng_uid` (analytics id) and `dlng_last_visit_date` (rollover bookkeeping).
- Payload in the URL **fragment** so no game data reaches Cloudflare logs.
- Import is **allowlist-bounded** (writes only the 5 keys, ignores any extra keys
  in a crafted payload) and string-type-guarded.
- Standalone page, NOT an SPA route — resolver would bounce `/migrate` → `/welcome`.

## QA (light, as agreed)

Roundtrip driven in a local build at mobile viewport:
- Export summary correct; `dlng_uid`/`dlng_last_visit_date` excluded from payload.
- Import writes exactly the 5 keys, `dlng_history` byte-identical, hash cleared,
  done view shown. Overwrite warning fires when destination already has history.
- No console errors. Both light/dark render checked.

## Review

- DA review (fresh subagent): **SHIP**, no Medium+ findings. Confirmed no XSS
  (text nodes only, no innerHTML), no open redirect (hardcoded dest), allowlist
  bound, worker route serves migrate.html not index.html.
- Applied the two flagged Low fixes: secondary nav-link touch target → 44px,
  removed unused `renderDone` param.

## Handoff to user (deploy — both origins)

1. Merge PR #230 → staging → **main** → `clumeral.com/migrate` (import side) live.
2. **Recreate the `new-design` branch** with this change + push → Cloudflare
   redeploys `new-design-clumeral-game.jevawin.workers.dev/migrate` (export side).
   The player's localStorage is tied to that origin, so a fresh build can read it.

The `new-design` branch was deleted after the redesign merged (cd206f9); the
preview is a leftover deployment still holding the player's data.
