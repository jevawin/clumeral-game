// Worker-side tests — anything that needs a real D1 to assert against.
//
// The jsdom project (vitest.jsdom.config.ts) cannot do this: there is no D1 in jsdom, so
// "the insert produced a row with these exact columns" had nowhere to live. This project runs
// tests inside workerd via @cloudflare/vitest-pool-workers, with both analytics migrations
// applied to a freshly reset database per test.
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
// gone as of pool 0.13 — neither exists anywhere in 0.19.1. `cloudflareTest` and
// `readD1Migrations` come from the package root instead. The pool ships a codemod for this
// move, but it throws on a function argument and the old file passed one, so this was done by
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
      // import.meta.dirname, not __dirname: vite's `configLoader: 'native'` warns on every
      // run about __dirname and is planned to become the default.
      const migrations = await readD1Migrations(
        path.join(import.meta.dirname, 'migrations/analytics'),
      );

      return {
        // There is deliberately NO isolatedStorage key here. That option does not exist in
        // pool 0.19.1 — zero occurrences in the whole package, against 17 in the 0.12.21 this
        // repo used to run — and the pool's options schema is zod `strip`, so passing it is
        // silently DISCARDED: no error, no warning, no deprecation. Setting it would do
        // nothing while reading as though isolation were handled.
        //
        // Per-test isolation now comes from an explicit reset() in
        // tests/worker/apply-migrations.ts. Measured cost of getting this wrong: 73 of 103
        // worker tests fail, starting with harness.spec.ts > isolates storage between tests.
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
