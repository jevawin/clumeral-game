# Clumeral — Roadmap & working state

The running view of **what's being worked on and what's next**. Read this at the start of a task.

Rules that keep it from rotting:

- **Detail lives in the GitHub issue, not here.** Each line is issue number + one-line title +
  trigger condition. Never copy the what/why/acceptance — that drifts.
- **Order in this file is the source of truth for "what next."** GitHub `P1/P2/P3` labels are
  coarse filtering; if they disagree with this order, this file wins.
- **WIP = 1.** One item under _Now_.
- **Conditions are greppable** — `when:` / `if:` suffixes, not prose.
- Canonical backlog: GitHub issues with the [`roadmap`](https://github.com/jevawin/clumeral-game/issues?q=is%3Aissue+label%3Aroadmap) label.

---

## Now — WIP 1

- **Colour + Fibonacci cluster** on `feat/now-cluster-2026-07-17` — [#249](https://github.com/jevawin/clumeral-game/issues/249) accent palette tidy (folding in [#243](https://github.com/jevawin/clumeral-game/issues/243)), [#202](https://github.com/jevawin/clumeral-game/issues/202) semantic success/error tokens, and [#81](https://github.com/jevawin/clumeral-game/issues/81) Fibonacci special. In review — PR to staging.

## Next

1. [#255](https://github.com/jevawin/clumeral-game/issues/255) Derive the whole palette from 2 base colours + hue angles (OKLCH) — 31 unique colour literals down to ~8 declared values; `on-accent` becomes `bg` and `accent-strong` disappears entirely. Verified AA-clean across 4 themes × 2 modes at `oklch(0.50 0.14 h)` light / `oklch(0.78 0.13 h)` dark. **A redesign, not a refactor** — every colour on screen moves, so it starts with a throwaway comparison page for sign-off before any app code changes — when: straight after #254 merges
2. [#256](https://github.com/jevawin/clumeral-game/issues/256) Exclude `.planning/` from the Tailwind content scan — class names quoted in old design docs generate real CSS in the bundle; small, likely one line plus a before/after class diff — when: after #255, so the two don't both churn the generated stylesheet

## Recently shipped

- 2026-06-28 — [#233](https://github.com/jevawin/clumeral-game/pull/233) Post-redesign bug fixes — `/random` correct-answer crash fixed (cold-boot solve no longer hits the uninitialised-router throw) + restored the "Play another random puzzle" entry link on the random completion screen, and theme-aware shadow tokens (`--shadow-*`) so shadows render correctly in dark mode
- 2026-06-27 — [#231](https://github.com/jevawin/clumeral-game/pull/231) `/migrate` cross-origin localStorage hand-off — one-time migration page that carries `dlng_*` history across the domain move
- 2026-06-27 — [#226](https://github.com/jevawin/clumeral-game/pull/226) Three-screen redesign — welcome / game / completion rebuilt in Tailwind with the minimal palette and accent picker (`cd206f9`)
- 2026-06-09 — [#219](https://github.com/jevawin/clumeral-game/issues/219) Hundreds-box 0 explainer — tapping the disabled 0 shows the (i)-style tooltip "first digit can't be 0" (`956fc99`, 260609-0tc) — _issue closes on merge to main_
- 2026-06-08 — [#213](https://github.com/jevawin/clumeral-game/issues/213) Feedback migration → **Cloudflare D1** — `POST /api/feedback` + private `/feedback` admin dashboard, off the old Google Apps Script URL (`ebba75a`, [docs/FEEDBACK.md](FEEDBACK.md))
- 2026-06-08 — Archive solves excluded from daily stats — replaying past puzzles no longer inflates streak/played (`0c033c0`, 260608-wyy)
- 2026-06-08 — QA regression suite — 38 Playwright specs, full 5-engine matrix green (branch `qa/playwright-regression-suite`, [design](superpowers/specs/2026-05-31-playwright-qa-regression-design.md))
- 2026-06-07 — [#214](https://github.com/jevawin/clumeral-game/issues/214) First-play octopus walkthrough — header tutorial on `/play` (`src/walkthrough.ts`)
- 2026-06-07 — DST date tests made timezone-deterministic (`451879e`)
- 2026-06-07 — Streak under-counting fix — sort history before streak walk (`13d98da`, 260607-df0)
- 2026-06-01 — [#215](https://github.com/jevawin/clumeral-game/issues/215) Docs cleanup — CLAUDE.md thinned to pointers, README structure refreshed
- 2026-06-01 — Feedback debug payload + redeployed Apps Script URL (`c8a1b15`, 260601-dcx)
- 2026-06-01 — PWA stale-asset resume fix (`31b8081`, 260601-bva)
- 2026-06-01 — Midnight date divergence fix — local-keyed `todayKey()` (`6c908bc`, 260601-auy)
- 2026-05-31 — QA regression suite **design spec** committed (`6e6f71b`, [doc](superpowers/specs/2026-05-31-playwright-qa-regression-design.md))
