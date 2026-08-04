import { describe, expect, it } from 'vitest';
import {
  GUTTER,
  LABEL_W,
  PLOT_W,
  VIEW_W,
  barCentre,
  barGeometry,
  fillDaySeries,
  formatDay,
  labelAnchor,
  pickDirectLabels,
  summarise,
  xLabelIndexes,
  xLabelStep,
} from '../src/worker/chart.ts';

const days = (n: number, count = 1) =>
  Array.from({ length: n }, (_, i) => ({
    day: new Date(Date.UTC(2026, 0, 1) + i * 86_400_000).toISOString().slice(0, 10),
    count,
  }));

describe('fillDaySeries', () => {
  it('fills a gap in the middle', () => {
    const out = fillDaySeries(
      [
        { day: '2026-08-01', count: 5 },
        { day: '2026-08-04', count: 2 },
      ],
      '2026-08-01',
      '2026-08-04',
    );
    expect(out).toEqual([
      { day: '2026-08-01', count: 5 },
      { day: '2026-08-02', count: 0 },
      { day: '2026-08-03', count: 0 },
      { day: '2026-08-04', count: 2 },
    ]);
  });

  it('fills a gap at the start', () => {
    const out = fillDaySeries([{ day: '2026-08-03', count: 4 }], '2026-08-01', '2026-08-03');
    expect(out.map((d) => d.count)).toEqual([0, 0, 4]);
  });

  it('fills a gap at the end', () => {
    const out = fillDaySeries([{ day: '2026-08-01', count: 4 }], '2026-08-01', '2026-08-03');
    expect(out.map((d) => d.count)).toEqual([4, 0, 0]);
  });

  it('returns all zeros for an entirely empty range', () => {
    const out = fillDaySeries([], '2026-08-01', '2026-08-07');
    expect(out).toHaveLength(7);
    expect(out.every((d) => d.count === 0)).toBe(true);
  });

  it('returns a single day when from equals to', () => {
    expect(fillDaySeries([], '2026-08-01', '2026-08-01')).toEqual([{ day: '2026-08-01', count: 0 }]);
  });

  it('returns nothing when to precedes from', () => {
    expect(fillDaySeries([], '2026-08-05', '2026-08-01')).toEqual([]);
  });

  it('crosses a month and a year boundary', () => {
    expect(fillDaySeries([], '2025-12-30', '2026-01-02').map((d) => d.day)).toEqual([
      '2025-12-30',
      '2025-12-31',
      '2026-01-01',
      '2026-01-02',
    ]);
  });

  it('ignores rows outside the requested window', () => {
    const out = fillDaySeries(
      [
        { day: '2026-07-01', count: 99 },
        { day: '2026-08-02', count: 3 },
      ],
      '2026-08-01',
      '2026-08-03',
    );
    expect(out.map((d) => d.count)).toEqual([0, 3, 0]);
  });
});

describe('xLabelStep', () => {
  it.each([
    [1, 1],
    [6, 1],
    [7, 2],
    [30, 5],
    [90, 15],
    [120, 20],
    [365, 61],
  ])('labels every %ith day at %i days', (d, step) => {
    expect(xLabelStep(d)).toBe(step);
  });

  // Six labels is what 327px fits. If this ever rises, labels overlap on a phone.
  it('never asks for more than six labels', () => {
    for (const d of [1, 7, 12, 30, 60, 90, 200, 365, 1000]) {
      expect(Math.ceil(d / xLabelStep(d))).toBeLessThanOrEqual(6);
    }
  });
});

describe('xLabelIndexes', () => {
  it('always labels the last day', () => {
    for (const d of [1, 7, 30, 90, 120, 365]) {
      expect(xLabelIndexes(d)).toContain(d - 1);
    }
  });

  it('labels every day at 7 days', () => {
    expect(xLabelIndexes(7)).toEqual([0, 2, 4, 6]);
  });

  // The rule that matters is distance in viewBox units, not in days. At 30 days
  // the plain step lands a label 4 slots from the end — 76 units, inside the 87 a
  // label occupies on a phone — so it reads fine on desktop and collides on mobile.
  it('keeps every label at least one label-width from its neighbours', () => {
    for (const d of [1, 7, 13, 30, 31, 90, 91, 101, 120, 365]) {
      const idx = xLabelIndexes(d);
      const geo = barGeometry(d);
      for (let i = 1; i < idx.length; i++) {
        const apart = barCentre(idx[i], geo) - barCentre(idx[i - 1], geo);
        expect(apart, `${d} days, labels ${idx[i - 1]}->${idx[i]}`).toBeGreaterThanOrEqual(LABEL_W);
      }
    }
  });

  // 568 / 87 = 6 is a count of GAPS, so seven labels fit (six gaps, 522 units).
  // The separation test above is the real guarantee; this just pins the ceiling.
  it('never asks for more labels than the narrowest viewport fits', () => {
    for (const d of [1, 7, 30, 90, 101, 365]) {
      expect(xLabelIndexes(d).length, `${d} days`).toBeLessThanOrEqual(7);
    }
  });

  it('returns nothing for an empty range', () => {
    expect(xLabelIndexes(0)).toEqual([]);
  });
});

describe('barGeometry', () => {
  it('caps bar width and keeps a gap at 7 days', () => {
    const geo = barGeometry(7);
    expect(geo.pitch).toBeCloseTo(PLOT_W / 7);
    expect(geo.gap).toBe(2);
    // Capped at 24 rather than a ~79-unit slab, then centred in the slot.
    expect(geo.barWidth).toBe(24);
  });

  it('collapses the gap once slots get tight', () => {
    expect(barGeometry(94).gap).toBe(2);
    expect(barGeometry(95).gap).toBe(0);
    expect(barGeometry(365).gap).toBe(0);
  });

  it('gives every bar a positive width at a full year', () => {
    const geo = barGeometry(365);
    expect(geo.barWidth).toBeCloseTo(PLOT_W / 365);
    expect(geo.barWidth).toBeGreaterThan(0);
  });

  it('never lets bars overflow their slots', () => {
    for (const d of [1, 7, 30, 90, 95, 200, 365]) {
      const geo = barGeometry(d);
      expect(geo.barWidth).toBeLessThanOrEqual(geo.pitch);
      // Epsilon because pitch is a float division; 568/7 lands a bar edge on
      // 31.999999999999996 rather than exactly 32.
      expect(barCentre(d - 1, geo) + geo.barWidth / 2).toBeLessThanOrEqual(VIEW_W + 1e-9);
      expect(barCentre(0, geo) - geo.barWidth / 2).toBeGreaterThanOrEqual(GUTTER - 1e-9);
    }
  });

  it('is safe at zero days', () => {
    expect(barGeometry(0)).toEqual({ pitch: 0, gap: 0, barWidth: 0 });
  });
});

describe('pickDirectLabels', () => {
  it('labels one bar when the max is the most recent', () => {
    const series = [...days(6, 1), { day: '2026-01-07', count: 9 }];
    const labels = pickDirectLabels(series);
    expect(labels).toHaveLength(1);
    expect(labels[0]).toMatchObject({ index: 6, value: 9, kind: 'max' });
  });

  it('labels both when max and latest are far apart', () => {
    const series = days(30, 1);
    series[0].count = 40;
    const labels = pickDirectLabels(series);
    expect(labels.map((l) => l.kind)).toEqual(['max', 'latest']);
  });

  it('drops the latest label when the boxes would overlap', () => {
    const series = days(30, 1);
    // Second-to-last bar is the max, so the two labels sit adjacent.
    series[28].count = 40;
    const labels = pickDirectLabels(series);
    expect(labels).toHaveLength(1);
    expect(labels[0].kind).toBe('max');
    // Confirm the drop was the collision rule and not an accident.
    const geo = barGeometry(30);
    expect(Math.abs(barCentre(29, geo) - barCentre(28, geo))).toBeLessThan(LABEL_W);
  });

  it('returns nothing for an all-zero series', () => {
    expect(pickDirectLabels(days(30, 0))).toEqual([]);
  });

  it('returns nothing for an empty series', () => {
    expect(pickDirectLabels([])).toEqual([]);
  });

  it('resolves a tied maximum to the more recent of the two', () => {
    const series = days(10, 0);
    series[2].count = 5;
    series[7].count = 5;
    const max = pickDirectLabels(series).find((l) => l.kind === 'max');
    expect(max?.index).toBe(7);
  });

  // A zero on the newest bar is worth saying out loud — "no plays today" is a
  // real reading. It is only the entirely-flat series that gets no labels,
  // because there "0" above a flat baseline reads as a broken chart.
  it('still labels a zero on the most recent bar when the range has activity', () => {
    const series = days(10, 0);
    series[2].count = 5;
    const labels = pickDirectLabels(series);
    expect(labels.map((l) => [l.kind, l.value])).toEqual([
      ['max', 5],
      ['latest', 0],
    ]);
  });

  it('anchors labels away from the plot edges', () => {
    const long = days(365, 1);
    long[364].count = 50;
    expect(pickDirectLabels(long)[0].anchor).toBe('end');

    const early = days(365, 1);
    early[0].count = 50;
    expect(pickDirectLabels(early)[0].anchor).toBe('start');
  });

  it('keeps every label inside the viewBox', () => {
    for (const d of [1, 7, 30, 90, 365]) {
      const series = days(d, 3);
      for (const l of pickDirectLabels(series)) {
        expect(l.x).toBeGreaterThanOrEqual(GUTTER);
        expect(l.x).toBeLessThanOrEqual(VIEW_W);
      }
    }
  });
});

describe('labelAnchor', () => {
  it('anchors by proximity to the plot edges', () => {
    expect(labelAnchor(GUTTER + 4)).toBe('start');
    expect(labelAnchor(300)).toBe('middle');
    expect(labelAnchor(VIEW_W - 4)).toBe('end');
  });
});

describe('summarise', () => {
  it('reports total, average, max and the day it fell on', () => {
    const series = [
      { day: '2026-08-01', count: 2 },
      { day: '2026-08-02', count: 0 },
      { day: '2026-08-03', count: 7 },
    ];
    expect(summarise(series)).toEqual({ total: 9, average: 3, max: 7, maxDay: '2026-08-03' });
  });

  it('rounds the average to one decimal', () => {
    expect(summarise(days(3, 1).map((d, i) => ({ ...d, count: i }))).average).toBe(1);
    expect(summarise([{ day: 'a', count: 1 }, { day: 'b', count: 2 }]).average).toBe(1.5);
  });

  it('reports no max day for an all-zero series', () => {
    expect(summarise(days(5, 0))).toMatchObject({ total: 0, max: 0, maxDay: null });
  });

  it('is safe on an empty series', () => {
    expect(summarise([])).toEqual({ total: 0, average: 0, max: 0, maxDay: null });
  });
});

describe('formatDay', () => {
  it('formats with and without the year', () => {
    expect(formatDay('2026-08-04')).toBe('4 Aug 2026');
    expect(formatDay('2026-08-04', { year: false })).toBe('4 Aug');
    expect(formatDay('2026-12-31')).toBe('31 Dec 2026');
  });
});
