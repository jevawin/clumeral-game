import type { Reporter, TestModule } from 'vitest/node';

// Pinned per-project FILE counts, not test counts. The test total is build-dependent:
// tests/sw-precache.spec.ts branches on existsSync(dist/client/sw.js), contributing 5 tests
// with a build present and 1 skipped without. So `npm test` reports 826 tests on a machine
// with a stale dist/ and 822 in CI, which runs before anything builds. The FILE count is 41
// either way, and this reporter still counts a file whose only test is skipped.
//
// Adding a spec file is therefore a two-line change: the file, and the number below. That is
// deliberate. A guard keyed on "project present and non-zero" would pass while a project
// collected only a SUBSET of its files — one of three ways this suite can lose coverage and
// still exit 0. The other two: vitest 4 ignoring a workspace file, and a root config that
// declares test.projects never running its own test.include.
const EXPECTED_FILES: Record<string, number> = {
  jsdom: 37,
  workers: 5,
};

export default class ProjectGuard implements Reporter {
  // Counts accumulate per reporter instance, which is per `vitest run`. This is wired for run
  // mode only: in watch mode the instance is reused, so a second run doubles the tallies to
  // 74/8 and prints a spurious FAILED. The test results are fine when that happens — but the
  // process.exitCode set below sticks, so quitting watch after a rerun exits 1 and a wrapper
  // script would read that as a failure. Restart the run. `npm test` is `vitest run`, so CI
  // and a plain local run never hit it.
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
        `(${Object.entries(EXPECTED_FILES)
          .map(([p, n]) => `${p}: ${n}`)
          .join(', ')})`,
    );
  }
}
