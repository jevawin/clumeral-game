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

/** One column, found by the full words a screen reader hears (brief 67). */
function col(fullLabel: string): {
  value: string; short: string; isBest: boolean;
} | null {
  for (const el of panel().querySelectorAll('.stat-col')) {
    if (el.querySelector('.sr-only')?.textContent?.trim() !== fullLabel) continue;
    const value = el.querySelector('.stat-col__value')!;
    return {
      value: value.textContent!.trim(),
      short: el.querySelector('.stat-col__label')!.textContent!.trim(),
      isBest: value.classList.contains('stat-col__value--best'),
    };
  }
  return null;
}

/** The visible column labels inside one block, in order. */
function colLabels(id: string): string[] {
  return [...block(id)!.querySelectorAll('.stat-col__label')].map((el) => el.textContent!.trim());
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
    expect(block('streak')).not.toBeNull();
    expect(block('records')).not.toBeNull();
    expect(block('all-time')).not.toBeNull();
    expect(block('average')).toBeNull();

    expect(figures()).toEqual(['2 goes', '3m 41s']);

    expect(col('Current play streak')!.value).toBe('5');
    expect(col('Current 1-go streak')!.value).toBe('0');
    expect(stat('Plays')).toBe('5');
    expect(stat('First-go wins')).toBe('1 (20%)');
    expect(stat('Average goes')).toBe('2.4');
    expect(stat('Average time')).toBe('4m 06s'); // (221+48+300+260+400)/5 = 245.8s
    expect(col('Fastest time')!.value).toBe('0m 48s');
  });

  it('shows only This game for a brand-new player, with the third-game line', async () => {
    await render([{ date: day(0), tries: 2, seconds: 100 }], 2, false, { seconds: 100 });
    expect(block('this-game')).not.toBeNull();
    expect(block('streak')).toBeNull();
    expect(block('all-time')).toBeNull();
    expect(text()).toContain('Your streaks and all-time stats start from your third game.');
  });

  it('still hides the other blocks on the second game', async () => {
    await render([
      { date: day(0), tries: 2 },
      { date: day(1), tries: 3 },
    ], 2);
    expect(block('streak')).toBeNull();
    expect(block('all-time')).toBeNull();
  });

  it('reveals the other blocks on the third game', async () => {
    await render([
      { date: day(0), tries: 2 },
      { date: day(1), tries: 3 },
      { date: day(2), tries: 3 },
    ], 2);
    expect(block('streak')).not.toBeNull();
    expect(block('records')).not.toBeNull();
    expect(block('all-time')).not.toBeNull();
  });

  it('treats a player who has just switched saving on as a new player (brief 131)', async () => {
    await render([{ date: day(0), tries: 2 }], 2);
    expect(text()).toContain('Your streaks and all-time stats start from your third game.');
  });

  it('shows only This game when score saving is off', async () => {
    await render(RETURNING, 2, false, { seconds: 221 }, { saveScore: false });
    expect(block('this-game')).not.toBeNull();
    expect(block('streak')).toBeNull();
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
    expect(block('streak')).toBeNull();
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
    expect(block('streak')).toBeNull();
    expect(block('all-time')).toBeNull();
    // No stopwatch figure at all, not an empty one — an archive replay carries
    // no timing (brief 54, and brief 36 for the shape).
    expect(figures()).toEqual(['3 goes']);
    expect(blockText('this-game')).not.toContain('3m 20s');
  });

  it('gives the figures no block heading at all (brief 62)', async () => {
    await render(RETURNING, 2, false, { seconds: 221 });
    expect(block('this-game')!.querySelector('h3')).toBeNull();
    expect(text()).not.toContain('This game');
    expect(text()).not.toContain('Today');
  });

  it('leads into the figures from the heading, and only when there are any (brief 63)', async () => {
    const heading = () => document.querySelector('[data-completion-heading]')!.textContent;
    await render(RETURNING, 2, false, { seconds: 221 });
    expect(heading()).toBe('Puzzle #157 solved! You took:');
    // A reload after a saving-off solve has neither figure, so the sentence
    // would lead into nothing.
    await render([{ date: day(0), tries: 0, marker: true }], null, false, {}, { saveScore: false });
    expect(heading()).toBe('Puzzle #157 solved!');
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
    // No heading now: the figures come first, then the note.
    expect(kids[0]).toBe('stat-today');
    expect(blockText('this-game')).toContain("Random puzzles don't count towards your stats.");
  });

  it('splits into Streak and Records, each with an icon (brief 64, 65, 66)', async () => {
    await render(RETURNING, 2, false, { seconds: 221 });

    expect(block('streak')!.querySelector('h3')!.textContent!.trim()).toBe('Streaks');
    expect(block('records')!.querySelector('h3')!.textContent!.trim()).toBe('Records');
    for (const id of ['streak', 'records']) {
      const icon = block(id)!.querySelector('h3 .stat-block__icon');
      expect(icon, `${id} heading icon`).not.toBeNull();
      expect(icon!.getAttribute('aria-hidden')).toBe('true');
    }

    expect(colLabels('streak')).toEqual(['Plays', '1-go solve', 'Avg. time']);
    expect(col('Current play streak')!.value).toBe('5');
    expect(col('Current 1-go streak')!.value).toBe('0');
    expect(col('Average time')!.value).toBe('4m 06s');

    expect(colLabels('records')).toEqual(['1-go streak', 'Fastest']);
    expect(col('Longest 1-go streak')!.value).toBe('1');
    expect(col('Fastest time')!.value).toBe('0m 48s');
  });

  it('colours Records with the second accent and Streak with the first (brief 70)', async () => {
    await render(RETURNING, 2, false, { seconds: 221 });
    for (const label of ['Longest 1-go streak', 'Fastest time']) {
      expect(col(label)!.isBest, label).toBe(true);
    }
    for (const label of ['Current play streak', 'Current 1-go streak', 'Average time']) {
      expect(col(label)!.isBest, label).toBe(false);
    }
  });

  it('gives every section a heading icon, and every box a watermark (brief 73, 76)', async () => {
    await render(RETURNING, 2, false, { seconds: 221 });
    // All three sections have one now, All time included.
    for (const id of ['streak', 'records', 'all-time']) {
      expect(block(id)!.querySelector('h3 .stat-block__icon'), id).not.toBeNull();
    }
    // One watermark per box, decorative, and no other icon inside a box.
    const marks = panel().querySelectorAll('.stat-col__mark');
    expect(marks.length).toBe(5);
    for (const mark of marks) expect(mark.getAttribute('aria-hidden')).toBe('true');
    for (const c of panel().querySelectorAll('.stat-col')) {
      expect(c.querySelectorAll('svg').length).toBe(1);
    }
    // The two figures under the solved message keep theirs.
    expect(panel().querySelectorAll('.stat-figure__icon').length).toBe(2);
  });

  it('drops the rule beside every heading (brief 73)', async () => {
    await render(RETURNING, 2, false, { seconds: 221 });
    expect(panel().querySelector('.stat-block__rule')).toBeNull();
  });

  it('says the short word on screen and the full one in speech', async () => {
    await render(RETURNING, 2, false, { seconds: 221 });
    // "Plays" means the streak here and the all-time total two blocks down, and
    // a screen reader has no column heading to tell them apart.
    expect(col('Current play streak')!.short).toBe('Plays');
    expect(col('Longest 1-go streak')!.short).toBe('1-go streak');
  });

  it('keeps every dt inside a dl, with dd after it', async () => {
    await render(RETURNING, 2, false, { seconds: 221 });
    for (const dt of panel().querySelectorAll('dt')) {
      expect(dt.closest('dl'), dt.textContent!).not.toBeNull();
    }
    // Label first in the DOM as well as on screen now (brief 67). The watermark
    // is a third child and comes last, so it never lands between the two.
    for (const el of panel().querySelectorAll('.stat-col')) {
      expect([...el.children].map((c) => c.tagName)).toEqual(['DT', 'DD', 'svg']);
    }
  });

  it('asks the player back tomorrow, under the streak columns (brief 69)', async () => {
    await render(RETURNING, 2, false, { seconds: 221 });
    // Under the heading and above the boxes, so it reads as the section's own
    // sentence rather than a footnote to the last number (brief 74).
    const kids = [...block('streak')!.children].map((el) => el.tagName);
    expect(kids).toEqual(['H3', 'P', 'DL']);
    expect(blockText('streak')).toContain('Come back tomorrow to maintain your streak!');
    expect(blockText('records')).not.toContain('Come back tomorrow');
  });

  it('shows a dash for a record nobody has yet', async () => {
    await render([
      { date: day(0), tries: 2 },
      { date: day(1), tries: 3 },
      { date: day(2), tries: 3 },
    ], 2);
    expect(col('Fastest time')!.value).toBe('—');
    expect(col('Average time')!.value).toBe('—');
  });

  it('puts no explanatory line under the Records columns (brief 45)', async () => {
    await render(RETURNING, 2, false, { seconds: 221 });
    expect(block('records')!.querySelector('.stat-note')).toBeNull();
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
    expect(col('Fastest time')!.value).toBe('1m 00s');
  });

  it('shows a dash for a figure nobody has data for', async () => {
    await render([
      { date: day(0), tries: 2 },
      { date: day(1), tries: 3 },
      { date: day(2), tries: 3 },
    ], 2);
    // A dash is right HERE — a box needs a placeholder rather than a gap.
    expect(stat('Average time')).toBe('—');
    expect(col('Fastest time')!.value).toBe('—');
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
