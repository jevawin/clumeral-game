import { describe, it, expect } from 'vitest';
// A static import is the assertion: the script used to call process.exit(1) at
// module scope when no token was found, which killed the vitest process during
// collection on any machine without a .env — i.e. CI.
import {
  parseArgs,
  withinTolerance,
  judgeCell,
  cellOrigin,
  buildCells,
  summarise,
  describeDelta,
  formatCellLine,
  formatReport,
} from '../scripts/compare-ae-d1.mjs';

describe('compare-ae-d1 — importable without side effects', () => {
  it('exports withinTolerance and runs nothing on import', () => {
    expect(typeof withinTolerance).toBe('function');
  });
});

describe('parseArgs', () => {
  it('compares every event by default', () => {
    // The headline behavioural change: --event used to default to puzzle_start,
    // so a bare run silently checked one event out of ten. This assertion is the
    // only thing standing between that regression and a header line nobody reads.
    expect(parseArgs([]).event).toBeUndefined();
  });

  it('defaults the window, the host and the verbosity', () => {
    expect(parseArgs([])).toMatchObject({ days: 30, host: 'clumeral.com', verbose: false });
  });

  it('picks up the flags it is given', () => {
    expect(parseArgs(['--event', 'puzzle_start']).event).toBe('puzzle_start');
    expect(parseArgs(['--verbose']).verbose).toBe(true);
    expect(parseArgs(['--days', '40', '--host', 'example.com'])).toMatchObject({
      days: 40,
      host: 'example.com',
    });
  });
});

/** A cell as buildCells produces one, with only the fields judgeCell reads set. */
const cell = (aeWeighted: number, d1Weighted: number) => ({
  day: '2026-07-01',
  event: 'puzzle_start',
  aeRows: 0,
  aeWeighted,
  d1Rows: 0,
  d1Weighted,
  d1Backfilled: 0,
  origin: 'unknown',
  delta: d1Weighted - aeWeighted,
});

describe('withinTolerance — 1% of the AE value, or 3, whichever is larger', () => {
  it('takes the percentage above 300, where 1% beats the floor', () => {
    expect(withinTolerance(1000, 990)).toBe(true); // allowed 10
    expect(withinTolerance(1000, 989)).toBe(false);
  });

  it('takes the ±3 floor below 300, where 1% would be uselessly tight', () => {
    expect(withinTolerance(80, 77)).toBe(true);
    expect(withinTolerance(80, 76)).toBe(false);
    // 1% of 200 is 2, so 203 passes only because the floor wins here.
    expect(withinTolerance(200, 203)).toBe(true);
  });
});

describe('judgeCell — the gate, over weighted sums only', () => {
  it('fails a cell where one side is zero and the other is not, whatever its size', () => {
    expect(judgeCell(cell(3, 0))).toBe('zero-side');
    expect(judgeCell(cell(0, 3))).toBe('zero-side');
    expect(judgeCell(cell(1, 0))).toBe('zero-side');
  });

  it('checks zero-side before tolerance, so the ±3 floor cannot swallow it', () => {
    // The band around AE 0 is ±3, so without the ordering AE 0 / D1 5 would be
    // in-band on one side and a hard failure on the other. It is a failure.
    expect(judgeCell(cell(0, 5))).toBe('zero-side');
  });

  it('names the three non-zero verdicts', () => {
    expect(judgeCell(cell(27, 18))).toBe('out-of-tolerance');
    expect(judgeCell(cell(91, 90))).toBe('in-band');
    expect(judgeCell(cell(90, 90))).toBe('exact');
  });

  it('treats both sides at zero as exact if it ever sees one', () => {
    // buildCells drops both-zero cells, so this is a belt-and-braces assertion
    // that the zero rule does not fire on it — not a live path.
    expect(judgeCell(cell(0, 0))).toBe('exact');
  });
});

/** A row as the AE query returns one — aggregates arrive as strings. */
const aeRow = (day: string, event: string, rows: number, weighted: number) => ({
  day: `${day} 00:00:00`,
  event,
  row_count: String(rows),
  weighted: String(weighted),
});

/** A row as the D1 query returns one. */
const d1Row = (
  day: string,
  event: string,
  rows: number,
  weighted: number,
  backfilled = 0,
) => ({ day, event, row_count: rows, weighted, backfilled });

describe('buildCells — the union of (day, event) across both sides', () => {
  it('keeps an event AE has and D1 does not', () => {
    const cells = buildCells([aeRow('2026-07-01', 'route_change', 4, 4)], []);
    expect(cells).toHaveLength(1);
    expect(cells[0]).toMatchObject({
      day: '2026-07-01',
      event: 'route_change',
      aeRows: 4,
      aeWeighted: 4,
      d1Rows: 0,
      d1Weighted: 0,
      delta: -4,
    });
  });

  it('keeps an event D1 has and AE does not', () => {
    const cells = buildCells([], [d1Row('2026-07-01', 'puzzle_start', 4, 4)]);
    expect(cells).toHaveLength(1);
    expect(cells[0]).toMatchObject({ event: 'puzzle_start', aeWeighted: 0, d1Weighted: 4, delta: 4 });
  });

  it('coerces the string aggregates AE returns', () => {
    const [c] = buildCells([aeRow('2026-07-01', 'puzzle_start', 18, 27)], []);
    expect(c.aeRows).toBe(18);
    expect(c.aeWeighted).toBe(27);
  });

  it('never produces a cell where both weighted sums are zero', () => {
    // A cheap invariant, not a live safeguard: both sides GROUP BY, so a key is
    // in the union only if one side had at least one row.
    expect(buildCells([aeRow('2026-07-01', 'ghost', 0, 0)], [d1Row('2026-07-01', 'ghost', 0, 0)]))
      .toEqual([]);
  });

  it('sorts by day then event', () => {
    const cells = buildCells(
      [aeRow('2026-07-02', 'a', 1, 1), aeRow('2026-07-01', 'z', 1, 1), aeRow('2026-07-01', 'a', 1, 1)],
      [],
    );
    expect(cells.map((c) => `${c.day} ${c.event}`)).toEqual([
      '2026-07-01 a',
      '2026-07-01 z',
      '2026-07-02 a',
    ]);
  });
});

describe('cellOrigin — what the D1 rows in a cell actually are', () => {
  it('labels a cell every row of which was backfilled', () => {
    expect(cellOrigin({ d1Rows: 18, d1Backfilled: 18 })).toBe('backfilled');
  });

  it('labels a cell no row of which was backfilled', () => {
    expect(cellOrigin({ d1Rows: 18, d1Backfilled: 0 })).toBe('live');
  });

  it('labels a cell straddling the cutover', () => {
    expect(cellOrigin({ d1Rows: 18, d1Backfilled: 4 })).toBe('mixed');
  });

  it('will not label a cell D1 has no rows in', () => {
    // Calling it live would assert something we did not measure.
    expect(cellOrigin({ d1Rows: 0, d1Backfilled: 0 })).toBe('unknown');
  });
});

describe('summarise — partial days are skipped, not tolerated', () => {
  const cells = buildCells(
    [aeRow('2026-08-06', 'puzzle_start', 90, 90), aeRow('2026-08-07', 'puzzle_start', 90, 90)],
    [d1Row('2026-08-06', 'puzzle_start', 90, 90), d1Row('2026-08-07', 'puzzle_start', 2, 2)],
  );
  const summary = summarise(cells, '2026-08-07');

  it('skips a cell dated today however wildly it differs', () => {
    expect(summary.skipped.map((c) => c.day)).toEqual(['2026-08-07']);
    expect(summary.failures).toEqual([]);
  });

  it('keeps the skipped cell in the output rather than hiding it', () => {
    expect(summary.cells).toHaveLength(2);
  });

  it('enriches every cell with skipped and verdict', () => {
    expect(summary.cells.map((c) => c.skipped)).toEqual([false, true]);
    expect(summary.cells[0].verdict).toBe('exact');
  });
});

describe('describeDelta — missing records, or a missing multiplier', () => {
  it('names sample weighting when the row counts agree', () => {
    expect(describeDelta({ aeRows: 18, aeWeighted: 27, d1Rows: 18, d1Weighted: 18 }))
      .toBe('same row count, sample weighting differs');
  });

  it('names both row counts when they disagree', () => {
    expect(describeDelta({ aeRows: 12, aeWeighted: 27, d1Rows: 18, d1Weighted: 18 }))
      .toBe('row counts differ (AE 12, D1 18)');
  });

  it('says exact when both agree', () => {
    expect(describeDelta({ aeRows: 18, aeWeighted: 18, d1Rows: 18, d1Weighted: 18 })).toBe('exact');
  });
});

describe('formatCellLine — the 2026-08-04 regression fixture', () => {
  // The real numbers from the one cell that ever failed this gate. The old
  // script could not express the difference between "9 events missing" and
  // "one row imported without its sample interval", and a day went on the
  // ambiguity. This assertion is why the change exists.
  const cells = buildCells(
    [aeRow('2026-08-04', 'incorrect_guess', 18, 27)],
    [d1Row('2026-08-04', 'incorrect_guess', 18, 18, 18)],
  );
  const summary = summarise(cells, '2026-08-07');

  it('renders the canonical line character for character', () => {
    expect(formatCellLine(summary.cells[0])).toBe(
      '2026-08-04 · incorrect_guess · AE 18/27 · D1 18/18 · backfilled · -9 · same row count, sample weighting differs',
    );
  });

  it('fails the cell on the weighted sums', () => {
    expect(summary.cells[0].verdict).toBe('out-of-tolerance');
    expect(summary.exitCode).toBe(1);
  });
});

describe('formatCellLine — the other positions', () => {
  const line = (cells: unknown[], today: string) =>
    formatCellLine(summarise(cells as never, today).cells[0]);

  it('renders a skipped partial day in the verdict position', () => {
    const cells = buildCells([aeRow('2026-08-07', 'puzzle_start', 5, 5)], []);
    expect(line(cells, '2026-08-07')).toContain('· partial, skipped');
  });

  it('renders an unlabelled origin as an em dash', () => {
    const cells = buildCells([aeRow('2026-07-01', 'puzzle_start', 5, 5)], []);
    expect(line(cells, '2026-08-07')).toBe(
      '2026-07-01 · puzzle_start · AE 5/5 · D1 0/0 · — · -5 · row counts differ (AE 5, D1 0)',
    );
  });

  it('prints a positive delta signed', () => {
    const cells = buildCells(
      [aeRow('2026-07-01', 'puzzle_start', 90, 90)],
      [d1Row('2026-07-01', 'puzzle_start', 92, 92, 0)],
    );
    expect(line(cells, '2026-08-07')).toContain('· live · +2 ·');
  });
});

describe('summarise — the rollup', () => {
  const cells = buildCells(
    [
      aeRow('2026-06-28', 'puzzle_start', 90, 90),
      aeRow('2026-06-29', 'puzzle_start', 91, 91),
      aeRow('2026-06-29', 'route_change', 190, 190),
      aeRow('2026-06-30', 'route_change', 200, 200),
    ],
    [
      d1Row('2026-06-28', 'puzzle_start', 90, 90),
      d1Row('2026-06-29', 'puzzle_start', 90, 90),
      d1Row('2026-06-29', 'route_change', 188, 188),
      d1Row('2026-06-30', 'route_change', 150, 150),
    ],
  );
  const summary = summarise(cells, '2026-08-07');

  it('exits 1 for one failure among many passes', () => {
    expect(summary.failures.map((c) => `${c.day} ${c.event}`)).toEqual(['2026-06-30 route_change']);
    expect(summary.exitCode).toBe(1);
  });

  it('exits 0 when every cell is clear', () => {
    const clear = buildCells(
      [aeRow('2026-06-28', 'puzzle_start', 90, 90)],
      [d1Row('2026-06-28', 'puzzle_start', 90, 90)],
    );
    expect(summarise(clear, '2026-08-07').exitCode).toBe(0);
  });

  it('rolls up one entry per event, sorted by name', () => {
    expect(summary.perEvent.map((e) => e.event)).toEqual(['puzzle_start', 'route_change']);
    expect(summary.perEvent[0]).toMatchObject({ days: 2, verdict: 'PASS' });
    expect(summary.perEvent[1]).toMatchObject({ days: 2, verdict: 'FAIL' });
  });

  it('takes the worst delta by absolute value and keeps its sign', () => {
    expect(summary.perEvent[0].worstDelta).toBe(-1);
    expect(summary.perEvent[1].worstDelta).toBe(-50);
  });

  it('reports the oldest day, which the retention note reads', () => {
    expect(summary.oldestDay).toBe('2026-06-28');
  });

  it('fails a run that compared nothing rather than calling it a pass', () => {
    // Zero failures out of zero cells is not a pass. A mistyped --host, an
    // --event that does not exist, or a window outside the data would otherwise
    // give a green gate on no evidence — and this gate retires a data source
    // that cannot be recovered afterwards.
    const nothing = summarise([], '2026-08-07');
    expect(nothing.comparedCount).toBe(0);
    expect(nothing.exitCode).toBe(1);
  });

  it('does not count skipped partial days as having been compared', () => {
    const onlyToday = buildCells([aeRow('2026-08-07', 'puzzle_start', 5, 5)], []);
    expect(summarise(onlyToday, '2026-08-07').exitCode).toBe(1);
  });
});

describe('formatReport', () => {
  const report = (aes: unknown[], d1s: unknown[], verbose = false) =>
    formatReport(summarise(buildCells(aes as never, d1s as never), '2026-08-07'), { verbose });

  it('names the event as well as the day in the in-band reminder', () => {
    const out = report(
      [aeRow('2026-08-06', 'puzzle_start', 91, 91), aeRow('2026-08-06', 'route_change', 190, 190)],
      [d1Row('2026-08-06', 'puzzle_start', 90, 90), d1Row('2026-08-06', 'route_change', 188, 188)],
    );
    expect(out).toContain('2026-08-06 · puzzle_start');
    expect(out).toContain('2026-08-06 · route_change');
    expect(out).toContain('docs/ANALYTICS.md');
  });

  it('shows the retention note only when every failure is on the oldest day', () => {
    const onlyOldest = report(
      [aeRow('2026-06-28', 'puzzle_start', 90, 90), aeRow('2026-06-29', 'puzzle_start', 90, 90)],
      [d1Row('2026-06-28', 'puzzle_start', 40, 40), d1Row('2026-06-29', 'puzzle_start', 90, 90)],
    );
    expect(onlyOldest).toContain('2026-06-28');
    expect(onlyOldest).toContain('AE retention');
    // A fully deleted oldest day is a zero-side failure under the new rule, and
    // the note has to say so or the reader is left to deduce it.
    expect(onlyOldest).toContain('zero-side');

    const alsoNewer = report(
      [aeRow('2026-06-28', 'puzzle_start', 90, 90), aeRow('2026-06-29', 'puzzle_start', 90, 90)],
      [d1Row('2026-06-28', 'puzzle_start', 40, 40), d1Row('2026-06-29', 'puzzle_start', 40, 40)],
    );
    expect(alsoNewer).not.toContain('AE retention');
  });

  it('prints every failing cell in full, and skipped days, but not passing cells', () => {
    const out = report(
      [
        aeRow('2026-06-28', 'puzzle_start', 90, 90),
        aeRow('2026-06-29', 'puzzle_start', 90, 90),
        aeRow('2026-08-07', 'puzzle_start', 5, 5),
      ],
      [
        d1Row('2026-06-28', 'puzzle_start', 90, 90),
        d1Row('2026-06-29', 'puzzle_start', 40, 40),
        d1Row('2026-08-07', 'puzzle_start', 1, 1),
      ],
    );
    expect(out).toContain('2026-06-29 · puzzle_start · AE 90/90 · D1 40/40');
    expect(out).toContain('2026-08-07 · puzzle_start · AE 5/5 · D1 1/1');
    expect(out).not.toContain('2026-06-28 · puzzle_start · AE 90/90 · D1 90/90');
  });

  it('names which failure class each failing cell is in', () => {
    // The PR 3 checklist lets Jamie sign off a zero-side failure without
    // resetting the three-clean-day streak, and nothing else. If the output
    // calls every failure "outside tolerance", that rule cannot be applied.
    const out = report(
      [aeRow('2026-07-01', 'htp_opened', 3, 3), aeRow('2026-07-02', 'puzzle_start', 90, 90)],
      [d1Row('2026-07-02', 'puzzle_start', 40, 40)],
    );
    expect(out).toContain('Out of tolerance');
    expect(out).toContain('Zero on one side');
    expect(out).not.toContain('cell(s) outside tolerance');
  });

  it('says plainly when nothing was compared', () => {
    expect(formatReport(summarise([], '2026-08-07'), { verbose: false }))
      .toContain('NO DATA');
  });

  it('prints every built cell under --verbose', () => {
    const args = [
      [aeRow('2026-06-28', 'puzzle_start', 90, 90), aeRow('2026-06-29', 'puzzle_start', 90, 90)],
      [d1Row('2026-06-28', 'puzzle_start', 90, 90), d1Row('2026-06-29', 'puzzle_start', 90, 90)],
    ] as const;
    expect(report(args[0], args[1], true)).toContain('2026-06-28 · puzzle_start · AE 90/90 · D1 90/90');
    expect(report(args[0], args[1], false)).not.toContain('2026-06-28 · puzzle_start');
  });
});
