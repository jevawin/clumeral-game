// The goes strip's markup and spoken summary (results brief items 22, 23, 47, 60,
// 67, 68, 88). jsdom has no layout, so this tests structure; the e2e spec
// (results-page.spec.ts) measures the real boxes.
import { describe, it, expect } from 'vitest';
import {
  stripRows,
  stripAreaPx,
  stripSummary,
  goesStripHtml,
  missedBetween,
  missedTotal,
  BREAK_DAYS,
} from '../src/goes-strip.ts';
import type { StripDay } from '../src/player-stats.ts';

/** Consecutive days from 2026-01-01, so no day is missed. */
function days(goes: number[]): StripDay[] {
  return goes.map((g, i) => ({ date: new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10), goes: g }));
}

function parse(html: string): Document {
  return new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
}

function cellsOf(col: Element): string[] {
  return [...col.children].map((c) => {
    if (c.classList.contains('goes-strip__cell--miss')) return 'miss';
    if (c.classList.contains('goes-strip__cell--hit')) return 'hit';
    if (c.classList.contains('goes-strip__elide')) return 'bolt';
    if (c.classList.contains('goes-strip__count')) return `count:${c.textContent}`;
    return '?';
  });
}

describe('stripRows', () => {
  it('is the worst day, capped at 5, at least 1', () => {
    expect(stripRows(days([1, 3, 2]))).toBe(3);
    expect(stripRows(days([1, 9]))).toBe(5);
    expect(stripRows(days([1]))).toBe(1);
    expect(stripRows([])).toBe(1);
  });
});

describe('stripAreaPx', () => {
  it('is the rows plus gaps, never under the rotated label', () => {
    expect(stripAreaPx(1)).toBe(32);
    expect(stripAreaPx(2)).toBe(32);
    expect(stripAreaPx(3)).toBe(38);
    expect(stripAreaPx(5)).toBe(66);
  });
});

describe('goesStripHtml', () => {
  it('sizes the inner track to hold a broken column and its count', () => {
    const doc = parse(goesStripHtml(days([2, 9, 1])));
    const inner = doc.querySelector<HTMLElement>('.goes-strip__inner')!;
    expect(inner.style.blockSize).toBe('84px');
  });

  it('draws a 3-go day as two misses then the hit, with no bolt or count', () => {
    const doc = parse(goesStripHtml(days([3])));
    const col = doc.querySelector('[data-strip-day]')!;
    expect(col.getAttribute('data-goes')).toBe('3');
    expect(col.hasAttribute('data-broken')).toBe(false);
    expect(cellsOf(col)).toEqual(['miss', 'miss', 'hit']);
  });

  it('breaks a 9-go day: three misses, the bolt, the hit, the true count', () => {
    const doc = parse(goesStripHtml(days([9])));
    const col = doc.querySelector('[data-strip-day]')!;
    expect(col.hasAttribute('data-broken')).toBe(true);
    expect(cellsOf(col)).toEqual(['miss', 'miss', 'miss', 'bolt', 'hit', 'count:9']);
    expect(col.querySelector('use')!.getAttribute('href')).toBe('/sprites.svg#icon-bolt');
  });

  it('breaks at 6, not at 5', () => {
    const doc = parse(goesStripHtml(days([5, 6])));
    const [five, six] = doc.querySelectorAll('[data-strip-day]');
    expect(five.hasAttribute('data-broken')).toBe(false);
    expect(cellsOf(five)).toEqual(['miss', 'miss', 'miss', 'miss', 'hit']);
    expect(six.hasAttribute('data-broken')).toBe(true);
  });

  it('draws one column per day, oldest first', () => {
    const doc = parse(goesStripHtml(days([1, 4, 2, 3])));
    const goes = [...doc.querySelectorAll('[data-strip-day]')].map((c) => c.getAttribute('data-goes'));
    expect(goes).toEqual(['1', '4', '2', '3']);
  });

  it('is a focusable named group whose drawing is hidden from speech', () => {
    const list = days([1, 2, 3]);
    const doc = parse(goesStripHtml(list));
    const scroller = doc.querySelector('[data-strip-scroller]')!;
    expect(scroller.getAttribute('role')).toBe('group');
    expect(scroller.getAttribute('tabindex')).toBe('0');
    expect(scroller.getAttribute('aria-label')).toBe(stripSummary(list));
    expect(scroller.hasAttribute('aria-hidden')).toBe(false);
    expect(doc.querySelector('.goes-strip__inner')!.getAttribute('aria-hidden')).toBe('true');
    expect(doc.querySelector('.goes-strip__y')!.getAttribute('aria-hidden')).toBe('true');
    expect(doc.querySelector('.goes-strip__meta')!.getAttribute('aria-hidden')).toBe('true');
  });

  it('labels the day count under the strip, singular at 1', () => {
    expect(parse(goesStripHtml(days([1, 2]))).querySelector('.goes-strip__meta')!.textContent)
      .toBe('2 daysToday');
    expect(parse(goesStripHtml(days([1]))).querySelector('.goes-strip__meta')!.textContent)
      .toBe('1 dayToday');
  });

  it('is empty for no days', () => {
    expect(goesStripHtml([])).toBe('');
  });
});

describe('stripSummary', () => {
  it("reads the brief's example", () => {
    // 47 threes before today, and today is the 48th.
    const goes = [
      ...Array(56).fill(1), ...Array(104).fill(2), ...Array(47).fill(3),
      ...Array(24).fill(4), ...Array(8).fill(5), 7, 9, 12, 3,
    ];
    expect(goes.length).toBe(243);
    expect(stripSummary(days(goes))).toBe(
      'Goes per day, your 243 days played: 56 in one, 104 in two, 48 in three, 24 in four, ' +
      '8 in five, 3 in six or more. Today: 3.',
    );
  });

  it('says "1 day" for one day', () => {
    expect(stripSummary(days([2]))).toBe('Goes per day, your 1 day played: 1 in two. Today: 2.');
  });

  it('leaves out buckets with no days', () => {
    expect(stripSummary(days([1, 3, 1]))).toBe('Goes per day, your 3 days played: 2 in one, 1 in three. Today: 1.');
  });

  it("says today's true figure past the cap", () => {
    expect(stripSummary(days([1, 9]))).toMatch(/Today: 9\.$/);
  });
});

describe('missed days (results brief 97)', () => {
  const gappy: StripDay[] = [
    { date: '2026-02-26', goes: 1 },
    { date: '2026-03-01', goes: 2 }, // 27, 28 Feb missed
    { date: '2026-03-02', goes: 1 },
    { date: '2026-03-05', goes: 3 }, // 3, 4 Mar missed
  ];

  it('counts the calendar days strictly between two played days', () => {
    expect(missedBetween('2026-03-01', '2026-03-02')).toBe(0);
    expect(missedBetween('2026-02-26', '2026-03-01')).toBe(2);
    expect(missedBetween('2024-12-31', '2025-01-02')).toBe(1);
  });

  it('is 0 for a duplicate date or a malformed key', () => {
    expect(missedBetween('2026-03-01', '2026-03-01')).toBe(0);
    expect(missedBetween('nonsense', '2026-03-01')).toBe(0);
  });

  it('crosses a clock change as whole days', () => {
    expect(missedBetween('2026-03-28', '2026-03-30')).toBe(1);
    expect(missedBetween('2026-10-24', '2026-10-26')).toBe(1);
  });

  it('draws an empty column per missed day, in place', () => {
    const doc = parse(goesStripHtml(gappy));
    const kids = [...doc.querySelector('.goes-strip__inner')!.children].map((c) =>
      c.hasAttribute('data-strip-missed') ? 'gap' : `day:${c.getAttribute('data-goes')}`,
    );
    expect(kids).toEqual(['day:1', 'gap', 'gap', 'day:2', 'day:1', 'gap', 'gap', 'day:3']);
    expect(doc.querySelector('[data-strip-missed]')!.children).toHaveLength(0);
  });

  it('keeps the meta hint at days played', () => {
    const doc = parse(goesStripHtml(gappy));
    expect(doc.querySelector('.goes-strip__meta')!.textContent).toContain('4 days');
  });

  it('says how many were missed, and nothing when none were', () => {
    expect(missedTotal(gappy)).toBe(4);
    expect(stripSummary(gappy)).toBe(
      'Goes per day, your 4 days played, 4 missed: 2 in one, 1 in two, 1 in three. Today: 3.',
    );
    expect(stripSummary(days([1, 2]))).not.toContain('missed');
  });
});

describe('long breaks (results brief 98)', () => {
  function kinds(list: StripDay[]): string[] {
    const doc = parse(goesStripHtml(list));
    return [...doc.querySelector('.goes-strip__inner')!.children].map((c) => {
      if (c.hasAttribute('data-strip-missed')) return 'gap';
      if (c.hasAttribute('data-strip-break')) return `break:${c.textContent}`;
      return 'day';
    });
  }

  it('is a week', () => {
    expect(BREAK_DAYS).toBe(7);
  });

  it('draws six missed days in full', () => {
    expect(kinds([{ date: '2026-03-01', goes: 1 }, { date: '2026-03-08', goes: 1 }])).toEqual([
      'day', 'gap', 'gap', 'gap', 'gap', 'gap', 'gap', 'day',
    ]);
  });

  it('draws seven or more as one break column with the count', () => {
    expect(kinds([{ date: '2026-03-01', goes: 1 }, { date: '2026-03-09', goes: 1 }])).toEqual([
      'day', 'break:7d', 'day',
    ]);
    expect(kinds([{ date: '2026-01-01', goes: 2 }, { date: '2026-04-01', goes: 1 }])).toEqual([
      'day', 'break:89d', 'day',
    ]);
  });

  it('still counts every missed day in the summary', () => {
    expect(stripSummary([{ date: '2026-01-01', goes: 2 }, { date: '2026-04-01', goes: 1 }])).toContain(
      '2 days played, 89 missed',
    );
  });
});
