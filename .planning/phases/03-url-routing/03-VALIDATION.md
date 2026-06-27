---
phase: 03
slug: url-routing
status: planned
nyquist_compliant: true
wave_0_complete: false
created: 2026-05-03
updated: 2026-05-03
---

# Phase 03 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 2.x + jsdom (Plan 01 installs) |
| **Config file** | `vitest.config.ts` (Plan 01 creates) |
| **Quick run command** | `npx vitest run tests/<file>.spec.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | <30 seconds full suite |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/<touched-module>.spec.ts`
- **After every plan wave:** Run `npx vitest run` (full suite)
- **Before `/gsd-verify-work`:** Full suite green + integration curl checks + manual deep-link smoke
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 03-01-T1 | 01 | 0 | infra (vitest install) | install | `npx vitest --version` matches `2.x` | created in plan | ⬜ pending |
| 03-01-T2 | 01 | 0 | infra (config + setup) | runner smoke | `npx vitest run` exits 0 | created in plan | ⬜ pending |
| 03-01-T3 | 01 | 0 | infra (spec scaffolds) | grep + runner | `grep -c "it.todo" tests/*.spec.ts` ≥ 25 + `npx vitest run` exits 0 | created in plan | ⬜ pending |
| 03-02-T1 | 02 | 1 | RTE-03, ARC-03 | unit (pure fn) | `npx tsc --noEmit` + module exports check | created in plan | ⬜ pending |
| 03-02-T2 | 02 | 1 | RTE-03, ARC-03 | unit | `npx vitest run tests/resolve-route.spec.ts` | created in plan | ⬜ pending |
| 03-03-T1 | 03 | 1 | RTE-01, POL-01..04 | unit | `npx tsc --noEmit` + grep for listeners | created in plan | ⬜ pending |
| 03-03-T2 | 03 | 1 | RTE-01, POL-01..04 | unit (jsdom) | `npx vitest run tests/router.spec.ts` | created in plan | ⬜ pending |
| 03-04-T1 | 04 | 2 | RTE-01, RTE-03, POL-04 | typecheck + grep | `npx tsc --noEmit` + grep `replaceRoute('/solved')` ≥ 2 | edits in plan | ⬜ pending |
| 03-04-T2 | 04 | 2 | RTE-01 | typecheck + grep | `grep "navigate('/play')" src/welcome.ts` | edits in plan | ⬜ pending |
| 03-05-T1 | 05 | 2 | ARC-01 | grep | `grep renderArchivePage src/worker/puzzles.ts` | edits in plan | ⬜ pending |
| 03-05-T2 | 05 | 2 | RTE-02, ARC-01, POL-02 | typecheck + grep | `npx tsc --noEmit` + grep `'route_change'` + 302 handlers | edits in plan | ⬜ pending |
| 03-05-T3 | 05 | 2 | RTE-02 | grep | `grep '"/welcome"' wrangler.jsonc` etc. | edits in plan | ⬜ pending |
| 03-06-T1 | 06 | 2 | ARC-02 | typecheck + grep | `npx tsc --noEmit` + `grep activeDate src/completion.ts` | edits in plan | ⬜ pending |
| 03-06-T2 | 06 | 2 | ARC-02 | unit (jsdom) | `npx vitest run tests/completion-links.spec.ts` | created in plan | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements (Plan 01)

- [ ] `package.json` — add `vitest@^2`, `jsdom@^25`, `@types/jsdom` to devDependencies
- [ ] Add `"test": "vitest run"` script to `package.json`
- [ ] `vitest.config.ts` — jsdom env, setupFiles
- [ ] `tests/setup.ts` — localStorage clear, fetch stub, title reset, scrollRestoration reset
- [ ] `tests/resolve-route.spec.ts` — it.todo placeholders for RTE-03, ARC-03
- [ ] `tests/router.spec.ts` — it.todo placeholders for RTE-01, POL-01..04
- [ ] `tests/completion-links.spec.ts` — it.todo placeholders for ARC-02

---

## Requirement → Plan Coverage

| Requirement | Plan(s) | Test File |
|-------------|---------|-----------|
| RTE-01 | 03, 04 | tests/router.spec.ts |
| RTE-02 | 05 | manual curl (Manual-Only Verifications below) |
| RTE-03 | 02, 03, 04 | tests/resolve-route.spec.ts + tests/router.spec.ts |
| ARC-01 | 05 | manual curl |
| ARC-02 | 06 | tests/completion-links.spec.ts |
| ARC-03 | 02 | tests/resolve-route.spec.ts |
| POL-01 | 03 | tests/router.spec.ts |
| POL-02 | 03, 05 | tests/router.spec.ts + grep |
| POL-03 | 03 | tests/router.spec.ts |
| POL-04 | 03, 04 | tests/router.spec.ts |

Every Phase 3 requirement appears in at least one plan's `requirements` field.

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

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (vitest install, spec stubs)
- [x] No watch-mode flags (`vitest run`, never `vitest` alone)
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter
- [ ] `wave_0_complete: true` — flip after Plan 01 lands

**Approval:** planned (awaiting Plan 01 execution)
