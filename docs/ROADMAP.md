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

- [#213](https://github.com/jevawin/clumeral-game/issues/213) Supabase feedback migration — now unblocked (QA suite green); the one-line feedback-intercept swap is covered by `e2e/specs/menu.spec.ts`. `when:` QA suite branch merges.

## Recently shipped

- 2026-06-08 — QA regression suite — 38 Playwright specs, full 5-engine matrix green (branch `qa/playwright-regression-suite`, [design](superpowers/specs/2026-05-31-playwright-qa-regression-design.md))
- 2026-06-07 — [#214](https://github.com/jevawin/clumeral-game/issues/214) First-play octopus walkthrough — header tutorial on `/play` (`src/walkthrough.ts`)
- 2026-06-07 — DST date tests made timezone-deterministic (`451879e`)
- 2026-06-07 — Streak under-counting fix — sort history before streak walk (`13d98da`, 260607-df0)
- 2026-06-01 — [#215](https://github.com/jevawin/clumeral-game/issues/215) Docs cleanup — CLAUDE.md thinned to pointers, README structure refreshed
- 2026-06-01 — Feedback debug payload + redeployed Apps Script URL (`c8a1b15`, 260601-dcx)
- 2026-06-01 — PWA stale-asset resume fix (`31b8081`, 260601-bva)
- 2026-06-01 — Midnight date divergence fix — local-keyed `todayKey()` (`6c908bc`, 260601-auy)
- 2026-05-31 — QA regression suite **design spec** committed (`6e6f71b`, [doc](superpowers/specs/2026-05-31-playwright-qa-regression-design.md))
