import { describe, it, expect } from 'vitest';
// A static import is the assertion: the script used to call process.exit(1) at
// module scope when no token was found, which killed the vitest process during
// collection on any machine without a .env — i.e. CI.
import { withinTolerance, judgeCell } from '../scripts/compare-ae-d1.mjs';

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
