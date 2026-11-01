// Clumeral — testing-panel.ts
// The Testing panel: one footer button on preview hosts that opens a dialog for
// putting the app into the states Jamie and Dave need to look at — fill or solve
// the puzzle, guess wrong, swap your history, and pick what the Daily leaderboard
// shows (time chart brief item 127). Phones have no console, so this is how the
// dev helpers are reached on a preview.
//
// NOT a feature, and never on clumeral.com: initTestingPanel returns before
// touching the page unless the host is local or a workers.dev preview. The answer
// helpers also depend on /api/dev/answer, which 404s on clumeral.com.
//
// The field choice is kept in sessionStorage so it survives a reload and dies
// with the tab. History choices write dlng_history and dlng_prefs exactly as the
// existing ?demo= switch does, and are meant for preview data only.

import type { HistoryEntry } from './types.ts';
import type { FieldRow } from './time-chart.ts';
import { todayKey } from './date.ts';
import { demoHistory } from './demo-history.ts';
import { setFieldOverride, showTimeChart } from './time-chart-view.ts';

const FIELD_KEY = 'clumeral-testing-field';

/** Local hosts and workers.dev previews only. Stricter than demoAllowed, which
 *  only excludes clumeral.com itself. */
export function testingAllowed(hostname: string): boolean {
  return ['localhost', '127.0.0.1', '[::1]'].includes(hostname) || hostname.endsWith('.workers.dev');
}

export const FIELD_PRESETS = [
  { id: 'real', label: 'Real data' },
  { id: '1', label: 'Only you' },
  { id: '2', label: '2 players' },
  { id: '3', label: '3 players' },
  { id: '12', label: '12 players' },
  { id: '20', label: '20 players' },
  { id: 'tie', label: 'Tied fastest' },
  { id: 'flat', label: 'All the same' },
  { id: 'slowest', label: 'You slowest' },
  { id: 'random', label: 'Random' },
  { id: 'fail', label: 'Fetch fails' },
] as const;
export type FieldPreset = Exclude<(typeof FIELD_PRESETS)[number]['id'], 'real'>;

// Idea-O's twenty-player day, less the board's own 148: three on 1m 09s, two on
// 1m 44s and a 14m 52s straggler.
const BOARD_DAY = [41, 49, 56, 63, 69, 69, 69, 81, 88, 96, 104, 104, 127, 163, 182, 206, 245, 311, 892];

const sec = (t: number) => Math.min(86_400, Math.max(1, Math.round(t)));
const rows = (times: number[]): FieldRow[] => times.map((t) => ({ second: sec(t), count: 1 }));

/** Log-normal around two minutes, which is roughly what play times look like. */
function randomTime(rng: () => number): number {
  const u = Math.max(rng(), 1e-9);
  const v = rng();
  const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  return sec(120 * Math.exp(0.6 * z));
}

/** Strangers' rows for a preset, built around your own time `yours`, or 'fail'
 *  for a fetch that fails. */
export function fieldPreset(name: FieldPreset, yours: number, rng = Math.random): FieldRow[] | 'fail' {
  const y = (k: number) => yours * k;
  switch (name) {
    case '1':
      return [];
    case '2':
      return rows([y(1.6)]);
    case '3':
      return rows([y(0.7), y(1.8)]);
    case '12':
      return rows([0.4, 0.55, 0.7, 0.85, 1.15, 1.3, 1.6, 2, 2.6, 3.4, 5].map(y));
    case '20':
      return rows(BOARD_DAY);
    case 'tie':
      return rows([yours, y(1.5), y(2)]);
    case 'flat':
      return rows([yours, yours, yours, yours]);
    case 'slowest':
      return rows([0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.7, 0.75, 0.8, 0.9].map(y));
    case 'random': {
      const n = 4 + Math.floor(rng() * 56);
      return rows(Array.from({ length: n }, () => randomTime(rng)));
    }
    case 'fail':
      return 'fail';
  }
}

function dayBefore(today: string, back: number): string {
  const d = new Date(today + 'T00:00:00');
  d.setDate(d.getDate() - back);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** 10–60 days back from today, today always solved, most days played. Goes are
 *  weighted towards one, as production is. */
export function randomHistory(today = todayKey(), rng = Math.random): HistoryEntry[] {
  const days = 10 + Math.floor(rng() * 51);
  const goes = [1, 1, 1, 1, 1, 2, 2, 3, 4, 6];
  const out: HistoryEntry[] = [];
  for (let back = 0; back < days; back++) {
    if (back > 0 && rng() < 0.15) continue;
    out.push({
      date: dayBefore(today, back),
      tries: goes[Math.floor(rng() * goes.length)],
      answer: 100 + Math.floor(rng() * 900),
      seconds: randomTime(rng),
    });
  }
  return out;
}

const HISTORIES: { id: string; label: string; go: string; write: () => void }[] = [
  {
    id: 'rich',
    label: 'Rich history',
    go: '/solved',
    write: () => setHistory(demoHistory(), true),
  },
  {
    id: 'random',
    label: 'Random history',
    go: '/solved',
    write: () => setHistory(randomHistory(), true),
  },
  {
    id: 'new',
    label: 'New player',
    go: '/solved',
    write: () =>
      setHistory([
        { date: todayKey(), tries: 2, answer: 123, seconds: 95 },
        { date: dayBefore(todayKey(), 1), tries: 1, answer: 456, seconds: 70 },
      ], true),
  },
  {
    id: 'saving-off',
    label: 'Saving off, solved',
    go: '/solved',
    write: () => setHistory([{ date: todayKey(), tries: 0, marker: true }], false),
  },
  {
    id: 'unsolved',
    label: 'Not solved today',
    go: '/play',
    write: () => setHistory(demoHistory().filter((e) => e.date !== todayKey()), true),
  },
  {
    id: 'clear',
    label: 'Clear everything',
    go: '/welcome',
    write: () => {
      localStorage.removeItem('dlng_history');
      localStorage.removeItem('dlng_active');
    },
  },
];

function setHistory(entries: HistoryEntry[], saveScore: boolean): void {
  localStorage.setItem('dlng_history', JSON.stringify(entries));
  localStorage.setItem('dlng_prefs', JSON.stringify({ saveScore }));
  localStorage.removeItem('dlng_active');
}

const PLAY: { id: string; label: string; run: () => unknown }[] = [
  { id: 'fill', label: 'Fill correct answer', run: () => window._devFillAnswer?.() },
  { id: 'solve', label: 'Solve now', run: () => window._devSolve?.() },
  { id: 'wrong', label: 'Submit wrong answer', run: () => window._devWrongGuess?.() },
];

function readField(): string {
  try {
    return sessionStorage.getItem(FIELD_KEY) ?? 'real';
  } catch {
    return 'real';
  }
}

function buttons(items: readonly { id: string; label: string }[], attr: string): string {
  return items
    .map((b) => `<button type="button" class="btn btn-hollow testing-panel__btn" ${attr}="${b.id}">${b.label}</button>`)
    .join('');
}

export function initTestingPanel(hostname = location.hostname): void {
  if (!testingAllowed(hostname)) return;

  setFieldOverride((yours) => {
    const f = readField();
    return f === 'real' ? null : fieldPreset(f as FieldPreset, yours);
  });

  const footer = document.querySelector('footer');
  if (!footer) return;

  const open = document.createElement('button');
  open.type = 'button';
  open.className = 'testing-panel__open';
  open.dataset.testingOpen = '';
  open.textContent = 'Testing';
  const wrap = document.createElement('p');
  wrap.append(open);
  footer.append(wrap);

  const dialog = document.createElement('dialog');
  dialog.className = 'testing-panel';
  dialog.dataset.testingPanel = '';
  dialog.setAttribute('aria-labelledby', 'testing-panel-title');
  dialog.innerHTML = `<div class="testing-panel__box">
    <div class="testing-panel__top">
      <h2 id="testing-panel-title" class="testing-panel__title">Testing</h2>
      <button type="button" class="btn btn-hollow" data-testing-close>Close</button>
    </div>
    <p class="testing-panel__note">Preview only. Never shown on clumeral.com.</p>
    <h3 class="testing-panel__head">Play</h3>
    <p class="testing-panel__note">On the puzzle screen.</p>
    <div class="testing-panel__grid">${buttons(PLAY, 'data-testing-play')}</div>
    <h3 class="testing-panel__head">Your history</h3>
    <p class="testing-panel__note">Replaces this browser's history and reloads.</p>
    <div class="testing-panel__grid">${buttons(HISTORIES, 'data-testing-history')}</div>
    <h3 class="testing-panel__head">Daily leaderboard</h3>
    <p class="testing-panel__note">Built around your time today. Kept until this tab closes.</p>
    <div class="testing-panel__grid">${buttons(FIELD_PRESETS, 'data-testing-field')}</div>
  </div>`;
  document.body.append(dialog);

  const mark = () => {
    const f = readField();
    for (const b of dialog.querySelectorAll<HTMLElement>('[data-testing-field]')) {
      b.setAttribute('aria-pressed', String(b.dataset.testingField === f));
    }
  };
  const close = () => (typeof dialog.close === 'function' ? dialog.close() : dialog.removeAttribute('open'));

  open.addEventListener('click', () => {
    mark();
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
  });

  dialog.addEventListener('click', (e) => {
    const t = (e.target as HTMLElement).closest<HTMLElement>('button');
    if (!t) return;
    if (t.matches('[data-testing-close]')) close();
    else if (t.dataset.testingPlay) {
      close();
      void PLAY.find((p) => p.id === t.dataset.testingPlay)?.run();
    } else if (t.dataset.testingHistory) {
      const h = HISTORIES.find((x) => x.id === t.dataset.testingHistory)!;
      try {
        h.write();
      } catch {
        return;
      }
      location.assign(h.go);
    } else if (t.dataset.testingField) {
      try {
        sessionStorage.setItem(FIELD_KEY, t.dataset.testingField);
      } catch {
        /* private mode: nothing to remember */
      }
      mark();
      close();
      // Redraw now if the card is on screen; otherwise the next visit picks it up.
      showTimeChart();
    }
  });
}
