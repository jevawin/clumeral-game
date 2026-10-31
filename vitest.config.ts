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
// The cap MUST live here and not on a project. #313 put it on the jsdom config, which was
// correct under the workspace file, but in vitest 4 `maxWorkers` is a cross-project scheduling
// budget: two projects with different values and the same `sequence.groupOrder` is a hard
// error — "Projects ... have different 'maxWorkers' but same 'sequence.groupOrder'",
// "Test Files no tests", exit 1. Root placement is forced, not chosen.
//
// `minWorkers` is gone from vitest 4. Passing it is not an error — v4 accepts it silently —
// but it does nothing, so it is removed rather than left as dead config. The both-bounds dance
// #313 needed is no longer required.
//
// Note what root placement costs on the Pi: jsdom and workerd specs now share ONE worker
// budget, so a ~300 MB jsdom worker can run alongside a workerd worker plus miniflare's own
// processes. The pool never reads `maxWorkers` at all (grepped across 0.19.1), so miniflare's
// footprint sits outside this budget entirely.
export default defineConfig({
  test: {
    maxWorkers: process.env.CI ? undefined : 2,
    // Declared here rather than in package.json's test script, so an extra CLI argument cannot
    // drop the guard. tests/project-guard.ts fails the run if either project goes missing —
    // which is the one thing "the tests passed" cannot detect.
    reporters: ['default', './tests/project-guard.ts'],
    projects: ['./vitest.jsdom.config.ts', './vitest.workers.config.ts'],
  },
});
