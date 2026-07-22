# Clumeral — roadmap

**The roadmap lives on GitHub: [Clumeral Roadmap board](https://github.com/users/jevawin/projects/3).**

This file no longer lists what's next. It used to, and it drifted — the 2026-07-22 sweep
found eight issues that had shipped weeks earlier and were still sitting in the queue. One
place to be wrong is enough.

| Lives on the board | Lives here |
|---|---|
| What stage an item is at (Inbound / Now / Next / Future / Done) | The shipped log — what went out, and what we learned doing it |
| Priority order — the order of cards *within* Now and Next | The sweep history — what got closed in bulk, and why |
| `Trigger` field — the `when:` / `if:` conditions and what blocks what | |

Detail always lives in the **GitHub issue**. Never copy acceptance criteria onto the board
or into this file.

---

## How to manage it

**Read it:** open the [board](https://github.com/users/jevawin/projects/3). Top of _Now_ is
what you're working on. Top of _Next_ is what follows.

Or from the terminal:

```bash
gh project item-list 3 --owner jevawin --limit 200 --format json \
  --jq '.items[] | select(.status=="Now" or .status=="Next") | "\(.status)\t#\(.content.number)\t\(.title)"'
```

`--limit` is not optional. Without it `gh` returns only the first **30** items and filters
that page — with 57 items on the board it silently drops rows rather than erroring.

**Add an item:** open a normal issue. The board's auto-add workflow files it into
**Inbound**. Anything the feedback triage bot creates lands there too, tagged `feedback`
and `claude`. Issue conventions are in [ROADMAP-ISSUES.md](ROADMAP-ISSUES.md).

**Triage it:** drag from Inbound to Now / Next / Future. If it's blocked or ordered
relative to something else, say so in the **Trigger** field — that's what `when: after #251`
used to mean in this file. Keep **WIP = 1**: one card in _Now_.

**Reprioritise:** drag cards within a column. Column order *is* the priority order; there
is no separate list to keep in sync.

**Finish it:** put `Closes #NUM` in the `staging → main` PR body — one line per issue in
the bundle. GitHub closes the issue on merge and the board's workflow moves it to _Done_
on its own. Skipping this is exactly what caused the drift that retired this file's queue;
see [GIT-WORKFLOW.md](GIT-WORKFLOW.md).

Then add a line to the shipped log below. That's the only manual step, and it's a
changelog entry, not state to maintain.

### Board setup, for reference

Two built-in workflows do the automation (project **⋯ → Workflows**). They're UI-only —
GitHub's API exposes no mutation to create them, so if the board is ever rebuilt these must
be re-enabled by hand:

- **Item added to project** → set Status to **Inbound** (plus **Auto-add to project**,
  filter `is:issue is:open`)
- **Item closed** → set Status to **Done**

---

## Recently shipped

- 2026-07-22 — [#261](https://github.com/jevawin/clumeral-game/pull/261) Reworded SQUARE / CUBE / FIB clue tooltips — copy-only edit to three `TAG_TIPS` entries (`src/app.ts`). Closes [#155](https://github.com/jevawin/clumeral-game/issues/155) "Amend (i) definitions": the PR shipped exactly the wording #155 asked for but listed no closing reference, so the issue stayed open until the 2026-07-22 sweep. Merged to `main` in the [#262](https://github.com/jevawin/clumeral-game/pull/262) release
- 2026-07-19 — [#255](https://github.com/jevawin/clumeral-game/pull/258) OKLCH-derived palette — 31 colour literals → **20 declared values** in `src/palette.ts`. Contrast rides on a shared `--accent-l`, so a theme cannot fail AA by construction; worst pairing is now 5.36 (Lime light on bg). Issue [#255](https://github.com/jevawin/clumeral-game/issues/255) closed 2026-07-22 (the PR carried no closing reference). Removed `--color-accent-strong` and `--color-on-accent`, partly undoing #254 by design. Also on the branch: eliminated-digit strike-through, fruit swatch icons, themes renamed to fruit (with a `dlng_colour` migration), and a pre-existing `/archive` → `/play` routing bug fixed. DA review caught two HIGH issues before merge — `palette.ts` was not an enforced source of truth (parity is now three-way), and the archive marker was still bounced by the rollover redirect. QA: 182 unit · 36 axe (all four themes) · 272 e2e
- 2026-07-18 — [#254](https://github.com/jevawin/clumeral-game/pull/254) Quick-win cluster — [#249](https://github.com/jevawin/clumeral-game/issues/249) accent palette tidy, [#243](https://github.com/jevawin/clumeral-game/issues/243) dark-mode white-on-accent fixed via `--color-on-accent`, [#202](https://github.com/jevawin/clumeral-game/issues/202) semantic `--color-success` / `--color-error`, [#81](https://github.com/jevawin/clumeral-game/issues/81) Fibonacci special (Specials 12 → 15), [#228](https://github.com/jevawin/clumeral-game/issues/228) "boxes" not "digits" in player copy, [#194](https://github.com/jevawin/clumeral-game/issues/194) keypad hidden on finalise, [#199](https://github.com/jevawin/clumeral-game/issues/199) Archive back in the corner menu. Also unpinned the axe gate from light-only and added open-menu / open-modal scans — 26 axe tests, both schemes (`42adf9b`). Issues #249, #202, #81, #228, #194, #199 all closed 2026-07-22 (the PR carried no closing references)
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

## Backlog sweep — 2026-07-22

Post-#262 reconciliation. Closed **8 issues that had already shipped** but were never closed, because
the release PRs carried no `Closes #` references: #81, #194, #199, #202, #228, #249 (all #254),
#255 (#258), #155 (#261). Each was verified present in code on `main` before closing. 38 open → **30**.
Added the `roadmap` label to #143, #151, #200, #201, #203 — carried in the _Future_ list here but
unlabelled on GitHub. Every open issue now carries it. Added #225, which had the label but appeared
nowhere in this file.

Cause and fix: release PRs bundle several issues and none of them get `Closes #`, so the queue drifts
silently until someone reads the code. [GIT-WORKFLOW.md](GIT-WORKFLOW.md) now requires the closing
references in the release PR body.

**Then retired the queue from this file entirely.** The reconciliation above was the second bulk
correction in a week, and both existed only because state was tracked in two places. Built the
[Clumeral Roadmap board](https://github.com/users/jevawin/projects/3) and moved all 30 open issues
onto it — Now 1, Next 10, Future 19 — plus 27 shipped issues into _Done_, excluding the nine closed
as stale/not-planned and #243 as superseded, which were decisions to drop work rather than ship it.
Column order carries the priority; a `Trigger` field carries the `when:` / `if:` conditions that
used to be prose here.

## Backlog triage — 2026-07-17

Cleared the board from 53 → 33 open. Closed as **already built** (verified in code): #191, #127, #188, #87, #207, #229, #237, #95, #210, #195. Closed as **stale / duplicate / not planned**: #147, #197, #217, #198, #177, #80, #84, #190, #212. Rescoped: #227 (full version, replaces #214 MVP), #211 (added eye-follow + blink), #189 (dropped how-to-play toast). Closed as **superseded**: #243 (folded into #249 — the fix shipped in #254). Created: #252 (streak tidy-up). Key finding: puzzles are **KV write-once**, so the archive is already static and generator changes (#81, #193) don't rewrite history — #235 is an audit, not a fix.
