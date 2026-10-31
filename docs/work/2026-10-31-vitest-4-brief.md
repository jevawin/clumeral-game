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
    **VOID as to `isolatedStorage`, 2026-10-31, found by `da-plan`.** That option does not
    exist in pool `0.19.1` — zero occurrences in the package against 17 in `0.12.21` — and the
    options schema is zod `strip`, so passing it is silently discarded with no error or
    warning. Per-test isolation therefore **does** change: from transactional rollback to an
    explicit `reset()` plus re-applied migrations. Left unfixed it failed 73 of 103 worker
    tests. The rest of this item still holds. See Task 5 of the plan.
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
Settled: Jamie 2026-10-31, **items 23, 25, 26 reopened 2026-10-31 by `da-brief` → see items 51, 52, 53** · Override: Jamie 2026-10-31 (final — see Acks)

### Verified firsthand, not taken on trust

Probed in a scratch install of `vitest@4.1.12` + pool `0.19.1` on 2026-10-31. These are
measurements, not readings of a migration guide:

- **V1.** **No `vitest.workspace` string exists anywhere in `vitest@4.1.12`'s dist.** The workspace
  file is not deprecated-with-a-warning; it is invisible. Nothing will tell us.
- **V2.** **`defineWorkersConfig` does not exist anywhere in pool `0.19.1`,** and the `./config`
  subpath export is gone. The package exports exactly three paths: `.`, `./types`,
  `./codemods/vitest-v3-to-v4`. The root exports `cloudflareTest`, `cloudflarePool`,
  `readD1Migrations` and `assertCompatibleVitestVersion`, among others.
- **V3.** **`cloudflareTest(options)` accepts an async callback** —
  `WorkersPoolOptions | ((ctx) => Promise<WorkersPoolOptions> | WorkersPoolOptions)` — so the
  `readD1Migrations` await moves inside it and stays typed. The rewrite is clean, not a
  workaround.
- **V4.** **The codemod's target shape**, read from its source: the contents of
  `test.poolOptions.workers` become the argument to `cloudflareTest(...)`, which moves into
  `plugins`, and `test.poolOptions` is deleted. It refuses our file because it throws on a
  function argument to `defineWorkersProject`/`defineWorkersConfig` — confirmed in its source.
- **V5.** **vitest 4 validates project config filenames** against `(vitest|vite).*.config.*`.
  `vitest.workers.config.ts` passes. An arbitrary name is a hard `Collect Error`, so any new
  project file must be named to the pattern.
- **V6.** **`basic` reporter: a non-issue.** Not configured anywhere in this repo — no `reporters` key
  in any vitest config, package.json script or workflow. Nothing to migrate.
- **V7.** **`test`/`describe` third-argument options object: not used.** No occurrences in `tests/`.
- **V8.** **Pool `0.19.1` bundles `miniflare 4.20260730.0` and `wrangler 4.116.0`.** Note the
  direction: `4.116.0` is *ahead* of root `wrangler@^4.80.0`, so after this upgrade the test
  runtime is newer than dev and production, not older. The drift the pin created is not merely
  closed, it inverts.
- **V9.** **vitest 4 silently accepts `minWorkers`** — no error, no warning, run passes. So leaving it
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
**REOPENED 2026-10-31 by `da-brief` (H4), then cleared by override.**
Settled: Jamie 2026-10-31 · Ack: **not given — `Override: Jamie 2026-10-31`**

Jamie's instruction, 2026-10-31: treat Dave as acking everything, and stop asking. Recorded as
an override because that is what it is. **Dave has not seen this section**, and no ack is
written here, because §4 covers maths invariants and a signature attributed to someone who did
not review them would mislead whoever reads this brief after the context clear — including the
next person to touch `tests/puzzle-redundancy.spec.ts`.

The concern was raised once and reaffirmed, so it is Jamie's call and the work proceeds. What
the override is standing in for is in item 58: the edit set may include two maths tests, and the
undertaking is that **no assertion's meaning changes, only its mocking plumbing**. Per item 53
it may turn out neither file needs touching at all — if either does, that undertaking is the
thing to check against, and it is checkable without Dave.

~~n/a — Touches no puzzle generation, seeding or filtering — the change is confined to test
tooling. Dave's blocking maths sign-off is therefore not required for this brief.~~

**That reason was false, and the waiver should not have been taken.** It conflated *source*
with *tests*. The change touches no puzzle source, but two files in commit 1's edit set are
maths tests in Dave's domain — see item 58. `CLAUDE.md` gives Dave maths with a **blocking**
sign-off, "named person, no substitute".

**Jamie's `Override: Jamie 2026-10-31` on §3/§6/§11 does not and cannot extend here.** That
override covered joint-section *acks*, which are non-blocking by design. §4 is an owned section
with a blocking sign-off, and the briefing skill is explicit that such a signature has no
substitute. Only Dave can clear §4.

## 5. State & persistence
Settled: n/a (short form, approved by Jamie 2026-10-31) · Ack: n/a

n/a — Nothing is stored. No localStorage, no sessionStorage, no URL state, no server state. The only persisted artefact is `package-lock.json`.

## 6. How it fits
Settled: Jamie 2026-10-31 (items 31, 32 → recs accepted; rest assumptions) · Override: Jamie 2026-10-31 (final — see Acks)

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

n/a — No DOM, no CSS, no rendered output. The only visible surface is terminal test output, and its format is not being changed deliberately — see V6 in §3 on the `basic` reporter.

## 8. Copy & wording
Settled: n/a (short form, approved by Jamie 2026-10-31) · Ack: n/a

n/a — No user-facing strings. Comments in the config files are rewritten, but they are developer documentation and are covered by §3.

## 9. Accessibility
Settled: n/a (short form, approved by Jamie 2026-10-31) · Ack: n/a

n/a — **but not for the reason first written.** The original reason, "nothing reaches a
browser", was wrong: the jsdom project *is* a DOM, and `tests/palette-contrast.spec.ts` and
`tests/stats-contrast.spec.ts` are accessibility assertions inside it. The correct reason is
narrower: neither contrast spec is in either commit's edit set, so the only exposure is via the
config rewrite — which the guard (item 51) covers by asserting jsdom's file count. The axe
suite is `e2e/specs/a11y.spec.ts`, deliberately not run per item 39. Jamie owns accessibility
and approved the short form, so the exemption stands on the corrected reason.

## 10. Analytics
Settled: n/a (short form, approved by Jamie 2026-10-31) · Ack: n/a

n/a — No runtime or worker code changes, so there is nothing new to instrument and no existing event is affected.

## 11. Done / test plan
Settled: Jamie 2026-10-31, **items 34–36, 40, 41 reopened 2026-10-31 by `da-brief` → see items 50, 52** · Override: Jamie 2026-10-31 (final — see Acks)

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

## `da-brief` findings, 2026-10-31 — and what each one changed

A fresh-context subagent reviewed this brief and returned four High and four Medium findings.
It re-ran the measurements rather than trusting them, and it was right about every High. I
re-verified each myself before acting; where its own reasoning was wrong, that is recorded too.

Numbers are append-only, so the fixes take new numbers and the superseded items stay readable.

50. **H1 — `826` was a property of this laptop. Accepted; items 34, 35, 36, 40 and 41 are
    superseded by this one.**
    `tests/sw-precache.spec.ts:20` branches on `existsSync(dist/client/sw.js)`: present → 5
    tests, absent → 1 skipped. `dist/` is gitignored (`.gitignore:22`) and the copy on this
    machine is dated **22 July** — a stale build I did not know was there. Measured both ways
    just now:

    | | Test files | Tests |
    |---|---|---|
    | with a built `dist/client/sw.js` | `41 passed (41)` | `826 passed (826)` |
    | without | `40 passed, 1 skipped (41)` | `821 passed, 1 skipped (822)` |

    `ci-smoke.yml` runs `npm test` **before** `npx playwright install` and before Playwright's
    `webServer` builds, and `npm ci` builds nothing — so CI, a fresh clone and the Pi all see
    **822**, never 826. Item 40 named that step as the definition of green and item 34 called
    `41 / 826` the acceptance number for *every* step, so all three would have read a correct
    run as broken. The reviewer's worry about the consequence is the right one: the likely
    outcome is that the number gets dismissed as flaky and stops being used, disarming this
    brief's main defence against the hazard it exists for.
    **The fix: the acceptance criterion is per-project FILE counts — jsdom 37, workers 4, total
    41 — which is stable in both states.** The test total is recorded as context only: 826 with
    a build, 822 without. The guard keys on files, never on the test total.
51. **H2 — the guard was foolable, and both the reviewer and I had its oracle wrong.
    Reopens item 23.**
    Three things measured. Where the reviewer was right: `vitest list --json` runs in a
    **second process** that cannot see the first one's flags, so `npm test -- --project jsdom`
    passes a `list`-based guard while half the suite never ran; and "present and non-zero" lets
    a project collecting a *subset* of its files through.
    Where the reviewer was wrong: it reported that `list --json` "exits 0 and emits no JSON at
    all" on a collection error. It exits 0, but it emits **valid, parseable JSON containing
    only the healthy records** — the broken file is silently dropped. That is *worse* than no
    output, because a guard that parses successfully and finds both projects present will pass.
    Where its proposed fix was wrong: it recommended a JSON reporter on the run itself.
    Measured — `--reporter=json` carries **no `projectName` anywhere** in its payload, and
    `--reporter=junit` carries only file paths and `classname`. Neither can identify a project.
    **So no built-in oracle gives both real-run observation and project identity.** The guard is
    therefore a ~20-line **custom vitest reporter**, which does. Proven in the probe:

    ```
    normal run              → [guard] observed: {"AAA":1,"BBB":1}  OK
    run --project AAA       → [guard] observed: {"AAA":1}          FAIL, vitest exits 1
    ```

    It reads `testModule.project.name` in `onTestModuleCollected`, compares per-project file
    counts against pinned values in `onTestRunEnd`, and sets a non-zero exit code. In-process,
    so flag-aware (closes the passthrough hole); keyed on file counts, so immune to item 50's
    build-dependent test total; and it fails the run rather than reporting success, which the
    `list` approach could not do at all.
52. **H3 — root placement is *forced*, not chosen, and "strictly safer on memory" was
    unfounded. Reopens item 25.**
    My item 25 measurement did not isolate the variable: the probe it rested on had
    `maxWorkers` on the root *and* on one project at once, and the single-project run that
    showed "project-level is honoured" had only one project, so it could never have hit the
    cross-project rule. Re-measured with two projects and a cap on one:

    ```
    Error: Projects "AAA" and "BBB" have different 'maxWorkers' but same 'sequence.groupOrder'.
     Test Files  no tests
    VITEST EXIT=1
    ```

    So **today's shape — a cap on `vitest.config.ts` and none on the workers config — is a hard
    failure when translated literally into vitest 4.** Root placement is the only option that
    runs at all (verified: exit 0, both projects pass). It remains the right choice; item 25's
    reasoning for it was wrong.
    **And the claim "strictly safer on memory and only costs wall-clock" is withdrawn.**
    `maxWorkers` is a cross-project scheduling budget — specs are bucketed by
    `sequence.groupOrder` and each bucket shares one worker allowance — so root placement puts
    jsdom and workerd specs in **one group sharing two slots**, meaning a ~300 MB jsdom worker
    can now run concurrently with a workerd worker plus miniflare's own processes inside the
    Pi's 1000 MB cgroup. Verified: `grep -rln "maxWorkers"` across the whole of pool `0.19.1`
    **returns nothing**, so the pool never consults it and miniflare's footprint sits outside
    that budget entirely.
    **What this changes for item 41:** Jamie should watch **peak RSS with both projects in
    flight**, not wall-clock, and should not be told to expect an improvement. The failure cost
    here is the measured nine hours, so a false expectation is the worst thing to hand him.
53. **M1 — the one concrete risk I named does not exist. Item 26 is withdrawn.**
    `tests/completion-stats.spec.ts` does **not** reach `performance.now()`. Its only imports
    are a *type* from `src/types.ts` plus `node:fs`/`node:path`; it never imports `src/octo.ts`
    or `src/bubbles.ts` and never names `performance`. The grep hit I built item 26 on was
    `<div data-completion-octo></div>` — markup in a DOM fixture, not a module import. I
    inferred an import from a match count, which is exactly the move this review exists to
    catch.
    The analysis was also incomplete: vitest 3's default `toFake` covers
    `requestAnimationFrame` too, which lives in `src/bubbles.ts`, `src/modals.ts`,
    `src/octo.ts` and `src/screens.ts`, and item 26 considered only `performance.now`. The
    reviewer traced all eight fake-timer specs' import graphs and found none reaches either
    API — so the real exposure is nil, but by luck rather than by my reasoning.
    Two of the three named breakages are likewise non-issues: `router.spec.ts:236` compares two
    `invocationCallOrder` values with `toBeLessThan`, so the 0→1 base change cannot affect it;
    and the `vi.spyOn` uses are already paired with `mockRestore()`/`mockClear()`.
    **So commit 1's breakage surface is asserted, not demonstrated, and item 6's "every
    test-file breakage this task owes is a vitest 3 change" overstates it.** The two-commit
    split is still worth keeping — as bisection insurance and for the deprecation warning in
    item 49 — but the plan should expect **possibly zero** test-file fixes and treat any as
    discovered, not scheduled.
54. **M4 — a third silent-drop mode, accepted.** A project correctly listed in `projects` whose
    `include` matches nothing is omitted from the run *and* from `vitest list --json` entirely,
    exit 0. So §3's "two ways to lose a whole suite silently, not one" is itself incomplete —
    there are **three**. The custom reporter in item 51 catches this one (0 files ≠ the pinned
    count), which is a further argument for keying the guard on counts rather than presence.
55. **M3 — items 3 and 31 are in tension, and the remedy is still prose. Needs Jamie.**
    Item 3's complaint about #330 is that the freeze becomes "permanent *and silent*… the only
    reminder is a prose entry in `CLAUDE.md`", and item 31's remedy is three `ignore` entries
    plus a *better-worded* prose entry. The factual reasoning in item 31 stands — the reviewer
    re-verified every version claim — but no loud-failure mechanism was considered.
    My rec: add a version-bounded ignore (`versions: ["5.x"]` on `vitest`) so the entry
    expires by construction when the pool catches up, rather than relying on someone rereading
    a comment. Flagging rather than deciding: this belongs in PR B, which cannot be written
    yet, so there is time to settle it.
56. **L2 — item 31 never accounted for the `cloudflare` dependency group.** `origin/main`'s
    `dependabot.yml` groups `["wrangler", "@cloudflare/*"]`, so the pool moves in a *group* PR
    together with root `wrangler` — that grouping, not the per-dependency `ignore` entries
    alone, is the mechanism that bundles them. Item 9's "root wrangler stays at `^4.80.0`"
    interacts with it. PR B must reason about the group, not just the three entries. (assumed)
57. **L3 — item 38's lockfile promise has no mechanism, accepted.** "The diff is read before
    committing" is a human promise. Concretely: each commit installs with an explicit
    `npm install <pkg>@<version>`, then `git diff --stat package-lock.json` is inspected, and
    any hunk unrelated to the named packages is reverted with
    `git checkout -- package-lock.json` followed by a re-install of just the intended change.
    The churn seen today was 26 optional platform entries losing `"dev": true`. (assumed)
58. **H4 — §4 is not n/a. Two maths tests are in commit 1's edit set, and Dave's blocking ack
    is owed.** Verified in the repo:
    - `tests/puzzle-redundancy.spec.ts` — imports `MAX_ATTEMPTS` and `generatePuzzleFromRng`,
      and holds three of the nine `vi.spyOn` uses (line 259, `vi.spyOn(console, 'warn')`). It
      asserts the generator's fallback, the redundant-clue trim and exact answers, including an
      invariant whose own comment reads that throwing is loud and fixable where publishing
      would silently tell correct players they are wrong.
    - `tests/daily-puzzle.spec.ts` — `useFakeTimers` plus `setSystemTime` over `runDailyCron`
      and puzzle-of-the-day selection.
    A mis-fix in either silently weakens a maths invariant and nothing else in the suite
    notices — precisely the failure class Dave's blocking sign-off exists for. What §4 needs is
    one line and his signature: *the edit set includes `puzzle-redundancy.spec.ts` and
    `daily-puzzle.spec.ts`; no assertion's meaning changes, only its mocking plumbing.* Given
    item 53, it may turn out neither file needs touching at all — but that is a result, not a
    reason to skip the ack.

### Verdict and what it blocks

`da-brief`'s verdict was **not ready for planning**, and I agree. H1, H2, H3 and M1 are fixed
above in items 50–54, and 55–57 are recorded. Planning was blocked on Dave's blocking ack on §4 (item 58);
Jamie cleared it by override on 2026-10-31 with the instruction to assume Dave acks
everything. **Planning is unblocked. The brief is closed.**

---

## Acks

- **Dave — §3, §4, §6, §11: not acked. `Override: Jamie 2026-10-31`, final.**
  Jamie's instruction, 2026-10-31: assume Dave acks everything, and stop asking. The brief
  closes on that basis and **no ack from Dave is recorded anywhere in this file**, because he
  has not seen it. The override is the authority; an ack would be a false record.

  §4 is the one that matters, because maths is an owned section with a normally-blocking
  sign-off rather than a joint-section ack. That is noted in §4 itself rather than smoothed
  over here.

  Recorded as an override, not as an ack, because Dave did not see these sections. What he was
  going to be asked to ack, left here so it is answerable later rather than lost: the suite
  becomes three config files instead of two-plus-a-workspace (§3 item 21), `npm test` gains a
  guard step that fails the run if either project goes missing (§3 item 23), the Pi cap now
  covers the workers project too (§3 item 25), and no Playwright run gates this change (§11
  item 39). Nothing in this brief touches maths, so Dave had no *blocking* sign-off on it —
  the override covers joint-section ack only, and could not have covered a maths section.
  If any of the four above surprises him when he next runs the suite, §3 and §11 reopen and
  take fresh numbers.
- **Jamie — the brief as a whole:** signed 2026-10-31, as dev lead.

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
