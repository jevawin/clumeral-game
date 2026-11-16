// The goes strip's markup and spoken summary (results brief items 22, 23, 47, 60,
// 67, 68, 88). jsdom has no layout, so this tests structure; the e2e spec
// (results-page.spec.ts) measures the real boxes.
import { describe, it, expect } from 'vitest';
import {
  stripRows,
  stripAreaPx,
  yLabels,
  xStart,
  stripSummary,
  goesStripHtml,
  wireStrip,
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
  it('is the rows plus the gaps between them', () => {
    expect(stripAreaPx(1)).toBe(10);
    expect(stripAreaPx(2)).toBe(24);
    expect(stripAreaPx(5)).toBe(66);
  });
});

describe('the axes (results brief 102)', () => {
  it('numbers each row, top first, with "1 go" at the bottom', () => {
    expect(yLabels(1)).toEqual(['1 go']);
    expect(yLabels(5)).toEqual(['5', '4', '3', '2', '1 go']);
  });

  it('leaves rows 4 and 5 unnumbered when a broken column skips goes there (brief 108)', () => {
    expect(yLabels(5, true)).toEqual(['', '', '3', '2', '1 go']);
    const labels = (goes: number[]) =>
      [...parse(goesStripHtml(days(goes))).querySelectorAll('.goes-strip__y > span')].map((s) => s.textContent);
    expect(labels([1, 9, 2])).toEqual(['', '', '3', '2', '1 go']);
    expect(labels([1, 5, 2])).toEqual(['5', '4', '3', '2', '1 go']);
  });

  it('puts one y label per row in the markup', () => {
    const doc = parse(goesStripHtml(days([1, 3, 2])));
    expect([...doc.querySelectorAll('.goes-strip__y > span')].map((s) => s.textContent)).toEqual(['3', '2', '1 go']);
  });

  it('starts the x axis at the oldest day, in calendar days', () => {
    expect(xStart(days([1]))).toBe('');
    expect(xStart(days([1, 2]))).toBe('1 day ago');
    expect(xStart([{ date: '2026-03-01', goes: 1 }, { date: '2026-03-10', goes: 1 }])).toBe('9 days ago');
    const doc = parse(goesStripHtml(days([1, 2, 1])));
    expect(doc.querySelector('.goes-strip__x')!.textContent).toBe('2 days agotoday');
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

  it('counts the x axis in calendar days, missed ones included', () => {
    expect(xStart(gappy)).toBe('7 days ago');
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
      'day', 'gap', 'gap', 'break:7d', 'gap', 'gap', 'day',
    ]);
    expect(kinds([{ date: '2026-01-01', goes: 2 }, { date: '2026-04-01', goes: 1 }])).toEqual([
      'day', 'gap', 'gap', 'break:89d', 'gap', 'gap', 'day',
    ]);
  });

  it('flanks the count with two bolts on their side (brief 112)', () => {
    const doc = parse(goesStripHtml([{ date: '2026-03-01', goes: 3 }, { date: '2026-03-21', goes: 1 }]));
    const mark = doc.querySelector('[data-strip-break]')!;
    expect([...mark.children].map((c) => c.getAttribute('class'))).toEqual([
      'goes-strip__side-bolt', 'goes-strip__break', 'goes-strip__side-bolt',
    ]);
    // The broken column's sprite, not a copy of it.
    expect(mark.querySelector('use')!.getAttribute('href')).toBe('/sprites.svg#icon-bolt');
    // The rows' height, to centre the mark in: 3 rows of 10px and two 4px gaps.
    expect(doc.querySelector('.goes-strip__inner')!.getAttribute('style')).toContain('--strip-area: 38px');
  });

  it('still counts every missed day in the summary', () => {
    expect(stripSummary([{ date: '2026-01-01', goes: 2 }, { date: '2026-04-01', goes: 1 }])).toContain(
      '2 days played, 89 missed',
    );
  });
});

describe('wireStrip (results brief 105)', () => {
  function mount(scrollWidth: number, clientWidth: number, scrollLeft = 0) {
    document.body.innerHTML = goesStripHtml(days([1, 2, 3]));
    const scroller = document.querySelector<HTMLElement>('[data-strip-scroller]')!;
    Object.defineProperty(scroller, 'scrollWidth', { value: scrollWidth, configurable: true });
    Object.defineProperty(scroller, 'clientWidth', { value: clientWidth, configurable: true });
    scroller.scrollLeft = scrollLeft;
    Object.defineProperty(scroller, 'scrollLeft', { value: scrollLeft, writable: true, configurable: true });
    wireStrip(document.body);
    return { strip: document.querySelector<HTMLElement>('[data-goes-strip]')!, scroller };
  }

  it('marks earlier days off-screen when the track is wider than the scroller', () => {
    expect(mount(500, 280).strip.hasAttribute('data-more-left')).toBe(true);
  });

  it('does not mark a strip that fits', () => {
    expect(mount(280, 280).strip.hasAttribute('data-more-left')).toBe(false);
  });

  it('is a tab stop only while there is something to scroll', () => {
    expect(mount(500, 280).scroller.getAttribute('tabindex')).toBe('0');
    expect(mount(280, 280).scroller.hasAttribute('tabindex')).toBe(false);
  });

  it('keeps the tab stop while focused, and drops it once focus leaves', () => {
    const { scroller } = mount(500, 280);
    scroller.focus();
    Object.defineProperty(scroller, 'scrollWidth', { value: 280, configurable: true });
    scroller.dispatchEvent(new Event('scroll'));
    expect(scroller.getAttribute('tabindex')).toBe('0');
    scroller.blur();
    expect(scroller.hasAttribute('tabindex')).toBe(false);
  });

  it('clears the mark once scrolled to the oldest day, and sets it again on the way back', () => {
    const { strip, scroller } = mount(500, 280);
    scroller.scrollLeft = -220;
    scroller.dispatchEvent(new Event('scroll'));
    expect(strip.hasAttribute('data-more-left')).toBe(false);
    scroller.scrollLeft = -100;
    scroller.dispatchEvent(new Event('scroll'));
    expect(strip.hasAttribute('data-more-left')).toBe(true);
  });

  it('puts the arrow before the start label, hidden from speech', () => {
    mount(500, 280);
    const start = document.querySelector('.goes-strip__start')!;
    expect(start.firstElementChild!.querySelector('use')!.getAttribute('href')).toBe('/sprites.svg#icon-arrow-left');
    expect(start.textContent).toBe('2 days ago');
    expect(document.querySelector('.goes-strip__x')!.getAttribute('aria-hidden')).toBe('true');
  });
});
