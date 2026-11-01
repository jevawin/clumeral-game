// The preview-only Testing panel (time chart brief item 127): its host gate, the
// leaderboard field presets and the random history. Never on clumeral.com.
import { describe, it, expect, beforeEach } from 'vitest';
import {
  FIELD_PRESETS,
  fieldPreset,
  initTestingPanel,
  randomHistory,
  testingAllowed,
  type FieldPreset,
} from '../src/testing-panel.ts';
import { buildField, rankCopy, ranking, type FieldRow } from '../src/time-chart.ts';

const copyFor = (rows: FieldRow[], yours: number) => {
  const c = rankCopy(ranking(buildField(rows, yours)));
  return c.pre + c.bold + c.post;
};

describe('testingAllowed', () => {
  it('allows local and workers.dev preview hosts', () => {
    for (const h of ['localhost', '127.0.0.1', '[::1]', 'dev-x-clumeral-game.jevawin.workers.dev']) {
      expect(testingAllowed(h), h).toBe(true);
    }
  });

  it('refuses production and anything else', () => {
    for (const h of ['clumeral.com', 'www.clumeral.com', 'evilworkers.dev', 'workers.dev.example.com']) {
      expect(testingAllowed(h), h).toBe(false);
    }
  });
});

describe('field presets', () => {
  const rowsOf = (name: FieldPreset, yours: number) => {
    const rows = fieldPreset(name, yours);
    if (rows === 'fail') throw new Error('unexpected fail');
    return rows;
  };

  it.each([
    ['1', "You're the first to solve today"],
    ['2', "You're the fastest today"],
    ['3', "You're the 2nd fastest"],
    ['12', "You're in the top 42% of solve times"],
    ['tie', "You're the joint fastest today"],
    ['flat', "You're the joint fastest today"],
    ['slowest', '12 players solved today'],
  ] as const)('%s reads "%s"', (name, line) => {
    for (const yours of [41, 148, 900]) expect(copyFor(rowsOf(name, yours), yours), String(yours)).toBe(line);
  });

  it.each([50, 100, 200, 500])('%s is a busy day of that many players, the same every time', (n) => {
    const id = String(n) as FieldPreset;
    const a = rowsOf(id, 148);
    expect(buildField(a, 148).n).toBe(n);
    expect(rowsOf(id, 148)).toEqual(a);
    for (const r of a) expect(r.second >= 1 && r.second <= 86400).toBe(true);
  });

  it('20 is a twenty-player day', () => {
    expect(buildField(rowsOf('20', 148), 148).n).toBe(20);
  });

  it('random gives a field of 5 to 60 players, you included, in valid rows', () => {
    for (let k = 0; k < 50; k++) {
      const rows = rowsOf('random', 120);
      const n = rows.reduce((s, r) => s + r.count, 0) + 1;
      expect(n).toBeGreaterThanOrEqual(5);
      expect(n).toBeLessThanOrEqual(60);
      for (const r of rows) {
        expect(Number.isInteger(r.second) && r.second >= 1 && r.second <= 86400).toBe(true);
        expect(Number.isInteger(r.count) && r.count >= 1).toBe(true);
      }
    }
  });

  it('fail stands for a failed fetch', () => {
    expect(fieldPreset('fail', 41)).toBe('fail');
  });

  it('every listed preset resolves', () => {
    for (const p of FIELD_PRESETS) expect(() => fieldPreset(p.id, 41)).not.toThrow();
  });
});

describe('randomHistory', () => {
  it('always solves today, with unique dates and valid times', () => {
    for (let k = 0; k < 20; k++) {
      const h = randomHistory('2026-11-01');
      expect(h[0].date).toBe('2026-11-01');
      expect(new Set(h.map((e) => e.date)).size).toBe(h.length);
      for (const e of h) {
        expect(e.tries).toBeGreaterThanOrEqual(1);
        expect(e.seconds! >= 1 && e.seconds! <= 86400).toBe(true);
      }
    }
  });
});

describe('initTestingPanel', () => {
  beforeEach(() => {
    document.body.innerHTML = '<footer>Made by Jamie &amp; Dave.</footer>';
    sessionStorage.clear();
  });

  it('adds nothing on clumeral.com', () => {
    initTestingPanel('clumeral.com');
    expect(document.querySelector('[data-testing-open]')).toBeNull();
    expect(document.querySelector('[data-testing-panel]')).toBeNull();
  });

  it('adds a Testing button to the footer on a preview host', () => {
    initTestingPanel('localhost');
    const open = document.querySelector<HTMLButtonElement>('footer [data-testing-open]');
    expect(open?.textContent).toBe('Testing');
    expect(open?.type).toBe('button');
  });

  it('remembers the chosen field for the session', () => {
    initTestingPanel('localhost');
    document.querySelector<HTMLButtonElement>('[data-testing-open]')!.click();
    document.querySelector<HTMLButtonElement>('[data-testing-field="tie"]')!.click();
    expect(sessionStorage.getItem('clumeral-testing-field')).toBe('tie');
    expect(document.querySelector('[data-testing-field="tie"]')!.getAttribute('aria-pressed')).toBe('true');
    expect(document.querySelector('[data-testing-field="real"]')!.getAttribute('aria-pressed')).toBe('false');
  });
});
