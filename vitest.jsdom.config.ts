import { defineConfig } from 'vitest/config';

// The browser-and-pure-function project. It lives in its own file rather than inside
// vitest.config.ts because a root config that declares `test.projects` does NOT run its own
// `test.include` — measured, and silent: the root's own spec files are simply dropped and the
// run still exits 0. Keeping jsdom here makes the root file visibly not-a-project, so that
// mistake cannot be made by editing one file.
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
