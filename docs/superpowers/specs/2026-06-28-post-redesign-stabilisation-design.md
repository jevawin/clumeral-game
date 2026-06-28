# Post-redesign stabilisation — design

**Date:** 2026-06-28
**Branch base:** `staging`
**Status:** in progress (sequencing per PR 1 → 3 → 2 → 4)

### Progress
- **PR 1 — bug fixes:** ✅ done. PR [#233](https://github.com/jevawin/clumeral-game/pull/233)
  → `staging` (branch `dev/post-redesign-stabilisation`). /random crash fix + restored entry
  link + theme-aware shadows. Full suite green (unit 120, e2e 208). Plan:
  [docs/superpowers/plans/2026-06-28-pr1-random-and-shadow-fixes.md](../plans/2026-06-28-pr1-random-and-shadow-fixes.md).
- **PR 3 — CI smoke gate:** ✅ done. PR [#234](https://github.com/jevawin/clumeral-game/pull/234)
  → `staging` (branch `dev/ci-smoke-gate`). `.github/workflows/ci-smoke.yml` blocks merge to
  `main` on a critical-path Playwright subset against the branch preview.
- **PR 2 — QA coverage map → spec:** ✅ done (branch `dev/qa-coverage-map`). Built the
  screen × flow coverage matrix (below), then filled the genuine gaps: random play-again
  click→solve, dark-mode active shadow, completion-screen popstate, how-to-play menu link,
  and a mid-game reload-restore probe. The reload probe passes (same-day restore works), so
  the "phone refresh restarts the puzzle" report is captured as a platform-behaviour issue
  ([#237](https://github.com/jevawin/clumeral-game/issues/237)), not a code bug. Coverage
  matrix + remaining-gap checklist added to
  [the QA regression design spec](2026-05-31-playwright-qa-regression-design.md).
- **PR 4 — cleanup + doc refresh:** ⬜ next.

The three-screen redesign (`cd206f9`, #226) and the `/migrate` hand-off (#231) shipped
to production with a small set of regressions and left several docs stale. This program
fixes the user-facing bugs first, then closes the QA gap that let them ship, then refreshes
docs and cleans the repo.

It is split into four PRs. PR 1 is the priority and ships fast. PR 3 (the CI gate) follows
PR 1 so the gate exists to catch the *next* regression — the /random bug is exactly the kind
a gate would have caught.

---

## Findings (verified)

- **/random is partly broken and unreachable.** The page and worker API are fine — a live
  `POST /api/guess` with a fresh random token returns `{correct:false}` (200), and
  `/random` cold-loads into a working game screen. Two real problems:
  1. **No entry point.** The only link to `/random` was "Play another random puzzle" on the
     old completion screen. The redesign rebuilt completion ([completion.ts](../../../src/completion.ts)
     renders only `data-completion-*` nodes) and dropped it. The old markup is now orphaned
     and permanently `hidden` in the *game* section ([index.html:281-288](../../../index.html#L281-L288)).
  2. **Submit fails with "Something went wrong" (friend report).** Client-side error from
     [app.ts:654/669/742](../../../src/app.ts#L654). Prime suspect: the correct-guess solve
     path calls `replaceRoute('/solved')` ([app.ts:719](../../../src/app.ts#L719)), but a
     random solve writes no daily history entry, so `resolveRoute('/solved')` has no
     `todayEntry` and bounces to `welcome`. Any throw in that branch is caught and rendered
     as the generic error. Reproduce locally before fixing — do not guess the exact line.

- **Shadows don't match theme.** ~10 hardcoded shadow colours (`rgba(38,38,36,...)` light,
  non-token `#494946` dark) instead of theme tokens, so shadows are wrong/invisible in dark
  mode. Files: [tailwind.css:122](../../../src/tailwind.css#L122),
  [app.ts:351,356-357,384](../../../src/app.ts#L351),
  [welcome.ts:64,95](../../../src/welcome.ts#L64),
  [worker/stats.ts:197](../../../src/worker/stats.ts#L197).

- **No e2e guards the /random regression.** Existing specs check the page renders, not that
  the UI can reach it or that a random solve completes. This gap is the case for PRs 2–3.

- **Docs stale:** `DESIGN-SYSTEM.md` (claims "green accent only" + DM Sans/Inconsolata; real
  state is 4 accent colours + Quicksand), `ARCHITECTURE.md` / `URL-ARCHITECTURE.md`
  (`cw-*` localStorage keys, now `dlng_*`), `PROGRESS.md` (frozen on an April session),
  `ROADMAP.md` ("shipped" list omits the redesign #226 and /migrate #231; no bugs tracked).

- **Feedback is already clean — nothing to import.** The Google Sheet CSV (pre-migration
  snapshot) holds exactly the 11 genuine rows already loaded by
  `migrations/0002_import_legacy_feedback.sql`; the rest are test/garbage (E2E smoke,
  keyboard-mashes, "testing"). Live remote D1 confirms: 11 `host = clumeral.com` rows
  (newest the 1 June "Streak bug."), no production feedback since the migration — new
  feedback now lands directly in D1 via `/api/feedback`. One stray preview-host test row
  (`*.workers.dev`) sits in prod D1; the dashboard already filters it out by default.

---

## Design decision: /random is a testing page

`/random` is intentionally a low-traffic testing page. Its **only** entry link lives on the
random completion screen ("Play another random puzzle" → `/random`), shown only after solving
a random puzzle. No link is added to the daily completion screen or anywhere else.

---

## PR 1 — Bug fixes (priority, ship fast)

One PR, a regression test per bug.

**/random**
1. Reproduce the friend's submit error locally (`npm run preview`, drive `/random`, solve it).
   Confirm the exact failing line before changing code.
2. Fix the random solve flow so a correct guess lands on (and stays on) the completion screen
   without the "Something went wrong" error and without bouncing to welcome.
3. In [completion.ts](../../../src/completion.ts), when `isRandom`, render a "Play another
   random puzzle" link → `/random` in the `data-completion-links` area. This is the sole
   `/random` entry point.
4. e2e: drive `/random` end-to-end — load → solve → completion shows without the
   "Something went wrong" error, and the "play another" link points to `/random`.

   Root cause (confirmed in planning): `/random` boots without `initRouter`
   ([app.ts:972](../../../src/app.ts#L972)), so the solve path's `replaceRoute('/solved')`
   hits `ctx()`'s `router not initialized` throw ([router.ts:67](../../../src/router.ts#L67)).
   Fix shows the completion screen directly for random solves.

   Note: the orphaned `data-next` / `data-again` markup ([index.html:281-288](../../../index.html#L281-L288))
   is **moved to PR 4** — it is still poked by a dead old-completion code path in app.ts
   (lines 472-474, 501, 525, 552, 636 + dom cache 69-71), so removing it cleanly is cleanup,
   not a ship-fast bug fix.

**Shadows**
6. Define `--shadow-*` tokens in [tailwind.css](../../../src/tailwind.css) `@theme`
   (`color-mix` off `--color-text` / `--color-accent`), with dark overrides.
7. Swap the ~10 hardcoded shadow values across the 4 files for the tokens.
8. Verify: Playwright screenshots in light + dark, both themes.

**QA level:** critical-path Playwright subset (the new /random e2e + a visual dark-mode check).

## PR 3 — CI smoke gate (right after PR 1)

GitHub Action on PRs targeting `main`: build, run a fast critical-path Playwright subset
against the branch preview (`{branch}-clumeral-game.jevawin.workers.dev`), block merge on red.
The full e2e matrix stays manual and proportional, per the QA-level rule in CLAUDE.md.

Open question for plan phase: run against the deployed preview URL vs. a local `vite preview`
build in the Action. Preview URL is closer to prod; local build is faster and avoids deploy
ordering. Decide during planning.

## PR 2 — QA coverage map → spec

1. Build a coverage matrix: every screen (welcome / game / completion) and flow (daily solve,
   random, archive, midnight rollover, PWA, theme/shadows, walkthrough) × tested-or-not,
   mapped to existing specs in `e2e/` and `tests/`.
2. The gaps drive what to add — expected: random entry/solve, completion screen, theme/shadow
   visual checks.
3. Update [the QA design spec](2026-05-31-playwright-qa-regression-design.md) and add the
   missing specs.

## PR 4 — Cleanup + doc refresh

- Prune merged branches: local `new-design`, `staging`; remote `chore/roadmap-217`
  (pre-redesign docs branch; its April /random fix `a8d0be8` is superseded). Confirm each is
  merged before deletion.
- Retire or refresh `PROGRESS.md` (stale April session; ROADMAP already covers working state).
- Update `ROADMAP.md` "Recently shipped": add the redesign (#226) and /migrate (#231) — the two
  biggest recent items, currently missing — **and** the PR 1 (#233) bug fixes now that they've
  shipped: the /random correct-answer crash + restored entry link, and theme-aware shadows.
  Record /random as a fixed regression (shipped), not an open bug. The shadows item was the one
  already tracked as a known bug — move it from open to shipped too.
- Fix docs: `DESIGN-SYSTEM.md` (Quicksand fonts, 4 accent colours), `ARCHITECTURE.md` /
  `URL-ARCHITECTURE.md` (`cw-*` → `dlng_*` keys), minor `README.md` naming.
- Document the feedback → triage dev process in [FEEDBACK.md](../../FEEDBACK.md), replacing
  the "no triage state yet" placeholder section:
  1. **Review feedback** → create GitHub issues as needed → mark the feedback row complete
     (once it's captured in GitHub).
  2. **Review new GitHub issues** → prioritise → update local `ROADMAP.md`.
  3. **Work from the roadmap.**
  Note the dependency: step 1's "mark complete" needs the open/resolved state from
  [#225](https://github.com/jevawin/clumeral-game/issues/225), still open. Until #225 ships,
  capture-to-GitHub happens but rows can't be marked done — call that out in the doc.
- Feedback data: no import needed (already clean — see Findings). Optional: delete the single
  stray preview-host test row from prod D1
  (`DELETE FROM feedback WHERE host LIKE '%workers.dev%';`) — low value since it's filtered
  from the dashboard; do only if tidying the table is wanted.

- Remove the orphaned `data-next` / `data-again` markup ([index.html:281-288](../../../index.html#L281-L288))
  **and** the dead old-completion code path that pokes it in app.ts (lines 472-474, 501, 525, 552,
  636 + the `next` / `nextNumber` / `again` dom cache at 69-71). Moved here from PR 1: the markup
  is entangled with live (no-op) code, so untangling it is cleanup, not a bug fix. Verify the new
  completion screen ([completion.ts](../../../src/completion.ts)) fully covers what the old path did
  (countdown / next-puzzle text) before deleting.

---

## Out of scope

- No worker/API changes — the random API verified working in production.
- No redesign visual changes beyond the shadow tokens.
- No new e2e engines or infra beyond the smoke gate.

## Risks

- The /random submit error is not yet reproduced line-exact; PR 1 must reproduce before
  fixing, not patch the symptom.
- Branch pruning: verify merged status before any delete; never touch `main` / `staging`
  remote protection.
