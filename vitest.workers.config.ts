// Worker-side tests — anything that needs a real D1 to assert against.
//
// The jsdom project (vitest.config.ts) cannot do this: there is no D1 in jsdom, so
// "the insert produced a row with these exact columns" had nowhere to live. This
// project runs tests inside workerd via @cloudflare/vitest-pool-workers, with both
// analytics migrations applied to an isolated database per test.
//
// The binding is declared here rather than read from wrangler.jsonc via
// `wrangler.configPath`: that path throws "the `assets` property is missing the
// required `directory` property", because @cloudflare/vite-plugin supplies the
// assets directory at build time and forbids setting it in source. Declaring it
// twice risks drift, so tests/wrangler-bindings.spec.ts asserts wrangler.jsonc
// still declares an ANALYTICS_DB binding.
import path from 'node:path';
import { defineWorkersConfig, readD1Migrations } from '@cloudflare/vitest-pool-workers/config';

export default defineWorkersConfig(async () => {
  // Read at config time, not test time: the pool serialises them into the worker.
  // Filtered to the analytics pair. The feedback migrations must not run here —
  // 0003 and 0004 are ALTER TABLE ADD COLUMN against a table that 0001 already
  // creates with those columns, so on a fresh database they fail with "duplicate
  // column name". They exist for the remote D1 that predates them. `npm run e2e:db`
  // applies 0001 alone for exactly the same reason.
  const all = await readD1Migrations(path.join(__dirname, 'migrations'));
  const migrations = all.filter((m) => /^000[56]_/.test(m.name));

  return {
    test: {
      include: ['tests/worker/**/*.spec.ts'],
      setupFiles: ['./tests/worker/apply-migrations.ts'],
      poolOptions: {
        workers: {
          // isolatedStorage (on by default) rolls back writes after each test, so
          // one test's rows can never leak into the next one's assertions.
          isolatedStorage: true,
          miniflare: {
            compatibilityDate: '2026-03-09',
            compatibilityFlags: ['nodejs_compat'],
            d1Databases: { ANALYTICS_DB: 'clumeral-analytics-test' },
            bindings: { TEST_MIGRATIONS: migrations },
          },
        },
      },
    },
  };
});
