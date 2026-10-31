# Plan — vitest 2 → 4, and the Workers test pool with it

**Date:** 2026-10-31
**Branch:** `dev/vitest-4` (off `staging`)
**Brief:** [2026-10-31-vitest-4-brief.md](2026-10-31-vitest-4-brief.md) — closed.
**Approval:** Jamie, 2026-10-31. Build started on revision 2.
**Revision 2, 2026-10-31** — rewritten after `da-plan`. See the revision log at the end for
what changed and why; revision 1's task sequence was not executable as written.

Gates: no `Ack: pending` remains in the brief; `da-brief` recorded with findings fixed in brief
items 50–58; `da-plan` recorded with findings fixed in this revision.

---

## Shape

Two commits on one branch, split on the version boundary (brief item 6). One PR into `staging`.

| Commit | Moves | Steps |
|---|---|---|
| 1 | `vitest` → `3.2.7` only | Task 1 |
| 2 | `vitest` → `4.1.12`, pool → `0.19.1`, all config | Tasks 2–6, plus Task 8 |

Acceptance throughout is **per-project file counts: jsdom 37, workers 4, total 41** (brief item
50) — never the test total, which is build-dependent (826 local, 822 in CI).

**Commit 2 has exactly one verification point: the end of Task 6.** This is a property of the
tooling, not a choice. Once Task 3 lands, vitest 4 ignores `vitest.workspace.ts` entirely and
falls back to the root config, so until Task 6 lists both projects the run is **jsdom-only and
exit 0**. Nothing between Tasks 3 and 6 can be independently verified, and the plan says so
rather than inventing per-task green states. Build straight through.

---

## Task 1 — `vitest` to `3.2.7`, alone  *(commit 1)*

Implements brief items 16, 17, 18, 48, 49.

**Files:** `package.json`, `package-lock.json`, plus any test file that breaks.

1. `npm install --save-dev vitest@3.2.7`. Nothing else, and **do not** move the pool —
   `3.2.7` sits inside its `"2.0.x - 3.2.x"` peer range (brief item 48).
2. `git diff --stat package-lock.json`. Revert hunks unrelated to `vitest`/`@vitest/*` per
   brief item 57; the known churn is 26 optional platform entries losing `"dev": true`.
3. `npm test`. Expect the deprecation from brief item 49 —
   `DEPRECATED  The workspace file is deprecated…` — whose presence is a **positive** signal
   that the workspace file is still being read.

**Expected breakage: none.** `da-plan` ran the entire real jsdom suite under vitest **4.1.12**
with this plan's jsdom config and got `36 passed | 1 skipped (37 files)`,
`718 passed | 1 skipped (719 tests)`, exit 0, with **no edits to any test file** — including
`tests/puzzle-redundancy.spec.ts` and `tests/daily-puzzle.spec.ts`. Since every breakage the
brief feared is a vitest *3* change and 4 is clean, brief item 53's "possibly zero" is
confirmed from the far side. Treat any failure as discovered, not scheduled.

If something does break, fix only mocking plumbing, never an assertion's meaning — the
undertaking brief item 58 records in place of Dave's signature.

**Done when:** `npm test` reports **41 test files**, zero failures.
**Note on what you can read here:** under vitest 2/3 with the workspace file there are no
usable project labels — the workers files print `|clumeral-game|` (derived from
`package.json`'s `name`, for both configs) and jsdom files print unlabelled. So the total file
count is the only assertion available until Task 6. Per-project counts become readable then.

**Commit:** `test(vitest): step to 3.2.7, the last release that still reads the workspace file`

---

## Task 2 — the project guard  *(commit 2)*

Implements brief items 22, 23 (as superseded by 51), 50, 51, 54.

**New file:** `tests/project-guard.ts` — beside `tests/setup.ts` and
`tests/worker/apply-migrations.ts`, the same kind of test infrastructure. `.ts`, **not**
`.spec.ts`, so the jsdom `include: ['tests/**/*.spec.ts']` does not collect it as a test.

**This file is inert until Task 6.** The `reporters` line that activates it lands there.
Creating it changes nothing observable — revision 1 wrongly described this task as "red by
design".

```ts
import type { Reporter, TestModule } from 'vitest/node';

// Pinned per-project FILE counts, not test counts. Brief item 50: the test total is
// build-dependent — tests/sw-precache.spec.ts contributes 5 tests with a built
// dist/client/sw.js and 1 skipped without, so the total is 826 locally and 822 in CI. The
// file count is 41 either way, and this reporter still sees a file whose only test is
// skipped.
//
// Adding a spec file is therefore a two-line change: the file, and the number below. That is
// deliberate. A guard keyed on "project present and non-zero" passes while a project collects
// only a SUBSET of its files, which is one of three ways this suite can lose coverage and
// still exit 0.
const EXPECTED_FILES: Record<string, number> = {
  jsdom: 37,
  workers: 4,
};

export default class ProjectGuard implements Reporter {
  // Counts accumulate per reporter instance, which is per `vitest run`. In watch mode a
  // second run would double them — this is wired for `npm test` (run mode) only.
  private seen = new Map<string, number>();

  onTestModuleCollected(module: TestModule) {
    const name = module.project.name || '(unnamed)';
    this.seen.set(name, (this.seen.get(name) ?? 0) + 1);
  }

  onTestRunEnd() {
    const problems: string[] = [];

    for (const [project, expected] of Object.entries(EXPECTED_FILES)) {
      const actual = this.seen.get(project) ?? 0;
      if (actual !== expected) {
        problems.push(
          `project "${project}": expected ${expected} test files, ${actual} ran` +
            (actual === 0 ? ' — the project did not run at all' : ''),
        );
      }
    }
    for (const project of this.seen.keys()) {
      if (!(project in EXPECTED_FILES)) {
        problems.push(`unexpected project "${project}" — add it to EXPECTED_FILES or remove it`);
      }
    }

    if (problems.length > 0) {
      console.error(
        '\n[project-guard] FAILED — the run did not cover what it should have:\n  ' +
          problems.join('\n  ') +
          '\n\nIf you added or removed a spec file on purpose, update EXPECTED_FILES in' +
          ' tests/project-guard.ts to match.\n',
      );
      process.exitCode = 1;
      return;
    }

    console.log(
      '[project-guard] both projects ran their full file count ' +
        `(${Object.entries(EXPECTED_FILES).map(([p, n]) => `${p}: ${n}`).join(', ')})`,
    );
  }
}
```

**Why a reporter and not a script over `vitest list --json`** — all measured, brief item 51:
that command runs in a second process blind to the real run's flags, so
`npm test -- --project jsdom` would pass it; on a collection error it exits 0 while emitting
*valid* JSON containing only the healthy records; and `--reporter=json` observes the real run
but carries **no `projectName` anywhere** (nor does `junit`). A reporter is the only oracle
that sees both the real run and project identity, and it can fail the run.

**Verified by `da-plan`, so do not re-litigate:** `Reporter` and `TestModule` are both exported
from `vitest/node` in 4.1.12; `onTestModuleCollected` fires for every file in **both** projects
including the workerd ones under the pool; and `process.exitCode = 1` in `onTestRunEnd` really
does fail the run — a run with 103/103 tests passing exited **1** on the guard alone.

**Deviation from the brief, recorded:** brief item 28 said "a guard script under `scripts/`"
wired via "the `test` script in `package.json`". Both are overruled here — the file lives in
`tests/` and is wired via `test.reporters` in the root config, so an extra CLI argument cannot
drop it. `package.json`'s `test` script is **not** edited. Do not also create a `scripts/` file.

---

## Task 3 — the version bump  *(commit 2)*

Implements brief items 19, 44, 45, 47.

1. `npm install --save-dev vitest@4.1.12 @cloudflare/vitest-pool-workers@0.19.1`
2. Read the lockfile diff as in Task 1.
3. Record the resolved runtime versions — needed verbatim for the PR description (brief item
   47) and as #331's baseline. `da-plan` confirmed these against the repo's real manifest:

   | | expected |
   |---|---|
   | **root** `wrangler` / `miniflare` / `workerd` | `4.80.0` / `4.20260401.0` / `1.20260401.1` — **unchanged** |
   | pool's **nested** copies | `4.116.0` / `4.20260730.0` / `1.20260730.1` |

   Confirm with `npm ls miniflare workerd wrangler`. Root stays put because
   `@cloudflare/vite-plugin@1.31.0` holds both as **exact** dependencies (brief item 44).
   **If root moves, stop** — that is the #325 skew, and it breaks `e2e:db` against
   `vite preview`.
4. **Load the configs under the repo's own vite before touching them.** Run `npm test` and read
   the output. Every measurement behind this plan was taken in a scratch install carrying
   **vite 8.3.5**; the repo pins **vite 8.0.3** and this install does not move it. Expect a
   startup error from `vitest.workers.config.ts` importing the now-gone
   `@cloudflare/vitest-pool-workers/config` subpath (brief V2):

   ```
   Error: Missing "./config" specifier in "@cloudflare/vitest-pool-workers"
   ```

   That error is **correct and expected** at this point. Anything else — particularly a *green*
   run — means read it carefully before continuing.

---

## Task 4 — `vitest.workers.config.ts`, rewritten by hand  *(commit 2)*

Implements brief items 10 (partly void — see Task 5), 19, 30, and V2, V3, V4.

The pool's codemod cannot do this: it throws on a function argument to
`defineWorkersConfig`, and this file passes one (brief V4). `defineWorkersConfig` and the
`./config` subpath no longer exist at all (brief V2).

Target shape, from the codemod's own source: the contents of `test.poolOptions.workers` become
the argument to `cloudflareTest(...)`, which moves into `plugins`; `test.poolOptions` is
deleted. `cloudflareTest` accepts an async callback (brief V3), so the `readD1Migrations` await
moves inside it.

```ts
// Worker-side tests — anything that needs a real D1 to assert against.
//
// The jsdom project (vitest.jsdom.config.ts) cannot do this: there is no D1 in jsdom, so
// "the insert produced a row with these exact columns" had nowhere to live. This project runs
// tests inside workerd via @cloudflare/vitest-pool-workers, with the analytics migrations
// applied to an isolated database per test.
//
// The binding is declared here rather than read from wrangler.jsonc via
// `wrangler.configPath`: that path throws "the `assets` property is missing the required
// `directory` property", because @cloudflare/vite-plugin supplies the assets directory at
// build time and forbids setting it in source. Declaring it twice risks drift, so
// tests/wrangler-bindings.spec.ts asserts wrangler.jsonc still declares an ANALYTICS_DB
// binding.
//
// Shape note: the pool options are the argument to cloudflareTest() in `plugins`, not
// `test.poolOptions.workers`. The `./config` subpath export and `defineWorkersConfig` are both
// gone as of pool 0.13; `cloudflareTest` and `readD1Migrations` come from the package root.
// The pool ships a codemod for this, but it refuses a function argument, so this was done by
// hand.
import path from 'node:path';
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-pool-workers';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    cloudflareTest(async () => {
      // Read at config time, not test time: the pool serialises them into the worker.
      //
      // Points at migrations/analytics, not migrations/. `readD1Migrations` does NOT recurse
      // — it is a flat readdir filtered to .sql — so aiming it at the parent returns [], no
      // migrations reach the test database, and every spec in tests/worker/ fails against an
      // empty D1.
      //
      // The directory is also what keeps the feedback migrations out: 0003 and 0004 are
      // ALTER TABLE ADD COLUMN against columns 0001 already creates, so on a fresh database
      // they fail with "duplicate column name". They exist only for the remote D1 that
      // predates them. That is expressed by the directory split rather than a filename filter.
      //
      // import.meta.dirname, not __dirname: vite's `configLoader: 'native'` warns on
      // __dirname on every single run and is planned to become the default.
      const migrations = await readD1Migrations(
        path.join(import.meta.dirname, 'migrations/analytics'),
      );

      return {
        // NO isolatedStorage key. It does not exist in pool 0.19.1 — zero occurrences in the
        // whole package, against 17 in 0.12.21 — and the options schema is zod `strip`, so
        // passing it is SILENTLY DISCARDED: no error, no warning, no deprecation. Per-test
        // isolation now comes from an explicit `reset()` in
        // tests/worker/apply-migrations.ts. Putting it back here would do nothing at all.
        miniflare: {
          // Matches wrangler.jsonc's compatibility_date deliberately, so the test worker and
          // production share one set of compat semantics. Pool 0.19.1 brings a newer workerd
          // binary; the compat date is the separate behaviour switch and is left alone.
          compatibilityDate: '2026-03-09',
          compatibilityFlags: ['nodejs_compat'],
          d1Databases: { ANALYTICS_DB: 'clumeral-analytics-test' },
          bindings: { TEST_MIGRATIONS: migrations },
        },
      };
    }),
  ],
  test: {
    name: 'workers',
    include: ['tests/worker/**/*.spec.ts'],
    setupFiles: ['./tests/worker/apply-migrations.ts'],
  },
});
```

Every comment above records a failure someone already hit. Losing one loses the reason.

---

## Task 5 — isolation moves from `isolatedStorage` to `reset()`  *(commit 2)*

Implements brief item 10 **as a correction**. New task in revision 2; this is the finding that
made revision 1 unbuildable.

**`isolatedStorage` does not exist in pool `0.19.1`.** Verified independently: zero occurrences
across the entire package against 17 in the `0.12.21` we run today, absent from
`WorkersPoolOptionsSchema`, `dist/` and `types/cloudflare-test.d.ts`. Because the schema is
zod `strip`, `isolatedStorage: true` is silently dropped — so with revision 1's config,
per-test rollback simply never happened:

```
❯ tests/worker/analytics-db.spec.ts (44 tests | 38 failed)
❯ tests/worker/backfill.spec.ts     (49 tests | 34 failed)
❯ tests/worker/harness.spec.ts      (4 tests  |  1 failed)
 Tests  73 failed | 30 passed (103)
```

The first casualty was `harness.spec.ts > isolates storage between tests` — the very spec
revision 1 nominated as proof the pool works. The rest are the
`beforeEach(() => insertLive(CUTOFF))` and `beforeEach(() => seed(50))` specs, which need each
test to start from an empty table.

The replacement is `reset()` from `cloudflare:test`, whose own docs read *"Deletes all data
from all attached bindings"* — so it drops the migrated schema too, and migrations must be
re-applied **per test** rather than once.

**File:** `tests/worker/apply-migrations.ts` — a file neither brief item 28 nor revision 1
listed. It is test plumbing, which brushes brief item 8 ("no test is rewritten to be a better
test"); this is not an improvement but a forced like-for-like replacement of a withdrawn
capability, and it is recorded rather than slipped in.

Change `beforeAll` to `beforeEach`, and add the reset:

```ts
import { applyD1Migrations, env, reset } from 'cloudflare:test';
import { beforeEach } from 'vitest';

// ...the existing `declare module 'cloudflare:test'` block is unchanged...

// Per test, not once per file. Pool 0.19.1 removed `isolatedStorage`, so nothing rolls writes
// back any more — isolation is now this explicit reset(). reset() "deletes all data from all
// attached bindings", schema included, so the migrations have to be re-applied after it.
// If this ever becomes beforeAll again, every row-count assertion in this project silently
// starts reading the previous test's rows.
beforeEach(async () => {
  await reset();
  await applyD1Migrations(env.ANALYTICS_DB, env.TEST_MIGRATIONS);
});
```

Checked: **no worker spec uses `beforeAll`**, so nothing else is wiped by the per-test reset.

**Verified end to end** on the repo's real `tests/worker/**`, real `src/`, real
`migrations/analytics`: `4 files / 103 tests, 103 passed`, and the full suite
`41 files / 822 tests` with the guard green. A working copy is at
`/private/tmp/claude-502/-Users-jamiepersonal-Developer-clumeral-game/03db2dd4-495b-4163-bb21-8bfa9c95a757/scratchpad/dajs`.

---

## Task 6 — the root and jsdom configs; the single verification point  *(commit 2)*

Implements brief items 20, 21, 22, 24, 25, 52, V5.

**Delete:** `vitest.workspace.ts`

**New file:** `vitest.jsdom.config.ts` — the jsdom project, moved out of the root verbatim
apart from gaining a name. The filename satisfies vitest 4's `(vitest|vite).*.config.*`
validation (brief V5); an arbitrary name is a hard `Collect Error`.

```ts
import { defineConfig } from 'vitest/config';

// The browser-and-pure-function project. It lives in its own file rather than in
// vitest.config.ts because a root config that declares `test.projects` does NOT run its own
// `test.include` — measured. Keeping jsdom here makes the root file visibly not-a-project, so
// that mistake cannot be made by editing one file.
export default defineConfig({
  test: {
    name: 'jsdom',
    environment: 'jsdom',
    globals: false,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.spec.ts'],
    // tests/worker/ runs in workerd against a real D1 — see vitest.workers.config.ts.
    exclude: ['**/node_modules/**', 'tests/worker/**'],
  },
});
```

**Rewrite:** `vitest.config.ts` — now only a root.

```ts
import { defineConfig } from 'vitest/config';

// Root config only. The two projects live in vitest.jsdom.config.ts and
// vitest.workers.config.ts; this file deliberately declares no `include` of its own, because a
// root that sets `test.projects` does not run one.
//
// Worker count is capped OFF CI because these tests do not run on a laptop — they run on the
// Pi, inside a 1000 MB cgroup, and each jsdom worker peaked around 300 MB. On 2026-08-22 the
// default (cores - 1 = 3) put three of them against that ceiling: 33.6 million reclaim events,
// load ~5, and nine hours of CPU that produced almost no progress because every worker was in
// direct reclaim. Two fit. CI has real machines and keeps the default.
//
// The cap MUST live here and not on a project (#313 put it on the jsdom config, which was
// correct under the workspace file). In vitest 4 `maxWorkers` is a cross-project scheduling
// budget: two projects with different values and the same `sequence.groupOrder` is a hard
// error — "Projects ... have different 'maxWorkers' but same 'sequence.groupOrder'",
// "Test Files no tests", exit 1. So root placement is forced, not chosen.
//
// `minWorkers` is gone from vitest 4. It is not an error to pass it — v4 accepts it silently —
// but it does nothing, so it is removed rather than left as dead config. The both-bounds dance
// #313 needed is no longer required.
//
// Note what root placement costs: jsdom and workerd specs now share ONE worker budget, so a
// ~300 MB jsdom worker can run alongside a workerd worker plus miniflare's own processes. The
// pool never reads `maxWorkers` at all (grepped across 0.19.1), so miniflare's footprint sits
// outside this budget. This is why the Pi check watches peak RSS, not wall-clock.
export default defineConfig({
  test: {
    maxWorkers: process.env.CI ? undefined : 2,
    // Declared here, not in the npm script, so an extra CLI argument cannot drop the guard.
    reporters: ['default', './tests/project-guard.ts'],
    projects: ['./vitest.jsdom.config.ts', './vitest.workers.config.ts'],
  },
});
```

**Verified by `da-plan`:** the relative reporter path resolves from the root config; a
root-declared reporter does apply when `test.projects` is set; and
`maxWorkers: process.env.CI ? undefined : 2` behaves as intended with `CI=true` and unset.

### Verification — this is the one point where commit 2 can be checked

1. `npm test` → **41 test files**, `jsdom 37 + workers 4`, guard prints
   `both projects ran their full file count (jsdom: 37, workers: 4)`, exit 0.
2. Confirm the per-file worker lines appear with their counts — `harness.spec.ts` 4,
   `schema.spec.ts` 6, `analytics-db.spec.ts` 44, `backfill.spec.ts` 49 — which proves
   `tests/worker/**` *executed*, not merely got collected.
3. **Prove the guard bites rather than assuming it:** `npm test -- --project jsdom` must exit
   non-zero with
   `project "workers": expected 4 test files, 0 ran — the project did not run at all`.
4. Record the test total in both build states: `826` with a built `dist/client/sw.js`, `822`
   (821 passed, 1 skipped) without. CI sees `822`, because `npm test` runs before anything
   builds.
5. `npm ls miniflare workerd wrangler` → capture for the PR description.
6. **No Playwright run** (brief item 39). Say so in the PR, with the reason.

---

## Task 7 — the stale doc and comment lines  *(commit 2)*

Found while planning and reviewing; implements nothing in the brief.

1. `README.md:91` — `npm test          # Unit tests (Vitest + jsdom)` undersells the suite both
   before and after. Since this PR restructures exactly that:
   `npm test          # Unit tests (Vitest — jsdom and workerd projects)`
2. `tests/puzzle-redundancy.spec.ts:127` reads "vitest.config.ts sets no `testTimeout`". Still
   true of the root config, but the jsdom project's config is no longer that file. Point it at
   `vitest.jsdom.config.ts`.

`docs/CONVENTIONS.md` and `docs/ARCHITECTURE.md` mention vitest nowhere. No code anywhere
references `vitest.workspace.ts`, and `.github/` names only `npm test`. References under
`docs/work/**` and `docs/superpowers/**` are records of past work and are left alone.

---

## Committing

- **Commit 1** = Task 1.
- **Commit 2** = Tasks 2–7, together. They cannot be split: the guard is inert until Task 6,
  and Tasks 3, 4 and 5 each leave `npm test` failing or silently incomplete on their own.
  Splitting them would put knowingly-broken commits on the branch, which is the wrong trade for
  a change whose whole point is that a green run can lie.

**Commit 2's message must state:** the resolved root and nested runtime versions; the
per-project file counts; that `isolatedStorage` was removed upstream and isolation is now
`reset()`; and that the guard was verified to fail under `--project`.

---

## Known limits, stated rather than discovered later

1. **The guard counts files, so three things still slip past it — each needing a deliberate
   act, and each visible in the output or the diff.** Measured by `da-build`:
   - `npm test -- --reporter=dot` replaces the config's reporters and drops the guard
     entirely: exit 0, guard never runs. CI runs plain `npm test`.
   - A whole-file `describe.skip` keeps the file count, so the guard passes and the run exits
     0 — but the summary prints `N skipped`, and `-t` filtering behaves the same way.
   - Deleting a spec file *and* decrementing `EXPECTED_FILES` passes, because the guard knows
     only that the number matches, not what it ought to be. That one is a two-line diff hunk,
     which is the point at which a human is looking.
   None of these is the failure the guard exists for — losing a whole project silently while
   exiting 0 — and all three are loud or reviewable. Not worth engineering around.
2. **The Pi cap cannot be validated here, and two things changed in that project, not one.**
   Brief item 41: Jamie runs `npm test` on the Pi from this branch and it **blocks the merge**.
   He should watch **peak RSS with both projects in flight**, not wall-clock, and should not
   expect an improvement — (a) root placement newly co-schedules jsdom and workerd workers in
   one budget, and (b) Task 5 adds 103 × (`reset()` + three migrations) of D1 I/O to the
   workers project. On a laptop that is not a regression — workers project **798ms** under
   vitest 4 + `reset()` against **869ms** today under vitest 2 + `isolatedStorage` — but the
   Pi's cgroup is the thing in question, not the laptop's.
3. **`tests/` and the vitest configs are not typechecked.** `tsconfig.json` includes only
   `src/**/*`, `src/global.d.ts` and `vite.config.ts`, and there is no `tsc` step in CI. So the
   guard's `Reporter` implementation is checked by running, not by types. Pre-existing and out
   of scope per brief items 27–29 — flagged for Jamie, who owns types, not fixed here.
4. **e2e jobs on GitHub stay red** until #330's `ubuntu-24.04` runner pin reaches `main` (brief
   item 40). Unrelated to this change. CI green means the `npm test` step.
5. **All config measurements were taken under vite 8.3.5; the repo pins 8.0.3.** The install
   does not move vite, and vitest 4's peer range accepts both. Task 3 step 4 exists to load the
   configs under the repo's own vite before any of them are edited.

## PR B — deliberately not in this plan

Brief items 31, 32, 55, 56. Two files, and they are on `main` for **two different reasons**:

- `.github/dependabot.yml` — GitHub reads it from the default branch only, so a change routed
  through `staging` sits inert until the next release.
- `CLAUDE.md` — **not** covered by that rule; it is read from whatever branch you are on. It
  belongs in the same PR for a different reason: the outstanding-action text does not exist on
  `dev/vitest-4`, `origin/staging` **or** `origin/main` (`grep -i vitest CLAUDE.md` → 0 hits on
  all three). It exists only on the unmerged `chore/vitest-pin` (#330). So PR B is an **add**
  whose text comes from #330, not a reword of anything reachable today — and putting it on
  `staging` now would collide with #330's copy when `staging` later merges to `main`.

PR B lands only after this upgrade has reached `main`, and must account for the `cloudflare`
dependency group (`patterns: ["wrangler", "@cloudflare/*"]`) that actually bundles these
packages, not just the three `ignore` entries (brief item 56).

**Updated by brief item 59, found during Build.** `@cloudflare/vitest-pool-workers` has been
**renamed** to `@cloudflare/vitest-plugin` and receives no further updates — and the version
this repo ran before today, `0.12.21`, carries the same deprecation, so this is not new. PR B's
wording must change accordingly: the reason to keep the `vitest` major ignore is **not** "no
pool supports vitest 5" (false — `@cloudflare/vitest-plugin@1.4.0+` peers
`^4.1.0 || ^5.0.0`). It is that the only package supporting vitest 5 is a **different package
name on a miniflare beta** — all 44 of its releases ship a miniflare 5 alpha or beta, with no
stable option at any version. PR B should also record migrating to the new name as the genuine
follow-up, gated on it shipping a stable miniflare.

---

## Traceability

| Brief items | Where |
|---|---|
| 6, 16, 17, 18, 48, 49 | Task 1 |
| 22, 23→51, 50, 51, 54 | Task 2 |
| 19, 44, 45, 47 | Task 3 |
| 19, 30, V2, V3, V4 | Task 4 |
| **10 — VOID, corrected** | **Task 5** |
| 20, 21, 24, 25→52, V5 | Task 6 |
| 34–36→50, 40 | Task 6 verification |
| — (found while planning) | Task 7 |
| 31, 32, 55, 56 | **PR B — not this plan** |
| 1, 2, 3, 4, 5 | Context; no code |
| 7, 11, 12, 13, 14, 15, 29 | Out of scope by decision; no code |
| 9, 26→53, 38→57 | Constraints on how tasks are done, not tasks |
| 27, 28 | File lists — **item 28 partly overruled, see Task 2** |
| 8 | **Brushed by Task 5**, recorded there rather than claimed clean |
| 33, 37, 39, 41, 42, 43, 46, 58 | Process, verification or hand-off; no code |
| V1, V6, V7, V8, V9 | Verified facts; no code |

### Brief deviations, stated plainly

Three places where this plan does not do what the brief said, each with its reason:

1. **Item 10 is void.** It listed `isolatedStorage: true` among behaviours "preserved exactly"
   and said "the file is rewritten; what it *does* is not changed". The capability was removed
   upstream, so what it does **has** changed — from transactional rollback to
   delete-and-remigrate. Task 5.
2. **Item 28's guard location and wiring are overruled** — `tests/project-guard.ts` via
   `test.reporters`, not `scripts/` via the npm script, and `package.json` is untouched. Item
   51's reasoning supersedes item 23's oracle but said nothing about location; this is the
   plan's call, recorded. Task 2.
3. **Item 8 is brushed.** "No test is rewritten to be a better test" — `apply-migrations.ts` is
   edited. It is not an improvement but a forced like-for-like replacement of a withdrawn
   capability. Task 5.

---

## Revision log

**Revision 2, 2026-10-31 — after `da-plan`.** Its verdict was *not ready to build* and it was
right. I re-verified every High myself before acting.

- **H1, accepted — the finding that mattered.** `isolatedStorage` is gone from pool `0.19.1`
  and silently stripped, so revision 1 would have failed **73 of 103** worker tests, starting
  with the spec it named as its own proof. Fixed by the new Task 5; brief item 10 recorded void.
  Independently confirmed: 0 occurrences in `0.19.1` vs 17 in `0.12.21`, schema is zod `strip`,
  `reset()` exists at `types/cloudflare-test.d.ts:94`, and the fixed suite runs 41 files / 822
  tests green.
- **H2, accepted.** Revision 1's Task 4 "Done when" was impossible — the old workers config's
  dead `./config` import makes the whole run a startup error, exit 1, no project collected.
  Fixed by resequencing so the workers config is rewritten *before* the root config, and by
  stating the expected startup error in Task 3 step 4.
- **H3, accepted.** Revision 1 called Task 2 "red by design"; it is **inert** — the `reporters`
  line that activates the guard arrives in Task 6. Worse, revision 1 claimed the guard would
  catch Task 3's silent jsdom-only fallback, which it could not. Fixed by saying so in Task 2
  and by stating plainly that commit 2 has exactly one verification point.
- **M1–M4 and L1–L4, accepted:** brief deviations now recorded explicitly; PR B's two files
  separated by their two different reasons; the Pi instruction now names the `reset()` I/O as a
  second change; a load-under-the-repo's-own-vite check added as Task 3 step 4;
  `import.meta.dirname` replaces `__dirname` (verified: 103/103 pass, permanent vite warning
  gone); the unactionable `git stash` fragment deleted; `puzzle-redundancy.spec.ts:127` added
  to Task 7; a watch-mode note added to the guard.
- **One finding improved on rather than applied as given.** `da-plan` suggested restating each
  task's "Done when". The deeper problem is that *no* intermediate state in commit 2 is
  verifiable: once vitest 4 lands it silently runs jsdom-only until the root config lists both
  projects. Saying that once, at the top, is more honest than four separately-worded
  almost-green outcomes.


---

## Build record — what it actually took, 2026-10-31

Both commits landed as planned, and `npm test` is **41 files / 826 tests** locally
(**822 with 1 skipped** in CI, file count 41 either way), both projects named, guard green.
**No test file needed editing**, confirming brief item 53's "possibly zero" from the far side.

Three things the plan did not predict, all surfaced by CI rather than by review:

1. **`.nvmrc` → 24.** The Cloudflare Workers build failed with no log beyond a dashboard link.
   Bisected across three real builds:

   | commit | vitest | pool | configs | build |
   |---|---|---|---|---|
   | `0d18b38` | 3.2.7 | 0.12.21 | old | **success** |
   | `cfaca7a` | 4.1.12 | 0.19.1 | **old** | **failure** |
   | `ba0fb71` | 4.1.12 | 0.19.1 | new | failure |

   The middle row exonerated the config rewrite. Cause: vitest 4 is the first of these to drop
   Node 18 (`^20 || ^22 || >=24`, where `3.2.7` took `^18 || ^20 || >=22`), `npm ci` installs
   devDependencies even though the builder never runs them, and there was **no `.nvmrc`** — so
   the builder chose its own Node while CI pins `24` and dev is `24`.
   **Wider than this branch:** `.nvmrc` is absent from both `main` and `staging`. That builder
   has always been unpinned, and any future bump raising an `engines.node` floor fails
   identically with the same unreadable error.
2. **The `ubuntu-24.04` runner pin**, taken verbatim from #330. Known limit 4 said the e2e jobs
   would stay red until #330 reached `main` — true, but it missed that `e2e smoke` is a
   *required* check, so the PR could not merge at all. Byte-identical to #330's copy so a later
   merge is a no-op.
3. **Two stale assertions in `e2e/specs/player-stats.spec.ts`** — a pre-existing `staging`
   defect this branch is merely the first to run. Every recent passing ci-smoke run came from a
   **`main`-based** branch (#330 and the Dependabot ones, which target the default branch), and
   `main` lacks the stats redesign, so e2e had not gated staging's stats markup since
   `ubuntu-latest` rolled. Kept in this PR by Jamie's call, as one revertible commit.

### What this says about the plan

The plan's own verification was sound — the guard, the counts, the `reset()` fix and the Pi cap
all behaved exactly as written, and `da-build` could not break them. What it missed was
entirely **environmental**: the one build host nobody had pinned, and a required check whose
redness it had classified as merely informational. Both were knowable in advance; neither was
looked for, because the plan reasoned about this repo's code and not about the three machines
that run it.

The lesson worth carrying: "CI green" was defined in known limit 4 as "the `npm test` step".
That was too narrow. A PR cannot merge on a required check being red for someone else's reason.


## The Pi check — brief item 41 satisfied, 2026-10-31

**Reported by Jamie via the #330 session, not measured here.** Run on the Pi from
`dev/vitest-4` at `2d13fec`; no files changed, nothing committed.

| | |
|---|---|
| Test files | **41** — 40 passed, 1 skipped |
| Guard | `both projects ran their full file count (jsdom: 37, workers: 4)` |
| Tests | **821 passed, 1 skipped (822)** |
| Host memory | rose **285 MB** over the run (2213 → 2498 MB peak); available never below 1551 MB |
| Duration | 23s |
| OOM | **none** — no `oom`/killed lines in dmesg, cgroup `oom_kill` is 0, no throttling |

The skip is `sw-precache.spec.ts`, exactly as item 50 predicted: no built `dist/client/sw.js`
on that box, so the Pi reads 822 and not 826, with the file count still 41. The output tail was
read rather than the exit code trusted — the habit the `e2e-exit-code-masks-failure` memory
exists for.

**The verdict against the ceiling item 41 cites:** 285 MB for the whole run is roughly one
jsdom worker's footprint, not the three that produced 33.6 million reclaim events on
2026-08-22. So root placement of `maxWorkers` (item 52) *plus* the new `reset()` D1 I/O (Task 5)
did not push it near the 1000 MB cgroup. The "watch peak RSS, not wall-clock, and expect no
improvement" framing was the right thing to ask for, and the answer is that neither change
costs what it might have.

### Two caveats, recorded rather than smoothed over

Both raised by the session that ran it, and both weaken the measurement without changing the
verdict:

1. **Sampling was 2s across a 23s run — twelve samples.** A spike between samples would not
   appear in `free`. So 285 MB is an observed peak at that granularity, not a guaranteed
   maximum.
2. **It ran in a 1200 MB cgroup, not the dev bot's 1000 MB** — 200 MB wider headroom than
   production conditions. The cgroup's `memory.peak` read 1177/1200 MB, but that figure covers
   the `claude` process and a preceding `npm ci` as well as the tests, so it is not a measure of
   the test run; the 285 MB delta is.

Given no kills and a wide margin, item 41 is satisfied. **The airtight version, if anyone wants
it later, is one `npm test` as the actual dev bot with no `npm ci` in the same turn** — recorded
as available, not as owed.

### One incidental finding from that run

`npm ci` on the Pi warned that install scripts for `esbuild`, `sharp` and `workerd` need
approving, so those postinstalls are **not** running on that box. It did not block, and the
workers tests passed — consistent with workerd's platform binary arriving via its prebuilt
optional dependency (`@cloudflare/workerd-linux-arm64`) rather than via a postinstall step. Not
chased further, and not this PR's to fix; noted because a future Workers-pool bump that *does*
depend on a postinstall would fail there and nowhere else.
