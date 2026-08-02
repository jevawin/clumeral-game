import { describe, it, expect } from 'vitest';
import { getStats, renderDashboard } from '../src/worker/stats.ts';

type Stats = Awaited<ReturnType<typeof getStats>>;
type Row = Record<string, string | number>;

function result(data: Row[]) {
  return { data, rows: data.length };
}

// renderDashboard is typed against the full getStats return, so every one of the
// six queries has to be present even when a test only cares about one of them.
function fakeStats(over: Partial<Stats> = {}): Stats {
  return {
    events: result([]),
    daily: result([]),
    uniqueUsers: result([]),
    newUsers: result([]),
    guessDistribution: result([]),
    sourceSplit: result([]),
    ...over,
  };
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
        sourceSplit: result([
          { event: 'undo_used', source: 'keyboard', count: 7 },
          { event: 'undo_used', source: 'button', count: 3 },
          { event: 'reset_used', source: 'keyboard', count: 2 },
          { event: 'reset_used', source: 'button', count: 11 },
        ]),
      }),
      30,
      'clumeral.com',
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
        sourceSplit: result([
          { event: 'undo_used', source: 'keyboard', count: 7 },
          { event: 'undo_used', source: 'button', count: 3 },
        ]),
      }),
      30,
      'clumeral.com',
    );

    expect(rowCount(html, 'Undo used (keyboard)')).toBe('7');
    expect(rowCount(html, 'Undo used (button)')).toBe('3');
    expect(html).not.toContain('<td>Undo used</td>');
  });

  // Matching the existing interactions behaviour: an absent combination is 0,
  // not a missing row.
  it('renders a missing combination as zero', () => {
    const html = renderDashboard(
      fakeStats({
        sourceSplit: result([{ event: 'undo_used', source: 'keyboard', count: 4 }]),
      }),
      30,
      'clumeral.com',
    );

    expect(rowCount(html, 'Undo used (keyboard)')).toBe('4');
    expect(rowCount(html, 'Undo used (button)')).toBe('0');
    expect(rowCount(html, 'Reset used (keyboard)')).toBe('0');
    expect(rowCount(html, 'Reset used (button)')).toBe('0');
  });

  it('renders all four rows as zero when there is no data at all', () => {
    const html = renderDashboard(fakeStats(), 30, 'clumeral.com');

    for (const label of [
      'Undo used (keyboard)', 'Undo used (button)',
      'Reset used (keyboard)', 'Reset used (button)',
    ]) {
      expect(rowCount(html, label), label).toBe('0');
    }
  });

  // The four rows are appended to the existing interactions list, so the rows
  // that were already there must still render from the events query.
  it('leaves the existing interaction rows alone', () => {
    const html = renderDashboard(
      fakeStats({
        events: result([
          { event: 'theme_toggle', count: 5 },
          { event: 'tooltip_opened', count: 9 },
        ]),
      }),
      30,
      'clumeral.com',
    );

    expect(rowCount(html, 'Theme toggled')).toBe('5');
    expect(rowCount(html, 'Tooltip opened')).toBe('9');
  });
});
