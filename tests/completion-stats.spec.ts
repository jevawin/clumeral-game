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

/** The text of one block, whitespace-collapsed the way `text()` does it. */
function blockText(id: string): string {
  return (block(id)?.textContent ?? '').replace(/\s+/g, ' ').trim();
}

/** One box pair, found by the full words a screen reader hears (brief 78). */
function pair(fullLabel: string): {
  value: string; short: string; isBest: boolean; flame: Element | null;
} | null {
  for (const el of panel().querySelectorAll('.stat-box__pair')) {
    if (el.querySelector('.sr-only')?.textContent?.trim() !== fullLabel) continue;
    const value = el.querySelector('.stat-box__value')!;
    return {
      value: value.textContent!.trim(),
      short: el.querySelector('.stat-box__label')!.textContent!.trim(),
      isBest: value.classList.contains('stat-box__value--best'),
      flame: value.querySelector('.stat-flame'),
    };
  }
  return null;
}

/** The box titles inside one block, in order. */
function boxTitles(id: string): string[] {
  return [...block(id)!.querySelectorAll('.stat-box__title')].map((el) => el.textContent!.trim());
}

/** The visible values of the Today block's figures, in order. */
function figures(): string[] {
  return [...panel().querySelectorAll('.stat-figure__value')].map((el) => el.textContent!.trim());
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
    expect(block('best')).not.toBeNull();
    expect(block('all-time')).not.toBeNull();
    // The Average block is gone; its two figures are All-time rows again.
    expect(block('average')).toBeNull();

    expect(figures()).toEqual(['2 goes', '3m 41s']);

    expect(pair('Current play streak')!.value).toBe('5');
    expect(pair('Current 1-go streak')!.value).toBe('0');
    expect(stat('Plays')).toBe('5');
    expect(stat('First-go wins')).toBe('1 (20%)');
    expect(stat('Average goes')).toBe('2.4');
    expect(stat('Average time')).toBe('4m 06s'); // (221+48+300+260+400)/5 = 245.8s
    expect(pair('Fastest time')!.value).toBe('0m 48s');
  });

  it('shows only This game for a brand-new player, with the third-game line', async () => {
    await render([{ date: day(0), tries: 2, seconds: 100 }], 2, false, { seconds: 100 });
    expect(block('this-game')).not.toBeNull();
    expect(block('best')).toBeNull();
    expect(block('all-time')).toBeNull();
    expect(text()).toContain('Your streaks and all-time stats start from your third game.');
  });

  it('still hides the other blocks on the second game', async () => {
    await render([
      { date: day(0), tries: 2 },
      { date: day(1), tries: 3 },
    ], 2);
    expect(block('best')).toBeNull();
    expect(block('all-time')).toBeNull();
  });

  it('reveals the other blocks on the third game', async () => {
    await render([
      { date: day(0), tries: 2 },
      { date: day(1), tries: 3 },
      { date: day(2), tries: 3 },
    ], 2);
    expect(block('best')).not.toBeNull();
    expect(block('all-time')).not.toBeNull();
  });

  it('treats a player who has just switched saving on as a new player (brief 131)', async () => {
    await render([{ date: day(0), tries: 2 }], 2);
    expect(text()).toContain('Your streaks and all-time stats start from your third game.');
  });

  it('shows only This game when score saving is off', async () => {
    await render(RETURNING, 2, false, { seconds: 221 }, { saveScore: false });
    expect(block('this-game')).not.toBeNull();
    expect(block('best')).toBeNull();
    expect(block('all-time')).toBeNull();
    expect(figures()).toEqual(['2 goes', '3m 41s']);
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
    expect(block('best')).toBeNull();
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
    expect(block('best')).toBeNull();
    expect(block('all-time')).toBeNull();
    // No stopwatch figure at all, not an empty one — an archive replay carries
    // no timing (brief 54, and brief 36 for the shape).
    expect(figures()).toEqual(['3 goes']);
    expect(blockText('this-game')).not.toContain('3m 20s');
  });

  it('heads the first block "Today", not "This game" (brief 66)', async () => {
    await render(RETURNING, 2, false, { seconds: 221 });
    expect(block('this-game')!.querySelector('h3')!.textContent).toBe('Today');
    expect(text()).not.toContain('This game');
  });

  it('has no "Solved in" sentence anywhere on the panel (brief 38)', async () => {
    // The sentence lives on the /play screen now and only there. The two screens
    // diverged on purpose (brief 39).
    await render(RETURNING, 2, false, { seconds: 221 });
    expect(text()).not.toContain('Solved in');
  });

  it('gives each figure a word only a screen reader hears (brief 47)', async () => {
    await render(RETURNING, 2, false, { seconds: 221 });
    expect(blockText('this-game')).toContain('Goes, 2 goes');
    expect(blockText('this-game')).toContain('Time, 3m 41s');
  });

  it('hides both Today icons from the accessibility tree (brief 49)', async () => {
    await render(RETURNING, 2, false, { seconds: 221 });
    const icons = block('this-game')!.querySelectorAll('svg');
    expect(icons.length).toBe(2);
    for (const icon of icons) expect(icon.getAttribute('aria-hidden')).toBe('true');
  });

  it('keeps the random line and the new-player line under the figures (brief 76)', async () => {
    await render(RETURNING, 2, true, { seconds: 221 });
    const kids = [...block('this-game')!.children].map((el) => el.className);
    // head, figures, then the note — the note is inside the block and last.
    expect(kids[1]).toBe('stat-today');
    expect(blockText('this-game')).toContain("Random puzzles don't count towards your stats.");
  });

  it('shows three Best boxes: your record over where you are now', async () => {
    await render(RETURNING, 2, false, { seconds: 221 });
    expect(block('best')!.querySelector('h3')!.textContent).toBe('Best');
    expect(boxTitles('best')).toEqual(['Time', '1-go', 'Plays']);
    // Every box title is an h4 under the block's h3 (brief 52).
    for (const t of block('best')!.querySelectorAll('.stat-box__title')) {
      expect(t.tagName).toBe('H4');
    }
    expect(pair('Fastest time')!.value).toBe('0m 48s');
    expect(pair('Current time')!.value).toBe('3m 41s');
    expect(pair('Longest 1-go streak')!.value).toBe('1');
    expect(pair('Current 1-go streak')!.value).toBe('0');
    expect(pair('Longest play streak')!.value).toBe('5');
    expect(pair('Current play streak')!.value).toBe('5');
  });

  it('says the short word on screen and the full one in speech (brief 78, 25)', async () => {
    await render(RETURNING, 2, false, { seconds: 221 });
    // Not prefixes of each other: "Streak" alone would announce two figures both
    // called "streak", and speech gets neither the flame nor the position.
    expect(text()).not.toContain('Best time');
    expect(pair('Fastest time')!.short).toBe('Fastest');
    expect(pair('Longest 1-go streak')!.short).toBe('Streak');
    expect(pair('Current 1-go streak')!.short).toBe('Current');
    // The visible label is never the whole label — the words a screen reader
    // hears are always the full ones.
    expect(pair('Current play streak')!.short).toBe('Current');
  });

  it('colours only the Best figures with the second accent (brief 81)', async () => {
    await render(RETURNING, 2, false, { seconds: 221 });
    for (const label of ['Fastest time', 'Longest 1-go streak', 'Longest play streak']) {
      expect(pair(label)!.isBest, label).toBe(true);
    }
    for (const label of ['Current time', 'Current 1-go streak', 'Current play streak']) {
      expect(pair(label)!.isBest, label).toBe(false);
    }
  });

  it('keeps every dt inside a dl, with dd after it', async () => {
    // A dt with no dl ancestor is not a description list at all: it breaks the
    // pairing and trips axe at serious level. The visual reversal is CSS only.
    await render(RETURNING, 2, false, { seconds: 221 });
    for (const dt of panel().querySelectorAll('dt')) {
      expect(dt.closest('dl'), dt.textContent!).not.toBeNull();
    }
    for (const el of panel().querySelectorAll('.stat-box__pair')) {
      expect([...el.children].map((c) => c.tagName)).toEqual(['DT', 'DD']);
    }
  });

  it('puts a flame on each record and on nothing else (brief 10, 18)', async () => {
    await render(RETURNING, 2, false, { seconds: 221 });
    for (const label of ['Fastest time', 'Longest 1-go streak', 'Longest play streak']) {
      expect(pair(label)!.flame, label).not.toBeNull();
      // aria-hidden, and inside the dd — so it never lands in the spoken label.
      expect(pair(label)!.flame!.getAttribute('aria-hidden')).toBe('true');
    }
    for (const label of ['Current time', 'Current 1-go streak', 'Current play streak']) {
      expect(pair(label)!.flame, label).toBeNull();
    }
    // Three flames on the whole panel, nowhere else.
    expect(panel().querySelectorAll('.stat-flame').length).toBe(3);
  });

  it('puts no flame beside a dash — a badge for an achievement nobody has', async () => {
    // Reachable on a full panel: three countable games, none of them timed.
    await render([
      { date: day(0), tries: 2 },
      { date: day(1), tries: 3 },
      { date: day(2), tries: 3 },
    ], 2);
    expect(pair('Fastest time')!.value).toBe('—');
    expect(pair('Fastest time')!.flame).toBeNull();
    // The two streaks are always numbers, so they keep theirs.
    expect(pair('Longest play streak')!.flame).not.toBeNull();
  });

  it('shows a dash for Current time when this game has no valid time', async () => {
    // A dash, matching the all-time rows, rather than the figure vanishing and
    // leaving a lopsided box (brief 83 low-16).
    await render(RETURNING, 2, false, {});
    expect(pair('Current time')!.value).toBe('—');
  });

  it('shows the same number three times on a personal-best day', async () => {
    // History is read AFTER today's row is written, so today's game is inside
    // the best. Beat your record and it reads once under the stopwatch in Today
    // and twice in the Time box. Deliberate, and pinned here so it is a decision
    // rather than a discovery on the preview (brief 71, 73).
    const history: HistoryEntry[] = [
      { date: day(0), tries: 2, seconds: 80 },
      { date: day(1), tries: 1, seconds: 300 },
      { date: day(2), tries: 3, seconds: 400 },
    ];
    await render(history, 2, false, { seconds: 80 });
    expect(figures()).toEqual(['2 goes', '1m 20s']);
    expect(pair('Fastest time')!.value).toBe('1m 20s');
    expect(pair('Current time')!.value).toBe('1m 20s');
  });

  it('puts the two averages back into All time, in order (brief 12, 20)', async () => {
    await render(RETURNING, 2, false, { seconds: 221 });
    const labels = [...block('all-time')!.querySelectorAll('.stat-row dt')]
      .map((el) => el.textContent!.trim());
    expect(labels).toEqual(['Plays', 'First-go wins', 'Average goes', 'Average time']);
    // The chart still comes last.
    expect(block('all-time')!.querySelector('.goes-chart')).not.toBeNull();
  });

  it('gives the returning rows their explanatory lines back (brief 23)', async () => {
    await render(RETURNING, 2, false, { seconds: 221 });
    expect(blockText('all-time')).toContain('Your average number of guesses.');
    expect(blockText('all-time')).toContain('How long you usually take.');
  });

  it('does not bring the fastest first-go win back with them (brief 14)', async () => {
    await render(RETURNING, 2, false, { seconds: 221 });
    expect(text()).not.toContain('Fastest first-go win');
    expect(text()).not.toContain('Your quickest win on a first guess.');
  });

  it('shows a dash for an average nobody has data for', async () => {
    await render([
      { date: day(0), tries: 2 },
      { date: day(1), tries: 3 },
      { date: day(2), tries: 3 },
    ], 2);
    expect(stat('Average time')).toBe('—');
  });

  it('puts no explanatory line inside a box or under the row (brief 45)', async () => {
    await render(RETURNING, 2, false, { seconds: 221 });
    expect(block('best')!.querySelector('.stat-note')).toBeNull();
    expect(text()).not.toContain('Miss a day and the streak starts again.');
    expect(text()).not.toContain('Days in a row you have finished the puzzle.');
    expect(text()).not.toContain('Days in a row you got it on your first guess.');
  });

  it('reads "Solved!" and never "Solved in 0" when the goes are unknowable', async () => {
    // The reload after a saving-off solve: today's row is a marker, so neither
    // the goes nor the time were ever stored.
    await render([{ date: day(0), tries: 0, marker: true }], null, false, {}, { saveScore: false });
    expect(text()).toContain('Solved!');
    expect(text()).not.toContain('Solved in');
    expect(text()).not.toContain('0:00');
    // The plain word and nothing else — no figures, empty or otherwise (brief 76).
    expect(figures()).toEqual([]);
  });

  it('puts an explanatory line under every all-time stat (brief 135)', async () => {
    await render(RETURNING, 2, false, { seconds: 221 });
    const t = text();
    for (const line of [
      'Daily puzzles you have finished.',
      'Puzzles you got on your first guess.',
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

  it('drops the stopwatch figure entirely when this game has no valid time', async () => {
    // An empty figure with a dash in it is worse than no figure: it reads as a
    // stat you have failed at rather than one that was never taken (brief 36).
    await render(RETURNING, 2, false, {});
    expect(figures()).toEqual(['2 goes']);
    expect(blockText('this-game')).not.toContain('—');
    expect(blockText('this-game')).not.toContain('0m 00s');
  });

  it('says "1 go", not "1 goes"', async () => {
    await render(RETURNING, 1, false, { seconds: 30 });
    expect(figures()).toEqual(['1 go', '0m 30s']);
  });

  it('shows a long game its own time and counts it in the averages', async () => {
    const history: HistoryEntry[] = [
      { date: day(0), tries: 1, seconds: 3900 },
      { date: day(1), tries: 1, seconds: 60 },
      { date: day(2), tries: 1, seconds: 120 },
    ];
    await render(history, 1, false, { seconds: 3900 });
    expect(figures()).toEqual(['1 go', '1h 05m']);
    expect(stat('Average time')).toBe('22m 40s');
    expect(pair('Fastest time')!.value).toBe('1m 00s');
  });

  it('shows a dash for a figure nobody has data for', async () => {
    await render([
      { date: day(0), tries: 2 },
      { date: day(1), tries: 3 },
      { date: day(2), tries: 3 },
    ], 2);
    // A dash is right HERE — a box needs a placeholder rather than a gap.
    expect(stat('Average time')).toBe('—');
    expect(pair('Fastest time')!.value).toBe('—');
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

// Both builders reach innerHTML, and `tries` comes from dlng_history, which
// loadHistory does not validate — unlike loadActive and loadUndo next door.
//
// heroLine is the /play screen's sentence now, not the panel's (brief 39). Its
// assertions below are no longer about the completion screen at all: they are
// the guard that the play screen's result line did not move when the panel's
// hero was replaced by figures.
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

  it('renders "Solved!" from the panel builder too, with no figures', async () => {
    const mod = await import('../src/completion.ts');
    for (const bad of ['<img src=x onerror=alert(1)>', '2<script>x</script>', 0, -1, 2.5, NaN]) {
      expect(mod.todayFigures(bad as unknown as number, 30, true), String(bad))
        .toBe('<p class="stat-hero">Solved!</p>');
    }
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

  it('reads in the body font, with no Inconsolata left on the panel', () => {
    // Deleted rather than overridden, so the rules inherit Quicksand from
    // html/body. Swept across the whole panel section rather than listing the
    // seven rules, so a rule added later is covered too. The play screen keeps
    // Inconsolata — its keypad needs every key the same width (brief 21).
    // The slice runs to .digit-box, which is the first rule AFTER the panel —
    // ending it at .goes-row__fill would leave .goes-row__count unswept.
    const start = css.indexOf('[data-completion-panel] {');
    const panel = css.slice(start, css.indexOf('.digit-box {'));
    expect(panel).toContain('.goes-row__count');
    expect(panel).not.toContain('Inconsolata');
  });

  it('leaves no box around the records, in either file (brief 13, 42)', () => {
    // Both halves matter. The rule is deleted outright, so an "declares no
    // background" check inside its body would pass trivially — hence asserting
    // the exact selector is absent. And the offset shadow was never in this
    // file at all: it was the shadow-box utility in the markup, which a
    // stylesheet-only guard would miss entirely.
    expect(css).not.toMatch(/(^|[};])\s*\.stat-box\s*\{/m);
    for (const rule of css.matchAll(/\.stat-box[\w-]*\s*\{([^}]*)\}/g)) {
      // Shorthands too — background: and border-width: would otherwise slip past.
      expect(rule[1]).not.toMatch(/background|border|box-shadow/);
    }
    const completion = readFileSync(resolve(__dirname, '../src/completion.ts'), 'utf8');
    expect(completion).not.toMatch(/class="stat-box[^"]*shadow-box/);
  });

  it('uses the theme token, never a literal colour', () => {
    // A hex here would be one mode's colour hardcoded into both.
    const block = css.match(/\[data-completion-panel\]\s*\{[^}]*\}/)![0];
    expect(block).not.toMatch(/#[0-9a-f]{3,8}/i);
  });
});
