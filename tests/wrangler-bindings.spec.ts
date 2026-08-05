// The worker test project declares its D1 binding in vitest.workers.config.ts
// rather than reading wrangler.jsonc (which pool-workers cannot parse — the assets
// block has no `directory`, by design, because @cloudflare/vite-plugin supplies it).
// That means the binding name exists in two places. This is the guard against them
// drifting: rename the binding in wrangler.jsonc alone and every worker test would
// keep passing against a binding production does not have.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BACKFILL_CRON } from '../src/worker/backfill.ts';

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
  // undefined binding and only a WARNING, so the upload succeeds and the Worker
  // throws at runtime.
  //
  // Read out of wrangler's own source rather than hardcoded. A hardcoded list of
  // the four keys this config uses today would stay green while a newly added
  // r2_bucket or queue shipped as undefined — a snapshot of today, not the
  // regression guard the spec asked for. Note `assets` is NOT on this list: it IS
  // inherited, which the generated preprod config confirms.
  const cli = readFileSync(join(process.cwd(), 'node_modules/wrangler/wrangler-dist/cli.js'), 'utf8');
  const NOT_INHERITED = [
    ...new Set([...cli.matchAll(/^\s*([a-z0-9_]+): notInheritable\($/gm)].map((m) => m[1])),
  ];

  it('exists', () => {
    expect(preprod).toBeDefined();
  });

  // If wrangler's bundle format changes, the extraction above silently returns []
  // and the next test would pass having checked nothing. This is what stops that.
  it('actually found wrangler’s non-inheritable list', () => {
    expect(NOT_INHERITED.length).toBeGreaterThan(20);
    expect(NOT_INHERITED).toEqual(
      expect.arrayContaining(['d1_databases', 'kv_namespaces', 'analytics_engine_datasets', 'vars']),
    );
  });

  // Iterates the CONFIG's keys against that list, so adding any non-inheritable
  // binding at the top level and forgetting env.preprod fails here.
  it('restates every non-inheritable key the top level defines', () => {
    const missed = Object.keys(config).filter(
      (key) => NOT_INHERITED.includes(key) && config[key] !== undefined && preprod[key] === undefined,
    );
    expect(missed, 'not inherited by an env block — must be restated in env.preprod').toEqual([]);
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

  // The lint is what stands between a bot-authored migration and production data,
  // and its directory list lives in package.json — a separate file. Add a third D1
  // binding with a new migrations_dir and, without this, its migrations would be
  // applied to production by migrate:prod completely unlinted, silently.
  it('lints every directory that wrangler will apply migrations from', () => {
    const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8'));
    const linted = pkg.scripts['lint:migrations'].split(/\s+/).filter((a: string) => a.startsWith('migrations/'));
    const applied = [...new Set([...config.d1_databases, ...preprod.d1_databases].map((d) => d.migrations_dir))];
    expect(applied.filter((d) => !linted.includes(d)), 'migrations_dir not covered by lint:migrations').toEqual([]);
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

  // The backfill cron expression lives in two files: here, and as BACKFILL_CRON in
  // src/worker/backfill.ts, which scheduled() matches on to tell the two triggers
  // apart. Change one and the other keeps compiling: the backfill would simply
  // never run, or — worse — the daily puzzle job would run once a minute, because
  // the dispatch falls through to it for anything unrecognised.
  it('declares the backfill cron the worker dispatches on', () => {
    expect(config.triggers.crons).toContain(BACKFILL_CRON);
  });
});
