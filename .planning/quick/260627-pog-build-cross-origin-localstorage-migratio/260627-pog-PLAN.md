---
quick_id: 260627-pog
slug: build-cross-origin-localstorage-migratio
description: Build cross-origin localStorage migration page at /migrate
created: 2026-06-27
status: in-progress
---

# Quick Task 260627-pog — Cross-origin localStorage migration page

## Problem

A player built up history on the `new-design-clumeral-game.jevawin.workers.dev`
preview origin. localStorage is origin-scoped, so that data does not appear on
`clumeral.com`. There is no `new-design` branch on origin any more (the redesign
merged to `main` in cd206f9); the preview is a leftover deployment still holding
the player's data. We need a friendly, mobile-only way (no devtools) to move the
`dlng_*` keys from one origin to the other.

## Approach

A single self-contained static page served at `/migrate`, with no SPA-router
involvement (the resolver would otherwise bounce `/migrate` → `/welcome`). The
page is symmetric and picks its mode from the URL:

- **Export** (no `#d=` hash): read the migratable `dlng_*` keys, show a summary,
  button → redirect to `<other-origin>/migrate#d=<encoded payload>`.
- **Import** (`#d=` hash present): decode, show what was found, button → write
  the keys to localStorage, clear the hash, link to Play.

Data rides in the URL **fragment** so it never reaches Cloudflare logs.

Migrate: `dlng_history`, `dlng_colour`, `dlng_theme`, `dlng_prefs`, `dlng_active`.
Skip: `dlng_uid` (analytics id — let each origin keep its own), `dlng_last_visit_date`
(rollover bookkeeping, regenerates).

## Tasks

1. **`public/migrate.html`** — self-contained page (inline CSS+JS, no build deps,
   origin-independent). Export/import modes, overwrite guard, summary, version tag.
   *Verify:* roundtrip a sample localStorage through export → import in a local
   build (served at `/migrate.html`); keys land intact, only the 5 allowed keys
   are written, unknown keys ignored.
2. **Worker route** — `src/worker/index.ts`: serve `migrate.html` at the clean
   `/migrate` path (mirror the `/welcome` → `index.html` pattern). Add `/migrate`
   to `run_worker_first` in `wrangler.jsonc` so the worker handles it first.
   *Verify:* route block reads `migrate.html`, not `index.html`.

## QA scope (light — agreed up front)

One-off utility, never touches puzzle logic. Manual roundtrip in a local
production build. No full Playwright suite.

## Out of scope / handled by user

- Deploy. clumeral.com gets it via the normal staging → main flow.
- Recreating the `new-design` branch + push so the friend's preview origin
  redeploys with `/migrate`. The page is origin-independent, so the same file
  serves both export (preview) and import (prod).
