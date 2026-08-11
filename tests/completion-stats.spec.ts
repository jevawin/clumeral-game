import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { HistoryEntry } from '../src/types.ts';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// The four stat boxes are gone, so this file is rewritten rather than patched.
// It renders the real panel and reads it the way a player meets it — by heading
// and by label — instead of by box index.

function setupDOM(): void {
  document.body.innerHTML = `
    <div data-completion-octo></div>
    <h2 data-completion-heading></h2>
    <p data-completion-subheading></p>
    <div data-completion-panel></div>
    <p data-completion-live></p>
    <p data-completion-countdown></p>
    <button data-completion-feedback></button>
    <div data-completion-links></div>
  `;
}

const TODAY = '2026-08-10';

function day(back: number): string {
  const d = new Date(TODAY + 'T00:00:00');
  d.setDate(d.getDate() - back);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function panel(): HTMLElement {
  return document.querySelector('[data-completion-panel]') as HTMLElement;
}

function block(id: string): HTMLElement | null {
  return panel().querySelector(`[data-stat-block="${id}"]`);
}

/** The value shown for a labelled stat, anywhere on the panel. */
function stat(label: string): string | null {
  for (const row of panel().querySelectorAll('dt')) {
    if (row.textContent?.trim() === label) {
      return (row.parentElement?.querySelector('dd')?.textContent ?? '').trim();
    }
  }
  return null;
}

function text(): string {
  return panel().textContent!.replace(/\s+/g, ' ').trim();
}

function live(): string {
  return (document.querySelector('[data-completion-live]') as HTMLElement).textContent ?? '';
}

/** Renders, then fires the screens:enter the real transition fires. */
async function render(
  history: HistoryEntry[],
  tries: number | null,
  isRandom = false,
  opts: Record<string, unknown> = {},
  prefs: { saveScore: boolean } = { saveScore: true },
) {
  localStorage.setItem('dlng_history', JSON.stringify(history));
  localStorage.setItem('dlng_prefs', JSON.stringify(prefs));
  const mod = await import('../src/completion.ts');
  mod.renderCompletion(157, tries, isRandom, opts);
  document.dispatchEvent(new CustomEvent('screens:enter', { detail: { screen: 'completion' } }));
  return mod;
}

// Five countable games, so the reveal gate is open. Today, then four before it.
const RETURNING: HistoryEntry[] = [
  { date: day(0), tries: 2, seconds: 221 },
  { date: day(1), tries: 1, seconds: 48 },
  { date: day(2), tries: 3, seconds: 300 },
  { date: day(3), tries: 2, seconds: 260 },
  { date: day(4), tries: 4, seconds: 400 },
];

describe('the completion panel', () => {
  beforeEach(() => {
    setupDOM();
    vi.resetModules();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(TODAY + 'T10:00:00'));
  });

  afterEach(() => { vi.useRealTimers(); });

  it('renders all three blocks for a returning player', async () => {
    await render(RETURNING, 2, false, { seconds: 221 });

    expect(block('this-game')).not.toBeNull();
    expect(block('streaks')).not.toBeNull();
    expect(block('all-time')).not.toBeNull();

    expect(block('this-game')!.textContent).toContain('Solved in 2 goes, 3m 41s');

    expect(stat('Play streak')).toBe('5');
    expect(stat('First-go streak')).toBe('0');
    expect(stat('Plays')).toBe('5');
    expect(stat('First-go wins')).toBe('1 (20%)');
    expect(stat('Average goes')).toBe('2.4');
    expect(stat('Average time')).toBe('4m 06s'); // (221+48+300+260+400)/5 = 245.8s
    expect(stat('Fastest first-go win')).toBe('0m 48s');
  });

  it('shows only This game for a brand-new player, with the third-game line', async () => {
    await render([{ date: day(0), tries: 2, seconds: 100 }], 2, false, { seconds: 100 });
    expect(block('this-game')).not.toBeNull();
    expect(block('streaks')).toBeNull();
    expect(block('all-time')).toBeNull();
    expect(text()).toContain('Your streaks and all-time stats start from your third game.');
  });

  it('still hides the other blocks on the second game', async () => {
    await render([
      { date: day(0), tries: 2 },
      { date: day(1), tries: 3 },
    ], 2);
    expect(block('streaks')).toBeNull();
    expect(block('all-time')).toBeNull();
  });

  it('reveals the other blocks on the third game', async () => {
    await render([
      { date: day(0), tries: 2 },
      { date: day(1), tries: 3 },
      { date: day(2), tries: 3 },
    ], 2);
    expect(block('streaks')).not.toBeNull();
    expect(block('all-time')).not.toBeNull();
  });

  it('treats a player who has just switched saving on as a new player (brief 131)', async () => {
    await render([{ date: day(0), tries: 2 }], 2);
    expect(text()).toContain('Your streaks and all-time stats start from your third game.');
  });

  it('shows only This game when score saving is off', async () => {
    await render(RETURNING, 2, false, { seconds: 221 }, { saveScore: false });
    expect(block('this-game')).not.toBeNull();
    expect(block('streaks')).toBeNull();
    expect(block('all-time')).toBeNull();
    expect(text()).toContain('Solved in 2');
  });

  it('says nothing at all about score saving, in any mode (P-01)', async () => {
    // Brief 53, 65 and 90 all asked for something here; P-01 removed all three
    // and deferred the opt-out to the menu ticket. The brief is what a builder
    // reads first, so this is pinned explicitly.
    await render(RETURNING, 2, false, { seconds: 221 }, { saveScore: false });
    expect(text().toLowerCase()).not.toContain('saving');
    expect(text().toLowerCase()).not.toContain('save my scores');
    expect(panel().querySelector('input[type="checkbox"]')).toBeNull();
  });

  it('shows This game and the random line after a random puzzle', async () => {
    await render(RETURNING, 2, true, { seconds: 221 });
    expect(block('this-game')).not.toBeNull();
    expect(block('streaks')).toBeNull();
    expect(block('all-time')).toBeNull();
    expect(text()).toContain("Random puzzles don't count towards your stats.");
  });

  it('keeps the minimal panel for an archive replay', async () => {
    await render(RETURNING, 3, false, {
      activeDate: '2026-07-01',
      todayLocal: TODAY,
      seconds: 200,
    });
    expect(block('this-game')).not.toBeNull();
    expect(block('streaks')).toBeNull();
    expect(block('all-time')).toBeNull();
    expect(text()).toContain('Solved in 3 goes');
    expect(text()).not.toContain('3:20'); // no timing on an archive replay (brief 54)
  });

  it('reads "Solved!" and never "Solved in 0" when the goes are unknowable', async () => {
    // The reload after a saving-off solve: today's row is a marker, so neither
    // the goes nor the time were ever stored.
    await render([{ date: day(0), tries: 0, marker: true }], null, false, {}, { saveScore: false });
    expect(text()).toContain('Solved!');
    expect(text()).not.toContain('Solved in');
    expect(text()).not.toContain('0:00');
  });

  it('puts an explanatory line under every stat (brief 135)', async () => {
    await render(RETURNING, 2, false, { seconds: 221 });
    const t = text();
    for (const line of [
      'Days in a row you have finished the puzzle.',
      'Days in a row you got it on your first guess.',
      'Miss a day and the streak starts again.',
      'Daily puzzles you have finished.',
      'Puzzles you got on your first guess.',
      'Your average number of guesses.',
      'How long you usually take.',
      'Your quickest win on a first guess.',
    ]) {
      expect(t, line).toContain(line);
    }
  });

  it('renders the goes chart as six rows with counts as text', async () => {
    await render(RETURNING, 2, false, { seconds: 221 });
    const rows = panel().querySelectorAll('[data-goes-row]');
    expect(rows.length).toBe(6);
    expect([...rows].map((r) => r.querySelector('[data-goes-label]')!.textContent))
      .toEqual(['1', '2', '3', '4', '5', '6+']);
    expect([...rows].map((r) => r.querySelector('[data-goes-count]')!.textContent))
      .toEqual(['1', '2', '1', '1', '0', '0']);
    expect(text()).toContain('How many goes you take');
  });

  it('drops the time clause entirely when this game has no valid time', async () => {
    // A dash is right in a column of figures and wrong in the middle of a
    // sentence, so the hero says the goes and stops.
    await render(RETURNING, 2, false, {});
    expect(block('this-game')!.textContent).toContain('Solved in 2 goes');
    expect(block('this-game')!.textContent).not.toContain('—');
    expect(block('this-game')!.textContent).not.toContain('0m 00s');
  });

  it('says "1 go", not "1 goes"', async () => {
    await render(RETURNING, 1, false, { seconds: 30 });
    expect(block('this-game')!.textContent).toContain('Solved in 1 go, 0m 30s');
  });

  it('shows a long game its own time while leaving it out of the averages', async () => {
    const history: HistoryEntry[] = [
      { date: day(0), tries: 1, seconds: 3900 },
      { date: day(1), tries: 1, seconds: 60 },
      { date: day(2), tries: 1, seconds: 120 },
    ];
    await render(history, 1, false, { seconds: 3900 });
    expect(block('this-game')!.textContent).toContain('1h 05m');
    expect(stat('Average time')).toBe('1m 30s');
    expect(stat('Fastest first-go win')).toBe('1m 00s');
  });

  it('shows a dash for an average nobody has data for', async () => {
    await render([
      { date: day(0), tries: 2 },
      { date: day(1), tries: 3 },
      { date: day(2), tries: 3 },
    ], 2);
    // A dash is right HERE — a column of figures needs a placeholder.
    expect(stat('Average time')).toBe('—');
    expect(stat('Fastest first-go win')).toBe('—');
  });
});

describe('the announcement (brief 139)', () => {
  beforeEach(() => {
    setupDOM();
    vi.resetModules();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(TODAY + 'T10:00:00'));
  });

  afterEach(() => { vi.useRealTimers(); });

  it('reads the goes, the time and the play streak, and nothing else', async () => {
    await render([
      ...RETURNING.slice(0, 1),
      ...RETURNING.slice(1),
    ], 2, false, { seconds: 221 });
    expect(live()).toBe('Solved in 2. 3 minutes 41 seconds. Play streak 5.');
  });

  it('leaves the time out when it is unknown', async () => {
    await render(RETURNING, 2, false, {});
    expect(live()).toBe('Solved in 2. Play streak 5.');
  });

  it('leaves the play streak out for a new player', async () => {
    await render([{ date: day(0), tries: 2, seconds: 48 }], 2, false, { seconds: 48 });
    expect(live()).toBe('Solved in 2. 48 seconds.');
  });

  it('leaves the play streak out when saving is off', async () => {
    await render(RETURNING, 2, false, { seconds: 221 }, { saveScore: false });
    expect(live()).toBe('Solved in 2. 3 minutes 41 seconds.');
  });

  it('is not written a second time when the same solve re-renders', async () => {
    const mod = await render(RETURNING, 2, false, { seconds: 221 });
    expect(live()).toBe('Solved in 2. 3 minutes 41 seconds. Play streak 5.');

    (document.querySelector('[data-completion-live]') as HTMLElement).textContent = '';
    mod.renderCompletion(157, 2, false, { seconds: 221 });
    document.dispatchEvent(new CustomEvent('screens:enter', { detail: { screen: 'completion' } }));
    expect(live()).toBe('');
  });

  it('announces again once a new puzzle has started', async () => {
    const mod = await render(RETURNING, 2, false, { seconds: 221 });
    (document.querySelector('[data-completion-live]') as HTMLElement).textContent = '';
    mod.resetCompletionAnnouncement();
    mod.renderCompletion(158, 1, false, { seconds: 60 });
    document.dispatchEvent(new CustomEvent('screens:enter', { detail: { screen: 'completion' } }));
    expect(live()).toBe('Solved in 1. 1 minute. Play streak 5.');
  });

  it('is not written while the completion screen is still hidden', async () => {
    localStorage.setItem('dlng_history', JSON.stringify(RETURNING));
    const mod = await import('../src/completion.ts');
    mod.renderCompletion(157, 2, false, { seconds: 221 });
    // A live region inside an aria-hidden subtree is not spoken, so the text is
    // held until the transition says the screen is visible.
    expect(live()).toBe('');
  });
});

// heroLine reaches innerHTML, and `tries` comes from dlng_history, which
// loadHistory does not validate — unlike loadActive and loadUndo next door.
describe('a forged history row cannot inject markup', () => {
  beforeEach(() => {
    setupDOM();
    vi.resetModules();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(TODAY + 'T10:00:00'));
  });

  afterEach(() => { vi.useRealTimers(); });

  it('renders "Solved!" rather than whatever was in the row', async () => {
    const mod = await import('../src/completion.ts');
    for (const bad of ['<img src=x onerror=alert(1)>', '2<script>x</script>', 0, -1, 2.5, NaN]) {
      expect(mod.heroLine(bad as unknown as number, 30, true), String(bad)).toBe('Solved!');
    }
  });

  it('leaves a real count of goes alone', async () => {
    const mod = await import('../src/completion.ts');
    expect(mod.heroLine(1, 30, true)).toBe('Solved in 1 go, 0m 30s');
    expect(mod.heroLine(4, null, true)).toBe('Solved in 4 goes');
  });

  it('puts no markup in the panel when the stored row is forged', async () => {
    await render(
      [{ date: day(0), tries: '<img src=x onerror=alert(1)>' as unknown as number }],
      '<img src=x onerror=alert(1)>' as unknown as number,
    );
    expect(panel().querySelector('img')).toBeNull();
    expect(text()).toContain('Solved!');
  });
});

// The dark-mode bug this guards: seven elements on the panel were coloured
// individually and the eighth — the streak block's <dt> — was missed, so it fell
// through to the browser's default black and vanished on the dark background.
// The fix is to colour the CONTAINER once so everything inherits, which is what
// makes the whole class of miss impossible rather than fixing the one instance.
describe('the panel colours itself once, at the top', () => {
  const css = readFileSync(resolve(__dirname, '../src/tailwind.css'), 'utf8');

  it('sets a text colour on the panel container', () => {
    expect(css).toMatch(/\[data-completion-panel\]\s*\{[^}]*color:\s*var\(--color-text\)/);
  });

  it('uses the theme token, never a literal colour', () => {
    // A hex here would be one mode's colour hardcoded into both.
    const block = css.match(/\[data-completion-panel\]\s*\{[^}]*\}/)![0];
    expect(block).not.toMatch(/#[0-9a-f]{3,8}/i);
  });
});
