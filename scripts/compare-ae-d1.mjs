#!/usr/bin/env node
// Compare Analytics Engine against D1, day by day, so AE can be retired on
// evidence rather than on the assumption that the dual write worked.
//
// Run from the Pi:  node scripts/compare-ae-d1.mjs [--days 30] [--host clumeral.com]
//
// Needs an Analytics Read token in .env at the repo root (gitignored), under
// CF_ANALYTICS_TOKEN or CF_API_TOKEN. The account id defaults to ours and can be
// overridden with CF_ACCOUNT_ID. The token is a scoped Account Analytics Read
// token; it cannot write anything.
//
// The gate, per docs/ANALYTICS.md: every FULL UTC day within +/-1% or +/-3 events,
// whichever is larger. Partial days are excluded rather than tolerated — a day
// still being written to will always differ, and letting it into the comparison
// just adds noise the reader has to learn to ignore.
//
// Both sides sum sample intervals. Comparing COUNT() to COUNT() would agree with
// itself while both undercounted reality by 1.7%.
//
// Everything above main() is pure and exported for tests. Every side effect —
// reading .env, the network, wrangler, printing, the exit code — happens inside
// main(), which only runs behind the direct-execution guard at the foot of the
// file. An unguarded import used to kill vitest during collection.

import { execFileSync } from 'node:child_process';
import { readFileSync, realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

/** Parse argv (already sliced past node and the script path). Pure. */
export function parseArgs(argv) {
  const arg = (name, fallback) => {
    const i = argv.indexOf(`--${name}`);
    return i === -1 ? fallback : argv[i + 1];
  };
  return {
    days: Number(arg('days', '30')),
    host: arg('host', 'clumeral.com'),
    event: arg('event', 'puzzle_start'),
    verbose: argv.includes('--verbose'),
  };
}

/** Within 1% or 3 events, whichever is larger. */
export function withinTolerance(ae, d1) {
  const allowed = Math.max(3, ae * 0.01);
  return Math.abs(ae - d1) <= allowed;
}

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

/** Analytics Engine SQL API. Returns per-day summed sample intervals. */
async function fromAE({ days, host, event, token, account }) {
  // toStartOfDay on the lower bound, matching the D1 side's UTC-midnight cutoff.
  // A rolling `NOW() - INTERVAL n DAY` would give AE a partial first day against
  // D1's whole one, and the oldest day would report out of tolerance on every run
  // — the exact midnight-boundary artefact this comparison is supposed to exclude.
  const sql = `
    SELECT toStartOfDay(timestamp) AS day, SUM(_sample_interval) AS count
    FROM clumeral
    WHERE timestamp >= toStartOfDay(NOW()) - INTERVAL '${days}' DAY
      AND blob4 = '${host.replace(/'/g, "''")}'
      AND blob1 = '${event.replace(/'/g, "''")}'
    GROUP BY day ORDER BY day ASC`;

  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${account}/analytics_engine/sql`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'text/plain' },
      body: sql,
    },
  );
  if (!res.ok) throw new Error(`AE query failed: ${res.status} ${await res.text()}`);
  const { data } = await res.json();
  return new Map(data.map((r) => [String(r.day).slice(0, 10), Number(r.count)]));
}

/** Remote D1, through wrangler. Read-only: a single SELECT. */
function fromD1({ days, host, event }) {
  const sql = `SELECT strftime('%Y-%m-%d', ts / 1000, 'unixepoch') AS day, SUM(sample_interval) AS count
    FROM analytics_events
    WHERE hostname = '${host.replace(/'/g, "''")}' AND event = '${event.replace(/'/g, "''")}'
      AND ts >= (unixepoch(date('now', '-${days} days')) * 1000)
    GROUP BY day ORDER BY day ASC`;

  let out;
  try {
    out = execFileSync(
      'npx',
      ['wrangler', 'd1', 'execute', 'clumeral-analytics', '--remote', '--json', '--command', sql],
      { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] },
    );
  } catch (err) {
    // Two expected causes, both worth naming rather than dumping a stack: the
    // database does not exist yet, or wrangler has no credentials in a
    // non-interactive shell.
    const detail = `${err.stdout ?? ''}${err.stderr ?? ''}`;
    console.error('\nCould not read the remote D1.\n');
    if (detail.includes('CLOUDFLARE_API_TOKEN')) {
      console.error('wrangler needs credentials here. Either run `npx wrangler login` in an');
      console.error('interactive shell, or export CLOUDFLARE_API_TOKEN before running this.\n');
    } else if (/couldn't find|not found/i.test(detail)) {
      console.error('The clumeral-analytics database does not exist yet, or wrangler.jsonc still');
      console.error('carries the placeholder database_id. This script is the PR 3 gate — it can');
      console.error('only run once the database is created and PR 1 has been collecting.\n');
    } else {
      console.error(detail.trim() || String(err));
      console.error('');
    }
    // Exit 2 is "could not run", as distinct from exit 1's "ran and failed".
    throw Object.assign(new Error('D1 unreachable'), { exitCode: 2 });
  }
  const parsed = JSON.parse(out.slice(out.indexOf('[')));
  return new Map((parsed[0]?.results ?? []).map((r) => [r.day, Number(r.count)]));
}

/** Every side effect lives here. Returns the process exit code. */
async function main(argv) {
  const { days, host, event } = parseArgs(argv);

  const env = loadEnv();
  // The .env Jamie created holds CF_ANALYTICS_TOKEN and no account id, so accept
  // that name and default the account. Demanding CF_API_TOKEN and CF_ACCOUNT_ID
  // made this script unrunnable with the only .env that has ever existed.
  const token = env.CF_ANALYTICS_TOKEN || env.CF_API_TOKEN;
  const account = env.CF_ACCOUNT_ID || '06ff16a35fdefa6cae9e3463116086aa';
  if (!token) {
    console.error('No Analytics Read token found. Set CF_ANALYTICS_TOKEN (or CF_API_TOKEN) in .env at the repo root.');
    return 1;
  }

  const today = new Date().toISOString().slice(0, 10);

  const [ae, d1] = await Promise.all([
    fromAE({ days, host, event, token, account }),
    Promise.resolve().then(() => fromD1({ days, host, event })),
  ]);
  const allDays = [...new Set([...ae.keys(), ...d1.keys()])].sort();

  let failures = 0;
  let withinBand = 0;
  let firstFailure = null;

  console.log(`\nAE vs D1 — ${event} on ${host}, last ${days} days\n`);
  console.log('day           AE      D1    delta  verdict');
  console.log('------------------------------------------');

  for (const day of allDays) {
    const a = ae.get(day) ?? 0;
    const d = d1.get(day) ?? 0;
    const delta = d - a;

    // Today is still being written to on both sides; a partial day always differs.
    if (day >= today) {
      console.log(`${day}  ${String(a).padStart(5)} ${String(d).padStart(6)} ${String(delta).padStart(8)}  partial, skipped`);
      continue;
    }

    const ok = withinTolerance(a, d);
    if (!ok) {
      failures++;
      firstFailure ??= day;
    }
    else if (delta !== 0) withinBand++;
    console.log(
      `${day}  ${String(a).padStart(5)} ${String(d).padStart(6)} ${String(delta).padStart(8)}  ${ok ? (delta === 0 ? 'exact' : 'within tolerance') : 'OUT OF TOLERANCE'}`,
    );
  }

  console.log('------------------------------------------');
  if (failures > 0) {
    console.log(`\nFAIL: ${failures} day(s) outside tolerance. PR 3 is blocked.\n`);
    // AE retains ~90 days and deletes continuously, so the oldest day in a long
    // window can be half-deleted on the AE side while D1 still holds all of it.
    // That looks identical to a dual-write defect and is not one.
    if (failures === 1 && firstFailure === allDays[0]) {
      console.log(`Note: the only failure is the oldest day (${allDays[0]}). If D1 is higher than AE`);
      console.log(`there, that is AE retention deleting it, not a write defect. Re-run with a`);
      console.log(`shorter --days to confirm.\n`);
    }
    return 1;
  }
  console.log(`\nPASS: every full day inside tolerance.`);
  if (withinBand > 0) {
    console.log(`${withinBand} day(s) differed but stayed inside the band — record them in docs/ANALYTICS.md.`);
  }
  console.log('');
  return 0;
}

// Is this file being run directly, rather than imported by a test? The three
// parts are each load-bearing and each has failed open before — the essay is at
// scripts/lint-migrations.mjs:104-115; this line is copied from :116 verbatim.
if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  main(process.argv.slice(2)).then(
    (code) => {
      process.exitCode = code;
    },
    (err) => {
      if (err?.exitCode === undefined) console.error(err);
      process.exitCode = err?.exitCode ?? 1;
    },
  );
}
