// The worker test project declares its D1 binding in vitest.workers.config.ts
// rather than reading wrangler.jsonc (which pool-workers cannot parse — the assets
// block has no `directory`, by design, because @cloudflare/vite-plugin supplies it).
// That means the binding name exists in two places. This is the guard against them
// drifting: rename the binding in wrangler.jsonc alone and every worker test would
// keep passing against a binding production does not have.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Resolved from the vitest root rather than import.meta.url: under the jsdom
// environment import.meta.url is not a file: URL and readFileSync rejects it.
const raw = readFileSync(join(process.cwd(), 'wrangler.jsonc'), 'utf8');
// Strip // comments — JSONC. Crude but sufficient: no string in this file contains "//".
const config = JSON.parse(raw.replace(/^\s*\/\/.*$/gm, ''));

describe('wrangler.jsonc bindings', () => {
  it('declares the ANALYTICS_DB D1 binding the worker tests assume', () => {
    const bindings = config.d1_databases.map((d: { binding: string }) => d.binding);
    expect(bindings).toContain('ANALYTICS_DB');
  });

  it('points ANALYTICS_DB at the clumeral-analytics database', () => {
    const db = config.d1_databases.find((d: { binding: string }) => d.binding === 'ANALYTICS_DB');
    expect(db.database_name).toBe('clumeral-analytics');
  });

  it('keeps the feedback binding untouched', () => {
    const db = config.d1_databases.find((d: { binding: string }) => d.binding === 'FEEDBACK_DB');
    expect(db.database_name).toBe('clumeral-feedback');
  });
});

describe('env.preprod', () => {
  const preprod = config.env?.preprod;

  // Keys wrangler does NOT inherit into an env block. Omitting one yields an
  // undefined binding and only a WARNING, so the deploy succeeds and the Worker
  // throws at runtime. Verified against wrangler's own `notInheritable` list.
  const NOT_INHERITED = ['d1_databases', 'kv_namespaces', 'analytics_engine_datasets', 'vars'];

  it('exists', () => {
    expect(preprod).toBeDefined();
  });

  it('restates every non-inheritable key the top level defines', () => {
    for (const key of NOT_INHERITED) {
      if (config[key] === undefined) continue;
      expect(preprod[key], `${key} is not inherited and must be restated`).toBeDefined();
    }
  });

  it('keeps the production Worker name, so preview URLs do not change', () => {
    expect(preprod.name).toBe(config.name);
  });

  it('has no placeholder ids anywhere in the file', () => {
    expect(raw).not.toMatch(/REPLACE_WITH/);
  });

  it('never binds a D1 database that production also binds', () => {
    const prod = Object.fromEntries(
      config.d1_databases.map((d: { binding: string; database_id: string }) => [d.binding, d.database_id]),
    );
    for (const d of preprod.d1_databases) {
      expect(d.database_id, `${d.binding} points at production`).not.toBe(prod[d.binding]);
    }
  });

  it('binds the same set of D1 bindings as production', () => {
    expect(preprod.d1_databases.map((d: { binding: string }) => d.binding).sort()).toEqual(
      config.d1_databases.map((d: { binding: string }) => d.binding).sort(),
    );
  });

  // Sharing is asserted POSITIVELY. Expressing it by omission is what made the
  // previous version of this plan encode a missing-binding bug as a passing test.
  it('shares the production PUZZLES namespace explicitly', () => {
    expect(preprod.kv_namespaces).toHaveLength(config.kv_namespaces.length);
    expect(preprod.kv_namespaces[0].id).toBe(config.kv_namespaces[0].id);
    expect(preprod.kv_namespaces[0].binding).toBe(config.kv_namespaces[0].binding);
  });

  it('shares the production Analytics Engine dataset explicitly', () => {
    expect(preprod.analytics_engine_datasets[0].dataset).toBe(config.analytics_engine_datasets[0].dataset);
  });

  it('gives every D1 binding a migrations_dir, in both environments', () => {
    for (const d of [...config.d1_databases, ...preprod.d1_databases]) {
      expect(d.migrations_dir, `${d.binding} has no migrations_dir`).toMatch(/^migrations\//);
    }
  });

  it('labels each environment', () => {
    expect(config.vars.ENVIRONMENT).toBe('production');
    expect(preprod.vars.ENVIRONMENT).toBe('preprod');
  });

  it('gives preprod no cron triggers', () => {
    expect(preprod.triggers?.crons ?? []).toEqual([]);
  });

  it('leaves the production cron intact', () => {
    expect(config.triggers.crons).toContain('0 0 * * *');
  });
});
