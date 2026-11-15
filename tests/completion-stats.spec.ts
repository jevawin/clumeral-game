import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { HistoryEntry } from '../src/types.ts';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// The results page as cards (results page redesign brief, board O): Today, the
// Daily leaderboard, Streaks and All time. It renders the real panel and reads it
// the way a player meets it — by heading and by label — instead of by box index.

function setupDOM(): void {
  document.body.innerHTML = `
    <div data-completion-octo></div>
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

function text(): string {
  return panel().textContent!.replace(/\s+/g, ' ').trim();
}

/** Every card in order, by its data-stat-block. */
function order(): string[] {
  return [...panel().querySelectorAll(':scope > section')].map((el) => (el as HTMLElement).dataset.statBlock!);
}

function collapse(el: Element | null): string {
  return (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
}

/** The ledger as label → value pairs, in order. */
function ledger(): [string, string][] {
  return [...panel().querySelectorAll('[data-ledger-row]')].map((row) => [
    collapse(row.querySelector('dt')),
    collapse(row.querySelector('dd')),
  ]);
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
    // The leaderboard's fetch is held forever: only its slot matters here.
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  describe('cards per mode (brief 14, 15)', () => {
    it('full with a time: Today, leaderboard, Streaks, All time', async () => {
      await render(RETURNING, 2, false, { seconds: 221 });
      expect(order()).toEqual(['today', 'daily-leaderboard', 'streak', 'all-time']);
    });

    it('full without a time: no leaderboard', async () => {
      await render(RETURNING, 2, false, {});
      expect(order()).toEqual(['today', 'streak', 'all-time']);
    });

    it('new: Today and the leaderboard, with the third-game note', async () => {
      await render([{ date: day(0), tries: 2, seconds: 100 }], 2, false, { seconds: 100 });
      expect(order()).toEqual(['today', 'daily-leaderboard']);
      expect(collapse(block('today'))).toContain('Your streaks and all-time stats start from your third game.');
    });

    it('new on the second game; full from the third', async () => {
      await render([{ date: day(0), tries: 2 }, { date: day(1), tries: 3 }], 2);
      expect(order()).toEqual(['today']);
      setupDOM();
      vi.resetModules();
      await render([{ date: day(0), tries: 2 }, { date: day(1), tries: 3 }, { date: day(2), tries: 3 }], 2);
      expect(order()).toEqual(['today', 'streak', 'all-time']);
    });

    it('saving-off: Today and the leaderboard', async () => {
      await render(RETURNING, 2, false, { seconds: 221 }, { saveScore: false });
      expect(order()).toEqual(['today', 'daily-leaderboard']);
    });

    it('marker: Today with the heading only', async () => {
      await render([{ date: day(0), tries: 0, marker: true }], null, false, {}, { saveScore: false });
      expect(order()).toEqual(['today']);
      expect([...block('today')!.children].map((el) => el.tagName)).toEqual(['H2']);
    });

    it('random: Today with the random note', async () => {
      await render(RETURNING, 2, true, { seconds: 221 });
      expect(order()).toEqual(['today']);
      expect(collapse(block('today'))).toContain("Random puzzles don't count towards your stats.");
    });

    it('archive: Today only', async () => {
      await render(RETURNING, 3, false, { activeDate: '2026-07-01', todayLocal: TODAY, seconds: 200 });
      expect(order()).toEqual(['today']);
    });

    it('says nothing at all about score saving, in any mode (P-01)', async () => {
      await render(RETURNING, 2, false, { seconds: 221 }, { saveScore: false });
      expect(text().toLowerCase()).not.toContain('saving');
      expect(panel().querySelector('input[type="checkbox"]')).toBeNull();
    });
  });

  describe('the Today card', () => {
    it('is the one h2: "Puzzle #N solved", solved in accent (brief 53, 63, 91)', async () => {
      await render(RETURNING, 2, false, { seconds: 221 });
      const h2s = panel().querySelectorAll('h2');
      expect(h2s.length).toBe(1);
      expect(h2s[0].hasAttribute('data-completion-heading')).toBe(true);
      expect(collapse(h2s[0])).toBe('Puzzle #157 solved');
      expect(h2s[0].querySelector('.result-card__solved')!.textContent).toBe('solved');
      expect(block('today')!.getAttribute('aria-labelledby')).toBe(h2s[0].id);
    });

    it('random reads "Puzzle solved"', async () => {
      await render(RETURNING, 2, true, { seconds: 221 });
      expect(collapse(panel().querySelector('h2'))).toBe('Puzzle solved');
    });

    it('has no section icon (brief 46)', async () => {
      await render(RETURNING, 2, false, { seconds: 221 });
      expect(block('today')!.querySelector('h2 svg')).toBeNull();
    });

    it('shows the figure line, and speaks the time in words (brief 54, 65)', async () => {
      await render(RETURNING, 2, false, { seconds: 221 });
      const fig = panel().querySelector('[data-today-figures]')!;
      expect(fig.querySelector('[aria-hidden="true"]')!.textContent).toBe('2 goes, 3m 41s');
      expect(fig.querySelector('.sr-only')!.textContent).toBe('2 goes, 3 minutes 41 seconds');
    });

    it('says "1 go", sentence form', async () => {
      await render(RETURNING, 1, false, { seconds: 41 });
      expect(panel().querySelector('[data-today-figures] [aria-hidden="true"]')!.textContent).toBe('1 go, 0m 41s');
    });

    it('drops the time with none, and in an archive replay', async () => {
      await render(RETURNING, 3, false, {});
      expect(collapse(panel().querySelector('[data-today-figures]'))).toBe('3 goes');
      setupDOM();
      vi.resetModules();
      await render(RETURNING, 3, false, { activeDate: '2026-07-01', todayLocal: TODAY, seconds: 200 });
      expect(collapse(panel().querySelector('[data-today-figures]'))).toBe('3 goes');
    });

    it('drops the figure line for a marker (brief 92)', async () => {
      await render([{ date: day(0), tries: 0, marker: true }], null, false, {}, { saveScore: false });
      expect(panel().querySelector('[data-today-figures]')).toBeNull();
      expect(text()).not.toContain('Solved!');
      expect(text()).not.toContain('Solved in');
    });

    it('shows the message in full mode (brief 17, 19)', async () => {
      // Earlier times 48, 300, 260, 400: best 48, mean 252. Today 221 → 31s quicker.
      await render(RETURNING, 2, false, { seconds: 221 });
      const msg = panel().querySelector('[data-today-message]')!;
      expect(collapse(msg)).toBe('31s quicker than your average.');
      expect(msg.querySelector('b')!.textContent).toBe('31s quicker');
      expect(msg.querySelector('use')!.getAttribute('href')).toBe('/sprites.svg#icon-arrow-up');
      expect(msg.querySelector('svg')!.getAttribute('aria-hidden')).toBe('true');
    });

    it('says fastest ever for a beaten best', async () => {
      await render(RETURNING, 2, false, { seconds: 30 });
      expect(collapse(panel().querySelector('[data-today-message]'))).toBe('Your fastest ever, 18s under your best.');
    });

    it('shows no message outside full mode', async () => {
      await render([{ date: day(0), tries: 2, seconds: 100 }], 2, false, { seconds: 100 });
      expect(panel().querySelector('[data-today-message]')).toBeNull();
      for (const args of [
        [RETURNING, 2, false, { seconds: 221 }, { saveScore: false }],
        [[{ date: day(0), tries: 0, marker: true }], null, false, {}, { saveScore: false }],
        [RETURNING, 2, true, { seconds: 221 }],
        [RETURNING, 3, false, { activeDate: '2026-07-01', todayLocal: TODAY, seconds: 200 }],
      ] as Parameters<typeof render>[]) {
        setupDOM();
        vi.resetModules();
        await render(...args);
        expect(panel().querySelector('[data-today-message]')).toBeNull();
      }
    });
  });

  describe('the Streaks card', () => {
    it('shows the play streak and the best (brief 20, 82)', async () => {
      await render(RETURNING, 2, false, { seconds: 221 });
      expect(collapse(panel().querySelector('[data-streak-figure]'))).toBe('5 days played');
      expect(collapse(panel().querySelector('[data-streak-line]'))).toBe('Best streak 5');
      expect(collapse(block('streak')!.querySelector('h3'))).toBe('Streaks');
      expect(block('streak')!.querySelector('h3 use')!.getAttribute('href')).toBe('/sprites.svg#icon-flame');
    });

    it('adds the one-go run from 2', async () => {
      await render([
        { date: day(0), tries: 1 }, { date: day(1), tries: 1 },
        { date: day(2), tries: 2 }, { date: day(3), tries: 2 },
      ], 1);
      expect(collapse(panel().querySelector('[data-streak-line]'))).toBe('Best streak 4 · One-go run 2');
    });

    it('names the harder run when they match, with no one-go part', async () => {
      await render([{ date: day(0), tries: 1 }, { date: day(1), tries: 1 }, { date: day(2), tries: 1 }], 1);
      expect(collapse(panel().querySelector('[data-streak-figure]'))).toBe('3 days solved in one');
      expect(collapse(panel().querySelector('[data-streak-line]'))).toBe('Best streak 3');
    });

    it('holds the goes strip, and nothing else does', async () => {
      await render(RETURNING, 2, false, { seconds: 221 });
      expect(panel().querySelectorAll('[data-strip-scroller]').length).toBe(1);
      expect(block('streak')!.querySelector('[data-strip-scroller]')).not.toBeNull();
      expect(block('streak')!.querySelectorAll('[data-strip-day]').length).toBe(5);
    });

    it('marks the panel with the strip style, the default on localhost', async () => {
      await render(RETURNING, 2, false, { seconds: 221 });
      expect(panel().dataset.stripVariant).toBe('faded-passing');
    });
  });

  describe('the All time card', () => {
    it('is a ledger in order (brief 25, 59, 69)', async () => {
      await render(RETURNING, 2, false, { seconds: 221 });
      expect(collapse(block('all-time')!.querySelector('h3'))).toBe('All time');
      expect(block('all-time')!.querySelector('h3 use')!.getAttribute('href')).toBe('/sprites.svg#icon-calendar-head');
      expect(block('all-time')!.querySelector('dl')).not.toBeNull();
      expect(ledger()).toEqual([
        ['Solved in one', '20%'],
        ['Best one-go run', '1'],
        ['Fastest solve', '0m 48s'],
        ['Puzzles solved', '5'],
      ]);
    });

    it('never solved in one: 0% and 0; no time: a dash', async () => {
      await render([{ date: day(0), tries: 2 }, { date: day(1), tries: 3 }, { date: day(2), tries: 3 }], 2);
      expect(ledger()).toEqual([
        ['Solved in one', '0%'],
        ['Best one-go run', '0'],
        ['Fastest solve', '—'],
        ['Puzzles solved', '3'],
      ]);
    });
  });

  it('gives every card but Today an h3 with a hidden icon (brief 44, 62, 66)', async () => {
    await render(RETURNING, 2, false, { seconds: 221 });
    for (const id of ['streak', 'all-time']) {
      const card = block(id)!;
      expect(card.className).toBe('result-card');
      const h3 = card.querySelector('h3')!;
      expect(card.getAttribute('aria-labelledby')).toBe(h3.id);
      expect(h3.querySelector('svg')!.getAttribute('aria-hidden')).toBe('true');
    }
  });

  it('drops the old panel entirely (brief 26, 27, 76)', async () => {
    await render(RETURNING, 2, false, { seconds: 221 });
    const html = panel().innerHTML;
    for (const gone of ['stat-col', 'stat-col__mark', 'data-goes-row', 'Attempts distribution', 'Records',
      'Average attempts', 'Avg. time', 'Come back tomorrow', 'You took', 'accent-2', 'accent-3', 'accent-4']) {
      expect(html, gone).not.toContain(gone);
    }
  });

  it('writes the countdown with the time in bold (brief 61)', async () => {
    await render(RETURNING, 2, false, { seconds: 221 });
    const cd = document.querySelector('[data-completion-countdown]')!;
    expect(cd.firstChild!.nodeType).toBe(Node.TEXT_NODE);
    expect(cd.firstChild!.textContent).toBe('Next puzzle in ');
    expect(cd.querySelector('b')!.textContent).toBe('14h 0m');
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

// Both the /play sentence and the panel reach innerHTML, and `tries` comes from
// dlng_history, which loadHistory does not validate — unlike loadActive and
// loadUndo next door.
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

  it('puts no markup in the panel when the stored row is forged', async () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
    const bad = '<img src=x onerror=alert(1)>';
    await render(
      [{ date: day(0), tries: bad as unknown as number }],
      bad as unknown as number,
    );
    expect(panel().querySelector('img')).toBeNull();
    expect(panel().querySelector('[data-today-figures]')).toBeNull();
    vi.unstubAllGlobals();
  });

  it('keeps a forged row out of the strip, the ledger and the message', async () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
    const bad = '<img src=x onerror=alert(1)>';
    await render([
      { date: day(0), tries: 2, seconds: 60 },
      { date: day(1), tries: bad as unknown as number },
      { date: day(2), tries: 1, seconds: bad as unknown as number },
      { date: day(3), tries: 3, seconds: 90 },
      { date: day(4), tries: 2, seconds: 80 },
    ], 2, false, { seconds: 60 });
    expect(panel().querySelector('img')).toBeNull();
    expect(block('streak')!.querySelectorAll('[data-strip-day]').length).toBe(4);
    expect(panel().querySelector('[data-today-message]')).not.toBeNull();
    expect(panel().innerHTML).not.toContain('onerror');
    vi.unstubAllGlobals();
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

// The "Daily leaderboard" slot (time chart brief items 4, 22, 46, 53). Only the
// slot is tested here; tests/time-chart-view.spec.ts covers what is drawn in it.
describe('the time chart slot', () => {
  beforeEach(() => {
    setupDOM();
    vi.resetModules();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(TODAY + 'T10:00:00'));
    // Held forever, so the slot stays in its reserved state.
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  const slot = () => panel().querySelector<HTMLElement>('[data-time-chart]');

  it('sits empty and busy straight after this game, above the streaks, in full mode', async () => {
    await render(RETURNING, 2, false, { seconds: 221 });
    expect(slot()).not.toBeNull();
    expect(slot()!.innerHTML).toBe('');
    expect(slot()!.getAttribute('aria-busy')).toBe('true');
    expect(order().slice(0, 3)).toEqual(['today', 'daily-leaderboard', 'streak']);
  });

  it('is there in new and saving-off modes', async () => {
    await render([{ date: day(0), tries: 2, seconds: 100 }], 2, false, { seconds: 100 });
    expect(slot()?.getAttribute('aria-busy')).toBe('true');
    setupDOM();
    vi.resetModules();
    await render([{ date: day(0), tries: 0, marker: true }], 2, false, { seconds: 41 }, { saveScore: false });
    expect(slot()?.getAttribute('aria-busy')).toBe('true');
  });

  it('is absent for random, archive and marker, and without a time', async () => {
    await render(RETURNING, 2, true, { seconds: 221 });
    expect(slot()).toBeNull();
    await render(RETURNING, 3, false, { activeDate: '2026-07-01', todayLocal: TODAY, seconds: 200 });
    expect(slot()).toBeNull();
    await render([{ date: day(0), tries: 0, marker: true }], null, false, {}, { saveScore: false });
    expect(slot()).toBeNull();
    await render(RETURNING, 2, false, {});
    expect(slot()).toBeNull();
    // A 0s own time is junk (item 87) and would beat every real player, since
    // the server drops 0s rows (Fable review L1).
    await render(RETURNING, 2, false, { seconds: 0 });
    expect(slot()).toBeNull();
  });
});
