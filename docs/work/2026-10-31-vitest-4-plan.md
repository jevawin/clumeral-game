# Plan — vitest 2 → 4, and the Workers test pool with it

**Date:** 2026-10-31
**Branch:** `dev/vitest-4` (off `staging`)
**Brief:** [2026-10-31-vitest-4-brief.md](2026-10-31-vitest-4-brief.md) — closed, all 11
sections settled, `da-brief` findings fixed in brief items 50–58.
**Approval:** pending Jamie.

Gates checked before writing this: no `Ack: pending` remains in the brief, and `da-brief` is
recorded with its findings addressed.

---

## Shape

Two commits on one branch, split on the version boundary (brief item 6). **One PR into
`staging`.** A second PR against `main` is deliberately out of this plan — see "PR B" at the
end.

| Commit | Moves | Touches config? |
|---|---|---|
| 1 | `vitest` → `3.2.7` only | No |
| 2 | `vitest` → `4.1.12`, pool → `0.19.1` | Yes, all of it |

The acceptance criterion throughout is **per-project file counts: jsdom 37, workers 4, total
41** (brief item 50). Not the test total — `826` is build-dependent and CI sees `822`.

---

## Task 1 — `vitest` to `3.2.7`, alone

Implements brief items 16, 17, 18, 48, 49.

**Files:** `package.json`, `package-lock.json`, plus any test file that actually breaks.

**Steps**

1. `npm install --save-dev vitest@3.2.7` — nothing else, and **do not** move the pool
   (`3.2.7` sits inside its `"2.0.x - 3.2.x"` peer range; verified by resolve, brief item 48).
2. `git diff --stat package-lock.json`. Revert any hunk unrelated to `vitest` and `@vitest/*`
   per brief item 57: `git checkout -- package-lock.json` then re-install just the intended
   change. The known churn is 26 optional platform entries losing `"dev": true`.
3. `npm test`. Expect the deprecation warning from brief item 49:
   `DEPRECATED  The workspace file is deprecated and will be removed in the next major.`
   Its presence is a **positive** signal — it confirms the workspace file is still being read.
4. Record the actual file/test counts in the commit message.

**Expected breakage: possibly none.** Brief item 53 withdrew the only concrete risk that had
been named, and found that two of the three suspected breakages cannot occur
(`router.spec.ts:236` compares `invocationCallOrder` values relatively; the `vi.spyOn` uses are
already paired with `mockRestore()`/`mockClear()`). So treat failures as **discovered, not
scheduled**. If nothing breaks, commit the bump on its own and say so.

**If something does break,** fix only the mocking plumbing, never an assertion's meaning — this
is the undertaking brief item 58 records in place of Dave's signature, and it is what makes
that override checkable. The two files where it matters are
`tests/puzzle-redundancy.spec.ts` and `tests/daily-puzzle.spec.ts`.

**Done when:** `npm test` reports **41 test files**, jsdom 37 + workers 4, zero failures.

**Commit:** `test(vitest): step to 3.2.7, the last release that still reads the workspace file`

---

## Task 2 — the project guard, written to fail first

Implements brief items 22, 23 (as superseded), 50, 51, 54.

This task is **red by design**: the guard pins project names that do not exist until Task 4.
That is the point — it is the test for Tasks 3–5.

**New file:** `tests/project-guard.ts`

Lives in `tests/` beside `tests/setup.ts` and `tests/worker/apply-migrations.ts`, which are the
same kind of test infrastructure. Named `.ts`, **not** `.spec.ts`, so the jsdom project's
`include: ['tests/**/*.spec.ts']` does not collect it as a test.

```ts
import type { Reporter, TestModule } from 'vitest/node';

// Pinned per-project FILE counts, not test counts. Brief item 50: the test total is
// build-dependent — tests/sw-precache.spec.ts contributes 5 tests with a built
// dist/client/sw.js and 1 skipped without, so the total is 826 here and 822 in CI. The
// file count is 41 either way.
//
// Adding a spec file is therefore a two-line change: the file, and the number below. That
// is deliberate. A guard keyed on "project present and non-zero" passes while a project
// collects only a subset of its files, which is one of the three ways this suite can lose
// coverage silently and still exit 0.
const EXPECTED_FILES: Record<string, number> = {
  jsdom: 37,
  workers: 4,
};

export default class ProjectGuard implements Reporter {
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

**Why a custom reporter and not a script over `vitest list --json`** — all three measured, and
recorded in brief item 51:

- `vitest list --json` runs in a **second process** that cannot see the real run's flags, so
  `npm test -- --project jsdom` passes such a guard while half the suite never runs.
- On a collection error it **exits 0 and emits valid JSON containing only the healthy
  records**, silently omitting the broken file. A guard that parses successfully and finds both
  projects present would pass.
- `--reporter=json` observes the real run but carries **no `projectName` anywhere**;
  `--reporter=junit` carries only file paths and `classname`. Neither can identify a project.

A reporter is the only oracle that sees both the real run and project identity, and it can fail
the run. Proven in a probe: a normal run reports `{"jsdom":37,"workers":4}`-shaped output and
exits 0; `--project jsdom` makes it report only `jsdom` and exit **1**.

**Done when:** the file exists and `npm test` fails with the guard's message naming
`jsdom: expected 37 test files, 0 ran`. Verify it fails for the right reason.

**Commit:** combined with Tasks 3–5 — see "Committing" below.

---

## Task 3 — the version bump

Implements brief items 19, 44, 45, 47.

**Files:** `package.json`, `package-lock.json`

1. `npm install --save-dev vitest@4.1.12 @cloudflare/vitest-pool-workers@0.19.1`
2. Read the lockfile diff as in Task 1 step 2.
3. Record the resolved runtime versions — needed verbatim for the PR description (brief item
   47) and as #331's baseline:

   | | expected |
   |---|---|
   | **root** `wrangler` / `miniflare` / `workerd` | `4.80.0` / `4.20260401.0` / `1.20260401.1` — **unchanged** |
   | pool's **nested** copies | `4.116.0` / `4.20260730.0` / `1.20260730.1` |

   Confirm with `npm ls miniflare workerd wrangler`. Root stays put because
   `@cloudflare/vite-plugin@1.31.0` holds `miniflare` and `wrangler` as **exact** dependencies,
   so the pool's newer copies cannot hoist over them (brief item 44). **If root moves, stop** —
   that is the #325 skew and it would break `e2e:db` against `vite preview`.

After this task `npm test` is expected to be broken in a new way: vitest 4 ignores
`vitest.workspace.ts` entirely (brief V1). The guard from Task 2 is what makes that visible
instead of green-and-incomplete.

---

## Task 4 — three config files replace two plus a workspace

Implements brief items 20, 21, 22, 24, 25, 52, and V5.

**Delete:** `vitest.workspace.ts`

**New file:** `vitest.jsdom.config.ts` — the jsdom project, moved out of the root verbatim
apart from gaining a name. The filename satisfies vitest 4's `(vitest|vite).*.config.*`
validation (brief V5); an arbitrary name is a hard `Collect Error`.

```ts
import { defineConfig } from 'vitest/config';

// The browser-and-pure-function project. It lives in its own file rather than in
// vitest.config.ts because a root config that declares `test.projects` does NOT run its own
// `test.include` — measured, brief item 51's sibling hazard. Keeping jsdom here makes the
// root file visibly not-a-project, so that mistake cannot be made by editing one file.
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

**Rewrite:** `vitest.config.ts` — now only a root. It holds what is genuinely global and
nothing a project would own.

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
// outside this budget. This is why the Pi check in the brief watches peak RSS, not wall-clock.
export default defineConfig({
  test: {
    maxWorkers: process.env.CI ? undefined : 2,
    // Declared here, not in the npm script, so an extra CLI argument cannot drop the guard.
    reporters: ['default', './tests/project-guard.ts'],
    projects: ['./vitest.jsdom.config.ts', './vitest.workers.config.ts'],
  },
});
```

**Done when:** `npm test` runs the jsdom project (37 files) and the guard reports
`workers: expected 4 test files, 0 ran`, because Task 5 has not happened yet.

---

## Task 5 — rewrite `vitest.workers.config.ts` by hand

Implements brief items 10, 19, 30, and V2, V3, V4.

The pool's codemod at `./codemods/vitest-v3-to-v4` **cannot** do this: it throws on a function
argument to `defineWorkersConfig`, and this file passes one (brief V4). `defineWorkersConfig`
and the `./config` subpath export no longer exist at all (brief V2).

Target shape, taken from the codemod's own source: the contents of `test.poolOptions.workers`
become the argument to `cloudflareTest(...)`, which moves into `plugins`, and
`test.poolOptions` is deleted. `cloudflareTest` accepts an async callback (brief V3), so the
`readD1Migrations` await moves inside it.

```ts
// Worker-side tests — anything that needs a real D1 to assert against.
//
// The jsdom project (vitest.jsdom.config.ts) cannot do this: there is no D1 in jsdom, so
// "the insert produced a row with these exact columns" had nowhere to live. This project runs
// tests inside workerd via @cloudflare/vitest-pool-workers, with both analytics migrations
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
      const migrations = await readD1Migrations(path.join(__dirname, 'migrations/analytics'));

      return {
        // isolatedStorage (on by default) rolls back writes after each test, so one test's
        // rows can never leak into the next one's assertions.
        isolatedStorage: true,
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

**Done when:** `npm test` is green, the guard reports both projects at their full counts, and
`tests/worker/harness.spec.ts` passes — it is the proof the pool genuinely works (migrations
applied, real D1, `isolatedStorage` rolling back), as opposed to merely being listed.

---

## Task 6 — verify, with the checks the brief asks for

Implements brief items 34–36 (as superseded by 50), 40, 50, 51.

1. `npm test` → **41 test files**, jsdom 37 + workers 4, guard OK, exit 0.
2. Prove the guard bites, don't assume it: `npm test -- --project jsdom` must **fail** with
   `project "workers": expected 4 test files, 0 ran — the project did not run at all`.
   Then `git stash`-free: just confirm and move on.
3. Prove `tests/worker/**` really executed, not merely collected — the per-file lines for
   `harness.spec.ts`, `schema.spec.ts`, `analytics-db.spec.ts` and `backfill.spec.ts` must all
   appear with their test counts (4, 6, 44, 49).
4. Record the test total in both build states so the next reader is not surprised:
   `826` with a built `dist/client/sw.js`, `822` (821 passed, 1 skipped) without. CI sees
   `822` because `npm test` runs before anything builds.
5. `npm ls miniflare workerd wrangler` → capture for the PR description (Task 3 step 3).
6. **No Playwright run** (brief item 39). Say so in the PR with the reason, so it does not
   read as forgotten.

---

## Task 7 — the one doc line that goes stale

Implements nothing in the brief; found while planning.

`README.md:91` reads `npm test          # Unit tests (Vitest + jsdom)`. That undersells the
suite both before and after this change — there are two projects and one of them runs in
workerd. Since this PR restructures exactly that, update it:

```
npm test          # Unit tests (Vitest — jsdom and workerd projects)
```

`docs/CONVENTIONS.md` and `docs/ARCHITECTURE.md` mention vitest nowhere, so nothing else goes
stale. References in `docs/work/**` and `docs/superpowers/**` are records of past work and are
left alone.

---

## Committing

- **Commit 1** = Task 1.
- **Commit 2** = Tasks 2–5 together, plus Task 7. They cannot be split: Task 2 is red until
  Task 5, and Tasks 3, 4 and 5 each leave `npm test` failing on their own. Splitting them
  would put knowingly-broken commits on the branch, which is worse than one coherent commit
  for a change whose whole point is that a green run can lie.
- The brief and this plan are already committed and merge with the PR.

**Commit 2 message must state:** the resolved root and nested runtime versions, the file counts
per project, and that the guard was verified to fail under `--project`.

---

## Known limits, stated rather than discovered later

1. **A CLI `--reporter` replaces the config's reporters and drops the guard.** Measured:
   `npm test -- --reporter=dot` exits 0 with the guard never running. Our CI runs plain
   `npm test`, so this needs a deliberate act. Not worth engineering around; worth knowing.
2. **The Pi cap cannot be validated here.** Brief item 41: Jamie runs `npm test` on the Pi from
   this branch and it **blocks the merge**. Per brief item 52 he should watch **peak RSS with
   both projects in flight**, not wall-clock, and should not expect an improvement — root
   placement newly co-schedules jsdom and workerd workers in one budget.
3. **`tests/` and the vitest configs are not typechecked.** `tsconfig.json` includes only
   `src/**/*`, `src/global.d.ts` and `vite.config.ts`, and there is no `tsc` step in CI. So the
   guard's `Reporter` implementation is checked by running, not by types. Pre-existing and
   out of scope per brief items 27–29 — flagged for Jamie, who owns types, not fixed here.
4. **e2e jobs on GitHub stay red** until #330's `ubuntu-24.04` runner pin reaches `main`
   (brief item 40). Unrelated to this change. CI green means the `npm test` step.

## PR B — deliberately not in this plan

Brief items 31, 32, 55, 56. Rewording the three Dependabot `ignore` reasons and the `CLAUDE.md`
outstanding action must target `main` directly, because GitHub reads
`.github/dependabot.yml` from the default branch only. It **cannot be written yet**: the
entries exist solely on the unmerged #330, and rewording them while `main` is still on vitest 2
would restart the churn. It lands only after this upgrade has reached `main`, and must account
for the `cloudflare` dependency group (brief item 56), not just the three entries.

---

## Traceability

Every numbered brief item, and where it lands.

| Brief items | Task |
|---|---|
| 6, 16, 17, 18, 48, 49 | Task 1 |
| 22, 23→51, 50, 54 | Task 2 |
| 19, 44, 45, 47 | Task 3 |
| 20, 21, 24, 25→52, V5 | Task 4 |
| 10, 19, 30, V2, V3, V4 | Task 5 |
| 34–36→50, 40 | Task 6 |
| — (found while planning) | Task 7 |
| 31, 32, 55, 56 | **PR B — not this plan** |
| 1, 2, 3, 4, 5 | Context; no code |
| 7, 8, 11, 12, 13, 14, 15, 29 | Out of scope by decision; no code |
| 9, 26→53, 38→57 | Constraints on how tasks are done, not tasks |
| 27, 28 | The file lists above |
| 33, 37, 39, 41, 42, 43, 46, 58 | Process, verification or hand-off; no code |
| V1, V6, V7, V8, V9 | Verified facts; no code (V6 confirmed `basic` unused) |
