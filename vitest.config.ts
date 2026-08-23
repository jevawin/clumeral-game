import { defineConfig } from 'vitest/config';

// Worker count is capped OFF CI because these tests do not run on a laptop — they run on the
// Pi, inside a 1000 MB cgroup, and each jsdom worker peaked around 300 MB. On 2026-08-22 the
// default (cores - 1 = 3) put three of them against that ceiling: 33.6 million reclaim events,
// load ~5, and nine hours of CPU that produced almost no progress because every worker was in
// direct reclaim. Two fit. CI has real machines and keeps the default.
// BOTH bounds, not just the ceiling: vitest 2.1.9 defaults minWorkers to (cores - 1) = 3 on
// this box, and a maxWorkers below that is a hard startup error —
// "options.minThreads and options.maxThreads must not conflict". Measured, not guessed: setting
// only the ceiling took the whole suite down.
const workers = process.env.CI ? undefined : 2;

export default defineConfig({
  test: {
    // maxWorkers/minWorkers, not pool-specific options: they apply whatever pool vitest
    // defaults to, so this cannot silently switch the isolation model the suite relies on.
    maxWorkers: workers,
    minWorkers: process.env.CI ? undefined : 1,
    environment: 'jsdom',
    globals: false,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.spec.ts'],
    // tests/worker/ runs in workerd against a real D1 — see vitest.workers.config.ts.
    exclude: ['**/node_modules/**', 'tests/worker/**'],
  },
});
