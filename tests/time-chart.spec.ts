// The time chart's pure module (time chart brief items 39, 78, 120): maths, copy,
// layout arithmetic and the spoken sentence. No DOM, no fetch.
import { describe, expect, it } from 'vitest';
import {
  buildField,
  geometry,
  layout,
  median,
  ordinal,
  refsFit,
  dotBase,
  dotSizes,
  TRACK_INSET,
  percentile,
  rankCopy,
  ranking,
  spokenSummary,
  type FieldRow,
  type Geometry,
} from '../src/time-chart.ts';

// Strangers as plain seconds, one row per player, for readable cases.
const rows = (times: number[]): FieldRow[] => times.map((second) => ({ second, count: 1 }));
const field = (strangers: number[], yours: number) => buildField(rows(strangers), yours);
const copy = (strangers: number[], yours: number) => {
  const c = rankCopy(ranking(field(strangers, yours)));
  return c.pre + c.bold + c.post;
};
const dotAt = (g: Geometry, fraction: number) => g.dots.find((d) => Math.abs(d.fraction - fraction) < 1e-9);

describe('positions on the log axis', () => {
  it('puts the fastest at 0 and the slowest at 1', () => {
    const g = geometry(field([10, 1000], 100));
    const fr = g.dots.map((d) => d.fraction);
    expect(Math.min(...fr)).toBe(0);
    expect(Math.max(...fr)).toBe(1);
  });

  it('is log, not linear: the geometric mean sits halfway', () => {
    const g = geometry(field([10, 1000], 100));
    expect(g.you.fraction).toBeCloseTo(0.5, 12);
  });

  // Item 90: a change of base cancels in the fraction.
  it('does not depend on the log base', () => {
    const strangers = [23, 41, 69, 150, 892];
    const g = geometry(field(strangers, 100));
    const lo = Math.log10(23);
    const span = Math.log10(892) - lo;
    const expected = [...new Set([...strangers, 100])].sort((a, b) => a - b).map((t) => (Math.log10(t) - lo) / span);
    // The even-n median disc is pushed last, after the distinct seconds.
    expected.forEach((e, k) => expect(g.dots[k].fraction).toBeCloseTo(e, 12));
  });

  it('puts every dot at 0.5 when there is one distinct time, at any n', () => {
    for (const n of [1, 2, 5]) {
      const g = geometry(field(Array(n - 1).fill(41), 41));
      for (const d of g.dots) expect(d.fraction).toBe(0.5);
      expect(g.refs.map((r) => [r.word, r.anchor])).toEqual([['Fastest', 'center']]);
    }
  });

  // Items 21, 87: the 1s floor is a placement guard only.
  it('floors 0 to 1 for placement', () => {
    expect(geometry(field([0], 1)).dots.every((d) => d.fraction === 0.5)).toBe(true);
    const g = geometry(field([0], 10));
    expect(g.dots[0]).toMatchObject({ fraction: 0, mine: false });
    expect(g.you.fraction).toBe(1);
  });
});

describe('dot sizes', () => {
  // Item 131: the base size follows how many distinct seconds share the track,
  // and a shared second grows by area in proportion to its count.
  const strangers = (k: number) => Array.from({ length: k }, (_, i) => 10 + i * 7);

  it('carries each second\'s player count, and 0 for the median disc', () => {
    const g = geometry(buildField([{ second: 10, count: 1 }, { second: 20, count: 3 }, { second: 30, count: 7 }], 40));
    expect(g.dots.map((d) => [d.count, d.mine])).toEqual([
      [1, false],
      [3, false],
      [7, false],
      [1, true],
    ]);
    const disc = geometry(field([10, 20, 40], 31)).dots.at(-1)!;
    expect(disc.count).toBe(0);
  });

  // Item 132: dots may overlap by 60% of their spacing, with a 7px floor.
  it('starts at 13px on a quiet day and shrinks to a 7px floor as seconds crowd in', () => {
    expect(dotBase(1, 288)).toBe(13);
    expect(dotBase(19, 288)).toBe(13);
    expect(dotBase(39, 288)).toBe(11);
    expect(dotBase(74, 288)).toBe(7);
    expect(dotBase(300, 288)).toBe(7);
  });

  it('gives a wider track bigger dots for the same day', () => {
    expect(dotBase(39, 480)).toBeGreaterThan(dotBase(39, 288));
  });

  it('grows a shared second by area, so size² is proportional to count', () => {
    const g = geometry(field(strangers(18), 300));
    const sizes = dotSizes(g, 288);
    expect(sizes[0]).toBe(13);
    // 13 × √3 = 22.5, and the cap is 25.
    const shared = geometry(buildField([{ second: 10, count: 3 }, { second: 200, count: 1 }], 400));
    expect(dotSizes(shared, 288)[0]).toBe(23);
    const crowd = geometry(buildField([{ second: 10, count: 9 }, ...rows(strangers(60).map((t) => t + 20))], 9999));
    // Base 7 here, so nine on one second is 21, still under the cap.
    expect(dotSizes(crowd, 288)[0]).toBe(21);
  });

  it('caps every dot at 25', () => {
    const g = geometry(buildField([{ second: 10, count: 50 }], 400));
    expect(Math.max(...dotSizes(g, 288))).toBe(25);
  });

  it('keeps yours 4px larger, and never under 11', () => {
    expect(dotSizes(geometry(field([1000], 10)), 288)[0]).toBe(17);
    const busy = geometry(field(strangers(80), 3));
    const sizes = dotSizes(busy, 288);
    const mine = busy.dots.findIndex((d) => d.mine);
    expect(sizes[mine]).toBe(11);
    expect(sizes[mine]).toBeGreaterThan(Math.max(...sizes.filter((_, k) => k !== mine)));
  });

  it('sizes the median disc as one player', () => {
    const g = geometry(field([10, 20, 40], 31));
    const sizes = dotSizes(g, 288);
    expect(sizes.at(-1)).toBe(dotBase(4, 288));
  });
});

describe('the median', () => {
  it('is the middle value at odd n and the rounded mean of the middle two at even n', () => {
    expect(median([10, 20, 30])).toBe(20);
    expect(median([10, 20, 31, 40])).toBe(26);
    expect(median([10, 20, 20, 40])).toBe(20);
  });

  it('is absent at n = 2: no ref and no extra dot', () => {
    const g = geometry(field([10], 40));
    expect(g.refs.map((r) => r.word)).toEqual(['Fastest', 'Slowest']);
    expect(g.dots).toHaveLength(2);
  });

  it('at odd n is a real time, so it adds a ref but no dot', () => {
    const f = field([10, 40], 20);
    const g = geometry(f);
    expect(g.refs.map((r) => r.word)).toEqual(['Fastest', 'Median', 'Slowest']);
    expect(g.dots).toHaveLength(f.tally.size);
  });

  it('at even n off any real time draws one extra disc', () => {
    const f = field([10, 20, 40], 31);
    const g = geometry(f);
    expect(g.refs.find((r) => r.word === 'Median')?.seconds).toBe(26);
    expect(g.dots).toHaveLength(f.tally.size + 1);
    const lo = Math.log(10);
    const disc = dotAt(g, (Math.log(26) - lo) / (Math.log(40) - lo));
    expect(disc).toEqual({ fraction: expect.any(Number), count: 0, mine: false });
  });

  it('at even n on a real time draws no extra disc', () => {
    const f = field([10, 20, 40], 20);
    expect(geometry(f).dots).toHaveLength(f.tally.size);
  });
});

describe('counting yourself once', () => {
  it('adds you to the server rows, which leave you out', () => {
    expect(field([30, 50, 90], 41).n).toBe(4);
  });

  it('counts a stranger on your exact second, and ties you', () => {
    const f = field([41, 90], 41);
    expect(f.tally.get(41)).toBe(2);
    expect(f.n).toBe(3);
    expect(ranking(f)).toEqual({ kind: 'fastest', joint: true });
  });

  it('drops malformed rows', () => {
    const f = buildField(
      [
        { second: -1, count: 1 },
        { second: 1.5, count: 1 },
        { second: 30, count: 0 },
        { second: 30, count: '2' as unknown as number },
        { second: 86401, count: 1 },
        { second: 60, count: 2 },
      ],
      41,
    );
    expect(f.sorted).toEqual([41, 60, 60]);
  });
});

describe('percentile', () => {
  // Item 28, integer-first (D17): ceil(0.7 * 100) would be 71.
  it('is ceil(100 × (faster + 1) / n)', () => {
    expect(percentile(0, 10)).toBe(10);
    expect(percentile(6, 10)).toBe(70);
    expect(percentile(0, 50)).toBe(2);
    expect(percentile(1, 3)).toBe(67);
  });

  // Item 111.
  it('caps at 99', () => {
    expect(percentile(99, 101)).toBe(99);
    expect(percentile(198, 200)).toBe(99);
  });
});

describe('ranking and copy', () => {
  // Strangers spaced so you can be placed anywhere among them.
  const spread = (k: number) => Array.from({ length: k }, (_, i) => 100 + i * 10);

  it('n = 1 reads first', () => {
    expect(copy([], 41)).toBe("You're the first to solve today");
  });

  it('the sole fastest reads fastest at every n, never a percentile', () => {
    for (const n of [2, 9, 10, 50]) expect(copy(spread(n - 1), 41), String(n)).toBe("You're the fastest today");
  });

  it('a tie at the top reads joint fastest', () => {
    expect(copy([41], 41)).toBe("You're the joint fastest today");
    expect(copy([41, ...spread(10)], 41)).toBe("You're the joint fastest today");
  });

  it('below 10 reads an ordinal, never slowest', () => {
    expect(copy([10, 100, 200, 300], 50)).toBe("You're the 2nd fastest");
    expect(copy([10, 20, 30, 40], 50)).toBe("You're the 5th fastest");
    expect(copy([10], 50)).toBe("You're the 2nd fastest");
  });

  it('a tie mid-field below 10 reads joint', () => {
    expect(copy([10, 20, 50, 60, 70, 80], 50)).toBe("You're the joint 3rd fastest");
  });

  it('a tie mid-field from 10 shares the better percentile', () => {
    expect(copy([10, 20, 30, 40, 50, ...spread(6)], 50)).toBe("You're in the top 42% of solve times");
  });

  it('7th of 10 reads top 70%', () => {
    expect(copy([1, 2, 3, 4, 5, 6, 200, 300, 400], 100)).toBe("You're in the top 70% of solve times");
  });

  it('the strictly slowest from 10 reads a count, and a tie at the bottom keeps a percentile', () => {
    expect(copy(spread(9), 999)).toBe('10 players solved today');
    expect(copy([...spread(8), 999], 999)).toBe("You're in the top 90% of solve times");
  });

  it('never reads top 100%', () => {
    const fast = (k: number) => Array.from({ length: k }, (_, i) => i + 1);
    expect(copy([...fast(99), 999], 900)).toBe("You're in the top 99% of solve times");
    expect(copy([...fast(198), 999], 999)).toBe("You're in the top 99% of solve times");
  });

  it('builds ordinals', () => {
    const got = [1, 2, 3, 4, 11, 12, 13, 21, 22, 23].map(ordinal);
    expect(got).toEqual(['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '23rd']);
  });
});

describe('layout', () => {
  // The board's calibration at 12px (items 50, 105): Fastest 39.9, Median 40.7,
  // Slowest 42.1, a time 43.6. A box is as wide as its widest line.
  const REF = 43.6;
  const YOU = 44;
  const NOTE = 66;

  // Fifty fields, each [10, m, 1000] with you on m, so the median ref and your dot
  // walk the whole track.
  const sweep = Array.from({ length: 50 }, (_, i) => {
    const m = Math.round(10 * 100 ** (i / 49));
    return geometry(field([10, 1000], m));
  });

  const run = (g: Geometry, track: number, scale = 1) =>
    layout({
      track,
      geometry: g,
      refWidths: g.refs.map(() => REF * scale),
      youWidth: YOU * scale,
      noteWidth: NOTE * scale,
    });

  it('keeps refs apart and inside the track', () => {
    for (const track of [288, 480]) {
      for (const scale of [1, 2]) {
        for (const g of sweep) {
          const { refs } = run(g, track, scale);
          refs.forEach((b, k) => {
            expect(b.left).toBeGreaterThanOrEqual(0);
            expect(b.left + b.width).toBeLessThanOrEqual(track + 1e-9);
            if (k > 0) expect(b.left).toBeGreaterThanOrEqual(refs[k - 1].left + refs[k - 1].width);
          });
        }
      }
    }
  });

  // Item 128: the end dots come in by TRACK_INSET, so the end leaders sit on
  // their dots' centres inside the track rather than on its edges.
  it('maps fractions into the inset span', () => {
    const { refs, you } = run(geometry(field([10, 1000], 100)), 288);
    expect(refs[0].at).toBe(TRACK_INSET);
    expect(refs[2].at).toBe(288 - TRACK_INSET);
    expect(you.at).toBeCloseTo(144, 9);
  });

  // Item 129: the end labels reach the track's edges, so their leaders sit just
  // inside them, on the end dots.
  it('puts the end labels flush with the track edges', () => {
    const { refs } = run(geometry(field([10, 1000], 100)), 288);
    expect(refs[0].left).toBe(0);
    expect(refs[2].left + refs[2].width).toBe(288);
    expect(run(geometry(field([1000], 10)), 288).you.left).toBe(0);
    const slow = run(geometry(field([10], 1000)), 288).you;
    expect(slow.left + slow.width).toBe(288);
  });

  it('anchors your box inward at the ends and centres it in the middle', () => {
    const at = (strangers: number[], yours: number) => run(geometry(field(strangers, yours)), 288).you.align;
    expect(at([1000], 10)).toBe('start');
    expect(at([10], 1000)).toBe('end');
    expect(at([10, 1000], 100)).toBe('center');
  });

  it('puts the note in the top corner furthest from you', () => {
    expect(run(geometry(field([10, 1000], 20)), 288).note).toBe('right');
    expect(run(geometry(field([10, 1000], 500)), 288).note).toBe('left');
  });

  // Item 122: nothing changes at normal text size.
  it('never drops the note below at normal text size', () => {
    for (const track of [288, 480]) for (const g of sweep) expect(run(g, track).note).not.toBe('below');
  });

  it('drops the note below at 200% text with you in the middle of 288px', () => {
    expect(run(geometry(field([10, 1000], 100)), 288, 2).note).toBe('below');
  });

  it('never leaves a corner note within 8px of your box', () => {
    for (const track of [288, 480]) {
      for (const scale of [1, 2]) {
        for (const g of sweep) {
          const { you, note } = run(g, track, scale);
          const w = NOTE * scale;
          if (note === 'right') expect(track - w - (you.left + you.width)).toBeGreaterThanOrEqual(8);
          if (note === 'left') expect(you.left - w).toBeGreaterThanOrEqual(8);
        }
      }
    }
  });
});

// Item 125: labels step down from full size only when three cannot sit side by side.
describe('refsFit', () => {
  it('fits when the boxes and their 8px gaps fit the track', () => {
    expect(refsFit([90, 90, 92], 288)).toBe(true);
    expect(refsFit([93.2, 95.1, 102], 288)).toBe(false);
    expect(refsFit([54, 54, 54], 288)).toBe(true);
  });

  it('always fits one label that fits the track', () => {
    expect(refsFit([120], 288)).toBe(true);
  });
});

describe('all-identical fields', () => {
  for (const n of [3, 10]) {
    it(`at n = ${n}: one dot, Fastest only, joint fastest`, () => {
      const f = field(Array(n - 1).fill(41), 41);
      const g = geometry(f);
      expect(g.dots).toEqual([{ fraction: 0.5, count: n, mine: true }]);
      expect(dotSizes(g, 288)).toEqual([25]);
      expect(g.refs.map((r) => [r.word, r.anchor, r.seconds])).toEqual([['Fastest', 'center', 41]]);
      expect(copy(Array(n - 1).fill(41), 41)).toBe("You're the joint fastest today");
      expect(spokenSummary(f, g)).toBe(`${n} players solved today, all in 41 seconds. Yours: 41 seconds.`);
    });
  }
});

describe('the spoken sentence', () => {
  const say = (strangers: number[], yours: number) => {
    const f = field(strangers, yours);
    return spokenSummary(f, geometry(f));
  };

  it('n = 1', () => {
    expect(say([], 41)).toBe('1 player solved today. Yours: 41 seconds.');
  });

  it('n = 2 with two times', () => {
    expect(say([30], 41)).toBe('2 players solved today. Fastest 30 seconds, slowest 41 seconds. Yours: 41 seconds.');
  });

  it('all identical at n = 2', () => {
    expect(say([41], 41)).toBe('2 players solved today, all in 41 seconds. Yours: 41 seconds.');
  });

  it('n ≥ 3', () => {
    const strangers = [23, 30, 50, 60, 70, 70, 70, 90, 100, 150, 200, 242, 242];
    expect(say(strangers, 41)).toBe(
      '14 players solved today. Fastest 23 seconds, median 1 minute 10 seconds, slowest 4 minutes 2 seconds. Yours: 41 seconds.',
    );
  });

  it('speaks words, never the compact label', () => {
    expect(say([30, 90], 41)).not.toMatch(/\d+s\b/);
  });
});

// Item 116: the server drops 0s rows, but one that reaches the client is kept,
// floored for placement, and still labelled with its true time.
describe('the 1s guard', () => {
  it('keeps a 0 row, places it at 1s and labels it 0s', async () => {
    const { labelTime } = await import('../src/time-chart.ts');
    const f = field([0, 100], 10);
    expect(f.sorted).toEqual([0, 10, 100]);
    const g = geometry(f);
    expect(g.dots[0].fraction).toBe(0);
    expect(g.refs[0]).toMatchObject({ word: 'Fastest', seconds: 0 });
    expect(labelTime(g.refs[0].seconds)).toBe('0s');
  });
});
