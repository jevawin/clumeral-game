// Applies the analytics migrations to the isolated per-test ANALYTICS_DB before
// any worker test runs. The migration list is injected by vitest.workers.config.ts
// (it cannot be read from disk in here — this file runs inside workerd).
import { applyD1Migrations, env } from 'cloudflare:test';
import { beforeAll } from 'vitest';

declare module 'cloudflare:test' {
  interface ProvidedEnv {
    ANALYTICS_DB: D1Database;
    TEST_MIGRATIONS: D1Migration[];
  }
}

beforeAll(async () => {
  await applyD1Migrations(env.ANALYTICS_DB, env.TEST_MIGRATIONS);
});
