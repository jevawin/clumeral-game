#!/usr/bin/env node
// Compare Analytics Engine against D1, day by day, so AE can be retired on
// evidence rather than on the assumption that the dual write worked.
//
// Run from the Pi:  node scripts/compare-ae-d1.mjs [--days 30] [--host clumeral.com]
//                                                  [--event NAME] [--verbose]
//
// A bare run compares EVERY event. --event narrows it to one; it is not a default.
//
// Needs an Analytics Read token in .env at the repo root (gitignored), under
// CF_ANALYTICS_TOKEN or CF_API_TOKEN. The account id defaults to ours and can be
// overridden with CF_ACCOUNT_ID. The token is a scoped Account Analytics Read
// token; it cannot write anything.
//
// The gate, per docs/ANALYTICS.md: the unit is the (day, event) CELL, over full
// UTC days, and the verdict is weighted sum against weighted sum within +/-1% of
// the AE value or +/-3 events, whichever is larger. Partial days are excluded
// rather than tolerated — a day still being written to will always differ, and
// letting it into the comparison just adds noise the reader has to learn to
// ignore.
//
// Both sides sum sample intervals. Comparing COUNT() to COUNT() would agree with
// itself while both undercounted reality by 1.7%. Row counts ARE printed, because
// they separate "records missing" from "a multiplier missing" — but they never
// decide a verdict: on a live day AE stores sampled rows and D1 writes one row per
// event, so a row-count gap there is correct behaviour.
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
    // No default. A bare run compares EVERY event; --event narrows it to one.
    event: arg('event', undefined),
    verbose: argv.includes('--verbose'),
  };
}

// Within 1% of the AE value, or 3 events, whichever is larger.
//
// The SOLE home of this arithmetic. judgeCell calls it rather than repeating it:
// two copies is how the ±3 floor ends up applied on one path and not the other.
export function withinTolerance(ae, d1) {
  const allowed = Math.max(3, ae * 0.01);
  return Math.abs(ae - d1) <= allowed;
}

// The gate. Reads ONLY the weighted sums.
//
// Row counts are diagnostic and can never fail a run: on a live day AE stores
// sampled rows while D1 writes one row per event, so an AE/D1 row-count gap on a
// live cell is correct behaviour, and gating on it would fail forever on good data.
//
// zero-side is checked BEFORE tolerance, so AE 1 / D1 0 fails rather than sliding
// under the ±3 floor. The asymmetry is deliberate: one side holding nothing at all
// is a different kind of wrong from the two sides drifting.
export function judgeCell(cell) {
  const { aeWeighted: ae, d1Weighted: d1 } = cell;
  if ((ae === 0) !== (d1 === 0)) return 'zero-side';
  if (ae === d1) return 'exact';
  return withinTolerance(ae, d1) ? 'in-band' : 'out-of-tolerance';
}

// What the D1 rows in a cell are, so a row-count difference can be read at all:
// on a backfilled cell it is an import defect, on a live one it is AE sampling
// doing its job. Without the label the printed counts are uninterpretable.
//
// d1Rows === 0 gives 'unknown' rather than 'live' — there is nothing to label.
export function cellOrigin({ d1Rows, d1Backfilled }) {
  if (d1Rows === 0) return 'unknown';
  if (d1Backfilled === d1Rows) return 'backfilled';
  if (d1Backfilled === 0) return 'live';
  return 'mixed';
}

// Fold both sides' query rows into one cell per (day, event), over the UNION of
// the two key sets. An event present only in AE still produces a cell — that is
// the defect class this whole comparison exists to catch.
//
// Both sides' aggregates go through Number(): AE returns them as strings.
export function buildCells(aeRows, d1Rows) {
  const cells = new Map();
  const at = (day, event) => {
    const key = `${day} ${event}`;
    let cell = cells.get(key);
    if (!cell) {
      cell = { day, event, aeRows: 0, aeWeighted: 0, d1Rows: 0, d1Weighted: 0, d1Backfilled: 0 };
      cells.set(key, cell);
    }
    return cell;
  };

  for (const r of aeRows) {
    // AE returns toStartOfDay as a datetime string; D1 already returns a date.
    const cell = at(String(r.day).slice(0, 10), String(r.event));
    cell.aeRows += Number(r.row_count);
    cell.aeWeighted += Number(r.weighted);
  }
  for (const r of d1Rows) {
    const cell = at(String(r.day).slice(0, 10), String(r.event));
    cell.d1Rows += Number(r.row_count);
    cell.d1Weighted += Number(r.weighted);
    cell.d1Backfilled += Number(r.backfilled ?? 0);
  }

  return [...cells.values()]
    // A cell empty on both sides carries no information. The real queries cannot
    // produce one — both GROUP BY, so a key exists only if a row does — so this
    // is a cheap invariant rather than a live safeguard.
    .filter((c) => c.aeWeighted !== 0 || c.d1Weighted !== 0)
    .map((c) => ({ ...c, origin: cellOrigin(c), delta: c.d1Weighted - c.aeWeighted }))
    .sort((a, b) => a.day.localeCompare(b.day) || a.event.localeCompare(b.event));
}

// Enrich every cell with its verdict and whether it counts, and roll the lot up.
//
// `today` is a parameter, never read from the clock in here — that is what makes
// the partial-day rule testable.
export function summarise(cells, today) {
  for (const cell of cells) {
    // A day still being written to on both sides will always differ. It stays in
    // the output so the skip is visible, but it can never fail the gate.
    cell.skipped = cell.day >= today;
    cell.verdict = judgeCell(cell);
  }

  const counted = cells.filter((c) => !c.skipped);
  const failures = counted.filter(
    (c) => c.verdict === 'zero-side' || c.verdict === 'out-of-tolerance',
  );

  const perEvent = [...new Set(counted.map((c) => c.event))].sort().map((event) => {
    const mine = counted.filter((c) => c.event === event);
    // Worst by absolute value, kept signed: across +2 and -5, -5 is the worst.
    const worstDelta = mine.reduce((w, c) => (Math.abs(c.delta) > Math.abs(w) ? c.delta : w), 0);
    return {
      event,
      days: mine.length,
      worstDelta,
      verdict: mine.some((c) => failures.includes(c)) ? 'FAIL' : 'PASS',
    };
  });

  return {
    cells,
    perEvent,
    failures,
    // Lists, not counters: the in-band reminder has to name the event as well as
    // the day, which a count cannot do.
    inBand: counted.filter((c) => c.verdict === 'in-band'),
    skipped: cells.filter((c) => c.skipped),
    oldestDay: cells[0]?.day ?? null,
    comparedCount: counted.length,
    // Zero failures out of zero cells is NOT a pass. A mistyped --host, an
    // --event that does not exist, or a window outside the data would otherwise
    // report green having checked nothing — and this gate is what retires a data
    // source that cannot be recovered once it is gone.
    exitCode: failures.length > 0 || counted.length === 0 ? 1 : 0,
  };
}

// Separate "we are missing records" from "we are missing a multiplier". The
// 2026-08-04 cell looked like nine lost events and was one imported row that lost
// its sample_interval — a distinction the old script could not express, and a day
// went on the ambiguity.
export function describeDelta({ aeRows, aeWeighted, d1Rows, d1Weighted }) {
  if (aeRows !== d1Rows) return `row counts differ (AE ${aeRows}, D1 ${d1Rows})`;
  if (aeWeighted !== d1Weighted) return 'same row count, sample weighting differs';
  return 'exact';
}

const signed = (n) => (n > 0 ? `+${n}` : String(n));

/** One line per cell. Takes a cell that has been through summarise. */
export function formatCellLine(cell) {
  const origin = cell.origin === 'unknown' ? '—' : cell.origin;
  const verdict = cell.skipped ? 'partial, skipped' : describeDelta(cell);
  return [
    cell.day,
    cell.event,
    `AE ${cell.aeRows}/${cell.aeWeighted}`,
    `D1 ${cell.d1Rows}/${cell.d1Weighted}`,
    origin,
    signed(cell.delta),
    verdict,
  ].join(' · ');
}

export function formatReport(summary, { verbose = false } = {}) {
  const out = [];

  // Suppressed entirely when there is nothing to roll up — a column header over
  // a dashed rule over nothing reads as a table that failed to render.
  if (summary.perEvent.length > 0) {
    out.push('event                  days  worst delta  verdict');
    out.push('-------------------------------------------------');
    for (const e of summary.perEvent) {
      out.push(
        `${e.event.padEnd(21)} ${String(e.days).padStart(5)} ${signed(e.worstDelta).padStart(12)}  ${e.verdict}`,
      );
    }
    out.push('');
  }

  if (verbose) {
    out.push(`Every cell compared (${summary.cells.length}):`);
    for (const c of summary.cells) out.push(`  ${formatCellLine(c)}`);
    out.push('');
  }

  if (summary.skipped.length > 0) {
    out.push(`Partial days, excluded from the verdict (${summary.skipped.length}):`);
    for (const c of summary.skipped) out.push(`  ${formatCellLine(c)}`);
    out.push('');
  }

  if (summary.comparedCount === 0) {
    out.push('NO DATA: nothing was compared. This is a failure, not a pass —');
    out.push('a gate that checks nothing cannot be green.');
    if (summary.skipped.length > 0) {
      out.push('');
      out.push('Every cell found was a partial day, listed above. Re-run tomorrow, or');
      out.push('widen --days so the window includes at least one full UTC day.');
    } else {
      out.push('');
      out.push('Nothing matched at all. Check --host, --event and --days.');
    }
    out.push('');
  } else if (summary.failures.length > 0) {
    out.push(`FAIL: ${summary.failures.length} failing cell(s). PR 3 is blocked.`);
    out.push('');

    // The two failure classes are procedurally different, so the output has to
    // name which is which: the PR 3 checklist lets a zero-side cell be signed
    // off without resetting the three-clean-day streak, and nothing else.
    const outOfTolerance = summary.failures.filter((c) => c.verdict === 'out-of-tolerance');
    const zeroSide = summary.failures.filter((c) => c.verdict === 'zero-side');

    if (outOfTolerance.length > 0) {
      out.push(`Out of tolerance (${outOfTolerance.length}) — resets the three-clean-day streak:`);
      for (const c of outOfTolerance) out.push(`  ${formatCellLine(c)}`);
      out.push('');
    }
    if (zeroSide.length > 0) {
      out.push(`Zero on one side (${zeroSide.length}) — may be signed off by Jamie, but only if`);
      out.push('recorded in docs/ANALYTICS.md with the day, the event and both counts:');
      for (const c of zeroSide) out.push(`  ${formatCellLine(c)}`);
      out.push('');
    }

    // AE retains ~90 days and deletes continuously, so the oldest day in a long
    // window can be part-deleted on the AE side while D1 still holds all of it.
    // That looks identical to a dual-write defect and is not one. Retention takes
    // a whole day at a time, which is now up to ten cells, so the condition is
    // "every failure is on the oldest day", not "there is exactly one failure".
    if (summary.failures.every((c) => c.day === summary.oldestDay)) {
      out.push(`Note: every failure is on the oldest day (${summary.oldestDay}). If D1 is higher`);
      out.push(`than AE there, that is AE retention deleting it, not a write defect. A fully`);
      out.push(`deleted day reads as AE 0 / D1 n — a zero-side failure, not a write defect.`);
      out.push(`Re-run with a shorter --days to confirm.`);
      out.push('');
    }
  } else {
    out.push('PASS: every full-day cell inside tolerance.');
    out.push('');
  }

  if (summary.inBand.length > 0) {
    out.push(`${summary.inBand.length} cell(s) differed but stayed inside the band — record them`);
    out.push('in docs/ANALYTICS.md with the day, the event and both counts:');
    for (const c of summary.inBand) out.push(`  ${formatCellLine(c)}`);
    out.push('');
  }

  return out.join('\n');
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

const quote = (s) => s.replace(/'/g, "''");

// One query per side per run, not one per event. Rows come back per (day, event).
/** Analytics Engine SQL API. */
async function fromAE({ days, host, event, token, account }) {
  // toStartOfDay on the lower bound, matching the D1 side's UTC-midnight cutoff.
  // A rolling `NOW() - INTERVAL n DAY` would give AE a partial first day against
  // D1's whole one, and the oldest day would report out of tolerance on every run
  // — the exact midnight-boundary artefact this comparison is supposed to exclude.
  //
  // COUNT() takes ZERO arguments here: AE rejects COUNT(*) outright. The row_count
  // alias avoids betting on `rows` being unreserved in AE's dialect. Grouping by
  // the aliases is the idiom already proven against this API for `day`, and
  // `blob1 AS event` is a plain rename rather than an expression — but if a run
  // ever rejects it, group and order by blob1 and keep the alias in the
  // projection only.
  const sql = `
    SELECT toStartOfDay(timestamp) AS day, blob1 AS event,
           COUNT() AS row_count, SUM(_sample_interval) AS weighted
    FROM clumeral
    WHERE timestamp >= toStartOfDay(NOW()) - INTERVAL '${days}' DAY
      AND blob4 = '${quote(host)}'
      ${event ? `AND blob1 = '${quote(event)}'` : ''}
    GROUP BY day, event ORDER BY day ASC, event ASC`;

  // Every way this can fail is "could not run", so every one of them prints its
  // own detail and exits 2. Exiting 1 would report an expired token as "the
  // comparison ran, and D1 disagrees" — and a tagged error is never printed by
  // the guard, so anything thrown from here has to say its piece first.
  const fail = (detail) => {
    console.error('\nCould not read Analytics Engine.\n');
    console.error(detail.trim());
    console.error('');
    return Object.assign(new Error('AE unreachable'), { exitCode: 2 });
  };

  let res;
  try {
    res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${account}/analytics_engine/sql`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'text/plain' },
        body: sql,
      },
    );
  } catch (err) {
    // No network, DNS failure, TLS failure.
    throw fail(String(err));
  }
  if (!res.ok) throw fail(`${res.status} ${await res.text()}`);

  let data;
  try {
    ({ data } = await res.json());
  } catch (err) {
    throw fail(`The response was not JSON: ${err}`);
  }
  // A 200 with no rows array is not an empty result — it is a shape we do not
  // understand, and treating it as zero rows would report a green gate.
  if (!Array.isArray(data)) throw fail(`Expected a data array, got: ${JSON.stringify(data)}`);
  return data;
}

/** Remote D1, through wrangler. Read-only: a single SELECT. */
function fromD1({ days, host, event }) {
  // SUM(backfilled) is the origin label — one extra column on a query already
  // being run. The column carries a CHECK (backfilled IN (0,1)), so the sum is
  // exactly how many of the cell's rows came from the import.
  const sql = `SELECT strftime('%Y-%m-%d', ts / 1000, 'unixepoch') AS day, event,
      COUNT(*) AS row_count, SUM(sample_interval) AS weighted, SUM(backfilled) AS backfilled
    FROM analytics_events
    WHERE hostname = '${quote(host)}'
      ${event ? `AND event = '${quote(event)}'` : ''}
      AND ts >= (unixepoch(date('now', '-${days} days')) * 1000)
    GROUP BY day, event ORDER BY day, event`;

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
  // Inside its own guard: wrangler exiting 0 with output we cannot parse is
  // still "could not read D1". Left bare, indexOf returning -1 made slice(-1)
  // parse the last character of the output and throw an untagged SyntaxError,
  // which the guard turned into exit 1 — a red gate blamed on the data.
  let parsed;
  try {
    const start = out.indexOf('[');
    if (start === -1) throw new Error('no JSON array in wrangler output');
    parsed = JSON.parse(out.slice(start));
  } catch (err) {
    console.error('\nCould not read the remote D1.\n');
    console.error(`wrangler succeeded but its output could not be parsed: ${err}`);
    console.error('');
    throw Object.assign(new Error('D1 unreachable'), { exitCode: 2 });
  }
  return parsed[0]?.results ?? [];
}

/** Every side effect lives here. Returns the process exit code. */
async function main(argv) {
  const { days, host, event, verbose } = parseArgs(argv);

  const env = loadEnv();
  // The .env Jamie created holds CF_ANALYTICS_TOKEN and no account id, so accept
  // that name and default the account. Demanding CF_API_TOKEN and CF_ACCOUNT_ID
  // made this script unrunnable with the only .env that has ever existed.
  const token = env.CF_ANALYTICS_TOKEN || env.CF_API_TOKEN;
  const account = env.CF_ACCOUNT_ID || '06ff16a35fdefa6cae9e3463116086aa';
  if (!token) {
    console.error('No Analytics Read token found. Set CF_ANALYTICS_TOKEN (or CF_API_TOKEN) in .env at the repo root.');
    // 2, not 1: a missing token means the comparison could not run at all.
    return 2;
  }

  const today = new Date().toISOString().slice(0, 10);

  const [aeRows, d1Rows] = await Promise.all([
    fromAE({ days, host, event, token, account }),
    Promise.resolve().then(() => fromD1({ days, host, event })),
  ]);

  const summary = summarise(buildCells(aeRows, d1Rows), today);

  console.log(`\nAE vs D1 — ${event ?? 'every event'} on ${host}, last ${days} days`);
  console.log(`${summary.cells.length} non-empty (day, event) cells\n`);
  console.log(formatReport(summary, { verbose }));

  return summary.exitCode;
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
