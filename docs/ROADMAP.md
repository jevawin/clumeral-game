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

- [#215](https://github.com/jevawin/clumeral-game/issues/215) Docs cleanup — thin CLAUDE.md to pointers, refresh README structure _(small; clears decks)_

## Next — in order

1. [#214](https://github.com/jevawin/clumeral-game/issues/214) First-play octopus walkthrough (P1) — reshapes `/play`; must land before the QA suite is finalised
2. [#219](https://github.com/jevawin/clumeral-game/issues/219) Hundreds box: tooltip when tapping 0 — "can't start with 0" (P1, UI/UX) — quick win
3. QA regression suite — build per [the design spec](superpowers/specs/2026-05-31-playwright-qa-regression-design.md) _(no issue — the spec is the tracking artifact)_

## Future / ideas — conditional

- [#213](https://github.com/jevawin/clumeral-game/issues/213) Supabase feedback migration — `when:` QA suite is green (the one-line feedback-intercept swap is then covered by tests)
- [#217](https://github.com/jevawin/clumeral-game/issues/217) Reset button — clear digit eliminations in one tap (UI/UX, P2) — `decide:` show always after eliminations vs only on unsuccessful submit

## Recently shipped

- 2026-05-31 — QA regression suite **design spec** committed (`6e6f71b`, [doc](superpowers/specs/2026-05-31-playwright-qa-regression-design.md))
