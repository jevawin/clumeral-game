import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { renderArchivePage } from '../src/worker/puzzles.ts';

// The goes column is populated by hand-written ES5 inside a template string,
// which has no build step and no test harness. This makes one: render the real
// page, parse it, seed localStorage, then execute the page's OWN inline script
// text against that document. That tests the shipped code rather than a copy.

const PUZZLES = [
  { num: 100, date: '2026-08-10', clues: 5 },
  { num: 99, date: '2026-08-09', clues: 4 },
  { num: 98, date: '2026-08-08', clues: 6 },
];

function renderWithHistory(history: unknown[]) {
  const dom = new JSDOM(renderArchivePage(PUZZLES), {
    url: 'https://clumeral.com/archive',
    runScripts: 'outside-only',
  });
  dom.window.localStorage.setItem('dlng_history', JSON.stringify(history));
  // jsdom has no matchMedia, and the page's theme script reads it. Stubbed
  // rather than skipped, so every script on the page still runs in order.
  (dom.window as unknown as { matchMedia: unknown }).matchMedia = () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  });

  // Run every inline script the page ships, in order — the goes column is one
  // of several and they share a document.
  for (const script of dom.window.document.querySelectorAll('script')) {
    if (script.src) continue;
    dom.window.eval(script.textContent ?? '');
  }
  return dom.window.document;
}

function cell(doc: Document, date: string): HTMLElement {
  return doc.querySelector(`tr.row[data-date="${date}"] [data-tries]`) as HTMLElement;
}

describe('the archive goes column', () => {
  it('shows the number of goes for a normal row', () => {
    const doc = renderWithHistory([{ date: '2026-08-09', tries: 3 }]);
    expect(cell(doc, '2026-08-09').textContent).toBe('3');
  });

  it('shows a dash for a marker row — not a blank and not a 0 (brief 124)', () => {
    const doc = renderWithHistory([{ date: '2026-08-09', tries: 0, marker: true }]);
    expect(cell(doc, '2026-08-09').textContent).toBe('—');
    expect(cell(doc, '2026-08-09').querySelector('a')).toBeNull();
  });

  it('still offers Play on a day with no entry', () => {
    const doc = renderWithHistory([{ date: '2026-08-09', tries: 3 }]);
    const play = cell(doc, '2026-08-08').querySelector('a');
    expect(play).not.toBeNull();
    expect(play!.getAttribute('href')).toBe('/archive/2026-08-08');
  });

  it('handles a 1-go row, which the dash must not be confused with', () => {
    const doc = renderWithHistory([{ date: '2026-08-10', tries: 1 }]);
    expect(cell(doc, '2026-08-10').textContent).toBe('1');
  });

  it('sorts from the row attributes, never from the cell', () => {
    // The dash would sort as text if the sort read the cell. It reads
    // data-num / data-date / data-clues on the row instead.
    const doc = renderWithHistory([{ date: '2026-08-09', tries: 0, marker: true }]);
    const rows = [...doc.querySelectorAll('tr.row')];
    expect(rows.map((r) => r.getAttribute('data-num'))).toEqual(['100', '99', '98']);
    for (const r of rows) {
      expect(r.getAttribute('data-date')).toBeTruthy();
      expect(r.getAttribute('data-clues')).toBeTruthy();
    }
  });
});
