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

- [#257](https://github.com/jevawin/clumeral-game/issues/257) Cron should pre-generate tomorrow so puzzle writes are cron-owned — promoted from _Next_ on 2026-07-19 when #255 shipped; failure mode is permanent, so it led the queue

## Next

**Puzzle integrity** (quick, unblocked — user-prioritised)
1. [#235](https://github.com/jevawin/clumeral-game/issues/235) Audit + document the early archive — audit, not fix: originals are in KV and served from KV (spot-check green)
2. [#193](https://github.com/jevawin/clumeral-game/issues/193) Add the redundant-clue removal pass to the generator — safe: cleans future puzzles only; optional KV backfill is answer-safe

**Usability core** (teach how to play + in-puzzle features)

3. [#251](https://github.com/jevawin/clumeral-game/issues/251) Undo + Reset controls above the digit boxes — lead; strongest user demand (feedback D1 row #12)
4. [#78](https://github.com/jevawin/clumeral-game/issues/78) Tap a box → surface only the clues relevant to it — when: after #251
5. [#196](https://github.com/jevawin/clumeral-game/issues/196) Highlight the violated clues after a wrong guess — when: after #78
6. [#227](https://github.com/jevawin/clumeral-game/issues/227) Full interactive guided tutorial with Clue — replaces the #214 MVP
7. [#189](https://github.com/jevawin/clumeral-game/issues/189) Feedback-sent toast + (i) info-icon explanations — small; toast system already built

**Hygiene**

8. [#256](https://github.com/jevawin/clumeral-game/issues/256) Exclude `.planning/` from the Tailwind content scan — **unblocked**: #255 shipped 2026-07-19, so the stylesheet has settled

## Future — playability, stats, then depth

**Playability**

- [#148](https://github.com/jevawin/clumeral-game/issues/148) End-of-puzzle shareable summary + time-to-complete — the vehicle for shareable stats + timing
- [#252](https://github.com/jevawin/clumeral-game/issues/252) Streak tidy-up — when: before leaning on streaks for playability; feeds #163 and #148
- [#163](https://github.com/jevawin/clumeral-game/issues/163) Streak indicators on the main puzzle screen — after: #252
- [#160](https://github.com/jevawin/clumeral-game/issues/160) / [#161](https://github.com/jevawin/clumeral-game/issues/161) / [#143](https://github.com/jevawin/clumeral-game/issues/143) Stats depth — per-puzzle, sortable history, dashboard
- [#162](https://github.com/jevawin/clumeral-game/issues/162) Login / cross-device history · [#145](https://github.com/jevawin/clumeral-game/issues/145) Additional game modes

**Archive epic** (remaining rendering work — #235 audit + #193 pass now live in _Next_)

- [#200](https://github.com/jevawin/clumeral-game/issues/200) Migrate `/archive` to a SPA route · [#169](https://github.com/jevawin/clumeral-game/issues/169) Group / paginate at scale

**Hygiene / polish**

- [#165](https://github.com/jevawin/clumeral-game/issues/165) Codebase refactor · [#221](https://github.com/jevawin/clumeral-game/issues/221) Unify client vs Worker render paths · [#203](https://github.com/jevawin/clumeral-game/issues/203) · [#201](https://github.com/jevawin/clumeral-game/issues/201) · [#151](https://github.com/jevawin/clumeral-game/issues/151) · [#164](https://github.com/jevawin/clumeral-game/issues/164) · [#101](https://github.com/jevawin/clumeral-game/issues/101)
- [#211](https://github.com/jevawin/clumeral-game/issues/211) Octopus liveliness (idle float, eye-follow, single-eyelid blink) · [#220](https://github.com/jevawin/clumeral-game/issues/220) Ink-squirt easter egg

## Backlog triage — 2026-07-17

Cleared the board from 53 → 33 open. Closed as **already built** (verified in code): #191, #127, #188, #87, #207, #229, #237, #95, #210, #195. Closed as **stale / duplicate / not planned**: #147, #197, #217, #198, #177, #80, #84, #190, #212. Rescoped: #227 (full version, replaces #214 MVP), #211 (added eye-follow + blink), #189 (dropped how-to-play toast). Closed as **superseded**: #243 (folded into #249 — the fix shipped in #254). Created: #252 (streak tidy-up). Key finding: puzzles are **KV write-once**, so the archive is already static and generator changes (#81, #193) don't rewrite history — #235 is an audit, not a fix.

## Recently shipped

- 2026-07-19 — [#255](https://github.com/jevawin/clumeral-game/pull/258) OKLCH-derived palette — 31 colour literals → **20 declared values** in `src/palette.ts`. Contrast rides on a shared `--accent-l`, so a theme cannot fail AA by construction; worst pairing is now 5.36 (Lime light on bg). Removed `--color-accent-strong` and `--color-on-accent`, partly undoing #254 by design. Also on the branch: eliminated-digit strike-through, fruit swatch icons, themes renamed to fruit (with a `dlng_colour` migration), and a pre-existing `/archive` → `/play` routing bug fixed. DA review caught two HIGH issues before merge — `palette.ts` was not an enforced source of truth (parity is now three-way), and the archive marker was still bounced by the rollover redirect. QA: 182 unit · 36 axe (all four themes) · 272 e2e
- 2026-07-18 — [#254](https://github.com/jevawin/clumeral-game/pull/254) Quick-win cluster — [#249](https://github.com/jevawin/clumeral-game/issues/249) accent palette tidy, [#243](https://github.com/jevawin/clumeral-game/issues/243) dark-mode white-on-accent fixed via `--color-on-accent`, [#202](https://github.com/jevawin/clumeral-game/issues/202) semantic `--color-success` / `--color-error`, [#81](https://github.com/jevawin/clumeral-game/issues/81) Fibonacci special (Specials 12 → 15), [#228](https://github.com/jevawin/clumeral-game/issues/228) "boxes" not "digits" in player copy, [#194](https://github.com/jevawin/clumeral-game/issues/194) keypad hidden on finalise, [#199](https://github.com/jevawin/clumeral-game/issues/199) Archive back in the corner menu. Also unpinned the axe gate from light-only and added open-menu / open-modal scans — 26 axe tests, both schemes (`42adf9b`)
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
