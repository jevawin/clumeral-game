#!/usr/bin/env node
// Compare Analytics Engine against D1, day by day, so AE can be retired on
// evidence rather than on the assumption that the dual write worked.
//
// Run from the Pi:  node scripts/compare-ae-d1.mjs [--days 30] [--host clumeral.com]
//
// Needs CF_ACCOUNT_ID and CF_API_TOKEN in .env at the repo root (gitignored). The
// token is a scoped Account Analytics Read token; it cannot write anything.
//
// The gate, per docs/ANALYTICS.md: every FULL UTC day within +/-1% or +/-3 events,
// whichever is larger. Partial days are excluded rather than tolerated — a day
// still being written to will always differ, and letting it into the comparison
// just adds noise the reader has to learn to ignore.
//
// Both sides sum sample intervals. Comparing COUNT() to COUNT() would agree with
// itself while both undercounted reality by 1.7%.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : args[i + 1];
};
const DAYS = Number(arg('days', '30'));
const HOST = arg('host', 'clumeral.com');
const EVENT = arg('event', 'puzzle_start');

function loadEnv() {
  const env = { ...process.env };
  try {
    for (const line of readFileSync(new URL('../.env', import.meta.url), 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
      if (m) env[m[1]] ??= m[2].trim().replace(/^["']|["']$/g, '');
    }
  } catch {
    // No .env — fall back to the ambient environment and fail below if unset.
  }
  return env;
}

const env = loadEnv();
if (!env.CF_ACCOUNT_ID || !env.CF_API_TOKEN) {
  console.error('CF_ACCOUNT_ID and CF_API_TOKEN must be set (put them in .env at the repo root).');
  process.exit(1);
}

/** Analytics Engine SQL API. Returns per-day summed sample intervals. */
async function fromAE() {
  const sql = `
    SELECT toStartOfDay(timestamp) AS day, SUM(_sample_interval) AS count
    FROM clumeral
    WHERE timestamp > NOW() - INTERVAL '${DAYS}' DAY
      AND blob4 = '${HOST.replace(/'/g, "''")}'
      AND blob1 = '${EVENT.replace(/'/g, "''")}'
    GROUP BY day ORDER BY day ASC`;

  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/analytics_engine/sql`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.CF_API_TOKEN}`, 'Content-Type': 'text/plain' },
      body: sql,
    },
  );
  if (!res.ok) throw new Error(`AE query failed: ${res.status} ${await res.text()}`);
  const { data } = await res.json();
  return new Map(data.map((r) => [String(r.day).slice(0, 10), Number(r.count)]));
}

/** Remote D1, through wrangler. Read-only: a single SELECT. */
function fromD1() {
  const sql = `SELECT strftime('%Y-%m-%d', ts / 1000, 'unixepoch') AS day, SUM(sample_interval) AS count
    FROM analytics_events
    WHERE hostname = '${HOST.replace(/'/g, "''")}' AND event = '${EVENT.replace(/'/g, "''")}'
      AND ts >= (unixepoch(date('now', '-${DAYS} days')) * 1000)
    GROUP BY day ORDER BY day ASC`;

  const out = execFileSync(
    'npx',
    ['wrangler', 'd1', 'execute', 'clumeral-analytics', '--remote', '--json', '--command', sql],
    { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 },
  );
  const parsed = JSON.parse(out.slice(out.indexOf('[')));
  return new Map((parsed[0]?.results ?? []).map((r) => [r.day, Number(r.count)]));
}

/** Within 1% or 3 events, whichever is larger. */
function withinTolerance(ae, d1) {
  const allowed = Math.max(3, ae * 0.01);
  return Math.abs(ae - d1) <= allowed;
}

const today = new Date().toISOString().slice(0, 10);

const [ae, d1] = await Promise.all([fromAE(), Promise.resolve().then(fromD1)]);
const days = [...new Set([...ae.keys(), ...d1.keys()])].sort();

let failures = 0;
let withinBand = 0;

console.log(`\nAE vs D1 — ${EVENT} on ${HOST}, last ${DAYS} days\n`);
console.log('day           AE      D1    delta  verdict');
console.log('------------------------------------------');

for (const day of days) {
  const a = ae.get(day) ?? 0;
  const d = d1.get(day) ?? 0;
  const delta = d - a;

  // Today is still being written to on both sides; a partial day always differs.
  if (day >= today) {
    console.log(`${day}  ${String(a).padStart(5)} ${String(d).padStart(6)} ${String(delta).padStart(8)}  partial, skipped`);
    continue;
  }

  const ok = withinTolerance(a, d);
  if (!ok) failures++;
  else if (delta !== 0) withinBand++;
  console.log(
    `${day}  ${String(a).padStart(5)} ${String(d).padStart(6)} ${String(delta).padStart(8)}  ${ok ? (delta === 0 ? 'exact' : 'within tolerance') : 'OUT OF TOLERANCE'}`,
  );
}

console.log('------------------------------------------');
if (failures > 0) {
  console.log(`\nFAIL: ${failures} day(s) outside tolerance. PR 3 is blocked.\n`);
  process.exit(1);
}
console.log(`\nPASS: every full day inside tolerance.`);
if (withinBand > 0) {
  console.log(`${withinBand} day(s) differed but stayed inside the band — record them in docs/ANALYTICS.md.`);
}
console.log('');
