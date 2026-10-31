# Brief — vitest 2 → 4, and the Workers test pool with it

**Date:** 2026-10-31
**Branch:** `dev/vitest-4` (off `staging`)
**Owner:** Jamie (dev lead). Dave acks joint sections.

**Short form: sections 1, 2, 3, 6, 11 — approved by Jamie 2026-10-31.**
Sections 4, 5, 7, 8, 9 and 10 are recorded n/a below, each with its reason.

Replaces the permanent pin recorded by PR #330. Target, verified against npm on
2026-10-31: `vitest@^4.1.12` with `@cloudflare/vitest-pool-workers@^0.19.1`.

---

## 1. What it is
Settled: Jamie 2026-10-31 (item 6 → rec accepted; 1–5 assumptions stand) · Ack: n/a (no joint content)

1. **The problem.** The suite is frozen on `vitest@2.1.9` with
   `@cloudflare/vitest-pool-workers@0.12.21`. Both are the last release on their line, so no
   patch will ever arrive for either. The pool pins its own `miniflare 4.20260310.0` and
   `wrangler 4.72.0`, while root `wrangler` is at `^4.80.0` and keeps climbing — so
   `tests/worker/**` asserts against an ever-older workerd than dev, build and deploy run.
   (assumed — stated in `.github/dependabot.yml` and verified against npm today)
2. **Who it is for.** Jamie and Dave, the only people who run the suite. No player-visible
   change whatsoever. (assumed)
3. **Why now.** PR #330 stops the Dependabot churn (#326, #328, #329 each died on ERESOLVE
   before a test ran) but in exchange makes the freeze permanent *and silent* — three
   `ignore` entries mean nothing in CI will ever raise it again. The only reminder is a
   prose entry in `CLAUDE.md`. Doing it now, while the reasoning is fresh and written down,
   is cheaper than rediscovering it in six months. (assumed)
4. **Target versions.** `vitest@^4.1.12` with `@cloudflare/vitest-pool-workers@^0.19.1`.
   `0.19.1` is deliberate, not "latest": it is the newest pool still on a **stable**
   miniflare (`4.20260730.0`). Re-verified against npm 2026-10-31 — `0.19.2` does not
   exist, and every release `0.20.0` through `0.23.0` ships a miniflare **5 alpha**.
   (assumed)
5. **vitest 5 is not reachable and is not the target.** `5.0.5` is the current latest, but
   pool `0.23.0` — the newest pool release — still declares peer `vitest "^4.1.0"`. 4 is
   the ceiling until Cloudflare moves. (assumed — verified against npm today)
6. **Do we stop at `vitest@3.2.7` on the way, or jump straight to 4?**
   **My rec: go to 4, but in two commits on one branch, with 3.2.7 as the first.**
   Why: every test-file breakage this task owes is a **vitest 3** change, not a 4 change —
   `useFakeTimers` losing its default `toFake` (20 uses, 8 files), `vi.spyOn` reusing an
   existing mock (9 uses, 3 files), and `mock.invocationCallOrder` starting at 1 (3 uses,
   1 file). Every *config* breakage is a **vitest 4** change — the workspace file, the pool
   rewrite, the Pi caps. Those are two disjoint sets of risk. Commit 1 moves `vitest` to
   `3.2.7` alone, touching no config and not moving the pool (`3.2.7` sits inside the
   pool's `"2.0.x - 3.2.x"` peer range and resolves cleanly today), and we prove the suite
   green with both projects still running. Commit 2 then moves to `4.1.12` + pool `0.19.1`
   and does the config work. One PR, one review, but a bisectable line down the middle: if
   the suite goes red we know immediately which half did it. Two *PRs* would cost a second
   round of gates and leave `main` sitting on an unsupported pairing in between — the
   pairing is fine for ten minutes, not for days.
   **Settled 2026-10-31: recommendation accepted — 3.2.7 then 4, two commits, one PR.**

## 2. Out of scope
Settled: Jamie 2026-10-31 (items 13, 14 → recs accepted; 7–12, 15 assumptions stand) · Ack: n/a (no joint content)

7. **Playwright and the e2e suite are not touched.** Four spec files under `e2e/`, plus
   `playwright.config.ts`. `@playwright/test` stays ignored in `.github/dependabot.yml` for
   its own reasons. (assumed)
8. **No test is rewritten to be a better test.** Only breakage caused by the version move is
   fixed. A spec that reveals itself to be weak under vitest 4 gets a follow-up issue, not a
   rewrite in this PR. (assumed)
9. **Root `wrangler` stays at `^4.80.0`.** The pool bump moves the pool's *own* bundled
   `miniflare`/`wrangler`, which is the entire point, but no root dependency is bumped
   alongside. The nine open Dependabot PRs stay open and are not merged as part of this.
   (assumed)
10. **The behavioural contract of `vitest.workers.config.ts` is preserved exactly** —
    `isolatedStorage: true`, the `ANALYTICS_DB` → `clumeral-analytics-test` binding,
    `nodejs_compat`, and `readD1Migrations` pointed at `migrations/analytics` specifically.
    The file is rewritten; what it *does* is not changed. (assumed)
11. **No migration file is added, changed or renamed.** (assumed)
12. **vitest 5 is out of scope** — unreachable, see item 5. (assumed)
13. **Do we move `compatibilityDate: '2026-03-09'` forward while we are in that file?**
    My rec: **no, leave it.** Why: it is not an arbitrary date — it matches
    `wrangler.jsonc`'s `compatibility_date` exactly, so the test worker and production share
    one set of compat semantics. Pool `0.19.1` brings a newer workerd *binary*, which is the
    upgrade we want; the compat date is the separate behaviour switch, and moving it on the
    test side alone would create a divergence from production that this PR has no reason to
    create. If it should move, it should move in both files, as its own change.
    **Settled 2026-10-31: no — leave it at 2026-03-09.**
14. **Do we un-ignore `@playwright/test` at the same time, since it sits in the same
    `ignore` block?**
    My rec: **no.** Why: different risk profile — e2e runs against a production build, so its
    failures are build-shaped, not unit-shaped. More to the point, every e2e job on GitHub is
    currently red for an unrelated reason: `ubuntu-latest` rolled to 26.04 around 2026-10-27
    and Playwright does not ship a chromium for it. Bundling a Playwright bump in here would
    make a red e2e job ambiguous at exactly the moment I need it to be readable.
    **Settled 2026-10-31: no — leave it ignored.**
15. **The CI workflow files are not touched by this PR.** The `ubuntu-24.04` runner pin that
    fixes the e2e jobs is already on #330's queue to `main`. (assumed)

## 3. How it works
Settled: Jamie 2026-10-31 (items 21, 23, 25 → recs accepted; rest assumptions) · Ack: pending — Dave, §3

### Verified firsthand, not taken on trust

Probed in a scratch install of `vitest@4.1.12` + pool `0.19.1` on 2026-10-31. These are
measurements, not readings of a migration guide:

- **No `vitest.workspace` string exists anywhere in `vitest@4.1.12`'s dist.** The workspace
  file is not deprecated-with-a-warning; it is invisible. Nothing will tell us.
- **`defineWorkersConfig` does not exist anywhere in pool `0.19.1`,** and the `./config`
  subpath export is gone. The package exports exactly three paths: `.`, `./types`,
  `./codemods/vitest-v3-to-v4`. The root exports `cloudflareTest`, `cloudflarePool`,
  `readD1Migrations` and `assertCompatibleVitestVersion`, among others.
- **`cloudflareTest(options)` accepts an async callback** —
  `WorkersPoolOptions | ((ctx) => Promise<WorkersPoolOptions> | WorkersPoolOptions)` — so the
  `readD1Migrations` await moves inside it and stays typed. The rewrite is clean, not a
  workaround.
- **The codemod's target shape**, read from its source: the contents of
  `test.poolOptions.workers` become the argument to `cloudflareTest(...)`, which moves into
  `plugins`, and `test.poolOptions` is deleted. It refuses our file because it throws on a
  function argument to `defineWorkersProject`/`defineWorkersConfig` — confirmed in its source.
- **vitest 4 validates project config filenames** against `(vitest|vite).*.config.*`.
  `vitest.workers.config.ts` passes. An arbitrary name is a hard `Collect Error`, so any new
  project file must be named to the pattern.
- **`basic` reporter: a non-issue.** Not configured anywhere in this repo — no `reporters` key
  in any vitest config, package.json script or workflow. Nothing to migrate.
- **`test`/`describe` third-argument options object: not used.** No occurrences in `tests/`.
- **Pool `0.19.1` bundles `miniflare 4.20260730.0` and `wrangler 4.116.0`.** Note the
  direction: `4.116.0` is *ahead* of root `wrangler@^4.80.0`, so after this upgrade the test
  runtime is newer than dev and production, not older. The drift the pin created is not merely
  closed, it inverts.
- **vitest 4 silently accepts `minWorkers`** — no error, no warning, run passes. So leaving it
  in would make it dead config rather than a crash. Removing it is correctness, not necessity.

### The hazard, and a second form of it the task did not name

Measured: **when the root config defines `test.projects`, the root's own `test.include` does
not run.** A probe with a root `include` plus two project files ran only the two projects; the
root's own spec file was silently dropped — no warning, exit 0.

So there are two ways to lose a whole suite silently here, not one:

1. Keep `vitest.workspace.ts` → vitest 4 ignores it, falls back to one default project, and
   `tests/worker/**` is dropped because `vitest.config.ts:25` excludes it. Green, incomplete.
2. Add `projects` to `vitest.config.ts` but leave its jsdom `include` in place → the **jsdom**
   suite is dropped instead. Also green, also incomplete.

Both exit 0. **"The tests passed" cannot detect either.** This is why item 23 exists.

### Added 2026-10-31 — commit 1's premise, verified rather than assumed

Both checked after §3 settled. They **confirm** the settled sequencing rather than change it,
so §3's ack is not reopened.

48. **`vitest@3.2.7` resolves against pool `0.12.21` untouched.** Resolved in a scratch copy of
    this repo's manifest: `vitest 3.2.7`, pool stays `0.12.21`, root `wrangler` stays `4.80.0`,
    no ERESOLVE. So commit 1 really is a one-package move. (assumed — verified by resolved
    lockfile)
49. **`vitest@3.2.7` still reads `vitest.workspace.ts`, and says so out loud.** Functionally
    tested with a two-project workspace file: both projects ran, and vitest printed

    > `DEPRECATED  The workspace file is deprecated and will be removed in the next major.`
    > `Please, use the test.projects field in the root config file instead.`

    This is a better reason for the 3.2.7 stop than the bisect argument alone. 3.2.7 is the
    **only** version in this upgrade that warns about the hazard: the `vitest.workspace` string
    is present in `3.2.7`'s dist and absent from `4.1.12`'s, so vitest 2 is silent because it is
    too early and vitest 4 is silent because the support is gone. Commit 1 therefore ends with
    the tooling itself naming commit 2's main task. (assumed — measured)

### How the work is sequenced

16. **Commit 1 — `vitest` to `3.2.7` alone.** `package.json` and `package-lock.json` only. The
    pool is not moved (`3.2.7` sits inside its `"2.0.x - 3.2.x"` peer range), and no config file
    is touched, so `vitest.workspace.ts` keeps working and both projects keep running. (assumed)
17. **The test-file fixes land in commit 1,** because every one of them is a vitest 3 change:
    `useFakeTimers` (20 uses, 8 files — confirmed by count), `vi.spyOn` (9 uses, 3 files),
    `mock.invocationCallOrder` (3 uses, 1 file), and the single `vi.restoreAllMocks`. (assumed)
18. **Commit 1's gate is `npm test` green *and* both projects still enumerated** — not green
    alone. (assumed)
19. **Commit 2 — `vitest` to `4.1.12`, pool to `0.19.1`, plus all the config work.** (assumed)
20. **`vitest.workspace.ts` is deleted.** (assumed)
21. **What replaces the workspace file?**
    My rec: **a new `vitest.jsdom.config.ts` holding the jsdom project, and `vitest.config.ts`
    reduced to a root that holds only `test.projects` and the genuinely global options.**
    Why: the measured behaviour above means the root config cannot also *be* a project. Keeping
    jsdom in the root file while adding `projects` to it is precisely failure mode 2 — and it is
    the shape a reader would reach for first, which is what makes it dangerous. Two projects,
    two files, one root that is obviously not a project, removes the ambiguity structurally
    rather than by comment. `vitest.workers.config.ts` already sets the precedent. The filename
    satisfies vitest 4's `(vitest|vite).*.config.*` validation.
    The alternative is inlining the jsdom project as an object inside the root's `projects`
    array — fewer files, but the root file then holds both global options and one project's
    options, which is the confusion we are trying to design out.
    **Settled 2026-10-31: recommendation accepted — new `vitest.jsdom.config.ts`.**
22. **Both projects get an explicit `test.name`** — `jsdom` and `workers`. (assumed) Why: the
    guard in item 23 asserts on project names, and a name auto-derived from a filename is an
    implementation detail that could change under us.
23. **How do we prove `tests/worker/**` actually ran — durably, not just once by eye?**
    My rec: **a guard script wired into `npm test`, asserting on `vitest list --json`.**
    Verified available: `vitest list --json` emits one record per collected test as
    `{ name, file, projectName }`. The script asserts both `jsdom` and `workers` appear and
    each has a non-zero count, and exits non-zero otherwise. Why this and not something
    lighter: `tests/worker/harness.spec.ts` *already* proves the workers project works properly
    when it runs — migrations applied, real D1, `isolatedStorage` rolling back. The only
    failure mode it cannot catch is the project not being run at all, which is exactly the
    hazard. The guard closes precisely that gap and nothing else.
    Considered and rejected: reading the reporter's project names by eye (works once, protects
    nobody later); a spec that asserts `import.meta.env` (a spec that is not run cannot fail).
    **Settled 2026-10-31: recommendation accepted — guard script wired into `npm test`.**
24. **The #313 Pi caps: `maxWorkers: 2` off CI, `minWorkers` removed.** Measured, not inferred
    — with no cap, six independent spec files reached peak concurrency **6**, confirming
    `vitest run` takes all available parallelism and the cap is still load-bearing. (assumed)
25. **Where do the Pi caps go — the root config, or the jsdom project config?**
    My rec: **the root config.** Both work: measured peak concurrency with six files was **1**
    with a project-level `maxWorkers: 1`, and **1** with a root-level one, versus **6** with no
    cap — so a project-level cap is honoured, and a root-level cap is inherited by the project.
    The reason to prefer root: it is one knob, and a third project added later inherits it
    instead of being born uncapped.
    **But be clear what it changes.** Today the cap lives in `vitest.config.ts`, which under
    the workspace file is *one project* — so the workers project has never been capped on the
    Pi, and the Pi has survived that. Root placement caps it too. That is strictly safer on
    memory and only costs wall-clock on four spec files, but it *is* a behaviour change to the
    one setting whose failure cost nine hours of a wedged box.
    **Neither placement can be validated from a laptop.** This needs Jamie to confirm on the
    Pi — see §11. I am flagging it rather than asserting it.
    **Settled 2026-10-31: recommendation accepted — root config, pending Pi confirmation.**
26. **The one concrete fake-timer risk is `tests/completion-stats.spec.ts`.** Of the eight
    files using `useFakeTimers`, it is the only one that also reaches code calling
    `performance.now()` — which vitest 3 began faking by default when it dropped `toFake`.
    `performance.now()` appears only in `src/octo.ts` and `src/bubbles.ts` (animation), and
    only `completion-stats.spec.ts` and `completion-links.spec.ts` touch those; of those two,
    only `completion-stats.spec.ts` fakes timers. The other seven fake-timer files are clear.
    (assumed — from a full grep of `tests/` and `src/`)

## 4. Maths
Settled: n/a (short form, approved by Jamie 2026-10-31) · Ack: n/a

n/a — Touches no puzzle generation, seeding or filtering — the change is confined to test tooling. Dave's blocking maths sign-off is therefore not required for this brief.

## 5. State & persistence
Settled: n/a (short form, approved by Jamie 2026-10-31) · Ack: n/a

n/a — Nothing is stored. No localStorage, no sessionStorage, no URL state, no server state. The only persisted artefact is `package-lock.json`.

## 6. How it fits
Settled: Jamie 2026-10-31 (items 31, 32 → recs accepted; rest assumptions) · Ack: pending — Dave, §6

27. **Commit 1 touches** `package.json`, `package-lock.json`, and whichever of the eight
    `useFakeTimers` files / three `vi.spyOn` files / one `invocationCallOrder` file actually
    break. No config file. (assumed)
28. **Commit 2 touches** `package.json`, `package-lock.json`, `vitest.config.ts` (reduced to a
    root), `vitest.jsdom.config.ts` (new), `vitest.workers.config.ts` (rewritten),
    `vitest.workspace.ts` (deleted), and a new guard script under `scripts/`. The `test` script
    in `package.json` gains the guard. (assumed)
29. **Nothing under `src/`, `migrations/`, `e2e/` or `.github/workflows/` is touched.** No
    worker or runtime code changes, so `wrangler.jsonc` is untouched too. (assumed)
30. **`tests/wrangler-bindings.spec.ts` keeps its job.** It asserts `wrangler.jsonc` still
    declares an `ANALYTICS_DB` binding, which is what stops the duplicated binding in the test
    config from drifting. The rewrite must not lose that relationship — the comment explaining
    it moves with the config. (assumed)
31. **Do we lift the three Dependabot `ignore` entries, as the task set out — and remove the
    `CLAUDE.md` outstanding action?**
    My rec: **no. Narrow and rewrite them instead; do not lift them.** Verified against npm
    2026-10-31, and this contradicts the task as briefed:
    - No pool release peers vitest 5. `0.23.0`, the newest, still declares `vitest "^4.1.0"`.
      So lifting the `vitest` major ignore has Dependabot propose vitest 5 against a pool that
      cannot accept it — ERESOLVE, every CI job dead before a test runs, which is #326, #328
      and #329 again verbatim.
    - `@vitest/*` major is the same case, via the transitively-tracked `@vitest/mocker` that
      #329 was filed against.
    - Lifting the pool's *minor* ignore has Dependabot propose `0.23.0`, and every pool from
      `0.20.0` onward ships a **miniflare 5 alpha** (`5.20260730.0-alpha` through
      `5.20260815.0-alpha`). An alpha runtime under the D1 assertions is worse than an old one.
    The peer-lock is **structural**, not a symptom of being on vitest 2. Reaching 4 moves the
    wall from the 2→4 boundary to the 4→5 one; it does not remove it. So the entries stay, and
    what changes is their *reasons* — and the `CLAUDE.md` outstanding action is **rewritten,
    not deleted**: it stops saying "upgrade 2→4" (done) and starts saying "the pool gates
    vitest's major; revisit when a pool release peers `^5`, and when pool 0.x returns to a
    stable miniflare".
    The cost of my recommendation: the repo keeps three `ignore` entries indefinitely, which
    looks like unfinished business to a reader. The rewritten comments are what stop it being
    mistaken for that.
    **Settled 2026-10-31: recommendation accepted — narrow and rewrite, do not lift.**
32. **Which branches, and how many PRs?**
    My rec: **two PRs, sequenced, and the second cannot be written yet.**
    - **PR A — `dev/vitest-4` → `staging`.** The upgrade: both commits, the brief, the plan.
      Touches no `.github/` file. This is the PR this brief is for.
    - **PR B — a narrow branch off `main`,** rewriting the three `ignore` reasons in
      `.github/dependabot.yml` and the `CLAUDE.md` outstanding action. Per
      `docs/GIT-WORKFLOW.md` ("What else lands on `main`"), GitHub reads
      `.github/dependabot.yml` from the default branch only, so routing it through `staging`
      leaves it inert for months. It must target `main` directly and stay narrow.
    **Why B cannot be written yet, and must not be rushed.** The `ignore` entries do not exist
    on `staging` or on `main` — checked: `.github/dependabot.yml` is absent from `staging`
    entirely, and `origin/main`'s copy mentions `vitest` once, in a group comment. They exist
    only on the unmerged #330. So B has nothing to edit until #330 lands on `main`. Worse, if B
    went in while `main` is still on vitest 2, Dependabot would re-file against a vitest-2
    `main` and the churn would return immediately. **B lands only after the upgrade itself has
    reached `main` via the normal `staging` → `main` release.** (assumed, but stated explicitly
    because getting the order wrong restores the exact problem #330 fixed)
    **Settled 2026-10-31: recommendation accepted — two PRs, B only after `main` has vitest 4.**
### Added 2026-10-31, after §6 settled — the #325 runtime-skew risk, checked

Raised by the #330 session: a types-only bump there moved root `wrangler` 4.80.0 → 4.146.0
via `wrangler`'s *optional* peer on `@cloudflare/workers-types@^5`, pulling a miniflare 5
alpha, while `@cloudflare/vite-plugin@1.31.0` still pinned wrangler 4.80.0 on miniflare 4.
`npm run e2e:db` wrote `.wrangler` D1 state with the new workerd and `vite preview` read it
with the old one: `table _cf_ALARM has 3 columns but 2 values were supplied`, which surfaces
in CI only as `ERR_RUNTIME_FAILURE`.

These items **confirm** the settled decisions rather than change them, so they do not reopen
§6 or invalidate its ack. Resolved in a scratch copy of this repo's `package.json` and
`package-lock.json` with `npm install --package-lock-only`, so nothing in the repo moved:

44. **This change cannot reproduce that skew.** The pool's runtime stays **fully nested**:

    | | today, pool `0.12.21` | after, pool `0.19.1` |
    |---|---|---|
    | **root** `wrangler` | 4.80.0 | **4.80.0 — unchanged** |
    | **root** `miniflare` | 4.20260401.0 | **unchanged** |
    | **root** `workerd` | 1.20260401.1 | **unchanged** |
    | pool's nested `wrangler` | 4.72.0 | 4.116.0 |
    | pool's nested `miniflare` | 4.20260310.0 | 4.20260730.0 |
    | pool's nested `workerd` | 1.20260310.1 | 1.20260730.1 |

    Root stays put because `@cloudflare/vite-plugin@1.31.0` holds `miniflare 4.20260401.0`
    and `wrangler 4.80.0` as **exact dependencies**, not ranges, so the pool's newer copies
    cannot hoist over them. `npm run e2e:db` uses root `wrangler` and `vite preview` uses
    vite-plugin's `workerd` — my change moves neither. The dry-run also resolves with no
    ERESOLVE. (assumed — verified by resolved lockfile, not inference)
45. **The pool's newer runtime is confined to `tests/worker/**`,** which binds an isolated
    `clumeral-analytics-test` D1 and contains no reference to `.wrangler` anywhere. So the
    newer workerd never touches the local D1 state that e2e shares. (assumed — grepped)
46. **A caveat #331 needs, and this is the one place our work touches.** The tree already
    carries **two** `miniflare` and **two** `workerd` versions *today*, because the pool pins
    `miniflare` as an exact dependency of its own. This change does not add that duplication —
    it only moves the nested version. So #331's stated acceptance criterion,
    `npm ls miniflare workerd` showing a single version of each, cannot pass while the pool is
    installed, before or after this work. It needs rewording to exclude the pool's nested copy,
    or it will read as a regression this PR caused. Passed back to that session. (assumed)
47. **The PR description states the resolved `wrangler`/`miniflare` versions,** root and
    nested — **the table in item 44 above, verbatim.** #331 is sequenced behind this branch by
    Jamie's decision and cites this PR as its baseline, so the table is an obligation, not a
    courtesy. Copy it from item 44 rather than re-deriving it; it was resolved from a scratch
    copy of the manifest and the context in which it was measured will not survive to Build.
    (assumed — asked for by the #330 session, and #331 now has a "Baseline" section citing it)

33. **No GitHub issue is filed.** The branch is `dev/vitest-4`, the "work without a GitHub
    issue" form in `docs/GIT-WORKFLOW.md`'s branch table, and the brief and plan files are the
    durable record. (assumed — say so if you would rather it had an issue and a roadmap card)

## 7. How it looks
Settled: n/a (short form, approved by Jamie 2026-10-31) · Ack: n/a

n/a — No DOM, no CSS, no rendered output. The only visible surface is terminal test output, and its format is not being changed deliberately — see item 25 in §3 on the `basic` reporter.

## 8. Copy & wording
Settled: n/a (short form, approved by Jamie 2026-10-31) · Ack: n/a

n/a — No user-facing strings. Comments in the config files are rewritten, but they are developer documentation and are covered by §3.

## 9. Accessibility
Settled: n/a (short form, approved by Jamie 2026-10-31) · Ack: n/a

n/a — Nothing reaches a browser. Jamie's blocking accessibility sign-off is therefore not required for this brief.

## 10. Analytics
Settled: n/a (short form, approved by Jamie 2026-10-31) · Ack: n/a

n/a — No runtime or worker code changes, so there is nothing new to instrument and no existing event is affected.

## 11. Done / test plan
Settled: Jamie 2026-10-31 (items 39, 41 → recs accepted; rest assumptions) · Ack: pending — Dave, §11

### The baseline, measured today before anything moved

Run on this branch under `vitest@2.1.9` + pool `0.12.21`, 2026-10-31:

| Project | Test files | Tests |
|---|---|---|
| jsdom | 37 | 723 |
| workers | 4 | 103 — harness 4, schema 6, analytics-db 44, backfill 49 |
| **Total** | **41** | **826** — all passing, 6.21s |

34. **`41` files and `826` tests is the acceptance number for every step.** (assumed) This is
    the strongest check available, and it is why it is written down *before* the work: both
    silent-drop failure modes change this number and nothing else about the run. Losing the
    workers project reads `37 / 723`; losing jsdom reads `4 / 103`. Either is green.
35. **Commit 1 is done when** `npm test` reports `41 / 826` passing under `vitest@3.2.7`, with
    the workspace file untouched. (assumed)
36. **Commit 2 is done when** `npm test` reports `41 / 826` passing under `vitest@4.1.12` +
    pool `0.19.1`, **and** the guard script passes, **and** `vitest list --json` shows both
    `jsdom` and `workers` as `projectName` values. Three conditions, not one. (assumed)
37. **A side-finding worth keeping.** Under vitest 2, `--config vitest.workers.config.ts` is
    *ignored* while `vitest.workspace.ts` exists — both single-project runs reported the full
    `41 / 826`, because the workspace file wins. So "run one project" is not something this
    repo can currently do by `--config`. Under vitest 4 with named projects, `--project jsdom`
    and `--project workers` will do it properly. A small gain, recorded so nobody hunts for it.
    (assumed)
38. **`npm install` on this repo produces unrelated lockfile churn.** Observed today: a plain
    `npm install` stripped `"dev": true` from 26 optional platform-specific entries, unrelated
    to anything being changed. Each commit's lockfile diff is read before committing, and
    unrelated churn is reverted. (assumed)
39. **What QA level does this warrant — any Playwright run?**
    My rec: **none, as a gate.** Why, and `CLAUDE.md` asks for this to be decided up front
    rather than discovered: the change touches no runtime code at all — nothing under `src/`,
    no worker, no migration — so there is no behaviour for an e2e test to catch that the 826
    unit tests do not already cover. Against that, every e2e job on GitHub is currently red
    because `ubuntu-latest` rolled to 26.04 and Playwright ships no chromium for it, so a
    Playwright run right now returns a red that means nothing about this change. Running it
    would cost 40 minutes to produce an unreadable signal.
    What I would do instead: rely on `41 / 826` plus the guard, and note in the PR that e2e
    was deliberately not run, with this reason, so the next reader does not think it was
    forgotten.
    **Settled 2026-10-31: recommendation accepted — no Playwright gate, skip noted in the PR.**
40. **CI green means the `npm test` step in `ci-smoke.yml`.** The e2e steps in that workflow
    will stay red until #330's `ubuntu-24.04` runner pin reaches `main` — unrelated to this
    change, and not something this PR fixes or should wait for. Stated here so a red checkmark
    on the PR is read correctly rather than chased. (assumed)
41. **The Pi cap cannot be validated from a laptop — who confirms it, and when?**
    My rec: **Jamie runs `npm test` on the Pi from this branch before PR A merges, and it
    blocks the merge.** Why blocking: this is the one setting in the change whose failure mode
    is measured and severe — 2026-08-22, three jsdom workers in a 1000 MB cgroup produced 33.6
    million reclaim events and nine hours of CPU that made almost no progress. My change also
    newly brings the workers project under the cap (item 25), so the Pi's behaviour is not
    identical to today's even though it should be strictly safer. A laptop run proves the cap
    is *honoured* — I measured that — but not that `2` is still the right number on that box.
    Nothing else in this PR has a failure cost anywhere near it, so it is the one thing worth
    blocking on.
    **Settled 2026-10-31: recommendation accepted — Jamie confirms on the Pi, and it blocks
    PR A's merge.**
42. **`da-build` runs on the diff before PR A is opened,** after human review, per `CLAUDE.md`.
    (assumed)
43. **Rollback is a clean revert.** Two commits, no migration, no runtime change, no stored
    state — reverting them restores vitest 2 exactly. Nothing needs undoing anywhere else.
    (assumed)


---

## Outstanding acks

The brief is **not closeable** until these land. Silence is not consent.

- **Dave — §3, §6, §11.** Non-blocking on the work continuing; blocking on closing the brief.
  What he is being asked to ack: the suite becomes three config files instead of two-plus-a-
  workspace (§3 item 21), `npm test` gains a guard step that fails the run if either project
  goes missing (§3 item 23), the Pi cap now covers the workers project too (§3 item 25), and
  no Playwright run gates this change (§11 item 39). Nothing here touches maths, so he has no
  blocking sign-off on this brief — this is the joint-section ack only.
- **Jamie — the brief as a whole,** as dev lead, once Dave has acked or has been overridden.

## Carried forward to the plan

Not decisions, just the things the plan must not lose:

- The test-file surface, counted today: `useFakeTimers` 20 uses / 8 files, `vi.spyOn` 9 uses /
  3 files, `mock.invocationCallOrder` 3 uses / 1 file, `vi.restoreAllMocks` 1 use. No
  snapshots, no `mockReset`, no `toThrowError`, no `mock.results`, no `onTestFinished`, no
  `onTestFailed` anywhere in `tests/`.
- `tests/completion-stats.spec.ts` is the single file where fake timers and `performance.now()`
  code meet (§3 item 26).
- The comments in `vitest.workers.config.ts` that must survive the rewrite, because each one
  records a failure someone already hit: why the binding is declared here rather than read from
  `wrangler.jsonc`; why `readD1Migrations` points at `migrations/analytics` and not `migrations`
  (it does not recurse); why the feedback migrations must stay out (0003 and 0004 are
  `ALTER TABLE ADD COLUMN` against columns 0001 already creates, so a fresh DB fails on
  duplicate column); and what `isolatedStorage` buys.
- The `cloudflareTest` target shape, from the codemod's own source: `test.poolOptions.workers`
  contents become its argument, it goes in `plugins`, `test.poolOptions` is deleted. It takes
  an async callback, so `readD1Migrations` moves inside it.
- PR B's wording, and the fact that it cannot be written until #330 has merged **and** the
  upgrade has reached `main`.
