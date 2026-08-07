import { describe, it, expect } from 'vitest';
// A static import is the assertion: the script used to call process.exit(1) at
// module scope when no token was found, which killed the vitest process during
// collection on any machine without a .env — i.e. CI.
import {
  withinTolerance,
  judgeCell,
  cellOrigin,
  buildCells,
  summarise,
} from '../scripts/compare-ae-d1.mjs';

describe('compare-ae-d1 — importable without side effects', () => {
  it('exports withinTolerance and runs nothing on import', () => {
    expect(typeof withinTolerance).toBe('function');
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
