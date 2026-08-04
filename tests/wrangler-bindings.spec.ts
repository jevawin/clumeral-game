// The worker test project declares its D1 binding in vitest.workers.config.ts
// rather than reading wrangler.jsonc (which pool-workers cannot parse — the assets
// block has no `directory`, by design, because @cloudflare/vite-plugin supplies it).
// That means the binding name exists in two places. This is the guard against them
// drifting: rename the binding in wrangler.jsonc alone and every worker test would
// keep passing against a binding production does not have.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const raw = readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8');
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
