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
Settled: pending · Ack: pending

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
    Pi — see item 31 in §11. I am flagging it rather than asserting it.
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
Settled: pending · Ack: pending

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
Settled: pending · Ack: pending
