import { describe, it, expect } from 'vitest';
import { renderDashboard } from '../src/worker/stats.ts';
import type { StatsResult } from '../src/worker/analytics-db.ts';

// 2026-08-04T12:00:00Z. Fixed so day bucketing and the period label are assertable.
const NOW = Date.UTC(2026, 7, 4, 12, 0, 0);
const DAY = 86_400_000;
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);

function fakeStats(over: Partial<StatsResult> = {}): StatsResult {
  return {
    events: [],
    daily: [],
    uniqueUsers: 0,
    newUsers: 0,
    guessDistribution: [],
    sourceSplit: [],
    firstTs: NOW - 6 * DAY,
    avgTimeSeconds: null,
    ...over,
  };
}

const parse = (html: string) => new DOMParser().parseFromString(html, 'text/html');

/** Daily puzzle_start rows for the last `n` days, most recent last. */
function plays(counts: number[]): StatsResult['daily'] {
  return counts.map((count, i) => ({
    day: iso(NOW - (counts.length - 1 - i) * DAY),
    event: 'puzzle_start',
    count,
  }));
}

// Pull the count out of a dashboard row by its label. The table cells are
// <td>label</td><td>count</td>, so the count is the cell straight after the label.
function rowCount(html: string, label: string): string | null {
  const match = html.match(new RegExp(`<td>${label.replace(/[()]/g, '\\$&')}</td><td>([^<]*)</td>`));
  return match ? match[1] : null;
}

describe('renderDashboard — undo/reset source split', () => {
  it('renders all four rows with their own figures', () => {
    const html = renderDashboard(
      fakeStats({
        sourceSplit: [
          { event: 'undo_used', source: 'keyboard', count: 7 },
          { event: 'undo_used', source: 'button', count: 3 },
          { event: 'reset_used', source: 'keyboard', count: 2 },
          { event: 'reset_used', source: 'button', count: 11 },
        ],
      }),
      { days: 30 },
      'clumeral.com',
      NOW,
    );

    expect(rowCount(html, 'Undo used (keyboard)')).toBe('7');
    expect(rowCount(html, 'Undo used (button)')).toBe('3');
    expect(rowCount(html, 'Reset used (keyboard)')).toBe('2');
    expect(rowCount(html, 'Reset used (button)')).toBe('11');
  });

  // The split is the point: a combined total would hide exactly the comparison
  // these events were added to make.
  it('keeps the two triggers apart rather than summing them', () => {
    const html = renderDashboard(
      fakeStats({
        sourceSplit: [
          { event: 'undo_used', source: 'keyboard', count: 7 },
          { event: 'undo_used', source: 'button', count: 3 },
        ],
      }),
      { days: 30 },
      'clumeral.com',
      NOW,
    );

    expect(rowCount(html, 'Undo used (keyboard)')).toBe('7');
    expect(rowCount(html, 'Undo used (button)')).toBe('3');
    expect(html).not.toContain('<td>Undo used</td>');
  });

  it('renders a missing combination as zero', () => {
    const html = renderDashboard(
      fakeStats({ sourceSplit: [{ event: 'undo_used', source: 'keyboard', count: 4 }] }),
      { days: 30 },
      'clumeral.com',
      NOW,
    );

    expect(rowCount(html, 'Undo used (keyboard)')).toBe('4');
    expect(rowCount(html, 'Undo used (button)')).toBe('0');
    expect(rowCount(html, 'Reset used (keyboard)')).toBe('0');
    expect(rowCount(html, 'Reset used (button)')).toBe('0');
  });

  it('renders all four rows as zero when there is no data at all', () => {
    const html = renderDashboard(fakeStats(), { days: 30 }, 'clumeral.com', NOW);
    for (const label of [
      'Undo used (keyboard)', 'Undo used (button)',
      'Reset used (keyboard)', 'Reset used (button)',
    ]) {
      expect(rowCount(html, label), label).toBe('0');
    }
  });

  it('leaves the existing interaction rows alone', () => {
    const html = renderDashboard(
      fakeStats({
        events: [
          { event: 'theme_toggle', count: 5 },
          { event: 'tooltip_opened', count: 9 },
        ],
      }),
      { days: 30 },
      'clumeral.com',
      NOW,
    );

    expect(rowCount(html, 'Theme toggled')).toBe('5');
    expect(rowCount(html, 'Tooltip opened')).toBe('9');
  });

  // Neither event is in VALID_EVENTS, so the Worker rejects them and both rows
  // could only ever read 0 — which looks like a feature nobody uses.
  it('drops the two rows that could only ever be zero', () => {
    const html = renderDashboard(fakeStats(), { days: 30 }, 'clumeral.com', NOW);
    expect(html).not.toContain('How to Play dismissed');
    expect(html).not.toContain('Colour changed');
    expect(html).toContain('How to Play opened');
  });
});

describe('renderDashboard — chart', () => {
  it('draws one mark per day in the range, including empty days', () => {
    const html = renderDashboard(
      fakeStats({ daily: plays([3, 0, 5, 0, 0, 2, 8]) }),
      { days: 7 },
      'clumeral.com',
      NOW,
    );
    const svg = parse(html).querySelector('svg')!;
    expect(svg.querySelectorAll('path.bar, rect.zero')).toHaveLength(7);
  });

  it('zero-fills days the query returned no row for', () => {
    // Only two days have data; the range is seven, so five must be filled.
    const html = renderDashboard(
      fakeStats({
        daily: [
          { day: iso(NOW - 6 * DAY), event: 'puzzle_start', count: 4 },
          { day: iso(NOW), event: 'puzzle_start', count: 2 },
        ],
      }),
      { days: 7 },
      'clumeral.com',
      NOW,
    );
    const svg = parse(html).querySelector('svg')!;
    expect(svg.querySelectorAll('rect.zero')).toHaveLength(5);
    expect(svg.querySelectorAll('path.bar')).toHaveLength(2);
  });

  // A zero day and a rendering bug must not look the same. The stub sits below
  // the baseline so it survives the gap collapsing at long ranges.
  it('marks a zero day with a stub below the baseline', () => {
    const html = renderDashboard(fakeStats({ daily: plays([5, 0]) }), { days: 2 }, 'clumeral.com', NOW);
    const stub = parse(html).querySelector('rect.zero')!;
    expect(Number(stub.getAttribute('y'))).toBe(200);
    // Tall enough to survive the ~0.55 scale factor on a phone, where a 1-unit
    // stub renders at half a pixel.
    expect(Number(stub.getAttribute('height'))).toBe(3);
  });

  it('keeps the zero stub visible at a range where bars touch', () => {
    const counts = Array.from({ length: 365 }, (_, i) => (i === 100 ? 0 : 5));
    const html = renderDashboard(
      fakeStats({ daily: plays(counts), firstTs: NOW - 364 * DAY }),
      { all: true },
      'clumeral.com',
      NOW,
    );
    const doc = parse(html);
    expect(doc.querySelectorAll('rect.zero')).toHaveLength(1);
    // Still a real, positive-width mark even with no gap between neighbours.
    expect(Number(doc.querySelector('rect.zero')!.getAttribute('width'))).toBeGreaterThan(0);
  });

  it('gives every bar a title with the date and a correctly pluralised count', () => {
    const html = renderDashboard(fakeStats({ daily: plays([1, 13, 0]) }), { days: 3 }, 'clumeral.com', NOW);
    const titles = [...parse(html).querySelectorAll('svg title')].map((t) => t.textContent);
    expect(titles).toEqual(['2 Aug 2026: 1 play', '3 Aug 2026: 13 plays', '4 Aug 2026: 0 plays']);
  });

  it('renders the empty state when the range holds no days at all', () => {
    const html = renderDashboard(fakeStats({ firstTs: null }), { all: true }, 'clumeral.com', NOW);
    expect(html).toContain('No plays in this range');
    expect(parse(html).querySelector('svg')).toBeNull();
  });

  it('renders axes and bars, not the empty state, for an all-zero range', () => {
    const html = renderDashboard(fakeStats({ daily: plays([0, 0, 0, 0, 0, 0, 0]) }), { days: 7 }, 'clumeral.com', NOW);
    const doc = parse(html);
    expect(doc.querySelector('svg')).not.toBeNull();
    expect(doc.querySelectorAll('rect.zero')).toHaveLength(7);
    expect(html).not.toContain('No plays in this range</p>');
  });

  // Colour is the bars' job. Accent-coloured axis text makes furniture look like
  // data, and the accent is the one token not chosen for small-text contrast.
  it('never paints axis or label text with the accent colour', () => {
    const html = renderDashboard(fakeStats({ daily: plays([3, 7, 1]) }), { days: 3 }, 'clumeral.com', NOW);
    for (const text of parse(html).querySelectorAll('svg text')) {
      expect(text.getAttribute('fill')).toBeNull();
      expect(['axis', 'direct']).toContain(text.getAttribute('class'));
    }
    expect(html).toContain('.bar { fill: var(--acc); }');
  });

  // The y axis must not lie. Drawing the mid gridline at exactly half height and
  // labelling it round(max/2) puts the "2" line a sixth of the plot below the bar
  // actually worth 2 whenever the max is odd — and single-digit maxima are what
  // /stats shows until the backfill lands.
  it.each([3, 5, 7, 9])('places the mid gridline at the value it claims, max %i', (max) => {
    const html = renderDashboard(
      fakeStats({ daily: plays([max, Math.round(max / 2), 0]) }),
      { days: 3 },
      'clumeral.com',
      NOW,
    );
    const doc = parse(html);
    const mid = Math.round(max / 2);
    const midLine = [...doc.querySelectorAll('text.axis')].find((t) => t.textContent === String(mid))!;
    const gridY = Number(midLine.getAttribute('y')) - 4;
    // The bar of that exact value tops out at the same height as its gridline.
    const barTop = 200 - (mid / max) * 200;
    expect(gridY).toBeCloseTo(barTop, 1);
  });

  it('drops the mid gridline rather than labelling the axis 0 / 1 / 1', () => {
    const html = renderDashboard(fakeStats({ daily: plays([1, 0, 1]) }), { days: 3 }, 'clumeral.com', NOW);
    const axis = [...parse(html).querySelectorAll('text.axis')].map((t) => t.textContent);
    expect(axis.filter((t) => t === '1')).toHaveLength(1);
  });

  // Pinning x labels to the plot edges is needed at 30+ days to stop them
  // overflowing the viewBox, but at 2-5 days it throws the label ~100 units away
  // from the bar it names — the exact range /stats shows the week after merge.
  it('keeps short-range x labels with their bars', () => {
    const html = renderDashboard(
      fakeStats({ daily: plays([4, 7]), firstTs: NOW - DAY }),
      { all: true },
      'clumeral.com',
      NOW,
    );
    const labels = [...parse(html).querySelectorAll('text.axis')].filter((t) => /[A-Z]/.test(t.textContent!));
    expect(labels).toHaveLength(2);
    for (const l of labels) {
      expect(l.getAttribute('text-anchor')).toBe('middle');
    }
    // Centres of a 2-bar chart: 32 + 0.5*284 and 32 + 1.5*284.
    expect(Number(labels[0].getAttribute('x'))).toBeCloseTo(174, 0);
    expect(Number(labels[1].getAttribute('x'))).toBeCloseTo(458, 0);
  });

  it('still pins the outermost labels inside the viewBox at long ranges', () => {
    const html = renderDashboard(
      fakeStats({ daily: plays(Array(90).fill(3)) }),
      { days: 90 },
      'clumeral.com',
      NOW,
    );
    const labels = [...parse(html).querySelectorAll('text.axis')].filter((t) => /[A-Z]/.test(t.textContent!));
    expect(labels[0].getAttribute('text-anchor')).toBe('start');
    expect(labels[labels.length - 1].getAttribute('text-anchor')).toBe('end');
    for (const l of labels) {
      const x = Number(l.getAttribute('x'));
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(600);
    }
  });

  it('says "1 day" rather than "1 days" on the first day of collection', () => {
    const html = renderDashboard(
      fakeStats({ daily: plays([2]), firstTs: NOW }),
      { all: true },
      'clumeral.com',
      NOW,
    );
    expect(html).toContain('· 1 day<');
  });

  it('labels the highest bar', () => {
    const html = renderDashboard(fakeStats({ daily: plays([2, 19, 3, 4, 1, 2, 5]) }), { days: 7 }, 'clumeral.com', NOW);
    const direct = [...parse(html).querySelectorAll('text.direct')].map((t) => t.textContent);
    expect(direct).toContain('19');
  });

  it('states the real span in the period label', () => {
    const bounded = renderDashboard(fakeStats(), { days: 7 }, 'clumeral.com', NOW);
    expect(bounded).toContain('Last 7 days · 29 Jul 2026 – 4 Aug 2026');

    const all = renderDashboard(fakeStats({ firstTs: NOW - 119 * DAY }), { all: true }, 'clumeral.com', NOW);
    expect(all).toContain('All time · 7 Apr 2026 – 4 Aug 2026 · 120 days');
  });

  it('says so rather than inventing a span when there is no data at all', () => {
    const html = renderDashboard(fakeStats({ firstTs: null }), { all: true }, 'clumeral.com', NOW);
    expect(html).toContain('All time · no data yet');
  });

  it('escapes the hostname it echoes back', () => {
    const html = renderDashboard(fakeStats(), { days: 7 }, '<script>alert(1)</script>', NOW);
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(parse(html).querySelectorAll('script')).toHaveLength(1); // the theme script only
  });
});

describe('renderDashboard — accessibility', () => {
  it('carries every date and count in a visually-hidden table', () => {
    const counts = [3, 0, 5, 0, 0, 2, 8];
    const html = renderDashboard(fakeStats({ daily: plays(counts) }), { days: 7 }, 'clumeral.com', NOW);
    const table = parse(html).querySelector('table.visually-hidden')!;
    const rows = [...table.querySelectorAll('tr')].slice(1); // drop the header row
    expect(rows).toHaveLength(counts.length);
    expect(rows.map((r) => r.querySelectorAll('td')[1].textContent)).toEqual(counts.map(String));
  });

  // The one assertion that catches the accessible route drifting from the visual
  // one — nothing else compares them.
  it('matches the hidden table to the chart, cell for bar', () => {
    const html = renderDashboard(
      fakeStats({ daily: plays([3, 0, 5, 11, 0, 2, 8]) }),
      { days: 7 },
      'clumeral.com',
      NOW,
    );
    const doc = parse(html);
    const fromChart = [...doc.querySelectorAll('svg title')].map((t) => {
      const [date, count] = t.textContent!.split(': ');
      return [date, count.replace(/ plays?$/, '')];
    });
    const fromTable = [...doc.querySelectorAll('table.visually-hidden tr')].slice(1).map((r) => {
      const cells = r.querySelectorAll('td');
      return [cells[0].textContent, cells[1].textContent];
    });
    expect(fromTable).toEqual(fromChart);
  });

  it('summarises the chart in its aria-label', () => {
    const html = renderDashboard(
      fakeStats({ daily: plays([2, 4, 0, 10, 4, 1, 7]) }),
      { days: 7 },
      'clumeral.com',
      NOW,
    );
    const label = parse(html).querySelector('svg')!.getAttribute('aria-label');
    // 28 plays over 7 days = 4 average; highest 10 on the fourth day.
    expect(label).toBe('Daily plays, 29 Jul 2026 to 4 Aug 2026. Average 4 per day, highest 10 on 1 Aug 2026.');
  });

  it('says there were no plays rather than claiming a highest of zero', () => {
    const html = renderDashboard(fakeStats({ daily: plays([0, 0, 0]) }), { days: 3 }, 'clumeral.com', NOW);
    const label = parse(html).querySelector('svg')!.getAttribute('aria-label');
    expect(label).toBe('Daily plays, 2 Aug 2026 to 4 Aug 2026. No plays in this range.');
  });

  // 365 tab stops to cross one chart is worse than no chart at all. The figures
  // are reachable through the hidden table instead.
  it('makes no part of the chart focusable', () => {
    const html = renderDashboard(fakeStats({ daily: plays([3, 7, 1]) }), { days: 3 }, 'clumeral.com', NOW);
    const svg = parse(html).querySelector('svg')!;
    expect(svg.getAttribute('focusable')).toBe('false');
    expect(svg.querySelectorAll('[tabindex]')).toHaveLength(0);
    expect(svg.querySelectorAll('a, button')).toHaveLength(0);
  });
});

describe('renderDashboard — range nav', () => {
  it('offers exactly the four ranges', () => {
    const html = renderDashboard(fakeStats(), { days: 30 }, 'clumeral.com', NOW);
    const links = [...parse(html).querySelectorAll('.period-nav a')];
    expect(links.map((a) => a.textContent)).toEqual(['7d', '30d', '90d', 'All']);
    expect(links.map((a) => a.getAttribute('href'))).toEqual([
      '/stats?period=7',
      '/stats?period=30',
      '/stats?period=90',
      '/stats?period=all',
    ]);
  });

  it.each([
    [{ days: 7 }, '7d'],
    [{ days: 30 }, '30d'],
    [{ days: 90 }, '90d'],
    [{ all: true }, 'All'],
  ] as const)('marks the selected range active', (range, label) => {
    const html = renderDashboard(fakeStats(), range, 'clumeral.com', NOW);
    const active = [...parse(html).querySelectorAll('.period-nav a.active')];
    expect(active).toHaveLength(1);
    expect(active[0].textContent).toBe(label);
  });
});


// The card that carries brief 40, 49 and 110: one figure, no chart, no new range
// controls.
describe('renderDashboard — average time to complete', () => {
  function card(html: string, label: string): string | null {
    const doc = parse(html);
    for (const el of doc.querySelectorAll('.card')) {
      if (el.querySelector('.card__label')?.textContent === label) {
        return el.querySelector('.card__val')?.textContent ?? null;
      }
    }
    return null;
  }

  it('shows the average as m:ss', () => {
    const html = renderDashboard(fakeStats({ avgTimeSeconds: 252 }), { days: 30 }, 'clumeral.com', NOW);
    expect(card(html, 'Avg time to complete')).toBe('4:12');
  });

  it('shows a dash, not 0:00, when nothing has been recorded', () => {
    const html = renderDashboard(fakeStats(), { days: 30 }, 'clumeral.com', NOW);
    expect(card(html, 'Avg time to complete')).toBe('—');
  });

  it('is present for every period, including all-time', () => {
    for (const range of [{ days: 7 }, { days: 30 }, { days: 90 }, { all: true } as const]) {
      const html = renderDashboard(fakeStats({ avgTimeSeconds: 60 }), range, 'clumeral.com', NOW);
      expect(card(html, 'Avg time to complete'), JSON.stringify(range)).toBe('1:00');
    }
  });

  it('pads the seconds', () => {
    const html = renderDashboard(fakeStats({ avgTimeSeconds: 305 }), { days: 30 }, 'clumeral.com', NOW);
    expect(card(html, 'Avg time to complete')).toBe('5:05');
  });
});
