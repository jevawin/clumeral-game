// Resets ANALYTICS_DB and applies the analytics migrations before EACH worker test. The
// migration list is injected by vitest.workers.config.ts (it cannot be read from disk in here
// — this file runs inside workerd).
import { applyD1Migrations, env, reset } from 'cloudflare:test';
import { beforeEach } from 'vitest';

declare module 'cloudflare:test' {
  interface ProvidedEnv {
    ANALYTICS_DB: D1Database;
    TEST_MIGRATIONS: D1Migration[];
  }
}

// beforeEach, not beforeAll — and the reset is why.
//
// Pool 0.19.1 removed `isolatedStorage`, which used to roll every test's writes back on its
// own. Nothing does that any more, so isolation is this explicit reset(). Its own docs say it
// "deletes all data from all attached bindings" — the migrated schema included — which is why
// the migrations have to be re-applied after it rather than once per file.
//
// If this ever becomes beforeAll again, every row-count assertion in tests/worker/ silently
// starts reading the previous test's rows. That is not hypothetical: with isolatedStorage
// passed to a pool that ignores it, 73 of 103 worker tests failed.
beforeEach(async () => {
  await reset();
  await applyD1Migrations(env.ANALYTICS_DB, env.TEST_MIGRATIONS);
});
