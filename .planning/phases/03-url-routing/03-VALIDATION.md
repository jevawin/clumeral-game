---
phase: 03
slug: url-routing
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-03
---

# Phase 03 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 2.x + jsdom (not yet installed — Wave 0 installs) |
| **Config file** | `vitest.config.ts` (Wave 0 creates; reuses `vite.config.ts` plugins) |
| **Quick run command** | `npx vitest run tests/<file>.spec.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | <30 seconds full suite |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/<touched-module>.spec.ts`
- **After every plan wave:** Run `npx vitest run` (full suite)
- **Before `/gsd:verify-work`:** Full suite green + integration curl checks + manual deep-link smoke
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

> Filled by gsd-planner from RESEARCH.md req→test map. See `03-RESEARCH.md` § Validation Architecture for the canonical mapping.

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 03-01-* | 01 | 0 | infra | install | `npx vitest --version` | ❌ W0 | ⬜ pending |
| 03-02-* | 02 | 1 | RTE-03, ARC-03 | unit (pure fn) | `npx vitest run tests/resolve-route.spec.ts` | ❌ W0 | ⬜ pending |
| 03-03-* | 03 | 1 | RTE-01, RTE-03, POL-01..04 | unit (jsdom) | `npx vitest run tests/router.spec.ts` | ❌ W0 | ⬜ pending |
| 03-04-* | 04 | 2 | RTE-02, ARC-01 | integration | `curl -I localhost:5173/welcome`, `curl -I localhost:5173/puzzles` | manual | ⬜ pending |
| 03-05-* | 05 | 2 | ARC-02 | unit (DOM) | `npx vitest run tests/completion-links.spec.ts` | ❌ W0 | ⬜ pending |
| 03-06-* | 06 | 2 | POL-02 | grep | `grep -c route_change src/worker/index.ts` ≥1 | ✅ grep | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `package.json` — add `vitest`, `jsdom`, `@types/jsdom` to devDependencies
- [ ] `vitest.config.ts` — jsdom env, ES2022 target
- [ ] `tests/resolve-route.spec.ts` — pure-function stubs for RTE-03, ARC-03
- [ ] `tests/router.spec.ts` — jsdom stubs for RTE-01, POL-01..04
- [ ] `tests/completion-links.spec.ts` — DOM stubs for ARC-02
- [ ] Add `test` script to `package.json`: `"test": "vitest run"`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Worker SPA fallback returns `index.html` for client routes | RTE-02 | Requires `wrangler dev` runtime | Start `npm run dev`, run `curl -I http://localhost:5173/welcome` (expect 200 + HTML), repeat for `/play`, `/solved`, `/archive`, `/archive/2026-04-01` |
| `/puzzles` → `/archive` 302 redirect | ARC-01 | Requires Worker runtime | `curl -I http://localhost:5173/puzzles` (expect 302, location: /archive); same for `/puzzles/<num>` → `/archive/<date>` |
| Browser back from `/solved` skips finished puzzle | RTE-03 | Browser history semantics | Solve puzzle → URL becomes `/solved` → press back → expect `/welcome`, not `/play` |
| Stale-day check fires on focus/visibility but not mid-interaction | POL-04 | Requires real browser focus events + active keypad state | Open `/play`, open keypad, switch tab past midnight, return — expect no auto-redirect; close keypad → expect redirect to `/welcome` |
| Deep-link refresh on every route | RTE-02 | Tests Cloudflare Pages + SW caching | Navigate to each route, hit browser refresh — expect same screen, no 404 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (vitest install, spec stubs)
- [ ] No watch-mode flags (`vitest run`, never `vitest` alone)
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
